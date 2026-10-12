#!/bin/bash
set -euo pipefail
app=/opt/vrc-mens-collector
state=/var/lib/vrc-mens-collector
if ! id vrcmens >/dev/null 2>&1; then
    useradd --system --home-dir "$state" --shell /usr/sbin/nologin vrcmens
fi
install -d -o root -g root -m 755 "$app"
install -d -o vrcmens -g vrcmens -m 700 "$state"
for file in worker.py manage.py parser.mjs; do install -o root -g root -m 644 "/root/vrc-mens-deploy/$file" "$app/$file"; done
if [ ! -x "$app/runtime/bin/node" ]; then
    install -d -m 755 "$app/download"
    cd "$app/download"
    curl --fail --silent --show-error --location https://nodejs.org/dist/v24.14.1/node-v24.14.1-linux-x64.tar.xz -o node-v24.14.1-linux-x64.tar.xz
    curl --fail --silent --show-error --location https://nodejs.org/dist/v24.14.1/SHASUMS256.txt -o SHASUMS256.txt
    grep ' node-v24.14.1-linux-x64.tar.xz$' SHASUMS256.txt | sha256sum --check --strict
    install -d -m 755 "$app/runtime"
    tar -xJf node-v24.14.1-linux-x64.tar.xz -C "$app/runtime" --strip-components=1
fi
for file in vrc-mens-collector.service vrc-mens-collector-backup.service vrc-mens-collector-backup.timer; do
    install -o root -g root -m 644 "/root/vrc-mens-deploy/$file" "/etc/systemd/system/$file"
done
systemd-analyze verify /etc/systemd/system/vrc-mens-collector.service /etc/systemd/system/vrc-mens-collector-backup.service /etc/systemd/system/vrc-mens-collector-backup.timer
systemctl daemon-reload
"$app/runtime/bin/node" --version
echo 'Installed; collector has not been started.'
