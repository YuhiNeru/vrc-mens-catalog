param([ValidateRange(30,600)][int]$IntervalSeconds=180)
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$lastPublished=-1
while ($true) {
    $progress=Get-Content -LiteralPath 'data/progress-comprehensive.json' -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($progress.storedProducts -ne $lastPublished -or $progress.phase -in @('complete','stopped')) {
        & npm.cmd run cli -- snapshot-local
        if ($LASTEXITCODE -ne 0) { throw 'Local snapshot failed' }
        & npx.cmd wrangler d1 execute catalog --local --file data/local-snapshot.sql
        if ($LASTEXITCODE -ne 0) { throw 'Local D1 import failed' }
        $lastPublished=$progress.storedProducts
        Write-Output ("Published local snapshot: {0} products, phase {1}, {2}" -f $lastPublished,$progress.phase,(Get-Date -Format o))
    }
    if ($progress.phase -eq 'complete') { exit 0 }
    if ($progress.phase -eq 'stopped') { exit 2 }
    Start-Sleep -Seconds $IntervalSeconds
}
