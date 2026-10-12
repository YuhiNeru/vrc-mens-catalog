"""Single-request public BOOTH collector. SQLite transactions own the cursor."""
import datetime as dt
import email.utils
import gzip
import json
import os
import pathlib
import signal
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import traceback
import base64

UTC=dt.timezone.utc
JST=dt.timezone(dt.timedelta(hours=9))
STOP=threading.Event()
ROOT=pathlib.Path(os.environ.get('VRC_DATA','/var/lib/vrc-mens-collector'))
APP=pathlib.Path(__file__).resolve().parent
def now(): return dt.datetime.now(UTC).isoformat().replace('+00:00','Z')
def connect(root=ROOT):
    root.mkdir(parents=True,exist_ok=True)
    db=sqlite3.connect(root/'collector.sqlite',timeout=30)
    db.execute('PRAGMA journal_mode=WAL'); db.execute('PRAGMA synchronous=FULL'); db.execute('PRAGMA cache_size=-4096')
    db.executescript('''
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,payload TEXT NOT NULL,fetched_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS compatibility(product_id TEXT,target_type TEXT,target_id TEXT,payload TEXT,PRIMARY KEY(product_id,target_type,target_id));
    CREATE TABLE IF NOT EXISTS queue(pos INTEGER PRIMARY KEY,product_id TEXT UNIQUE,status TEXT NOT NULL,error TEXT,updated_at TEXT);
    CREATE TABLE IF NOT EXISTS budgets(day TEXT PRIMARY KEY,used INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS changes(seq INTEGER PRIMARY KEY AUTOINCREMENT,product_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS overrides(entity TEXT,entity_key TEXT,patch TEXT,PRIMARY KEY(entity,entity_key));
    CREATE TABLE IF NOT EXISTS classifications(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cached_queue(product_id TEXT PRIMARY KEY);
    CREATE INDEX IF NOT EXISTS queue_status_pos ON queue(status,pos);
    ''')
    return db
def get(db,key,default=None):
    row=db.execute('SELECT value FROM meta WHERE key=?',(key,)).fetchone()
    return json.loads(row[0]) if row else default
def put(db,key,value): db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)',(key,json.dumps(value,ensure_ascii=False)))
def status(db,root=ROOT):
    own_transaction=not db.in_transaction
    if own_transaction:db.execute('BEGIN')
    result={k:get(db,k) for k in ('runId','phase','cursor','total','downloaded','cached','failed','added','requests','likesCursor','retryAt','reason','lastProductAt','lastRequestAt','lastRequestStatus','lastDownloadAt','migrationCursor')}
    pending=db.execute("SELECT count(*) FROM queue WHERE status='pending'").fetchone()[0]
    result.update(updatedAt=now(),productsStored=db.execute('SELECT count(*) FROM products').fetchone()[0],pending=pending,processed=(get(db,'total',0)-pending),accessories=len(get(db,'accessoryIds',[])),changeSequence=db.execute('SELECT coalesce(max(seq),0) FROM changes').fetchone()[0])
    if own_transaction:db.commit()
    temp=root/f'progress.{os.getpid()}.tmp';temp.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8');temp.replace(root/'progress.json')
    return result
