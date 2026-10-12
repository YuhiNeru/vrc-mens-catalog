import argparse
import datetime as dt
import json
import os
import pathlib
import shutil
import sqlite3
import sys
import tarfile
import io
import subprocess
import worker

def initialize(root):
    db=worker.connect(root)
    if db.execute('SELECT count(*) FROM queue').fetchone()[0]:raise RuntimeError('Database already initialized')
    seed=json.loads((root/'seed.json').read_text(encoding='utf8'));state=seed['state']
    with db:
        for k in ('phase','downloaded','cached','likesCursor','requests','reason'):worker.put(db,k,state[k])
        for k,v in dict(runId=state['id'],cursor=state['cursor'],migrationCursor=state['cursor'],total=len(state['queue']),failed=len(state['failed']),added=len(state['added']),accessoryIds=seed['accessoryIds'],retryAt=(state['retryAt']/1000 if state['retryAt'] else None)).items():worker.put(db,k,v)
        failures={x['id']:x['reason'] for x in state['failed']}
        for pos,pid in enumerate(state['queue']):db.execute('INSERT INTO queue VALUES(?,?,?,?,?)',(pos,pid,'failed' if pos<state['cursor'] and pid in failures else 'done' if pos<state['cursor'] else 'pending',failures.get(pid),state['updatedAt']))
        for b in seed['budgets']:db.execute('INSERT INTO budgets VALUES(?,?)',(b['day'],b['used']))
        for path in (root/'raw').glob('*.html'):db.execute('INSERT OR IGNORE INTO cached_queue VALUES(?)',(path.stem,))
    count=0
    with (root/'products.jsonl').open(encoding='utf8') as file:
        for line in file:
            item=json.loads(line);p=item['product'];db.execute('INSERT INTO products VALUES(?,?,?)',(p['id'],json.dumps(p,ensure_ascii=False),p['fetchedAt']))
            for r in item['compatibility']:db.execute('INSERT INTO compatibility VALUES(?,?,?,?)',(p['id'],r['targetType'],r['targetId'],json.dumps(r,ensure_ascii=False)))
            count+=1
            if count%1000==0:db.commit()
    db.commit();print(json.dumps(worker.status(db,root)));db.close()

def export(db,root,after):
    target=root/'exports';target.mkdir(exist_ok=True)
    db.execute('BEGIN')
    cutoff=db.execute('SELECT coalesce(max(seq),0) FROM changes').fetchone()[0]
    dest=target/f'changes-{after}-{cutoff}.jsonl'
    temp=dest.with_suffix('.tmp')
    with temp.open('w',encoding='utf8') as out:
        out.write(json.dumps(dict(type='header',after=after,through=cutoff,runId=worker.get(db,'runId')))+'\n')
        for (pid,) in db.execute('SELECT DISTINCT product_id FROM changes WHERE seq>? AND seq<=?',(after,cutoff)):
            p=json.loads(db.execute('SELECT payload FROM products WHERE id=?',(pid,)).fetchone()[0])
            rs=[json.loads(row[0]) for row in db.execute('SELECT payload FROM compatibility WHERE product_id=?',(pid,))]
            overrides=[dict(entity=e,key=k,patch=json.loads(patch)) for e,k,patch in db.execute("SELECT entity,entity_key,patch FROM overrides WHERE (entity='product' AND entity_key=?) OR (entity='compatibility' AND entity_key LIKE ?)",(pid,pid+':%'))]
            c=db.execute('SELECT payload FROM classifications WHERE id=?',(pid,)).fetchone()
            out.write(json.dumps(dict(type='product',product=p,compatibility=rs,overrides=overrides,classification=json.loads(c[0]) if c else None),ensure_ascii=False)+'\n')
    db.commit();temp.replace(dest);print(str(dest))

def backup(db,root):
    folder=root/'backups';folder.mkdir(exist_ok=True)
    name='collector-'+dt.datetime.now(worker.UTC).strftime('%Y%m%dT%H%M%S%fZ')
    target=folder/(name+'.sqlite');copy=sqlite3.connect(target);db.backup(copy);copy.close()
    shutil.copy2(root/'seed.json',folder/(name+'.seed.json'))
    print(str(target))

def recovery(db,root):
    state=json.loads((root/'seed.json').read_text(encoding='utf8'))['state']
    for key in ('cursor','downloaded','cached','requests','likesCursor','phase','reason'):state[key]=worker.get(db,key)
    state['retryAt']=int((worker.get(db,'retryAt',0) or 0)*1000)
    state['failed']=[dict(id=pid,reason=error) for pid,error in db.execute("SELECT product_id,error FROM queue WHERE status='failed'")]
    state['added']=list(dict.fromkeys(state['added']+[row[0] for row in db.execute('SELECT id FROM classifications')]))
    state['updatedAt']=worker.now();state['estimatedFinish']=None
    dest=root/'exports'/'recovery.tar.gz';dest.parent.mkdir(exist_ok=True)
    with tarfile.open(dest,'w:gz') as tar:
        payload=json.dumps(state,ensure_ascii=False).encode('utf8');info=tarfile.TarInfo('state.json');info.size=len(payload);tar.addfile(info,io.BytesIO(payload))
        for day,used in db.execute('SELECT day,used FROM budgets'):
            payload=json.dumps(dict(used=used)).encode('utf8');info=tarfile.TarInfo('budget-'+day+'.json');info.size=len(payload);tar.addfile(info,io.BytesIO(payload))
        for file in (root/'raw').glob('*.html.gz'):tar.add(file,arcname='raw/'+file.name,recursive=False)
    print(str(dest))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['init','status','export','backup','resume','restore','recovery']);parser.add_argument('--after',type=int,default=0);parser.add_argument('--backup');parser.add_argument('--root',type=pathlib.Path,default=worker.ROOT);args=parser.parse_args();root=args.root
    os.umask(0o077)
    if args.action=='init':initialize(root);return
    if args.action=='restore':
        if root==worker.ROOT and subprocess.run(['systemctl','is-active','--quiet','vrc-mens-collector.service']).returncode==0:raise RuntimeError('Stop vrc-mens-collector.service before restore')
        path=pathlib.Path(args.backup).resolve();folder=(root/'backups').resolve()
        if path.parent!=folder or not path.name.startswith('collector-') or path.suffix!='.sqlite':raise RuntimeError('Backup must be in this collector backup directory')
        source=sqlite3.connect(f'file:{path}?mode=ro',uri=True)
        if source.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RuntimeError('Invalid backup')
        source.close();temp=root/'restore.sqlite';shutil.copy2(path,temp)
        # Stop this collector service before restore; never touch another project.
        for suffix in ('-wal','-shm'):
            side=root/('collector.sqlite'+suffix)
            if side.exists():side.unlink()
        temp.replace(root/'collector.sqlite');shutil.copy2(path.with_suffix('.seed.json'),root/'seed.json');print('restored');return
    db=worker.connect(root)
    if args.action=='status':print(json.dumps(worker.status(db,root),ensure_ascii=False,indent=2))
    elif args.action=='export':export(db,root,args.after)
    elif args.action=='backup':backup(db,root)
    elif args.action=='recovery':recovery(db,root)
    elif args.action=='resume':
        until=worker.get(db,'retryAt',0) or 0
        with db:
            worker.put(db,'phase','waiting' if until>worker.time.time() else 'products')
            if until<=worker.time.time():worker.put(db,'reason','');worker.put(db,'retryAt',None)
        print('resume enabled')
    db.close()
if __name__=='__main__':main()
