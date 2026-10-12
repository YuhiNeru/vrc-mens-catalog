import json,subprocess,time
def read():
    output=subprocess.check_output(['systemctl','show','vrc-mens-collector.service','-p','MemoryCurrent','-p','MemoryPeak','-p','CPUUsageNSec','-p','ActiveState','-p','MainPID'],text=True)
    return dict(line.split('=',1) for line in output.splitlines())
start=time.monotonic();first=read();peak=0;samples=[]
for _ in range(20):
    value=read();samples.append(value);peak=max(peak,int(value['MemoryCurrent']) if value['MemoryCurrent'].isdigit() else 0);time.sleep(1)
last=read();elapsed=time.monotonic()-start
print(json.dumps(dict(elapsedSeconds=elapsed,mainPID=last['MainPID'],active=last['ActiveState'],memoryMaxObservedMB=round(peak/1048576,1),memoryPeak=last['MemoryPeak'],cpuOneCorePercent=round((int(last['CPUUsageNSec'])-int(first['CPUUsageNSec']))/elapsed/1e7,1))))
