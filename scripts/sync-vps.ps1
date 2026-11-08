$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'vps-common.ps1')
$vps=Get-VpsConfig
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$sshArgs=$vps.SshArgs
New-Item -ItemType Directory -Force -Path 'data/vps-sync' | Out-Null
$after=0
if(Test-Path 'data/vps-sync/cursor.json'){$after=(Get-Content 'data/vps-sync/cursor.json' -Raw | ConvertFrom-Json).through}
$remotePath=(& ssh @sshArgs $vps.VPS_SSH_TARGET "$($vps.Manage) export --after $after").Trim()
$exportRoot=[regex]::Escape($vps.VPS_STATE_DIR.TrimEnd('/'))
if($LASTEXITCODE -ne 0 -or $remotePath -notmatch ('^'+$exportRoot+'/exports/changes-\d+-\d+\.jsonl$')){throw 'VPS export failed'}
& scp @sshArgs "$($vps.VPS_SSH_TARGET):$remotePath" 'data/vps-sync/changes.jsonl'
if($LASTEXITCODE -ne 0){throw 'Download failed'}
& node --import tsx deploy/vps/sync.ts data/vps-sync/changes.jsonl
if($LASTEXITCODE -ne 0){throw 'Import failed; retained export can be retried'}
