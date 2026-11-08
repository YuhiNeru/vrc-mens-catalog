"""Bounded maintenance for the completed catalog; shares BOOTH limits and lock."""
import argparse
import json
import pathlib
import gzip
import os
import signal
import sys
import urllib.parse
import worker as w

def today(): return w.dt.datetime.now(w.JST).date().isoformat()
def used(db):
    row=db.execute('SELECT used FROM daily_budgets WHERE day=?',(today(),)).fetchone()
    return row[0] if row else 0
def product_request_cutoff(accessory_count):
    # Reserve enough requests for likes even when the catalog grows.
    return max(0,500-max(100,(accessory_count+23)//24+2))
def product_cutoff(db,root):
    watched=json.loads((root/'watchlist.json').read_text(encoding='utf8')).get('accessoryIds',[]) if (root/'watchlist.json').exists() else []
    if not isinstance(watched,list) or any(not isinstance(pid,str) or not pid.isdigit() for pid in watched):raise w.Halt('invalid_watchlist')
    return product_request_cutoff(len(set(w.get(db,'accessoryIds',[])+watched)))
def setup(db):
    db.execute('CREATE TABLE IF NOT EXISTS daily_queue(id TEXT PRIMARY KEY,priority INTEGER NOT NULL,added_at TEXT NOT NULL,error TEXT)')
    db.execute('CREATE INDEX IF NOT EXISTS daily_queue_priority ON daily_queue(priority,added_at)')
    db.commit()
def state(db): return w.get(db,'daily',{})
def save(db,s):
    s['updatedAt']=w.now()
    with db:w.put(db,'daily',s)
def status(db):
    return dict(**state(db),requestsToday=used(db),pending=db.execute('SELECT count(*) FROM daily_queue').fetchone()[0])
def plan(db,root):
    seed=json.loads((root/'seed.json').read_text(encoding='utf8'))
    sources=[]
    for index,source in enumerate(seed['state']['sources']):
        sources.append(dict(url=source['url'],pages=3 if index==0 else 1))
    cutoff=(w.dt.datetime.now(w.UTC)-w.dt.timedelta(days=7)).isoformat().replace('+00:00','Z')
    watchlist=json.loads((root/'watchlist.json').read_text(encoding='utf8')).get('ids',[]) if (root/'watchlist.json').exists() else []
    if not isinstance(watchlist,list) or len(watchlist)>20000 or any(not isinstance(pid,str) or not pid.isdigit() for pid in watchlist):raise w.Halt('invalid_watchlist')
    # Only known catalog items need ongoing price/compatibility checks. The
    # 80,000 unrelated discovery candidates do not crowd out published items.
    rows=db.execute("""SELECT id FROM products WHERE fetched_at<? AND
      (json_extract(payload,'$.review')='verified' OR id IN (SELECT id FROM classifications)
       OR id IN (SELECT entity_key FROM overrides WHERE entity='product' AND json_extract(patch,'$.review')='verified')
       OR id IN (SELECT value FROM json_each(?)))
      ORDER BY fetched_at,id LIMIT 400""",(cutoff,json.dumps(watchlist))).fetchall()
    with db:
        for (pid,) in rows:db.execute('INSERT OR IGNORE INTO daily_queue VALUES(?,1,?,NULL)',(pid,w.now()))
    return dict(day=today(),phase='search',sources=sources,source=0,page=1,next=sources[0]['url'] if sources else None,likesCursor=0,updated=0,discovered=0,failed=0,reason='',retryAt=None,startedAt=w.now())
def enqueue(db,urls):
    count=0
    with db:
        for url in urls:
            path=urllib.parse.urlparse(url).path;pid=path.rstrip('/').split('/')[-1]
            if not pid.isdigit():raise w.Halt('invalid_search_item')
            if db.execute('SELECT 1 FROM products WHERE id=?',(pid,)).fetchone():continue
            count+=db.execute('INSERT OR IGNORE INTO daily_queue VALUES(?,0,?,NULL)',(pid,w.now())).rowcount
    return count
def store_product(db,result,protected):
    p=result['product'];pid=p['id'];review=result.get('review')
    old=db.execute('SELECT payload FROM products WHERE id=?',(pid,)).fetchone()
    if old:
        old=json.loads(old[0]);p['likes']=old.get('likes');p['likesFetchedAt']=old.get('likesFetchedAt')
    rs=result['compatibility']
    if pid in protected and old:
        for key in ('kind','category','review'):
            if key in old:p[key]=old[key]
        retained=[json.loads(row[0]) for row in db.execute('SELECT payload FROM compatibility WHERE product_id=?',(pid,))]
        merged={(r['targetType'],r['targetId']):r for r in rs}
        for r in retained:
            if r.get('review')=='verified':merged[(r['targetType'],r['targetId'])]=r
        rs=list(merged.values())
    with db:
        if pid not in protected:
            # Daily automatic decisions live in crawl payloads. Retract initial
            # automatic overrides when no longer supported; local manual edits
            # are preserved separately by the Windows sync adapter.
            db.execute("DELETE FROM overrides WHERE (entity='product' AND entity_key=?) OR (entity='compatibility' AND entity_key LIKE ?)",(pid,pid+':%'))
            if review:
                p.update(kind='accessory',category=review['category'],review='verified')
                rs=review['relations']
                db.execute('INSERT OR REPLACE INTO classifications VALUES(?,?)',(pid,json.dumps(dict(id=pid,category=review['category'],evidence='作者の対応一覧・販売版を日次照合。',fetchedAt=p['fetchedAt']),ensure_ascii=False)))
            elif db.execute('SELECT 1 FROM classifications WHERE id=?',(pid,)).fetchone():
                p['review']='candidate';db.execute('DELETE FROM classifications WHERE id=?',(pid,))
        ids=w.get(db,'accessoryIds',[])
        if review and pid not in ids:ids.append(pid)
        elif not review and pid not in protected and pid in ids:ids.remove(pid)
        w.put(db,'accessoryIds',ids)
        db.execute('INSERT OR REPLACE INTO products VALUES(?,?,?)',(pid,json.dumps(p,ensure_ascii=False),p['fetchedAt']))
        db.execute('DELETE FROM compatibility WHERE product_id=?',(pid,))
        for r in rs:db.execute('INSERT INTO compatibility VALUES(?,?,?,?)',(pid,r['targetType'],r['targetId'],json.dumps(r,ensure_ascii=False)))
        db.execute('INSERT INTO changes(product_id) VALUES(?)',(pid,))
        db.execute('DELETE FROM daily_queue WHERE id=?',(pid,))
def update_product(db,fetcher,parser,pid,root,protected):
    url='https://booth.pm/ja/items/'+pid
    html=fetcher.get(url)
    result=parser.call(dict(html=html,url=url,fetchedAt=w.now()))
    # Never replace a good cached page with a failed/challenge response.
    raw=root/'raw'/f'{pid}.html.gz';raw.parent.mkdir(exist_ok=True)
    temp=raw.with_suffix('.tmp')
    with gzip.open(temp,'wt',encoding='utf8') as f:f.write(html)
    temp.replace(raw)
    store_product(db,result,protected)
def next_product(db,s):
    # Reserve capacity for stale catalog items even on days with many new hits.
    if s.get('newUpdated',0)>=s.get('newLimit',230) and s.get('staleUpdated',0)<100:
        stale=db.execute('SELECT id FROM daily_queue WHERE priority=1 ORDER BY added_at,id LIMIT 1').fetchone()
        if stale:return stale
    return db.execute('SELECT id FROM daily_queue ORDER BY priority,added_at,id LIMIT 1').fetchone()
def refresh_one(root,pid):
    db=w.connect(root);setup(db);parser=w.Parser(root);fetcher=w.Fetcher(db,daily=True)
    try:
        s=state(db)
        if s.get('phase')=='stopped' or (s.get('retryAt') or 0)>w.time.time():raise w.Halt('daily_not_resumable')
        watchlist=json.loads((root/'watchlist.json').read_text(encoding='utf8'))['ids']
        if not pid.isdigit() or pid not in watchlist:raise w.Halt('refresh_requires_catalog_item')
        robots=fetcher.get('https://booth.pm/robots.txt')
        if not parser.call(dict(action='robots',text=robots,path='/ja/items/'+pid))['allowed']:raise w.Halt('robots_disallow')
        protected=set(json.loads((root/'seed.json').read_text(encoding='utf8'))['protectedIds'])
        update_product(db,fetcher,parser,pid,root,protected)
        p=json.loads(db.execute('SELECT payload FROM products WHERE id=?',(pid,)).fetchone()[0])
        s.update(lastManualRefresh=w.now(),lastManualRefreshId=pid);save(db,s)
        print(json.dumps(dict(refreshed=pid,fetchedAt=p['fetchedAt'],priceMin=p.get('priceMin'),priceMax=p.get('priceMax'))),flush=True)
        return 0
    finally:parser.close();db.close()
def run(root=w.ROOT,max_products=None):
    db=w.connect(root);setup(db)
    parser=w.Parser(root);fetcher=w.Fetcher(db,daily=True)
    try:
        if w.get(db,'phase')!='complete':raise w.Halt('initial_collection_not_complete')
        s=state(db)
        if s.get('phase')=='stopped':return 20
        if (s.get('retryAt') or 0)>w.time.time():return 0
        if s.get('day')==today() and s.get('phase')=='complete':return 0
        if s.get('day')!=today():s=plan(db,root);save(db,s)
        if s.get('phase')=='waiting':s['phase']=s.get('resumePhase','search');save(db,s)
        seed=json.loads((root/'seed.json').read_text(encoding='utf8'));protected=set(seed['protectedIds'])
        robots=fetcher.get('https://booth.pm/robots.txt')
        def allowed(url,text=robots):
            if not parser.call(dict(action='robots',text=text,path=urllib.parse.urlparse(url).path))['allowed']:raise w.Halt('robots_disallow')
        s.update(reason='',retryAt=None);save(db,s)
        while s['phase']=='search' and not w.STOP.is_set():
            if s['source']>=len(s['sources']):s['phase']='products';save(db,s);break
            url=s['next'];allowed(url)
            result=parser.call(dict(action='search',html=fetcher.get(url),url=url))
            s['networkFailures']=0
            s['discovered']+=enqueue(db,result['urls'])
            if result['next'] and s['page']<s['sources'][s['source']]['pages']:
                s['page']+=1;s['next']=result['next']
            else:
                s['source']+=1;s['page']=1
                s['next']=s['sources'][s['source']]['url'] if s['source']<len(s['sources']) else None
            save(db,s)
        processed=0
        if s['phase']=='products' and 'newLimit' not in s:
            s['newLimit']=s.get('newUpdated',0)+max(0,product_cutoff(db,root)-used(db)-100);save(db,s)
        while s['phase']=='products' and not w.STOP.is_set():
            row=next_product(db,s)
            if not row or used(db)>=product_cutoff(db,root) or max_products is not None and processed>=max_products:
                s['phase']='likes';save(db,s);break
            pid=row[0];url='https://booth.pm/ja/items/'+pid;allowed(url)
            existing=db.execute('SELECT 1 FROM products WHERE id=?',(pid,)).fetchone()
            try:
                update_product(db,fetcher,parser,pid,root,protected);s['updated']+=1
                s['networkFailures']=0
                metric='staleUpdated' if existing else 'newUpdated';s[metric]=s.get(metric,0)+1
            except ValueError as error:
                # A 404 does not erase an existing product. Failed pages are
                # retried on their next stale refresh, without looping today.
                with db:db.execute('DELETE FROM daily_queue WHERE id=?',(pid,))
                s['failed']+=1;s['lastFailure']='http_404' if str(error)=='http_404' else 'parse_error'
            processed+=1;save(db,s)
        if s['phase']=='likes' and not w.STOP.is_set():
            account=fetcher.get('https://accounts.booth.pm/robots.txt')
            allowed('https://accounts.booth.pm/wish_lists.json',account)
            if 'likesIds' not in s:
                local_ids=json.loads((root/'watchlist.json').read_text(encoding='utf8')).get('accessoryIds',[]) if (root/'watchlist.json').exists() else []
                if not isinstance(local_ids,list) or len(local_ids)>20000 or any(not isinstance(pid,str) or not pid.isdigit() for pid in local_ids):raise w.Halt('invalid_watchlist')
                s['likesIds']=list(dict.fromkeys(w.get(db,'accessoryIds',[])+local_ids));save(db,s)
            ids=s['likesIds']
            while s['likesCursor']<len(ids) and not w.STOP.is_set():
                batch=ids[s['likesCursor']:s['likesCursor']+24]
                url='https://accounts.booth.pm/wish_lists.json?'+urllib.parse.urlencode([('item_ids[]',pid) for pid in batch])
                counts=parser.call(dict(action='likes',text=fetcher.get(url),ids=batch))['counts']
                if set(counts)!=set(batch):raise w.Halt('incomplete_likes_response')
                with db:
                    for pid,count in counts.items():
                        row=db.execute('SELECT payload FROM products WHERE id=?',(pid,)).fetchone()
                        if row:
                            p=json.loads(row[0]);p.update(likes=count,likesFetchedAt=w.now())
                            db.execute('UPDATE products SET payload=? WHERE id=?',(json.dumps(p,ensure_ascii=False),pid))
                            db.execute('INSERT INTO changes(product_id) VALUES(?)',(pid,))
                s['likesCursor']+=len(batch);save(db,s)
                s['networkFailures']=0;save(db,s)
            if not w.STOP.is_set():s.update(phase='complete',endedAt=w.now());save(db,s)
        print(json.dumps(status(db)),flush=True)
        return 0
    except (w.Halt,ValueError) as error:
        s=state(db);halt=error if isinstance(error,w.Halt) else w.Halt('parse_error')
        if halt.reason=='shutdown':return 0
        if halt.reason in ('network_timeout','http_5xx'):
            s['networkFailures']=s.get('networkFailures',0)+1
            if s['networkFailures']>=5:halt=w.Halt('persistent_network_error')
        s.update(resumePhase=s.get('phase','search'),phase='waiting' if halt.until else 'stopped',reason=halt.reason,retryAt=halt.until)
        save(db,s);print(json.dumps(dict(event=s['phase'],reason=halt.reason)),flush=True)
        return 0 if halt.until else 20
    finally:parser.close();db.close()

if __name__=='__main__':
    import fcntl
    cli=argparse.ArgumentParser();cli.add_argument('--max-products',type=int);cli.add_argument('--refresh-id');args=cli.parse_args()
    os.umask(0o077);w.ROOT.mkdir(parents=True,exist_ok=True)
    lock=(w.ROOT/'worker.lock').open('a')
    try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:sys.exit(0)
    signal.signal(signal.SIGTERM,lambda *_:w.STOP.set());signal.signal(signal.SIGINT,lambda *_:w.STOP.set())
    try:sys.exit(refresh_one(w.ROOT,args.refresh_id) if args.refresh_id else run(max_products=args.max_products))
    except Exception:
        db=w.connect();s=state(db);s.update(phase='stopped',reason='internal_error',retryAt=None);save(db,s);db.close()
        print('{"event":"stopped","reason":"internal_error"}',flush=True);sys.exit(20)