class Halt(Exception):
    def __init__(self,reason,until=None): self.reason,self.until=reason,until
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
class Fetcher:
    def __init__(self,db): self.db=db;self.last=0;self.opener=urllib.request.build_opener(NoRedirect());self.rate_errors=get(db,'consecutiveRateLimits',0)
    def get(self,url):
        u=urllib.parse.urlparse(url)
        if u.scheme!='https' or u.hostname not in ('booth.pm','accounts.booth.pm') or u.username or u.password or u.port: raise Halt('invalid_url')
        for attempt in range(2):
            if STOP.wait(max(0,3-(time.monotonic()-self.last))): raise Halt('shutdown')
            today=dt.datetime.now(JST).date();day=today.isoformat()
            used=self.db.execute('SELECT used FROM budgets WHERE day=?',(day,)).fetchone()
            if used and used[0]>=12000:
                until=dt.datetime.combine(today+dt.timedelta(days=1),dt.time(0,1),JST).timestamp()
                raise Halt('daily_budget',until)
            with self.db:
                self.db.execute('INSERT INTO budgets VALUES(?,1) ON CONFLICT(day) DO UPDATE SET used=used+1',(day,));put(self.db,'requests',get(self.db,'requests',0)+1);put(self.db,'lastRequestAt',now())
            self.last=time.monotonic()
            try:
                request=urllib.request.Request(url,headers={'User-Agent':'vrc-mens-catalog/0.1 (public metadata catalog)','Accept-Encoding':'identity'})
                with self.opener.open(request,timeout=20) as response:
                    body=response.read(8*1024*1024+1)
                    if len(body)>8*1024*1024: raise Halt('response_too_large')
                    with self.db:put(self.db,'lastRequestStatus',response.status)
                    if not u.path.endswith('/robots.txt'):
                        self.rate_errors=0
                        with self.db:put(self.db,'consecutiveRateLimits',0)
                    return body.decode('utf8')
            except urllib.error.HTTPError as error:
                code=error.code
                with self.db:put(self.db,'lastRequestStatus',code)
                if code in (401,403) or 300<=code<400: raise Halt('access_restricted_'+str(code))
                if code==429:
                    self.rate_errors+=1
                    with self.db:put(self.db,'consecutiveRateLimits',self.rate_errors)
                    if self.rate_errors>5: raise Halt('repeated_rate_limit')
                    retry=error.headers.get('Retry-After','60')
                    try: until=time.time()+max(1,int(retry))
                    except ValueError:
                        try: until=max(time.time()+1,email.utils.parsedate_to_datetime(retry).timestamp())
                        except Exception: until=time.time()+60
                    raise Halt('rate_limit',until)
                if code>=500:
                    if attempt==0:
                        if STOP.wait(2): raise Halt('shutdown')
                        continue
                    raise Halt('http_5xx',time.time()+60)
                raise ValueError('http_'+str(code)) from None
            except (urllib.error.URLError,TimeoutError,OSError):
                if attempt==0:
                    if STOP.wait(2): raise Halt('shutdown')
                    continue
                raise Halt('network_timeout',time.time()+60)
