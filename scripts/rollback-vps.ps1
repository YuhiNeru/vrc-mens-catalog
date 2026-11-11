$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'vps-common.ps1')
$vps=Get-VpsConfig
$taskRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$sshArgs=$vps.SshArgs
$syncTask=Get-ScheduledTask -TaskName 'VRCMensCatalogSync' -ErrorAction SilentlyContinue
if($syncTask){$syncTask | Disable-ScheduledTask | Out-Null; $syncTask | Stop-ScheduledTask}else{Write-Host 'Scheduled task VRCMensCatalogSync not found; skipping.'}
$unitStates=& ssh @sshArgs $vps.VPS_SSH_TARGET 'systemctl disable --now vrc-mens-daily.timer vrc-mens-daily.service; systemctl disable --now vrc-mens-collector.service; systemctl is-active vrc-mens-collector.service vrc-mens-daily.timer vrc-mens-daily.service'
if(@($unitStates).Count -ne 3 -or @($unitStates | Where-Object {$_ -ne 'inactive'}).Count -ne 0){throw 'Confirm VPS collector and daily job are inactive before rollback'}
& (Join-Path $PSScriptRoot 'sync-vps.ps1')
if($LASTEXITCODE -ne 0){throw 'Sync failed; local collector remains disabled'}
& ssh @sshArgs $vps.VPS_SSH_TARGET "$($vps.Manage) recovery"
if($LASTEXITCODE -ne 0){throw 'Recovery export failed'}
& scp @sshArgs "$($vps.VPS_SSH_TARGET):$($vps.VPS_STATE_DIR)/exports/recovery.tar.gz" 'data/vps-sync/recovery.tar.gz'
if($LASTEXITCODE -ne 0){throw 'Recovery download failed'}
& python deploy/vps/restore-local.py data/vps-sync/recovery.tar.gz
if($LASTEXITCODE -ne 0){throw 'Checkpoint restore failed'}
Remove-Item -LiteralPath (Join-Path $taskRoot 'data/vps-migration-active.json')
$process=Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'resume-full-accessories.ps1')) -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot 'data/logs/rollback-accessories.log') -RedirectStandardError (Join-Path $taskRoot 'data/logs/rollback-accessories-error.log') -PassThru
@{pid=$process.Id;script='scripts/resume-full-accessories.ps1';startedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content data/full-accessory-process.json -Encoding UTF8
Write-Output 'VPS collection and daily job stopped and disabled; local collection resumed.'
