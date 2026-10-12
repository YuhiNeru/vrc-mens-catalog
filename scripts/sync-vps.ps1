param([string]$KeyPath='C:\Code\world-compass\.runtime\conoha-ssh.pem',[string]$KnownHosts='C:\Code\world-compass\.runtime\vps-known-hosts')
$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$sshArgs=@('-i',$KeyPath,'-o',"UserKnownHostsFile=$KnownHosts",'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes')
New-Item -ItemType Directory -Force -Path 'data/vps-sync' | Out-Null
$after=0
if(Test-Path 'data/vps-sync/cursor.json'){$after=(Get-Content 'data/vps-sync/cursor.json' -Raw | ConvertFrom-Json).through}
$remotePath=(& ssh @sshArgs root@160.251.167.191 "runuser -u vrcmens -- python3 /opt/vrc-mens-collector/manage.py export --after $after").Trim()
if($LASTEXITCODE -ne 0 -or $remotePath -notmatch '^/var/lib/vrc-mens-collector/exports/changes-\d+-\d+\.jsonl$'){throw 'VPS export failed'}
& scp @sshArgs "root@160.251.167.191:$remotePath" 'data/vps-sync/changes.jsonl'
if($LASTEXITCODE -ne 0){throw 'Download failed'}
& node --import tsx deploy/vps/sync.ts data/vps-sync/changes.jsonl
if($LASTEXITCODE -ne 0){throw 'Import failed; retained export can be retried'}
