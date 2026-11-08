#!/bin/bash
set -euo pipefail
# Host-specific values. Override via environment variables; the defaults are the current production values.
#   VRC_APP_DIR       program directory         (default /opt/vrc-mens-collector)
#   VRC_DATA          data directory            (default /var/lib/vrc-mens-collector; same variable worker.py reads)
#   VRC_SERVICE_USER  service user and group    (default vrcmens)
#   VRC_DEPLOY_SRC    uploaded bundle directory (default /root/vrc-mens-deploy)
# The systemd unit files in this directory hardcode the default values. When you override any of them,
# the copies installed under /etc/systemd/system are rewritten with the overridden values (repo files are unchanged).
app="${VRC_APP_DIR:-/opt/vrc-mens-collector}"
state="${VRC_DATA:-/var/lib/vrc-mens-collector}"
svc_user="${VRC_SERVICE_USER:-vrcmens}"
src="${VRC_DEPLOY_SRC:-/root/vrc-mens-deploy}"
if ! id "$svc_user" >/dev/null 2>&1; then
    useradd --system --home-dir "$state" --shell /usr/sbin/nologin "$svc_user"
fi
install -d -o root -g root -m 755 "$app"
install -d -o "$svc_user" -g "$svc_user" -m 700 "$state"
for file in worker.py manage.py daily.py parser.mjs; do install -o root -g root -m 644 "$src/$file" "$app/$file"; done
if [ ! -x "$app/runtime/bin/node" ]; then
    install -d -m 755 "$app/download"
    cd "$app/download"
    curl --fail --silent --show-error --location https://nodejs.org/dist/v24.14.1/node-v24.14.1-linux-x64.tar.xz -o node-v24.14.1-linux-x64.tar.xz
    curl --fail --silent --show-error --location https://nodejs.org/dist/v24.14.1/SHASUMS256.txt -o SHASUMS256.txt
    grep ' node-v24.14.1-linux-x64.tar.xz$' SHASUMS256.txt | sha256sum --check --strict
    install -d -m 755 "$app/runtime"
    tar -xJf node-v24.14.1-linux-x64.tar.xz -C "$app/runtime" --strip-components=1
fi
for file in vrc-mens-collector.service vrc-mens-collector-backup.service vrc-mens-collector-backup.timer vrc-mens-daily.service vrc-mens-daily.timer; do
    install -o root -g root -m 644 "$src/$file" "/etc/systemd/system/$file"
    if [ "$app" != /opt/vrc-mens-collector ] || [ "$state" != /var/lib/vrc-mens-collector ] || [ "$svc_user" != vrcmens ]; then
        sed -i -e "s#/opt/vrc-mens-collector#$app#g" -e "s#/var/lib/vrc-mens-collector#$state#g" -e "s#^User=vrcmens\$#User=$svc_user#" -e "s#^Group=vrcmens\$#Group=$svc_user#" "/etc/systemd/system/$file"
    fi
done
systemd-analyze verify /etc/systemd/system/vrc-mens-collector.service /etc/systemd/system/vrc-mens-collector-backup.service /etc/systemd/system/vrc-mens-collector-backup.timer /etc/systemd/system/vrc-mens-daily.service /etc/systemd/system/vrc-mens-daily.timer
systemctl daemon-reload
"$app/runtime/bin/node" --version
echo 'Installed; collector has not been started.'
