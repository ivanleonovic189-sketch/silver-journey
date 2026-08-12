#!/usr/bin/env bash
# Шаг 3 (на хосте): заливаем код в VM и запускаем сервис.
# Повторный запуск = обновление: rsync + рестарт.
set -euo pipefail

VM_IP=${VM_IP:-192.168.122.50}
VM_USER=${VM_USER:-yamusic}
APP_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
ENV_FILE=$APP_ROOT/server/.env

if [[ ! -f $ENV_FILE ]]; then
  echo "→ Нет server/.env, создаю из шаблона"
  sed \
    -e "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -hex 32)|" \
    -e "s|^CACHE_DIR=.*|CACHE_DIR=/var/lib/yamusic/cache|" \
    "$APP_ROOT/server/env.example" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo
  echo "Заполните в $ENV_FILE:"
  echo "  YANDEX_MUSIC_TOKEN — токен вашего аккаунта (см. README)"
  echo "  APP_PASSWORD       — пароль для входа с телефона"
  echo "и запустите скрипт снова."
  exit 1
fi

for key in YANDEX_MUSIC_TOKEN APP_PASSWORD AUTH_SECRET; do
  if ! grep -qE "^$key=.+" "$ENV_FILE"; then
    echo "В $ENV_FILE не заполнен $key" >&2
    exit 1
  fi
done

echo "→ Копируем код в $VM_USER@$VM_IP:/opt/yamusic"
rsync -az --delete \
  --exclude '.cache/' \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'server/.env' \
  -e "ssh -o StrictHostKeyChecking=accept-new" \
  "$APP_ROOT/" "$VM_USER@$VM_IP:/opt/yamusic/"

echo "→ Копируем .env отдельно (права 600)"
scp -q -o StrictHostKeyChecking=accept-new "$ENV_FILE" "$VM_USER@$VM_IP:/opt/yamusic/server/.env"
ssh "$VM_USER@$VM_IP" 'chmod 600 /opt/yamusic/server/.env'

echo "→ Перезапускаем сервис"
ssh "$VM_USER@$VM_IP" '
  set -e
  sudo install -d -o yamusic -g yamusic /var/lib/yamusic/cache
  sudo systemctl daemon-reload
  sudo systemctl enable --now yamusic.service
  sudo systemctl restart yamusic.service
  sleep 2
  systemctl is-active --quiet yamusic.service || { sudo journalctl -u yamusic -n 40 --no-pager; exit 1; }
'

echo "→ Проверка"
if ssh "$VM_USER@$VM_IP" "curl -sf http://127.0.0.1:8080/api/health"; then
  echo
  echo "Сервис работает внутри VM: http://$VM_IP:8080"
  echo "Дальше: sudo ./04-forward-port.sh — чтобы телефон достучался с локальной сети."
else
  echo "Сервис не отвечает, смотрите: ssh $VM_USER@$VM_IP 'journalctl -u yamusic -n 50'" >&2
  exit 1
fi
