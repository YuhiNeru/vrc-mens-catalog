"""One-time repair of items rejected by the initial IPC framing bug; no HTTP retries."""
import worker
db=worker.connect()
with db:
    count=db.execute("SELECT count(*) FROM queue WHERE status='failed' AND error='parse_error' AND pos>=?",(worker.get(db,'migrationCursor'),)).fetchone()[0]
    db.execute("UPDATE queue SET status='pending',error=NULL WHERE status='failed' AND error='parse_error' AND pos>=?",(worker.get(db,'migrationCursor'),))
    worker.put(db,'failed',worker.get(db,'failed')-count)
    worker.put(db,'phase','waiting');worker.put(db,'reason','daily_budget')
print('Requeued cached parser rejects:',count)
