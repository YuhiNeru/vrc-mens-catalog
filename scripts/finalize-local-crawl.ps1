param([string]$PublisherLog='data/logs/avatar-name-recrawl-publish.log')
$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$expectedPlan=(Get-Content -LiteralPath data/coverage-plan.json -Raw -Encoding UTF8|ConvertFrom-Json).id
while ($true) {
    $plan=Get-Content -LiteralPath data/coverage-plan.json -Raw -Encoding UTF8|ConvertFrom-Json
    if ($plan.id -ne $expectedPlan) { throw 'Coverage plan changed; finalizer stopped' }
    if ($plan.phase -eq 'stopped') { Write-Output ("Crawl stopped: {0}" -f $plan.reason); exit 2 }
    if ($plan.phase -eq 'complete' -and (Test-Path -LiteralPath $PublisherLog)) {
        $published=Select-String -LiteralPath $PublisherLog -Pattern 'Published local snapshot: .*phase complete' -Quiet
        if ($published) { break }
    }
    Start-Sleep -Seconds 30
}
& npm.cmd run cli -- coverage-report
if ($LASTEXITCODE -ne 0) { throw 'Final coverage report failed' }
& node.exe tests/ui.mjs
if ($LASTEXITCODE -ne 0) { throw 'Final floor UI verification failed' }
Write-Output ("Crawl, local publication, report and UI verification complete: {0}" -f (Get-Date -Format o))
