$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
if (Test-Path -LiteralPath 'data/vps-migration-active.json') { throw 'Collection moved to VPS; use the rollback procedure first.' }
do {
    & node --max-old-space-size=4096 --expose-gc --import tsx scripts/collect-full-accessories.ts --recycle-after=1000
    $workerExit = $LASTEXITCODE
    if ($workerExit -eq 75) {
        Write-Output "Worker checkpoint saved; restarting with a fresh heap."
    }
} while ($workerExit -eq 75)
exit $workerExit
