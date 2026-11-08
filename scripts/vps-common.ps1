# Shared VPS connection settings. Dot-source this file: . (Join-Path $PSScriptRoot 'vps-common.ps1')
# No real values are stored in the repository. Set these environment variables (see .env.example):
#   VPS_SSH_TARGET   ssh target, form <VPS_USER>@<VPS_HOST>
#   VPS_SSH_KEY      path to the SSH private key file
#   VPS_KNOWN_HOSTS  path to the verified known_hosts file
#   VPS_SERVICE_USER dedicated non-admin user that runs the collector
#   VPS_APP_DIR      program directory on the VPS
#   VPS_STATE_DIR    data directory on the VPS (exports/ lives under it)
function Get-VpsConfig {
    $names='VPS_SSH_TARGET','VPS_SSH_KEY','VPS_KNOWN_HOSTS','VPS_SERVICE_USER','VPS_APP_DIR','VPS_STATE_DIR'
    $cfg=@{}
    foreach($n in $names){
        $v=[Environment]::GetEnvironmentVariable($n)
        if([string]::IsNullOrWhiteSpace($v)){throw "Environment variable $n is required (see .env.example and docs/vps-collector-operations.md)"}
        $cfg[$n]=$v
    }
    $cfg.SshArgs=@('-i',$cfg.VPS_SSH_KEY,'-o',"UserKnownHostsFile=$($cfg.VPS_KNOWN_HOSTS)",'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes')
    $cfg.ServiceUser=$cfg.VPS_SERVICE_USER
    $cfg.Manage="runuser -u $($cfg.VPS_SERVICE_USER) -- python3 $($cfg.VPS_APP_DIR)/manage.py"
    return $cfg
}