class Parser:
    def __init__(self,root=ROOT): self.root=root;self.child=None;self.count=0
    def close(self):
        if self.child:
            try:self.child.stdin.close()
            except BrokenPipeError:pass
            try:self.child.wait(timeout=5)
            except subprocess.TimeoutExpired:self.child.kill();self.child.wait()
            self.child=None
    def call(self,request):
        if not self.child or self.count>=50:
            self.close();self.count=0
            node=os.environ.get('VRC_NODE',str(APP/'runtime/bin/node'))
            self.child=subprocess.Popen([node,'--max-old-space-size=160',str(APP/'parser.mjs'),str(self.root/'seed.json')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,text=True,encoding='utf8')
        request['rpc']=self.count
        frame=base64.b64encode(json.dumps(request,ensure_ascii=False).encode('utf8')).decode('ascii')
        self.child.stdin.write(frame+'\n');self.child.stdin.flush()
        line=self.child.stdout.readline();self.count+=1
        if not line: raise Halt('shutdown' if STOP.is_set() else 'parser_failed')
        result=json.loads(base64.b64decode(line))
        if result.get('rpc')!=request['rpc']:
            print(json.dumps(dict(event='parser_protocol_error',requestAction=request.get('action','product'),expected=request['rpc'],received=result.get('rpc'),stage=result.get('stage'),kind=result.get('kind'),bytes=result.get('bytes'))),flush=True)
            raise Halt('parser_protocol_error')
        if result.get('error')=='challenge': raise Halt('access_challenge')
        if result.get('error'):
            print(json.dumps(dict(event='parser_error',requestAction=request.get('action','product'),stage=result.get('stage'),kind=result.get('kind'),bytes=result.get('bytes'))),flush=True)
            raise ValueError('parse_error')
        return result
def store_result(db,pos,result,cached):
    p=result['product'];pid=p['id'];review=result.get('review')
    with db:
        old=db.execute('SELECT fetched_at FROM products WHERE id=?',(pid,)).fetchone()
        if not old or p['fetchedAt']>=old[0]:
            db.execute('INSERT OR REPLACE INTO products VALUES(?,?,?)',(pid,json.dumps(p,ensure_ascii=False),p['fetchedAt']))
            db.execute('DELETE FROM compatibility WHERE product_id=?',(pid,))
            for r in result['compatibility']:db.execute('INSERT OR REPLACE INTO compatibility VALUES(?,?,?,?)',(pid,r['targetType'],r['targetId'],json.dumps(r,ensure_ascii=False)))
        if review:
            db.execute('INSERT OR REPLACE INTO overrides VALUES(?,?,?)',('product',pid,json.dumps(dict(kind='accessory',category=review['category'],review='verified'),ensure_ascii=False)))
            for r in review['relations']:
                patch={k:r[k] for k in ('fit','review','evidence','variantNames')}
                db.execute('INSERT OR REPLACE INTO overrides VALUES(?,?,?)',('compatibility',pid+':'+r['targetType']+':'+r['targetId'],json.dumps(patch,ensure_ascii=False)))
            classification=dict(id=pid,category=review['category'],evidence='作者の対応一覧・販売版を照合。',fetchedAt=p['fetchedAt'])
            db.execute('INSERT OR REPLACE INTO classifications VALUES(?,?)',(pid,json.dumps(classification,ensure_ascii=False)))
            ids=get(db,'accessoryIds',[])
            if pid not in ids:ids.append(pid);put(db,'accessoryIds',ids);put(db,'added',get(db,'added',0)+1)
        db.execute('INSERT INTO changes(product_id) VALUES(?)',(pid,))
        db.execute("UPDATE queue SET status='done',error=NULL,updated_at=? WHERE pos=?",(now(),pos))
        frontier=db.execute("SELECT min(pos) FROM queue WHERE status='pending'").fetchone()[0]
        put(db,'cursor',frontier if frontier is not None else get(db,'total',pos+1));put(db,'cached' if cached else 'downloaded',get(db,'cached' if cached else 'downloaded',0)+1);put(db,'lastProductAt',now())
        if not cached:put(db,'lastDownloadAt',now())
def process_product(db,fetcher,parser,pos,pid,root=ROOT):
    url='https://booth.pm/ja/items/'+pid;raw=root/'raw'/f'{pid}.html';gz=raw.with_suffix('.html.gz')
    row=db.execute('SELECT payload FROM products WHERE id=?',(pid,)).fetchone();existing=json.loads(row[0]) if row else None
    cached=raw.exists() or gz.exists()
    if cached:
        html=gzip.open(gz,'rt',encoding='utf8').read() if gz.exists() else raw.read_text(encoding='utf8')
        stamp=existing['fetchedAt'] if existing else dt.datetime.fromtimestamp((gz if gz.exists() else raw).stat().st_mtime,UTC).isoformat().replace('+00:00','Z')
    else:
        html=fetcher.get(url);stamp=now();gz.parent.mkdir(exist_ok=True)
        temp=gz.with_suffix('.tmp')
        with gzip.open(temp,'wt',encoding='utf8') as f:f.write(html)
        temp.replace(gz)
    compat=[json.loads(r[0]) for r in db.execute('SELECT payload FROM compatibility WHERE product_id=?',(pid,))]
    result=parser.call(dict(html=html,url=url,fetchedAt=stamp,existing=existing,compatibility=compat))
    store_result(db,pos,result,cached)
def run(root=ROOT):
    db=connect(root);parser=Parser(root);fetcher=Fetcher(db);errors=0
    if get(db,'phase') in ('stopped','complete'):status(db,root);return 0
    try:
        while not STOP.is_set():
            until=get(db,'retryAt',0) or 0
            if until>time.time():
                # Budget waits do not prevent processing already downloaded public pages.
                # The frontier remains the first unfinished position, even if cached rows ahead are done.
                cache_path=root/'robots-cache.json'
                cached_row=db.execute("SELECT q.pos,q.product_id FROM queue q JOIN cached_queue c ON c.product_id=q.product_id WHERE q.status='pending' ORDER BY q.pos LIMIT 1").fetchone()
                if cached_row and cache_path.exists() and get(db,'reason','').startswith('daily'):
                    robots_cache=json.loads(cache_path.read_text(encoding='utf8'))
                    checked=dt.datetime.fromisoformat(robots_cache['at'].replace('Z','+00:00'))
                    if time.time()-checked.timestamp()<86400:
                        if not parser.call(dict(action='robots',text=robots_cache['text'],path='/ja/items/'+cached_row[1]))['allowed']:raise Halt('robots_disallow')
                        try:process_product(db,fetcher,parser,*cached_row,root)
                        except ValueError:
                            with db:
                                db.execute("UPDATE queue SET status='failed',error='parse_error',updated_at=? WHERE pos=?",(now(),cached_row[0]));put(db,'failed',get(db,'failed',0)+1)
                        status(db,root);continue
                status(db,root);STOP.wait(min(60,until-time.time()));continue
            try:
                robots=fetcher.get('https://booth.pm/robots.txt')
                (root/'robots-cache.json').write_text(json.dumps(dict(at=now(),text=robots)),encoding='utf8')
                if not parser.call(dict(action='robots',text=robots,path='/ja/items/1'))['allowed']:raise Halt('robots_disallow')
                with db:put(db,'retryAt',None);put(db,'reason','');put(db,'phase','products')
                while not STOP.is_set():
                    row=db.execute("SELECT pos,product_id FROM queue WHERE status='pending' ORDER BY pos LIMIT 1").fetchone()
                    if not row:break
                    pos,pid=row
                    try:
                        if not parser.call(dict(action='robots',text=robots,path='/ja/items/'+pid))['allowed']:raise Halt('robots_disallow')
                        process_product(db,fetcher,parser,pos,pid,root);errors=0
                    except ValueError as error:
                        reason=str(error) if str(error).startswith('http_') else 'parse_error'
                        with db:
                            db.execute("UPDATE queue SET status='failed',error=?,updated_at=? WHERE pos=?",(reason,now(),pos));frontier=db.execute("SELECT min(pos) FROM queue WHERE status='pending'").fetchone()[0];put(db,'cursor',frontier if frontier is not None else get(db,'total'));put(db,'failed',get(db,'failed',0)+1);put(db,'lastProductAt',now())
                        print(json.dumps(dict(event='item_failed',id=pid,reason=reason)),flush=True)
                    status(db,root)
                    if (pos+1)%25==0:print(json.dumps(dict(event='progress',cursor=pos+1,total=get(db,'total'))),flush=True)
                if STOP.is_set():break
                with db:put(db,'phase','likes')
                account_robots=fetcher.get('https://accounts.booth.pm/robots.txt')
                if not parser.call(dict(action='robots',text=account_robots,path='/wish_lists.json'))['allowed']:raise Halt('robots_disallow_likes')
                ids=get(db,'accessoryIds',[])
                while get(db,'likesCursor',0)<len(ids) and not STOP.is_set():
                    cursor=get(db,'likesCursor',0);batch=ids[cursor:cursor+24]
                    url='https://accounts.booth.pm/wish_lists.json?'+urllib.parse.urlencode([('item_ids[]',i) for i in batch])
                    counts=parser.call(dict(action='likes',text=fetcher.get(url),ids=batch))['counts']
                    with db:
                        for pid,count in counts.items():
                            row=db.execute('SELECT payload FROM products WHERE id=?',(pid,)).fetchone()
                            if row:
                                p=json.loads(row[0]);p.update(likes=count,likesFetchedAt=now());db.execute('UPDATE products SET payload=? WHERE id=?',(json.dumps(p,ensure_ascii=False),pid));db.execute('INSERT INTO changes(product_id) VALUES(?)',(pid,))
                        put(db,'likesCursor',cursor+len(batch))
                    status(db,root)
                if not STOP.is_set():
                    with db:put(db,'phase','complete');put(db,'reason','')
                    status(db,root);print('{"event":"complete"}',flush=True);return 0
            except Halt as halt:
                if halt.reason=='shutdown':break
                if halt.reason in ('network_timeout','http_5xx'):
                    errors+=1
                    if errors>=5:halt=Halt('persistent_network_error')
                with db:put(db,'phase','waiting' if halt.until else 'stopped');put(db,'reason',halt.reason);put(db,'retryAt',halt.until)
                status(db,root);print(json.dumps(dict(event='wait' if halt.until else 'stopped',reason=halt.reason)),flush=True)
                if not halt.until:return 20
    finally:
        parser.close();status(db,root);db.close()
    return 0
if __name__=='__main__':
    import fcntl
    ROOT.mkdir(parents=True,exist_ok=True)
    lock=(ROOT/'worker.lock').open('a')
    try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:
        print('{"event":"stopped","reason":"worker_already_running"}',flush=True);sys.exit(20)
    signal.signal(signal.SIGTERM,lambda *_:STOP.set());signal.signal(signal.SIGINT,lambda *_:STOP.set())
    try:sys.exit(run())
    except Exception as error:
        # Do not log response bodies, headers, cookies or arbitrary exception text.
        db=connect()
        if isinstance(error,Halt) and error.reason=='shutdown':status(db);sys.exit(0)
        reason=error.reason if isinstance(error,Halt) else 'internal_error'
        with db:put(db,'phase','stopped');put(db,'reason',reason)
        status(db);print(json.dumps(dict(event='stopped',reason=reason,kind=type(error).__name__,locations=[dict(file=pathlib.Path(frame.filename).name,line=frame.lineno) for frame in traceback.extract_tb(error.__traceback__)])),flush=True);sys.exit(20)
