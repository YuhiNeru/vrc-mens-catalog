"""Read-only measurements; output service metadata and error classes, never log bodies."""
import json,os,pathlib,re,sqlite3,subprocess,time
APP_DIR=os.environ.get('VRC_APP_DIR','/opt/vrc-mens-collector')
STATE_DIR=os.environ.get('VRC_DATA','/var/lib/vrc-mens-collector')
def properties(unit):
    fields=['ActiveState','SubState','MainPID','MemoryCurrent','MemoryPeak','CPUUsageNSec','NRestarts','Result','ExecMainStartTimestamp']
    output=subprocess.check_output(['systemctl','show',unit,*['-p'+p for p in fields]],text=True)
    return dict(line.split('=',1) for line in output.splitlines())
for unit in ('vrc-mens-collector.service','vrc-mens-daily.service'):
    info=properties(unit);pid=info.get('MainPID')
    if pid and pid!='0':
        info['rssProcesses']=subprocess.check_output(['ps','-o','pid,user,rss,pcpu,comm','-p',pid,'--ppid',pid],text=True).strip()
    print(json.dumps(dict(service=unit,properties=info)))
logs=subprocess.check_output(['journalctl','-u','vrc-mens-daily.service','-n','120','-o','json','--no-pager'],text=True)
flags={term:0 for term in ('HTTP Error 401','HTTP Error 403','HTTP Error 429','HTTP Error 500','TimeoutError','URLError','ConnectionError','Traceback','JSONDecodeError','NameError','PermissionError')}
for line in logs.splitlines():
    try:message=json.loads(line).get('MESSAGE','')
    except ValueError:continue
    for term in flags:
        if term in message:flags[term]+=1
print(json.dumps(dict(errorClasses=flags)))
kernel=subprocess.run(['journalctl','-k','--since','2026-10-12 10:35:00','--grep','oom|Out of memory|Killed process','--no-pager'],capture_output=True,text=True)
print(json.dumps(dict(kernelOOMEvents=kernel.stdout.count('Killed process'),kernelReadExit=kernel.returncode)))
for name in (APP_DIR,STATE_DIR):
    st=pathlib.Path(name).stat();print(json.dumps(dict(path=name,uid=st.st_uid,gid=st.st_gid,mode=oct(st.st_mode&0o777))))
