param([ValidateSet('initial','daily','sync','retry')][string]$Mode='daily',[switch]$NoSync)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    New-Item -ItemType Directory -Force -Path 'data/logs' | Out-Null
    $logPath=Join-Path $projectRoot ('data/logs/'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.log')
    # トークンやAPI URLをログへ出力しない。環境変数は子プロセスが継承する。
    & npm.cmd run cli -- $Mode 2>&1 | Tee-Object -FilePath $logPath
    $resultCode=$LASTEXITCODE
    if ($resultCode -eq 0 -and -not $NoSync -and $Mode -ne 'sync') {
        & npm.cmd run cli -- sync 2>&1 | Tee-Object -FilePath $logPath -Append
        $resultCode=$LASTEXITCODE
    }
    exit $resultCode
} finally { Pop-Location }

