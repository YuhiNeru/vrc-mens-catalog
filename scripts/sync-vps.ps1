$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'vps-common.ps1')
$vps=Get-VpsConfig
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$sshArgs=$vps.SshArgs+@('-o','ConnectTimeout=15','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2')
New-Item -ItemType Directory -Force -Path 'data/vps-sync' | Out-Null
try{$syncLock=[IO.File]::Open((Join-Path $PWD 'data/vps-sync/script.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch{throw 'Another VPS sync is already running'}
try {
$after=0
if(Test-Path 'data/vps-sync/cursor.json'){$after=(Get-Content 'data/vps-sync/cursor.json' -Raw | ConvertFrom-Json).through}
$remotePath=(& ssh @sshArgs $vps.VPS_SSH_TARGET "$($vps.Manage) export --after $after").Trim()
$exportRoot=[regex]::Escape($vps.VPS_STATE_DIR.TrimEnd('/'))
if($LASTEXITCODE -ne 0 -or $remotePath -notmatch ('^'+$exportRoot+'/exports/changes-\d+-\d+\.jsonl$')){throw 'VPS export failed'}
& scp @sshArgs "$($vps.VPS_SSH_TARGET):$remotePath" 'data/vps-sync/changes.jsonl'
if($LASTEXITCODE -ne 0){throw 'Download failed'}
& node --import tsx deploy/vps/sync.ts data/vps-sync/changes.jsonl
if($LASTEXITCODE -ne 0){throw 'Import failed; retained export can be retried'}
# Watchlist for the VPS daily job. Optional: skipped when the exporter is absent, and a failure here never fails the sync (the import above is already committed).
if(Test-Path -LiteralPath 'scripts/export-watchlist.ts'){
    $stateDir=$vps.VPS_STATE_DIR.TrimEnd('/')
    Remove-Item -LiteralPath 'data/vps-sync/watchlist.json' -ErrorAction SilentlyContinue
    & node --import tsx scripts/export-watchlist.ts
    if($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath 'data/vps-sync/watchlist.json')){Write-Warning 'Watchlist export failed; VPS watchlist left unchanged'}
    else{
        & scp @sshArgs 'data/vps-sync/watchlist.json' "$($vps.VPS_SSH_TARGET):$stateDir/exports/watchlist-upload.json"
        if($LASTEXITCODE -ne 0){Write-Warning 'Watchlist upload failed; VPS watchlist left unchanged'}
        else{
            & ssh @sshArgs $vps.VPS_SSH_TARGET "install -o $($vps.ServiceUser) -m 600 $stateDir/exports/watchlist-upload.json $stateDir/watchlist.next && mv -f $stateDir/watchlist.next $stateDir/watchlist.json"
            if($LASTEXITCODE -ne 0){Write-Warning 'Watchlist update failed; VPS watchlist left unchanged'}
        }
    }
}else{Write-Host 'scripts/export-watchlist.ts not found; skipping watchlist sync.'}
} finally {$syncLock.Dispose()}
exit 0
