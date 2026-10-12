param([ValidateSet('status','stop','start','logs','backup')][string]$Action='status',[string]$KeyPath='C:\Code\world-compass\.runtime\conoha-ssh.pem',[string]$KnownHosts='C:\Code\world-compass\.runtime\vps-known-hosts')
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if($Action -eq 'start' -and -not (Test-Path -LiteralPath 'data/vps-migration-active.json')){throw 'Local collection may be active; complete the cutover before starting VPS collection'}
$sshArgs=@('-i',$KeyPath,'-o',"UserKnownHostsFile=$KnownHosts",'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes')
$commands=@{
    status='systemctl show vrc-mens-collector.service -p ActiveState -p SubState -p MemoryCurrent -p MemoryPeak -p CPUUsageNSec; runuser -u vrcmens -- python3 /opt/vrc-mens-collector/manage.py status'
    stop='systemctl stop vrc-mens-collector.service'
    start='runuser -u vrcmens -- python3 /opt/vrc-mens-collector/manage.py resume; systemctl reset-failed vrc-mens-collector.service; systemctl start vrc-mens-collector.service'
    logs='journalctl -u vrc-mens-collector.service -n 30 --no-pager'
    backup='runuser -u vrcmens -- python3 /opt/vrc-mens-collector/manage.py backup'
}
& ssh @sshArgs root@160.251.167.191 $commands[$Action]
if($LASTEXITCODE -ne 0){throw 'VPS operation failed'}
