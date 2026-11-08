param([ValidateSet('status','stop','start','logs','backup')][string]$Action='status')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'vps-common.ps1')
$vps=Get-VpsConfig
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if($Action -eq 'start' -and -not (Test-Path -LiteralPath 'data/vps-migration-active.json')){throw 'Local collection may be active; complete the cutover before starting VPS collection'}
$sshArgs=$vps.SshArgs
$manage=$vps.Manage
$commands=@{
    status="systemctl show vrc-mens-collector.service -p ActiveState -p SubState -p MemoryCurrent -p MemoryPeak -p CPUUsageNSec; $manage status"
    stop='systemctl stop vrc-mens-collector.service'
    start="$manage resume; systemctl reset-failed vrc-mens-collector.service; systemctl start vrc-mens-collector.service"
    logs='journalctl -u vrc-mens-collector.service -n 30 --no-pager'
    backup="$manage backup"
}
& ssh @sshArgs $vps.VPS_SSH_TARGET $commands[$Action]
if($LASTEXITCODE -ne 0){throw 'VPS operation failed'}
