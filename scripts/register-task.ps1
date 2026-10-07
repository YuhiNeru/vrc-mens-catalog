param([ValidateSet('Install','Remove')][string]$Action='Install',[string]$Time='04:00',[string]$TaskName='VRCMensCatalogDaily')
$ErrorActionPreference='Stop'
if($Action -eq 'Remove'){Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false;exit 0}
if($Time -notmatch '^([01]\d|2[0-3]):[0-5]\d$'){throw '時刻はHH:mmで指定してください。'}
$projectRoot=Split-Path -Parent $PSScriptRoot
$scriptPath=Join-Path $PSScriptRoot 'run-crawler.ps1'
$taskAction=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$scriptPath+'" -Mode daily') -WorkingDirectory $projectRoot
$trigger=New-ScheduledTaskTrigger -Daily -At $Time
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
# 現在のユーザーがログインしている時に実行。秘密情報やパスワードはタスク引数に入れない。
$principal=New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $trigger -Settings $settings -Principal $principal -Description 'BOOTH公開情報の少数差分取得とカタログ反映' -Force | Out-Null
Write-Output ('登録: '+$TaskName+' 毎日 '+$Time+' (Windowsのローカル時刻)')

