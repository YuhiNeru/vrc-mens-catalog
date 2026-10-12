import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch
import worker
import manage

class CollectorTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name);self.db=worker.connect(self.root)
        with self.db:
            self.db.execute("INSERT INTO queue VALUES(0,'123','pending',NULL,NULL)")
            worker.put(self.db,'cursor',0);worker.put(self.db,'accessoryIds',[])
    def tearDown(self):self.db.close();self.temp.cleanup()
    def result(self):return dict(product=dict(id='123',fetchedAt='2026-10-12T00:00:00Z'),compatibility=[],review=dict(category='ピアス',relations=[]))
    def test_atomic_resume_and_duplicate_publication(self):
        worker.store_result(self.db,0,self.result(),False);worker.store_result(self.db,0,self.result(),True)
        self.assertEqual(worker.get(self.db,'cursor'),1);self.assertEqual(worker.get(self.db,'added'),1)
        self.assertEqual(self.db.execute('SELECT count(*) FROM products').fetchone()[0],1)
        self.assertEqual(self.db.execute('SELECT status FROM queue').fetchone()[0],'done')
    def test_transaction_failure_preserves_pending_cursor(self):
        result=self.result();result['review']['relations']=[{}]
        with self.assertRaises(KeyError):worker.store_result(self.db,0,result,False)
        self.assertEqual(worker.get(self.db,'cursor'),0);self.assertEqual(self.db.execute('SELECT count(*) FROM products').fetchone()[0],0)
    def test_daily_budget_sends_no_request(self):
        day=worker.dt.datetime.now(worker.JST).date().isoformat()
        with self.db:self.db.execute('INSERT INTO budgets VALUES(?,12000)',(day,))
        f=worker.Fetcher(self.db)
        with patch.object(f.opener,'open') as request:
            with self.assertRaises(worker.Halt) as error:f.get('https://booth.pm/robots.txt')
            self.assertEqual(error.exception.reason,'daily_budget');request.assert_not_called()
    def test_auth_failure_stops_without_retry(self):
        f=worker.Fetcher(self.db)
        error=worker.urllib.error.HTTPError('https://booth.pm/x',403,'forbidden',{},None)
        with patch.object(f.opener,'open',side_effect=error) as request:
            with self.assertRaises(worker.Halt) as halted:f.get('https://booth.pm/x')
            self.assertIsNone(halted.exception.until);self.assertEqual(request.call_count,1)
    def test_cached_ahead_keeps_contiguous_frontier(self):
        with self.db:self.db.execute("INSERT INTO queue VALUES(1,'124','pending',NULL,NULL)")
        result=self.result();result['product']['id']='124'
        worker.store_result(self.db,1,result,True)
        self.assertEqual(worker.get(self.db,'cursor'),0)
        self.assertEqual(self.db.execute("SELECT count(*) FROM queue WHERE status='pending'").fetchone()[0],1)
    def test_credentials_and_foreign_hosts_rejected(self):
        for url in ('https://user:password@booth.pm/x','https://example.org/x','http://booth.pm/x'):
            with self.assertRaises(worker.Halt):worker.Fetcher(self.db).get(url)
    def test_backup_restorable_and_export_only_changes(self):
        (self.root/'seed.json').write_text('{}',encoding='utf8')
        worker.store_result(self.db,0,self.result(),False)
        manage.backup(self.db,self.root)
        backups=list((self.root/'backups').glob('*.sqlite'));self.assertEqual(len(backups),1)
        db=worker.sqlite3.connect(backups[0]);self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok');db.close()
        manage.export(self.db,self.root,0)
        lines=(self.root/'exports'/'changes-0-1.jsonl').read_text(encoding='utf8').splitlines()
        self.assertEqual(json.loads(lines[0])['through'],1);self.assertEqual(json.loads(lines[1])['product']['id'],'123')
    def test_restore_recovers_checkpoint_and_rejects_foreign_file(self):
        (self.root/'seed.json').write_text('{}',encoding='utf8')
        worker.store_result(self.db,0,self.result(),False);manage.backup(self.db,self.root)
        backup=next((self.root/'backups').glob('*.sqlite'))
        with self.db:worker.put(self.db,'cursor',99)
        self.db.close()
        with patch('sys.argv',['manage.py','restore','--root',str(self.root),'--backup',str(backup)]):manage.main()
        self.db=worker.connect(self.root);self.assertEqual(worker.get(self.db,'cursor'),1)
        with patch('sys.argv',['manage.py','restore','--root',str(self.root),'--backup',str(self.root/'elsewhere.sqlite')]):
            with self.assertRaises(RuntimeError):manage.main()

if __name__=='__main__':unittest.main()
