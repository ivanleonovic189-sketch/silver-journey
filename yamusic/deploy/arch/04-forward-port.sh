#!/usr/bin/env bash
# Шаг 4 (на хосте, от root): пробрасываем порт хоста внутрь VM,
# чтобы телефон из локальной сети видел сервис по адресу хоста.
#
# Сеть default у libvirt — NAT, VM снаружи не видна. Ставим libvirt-хук,
# который добавляет DNAT при старте домена и убирает при остановке.
set -euo pipefail

VM_NAME=${VM_NAME:-yamusic}
VM_IP=${VM_IP:-192.168.122.50}
HOST_PORT=${HOST_PORT:-8080}
GUEST_PORT=${GUEST_PORT:-8080}
HOOK=/etc/libvirt/hooks/qemu

if [[ $EUID -ne 0 ]]; then
  echo "Запустите через sudo." >&2
  exit 1
fi

echo "→ Включаем форвардинг пакетов"
cat > /etc/sysctl.d/99-yamusic-forward.conf <<'EOF'
net.ipv4.ip_forward = 1
EOF
sysctl -q --system

echo "→ Ставим хук $HOOK"
mkdir -p "$(dirname "$HOOK")"
if [[ -f $HOOK ]] && ! grep -q 'yamusic-port-forward' "$HOOK"; then
  cp "$HOOK" "$HOOK.bak.$(date +%s)"
  echo "  (существующий хук сохранён в $HOOK.bak.*)"
fi

cat > "$HOOK" <<EOF
#!/usr/bin/env bash
# yamusic-port-forward — проброс $HOST_PORT (хост) → $VM_IP:$GUEST_PORT (VM)
set -eu

DOMAIN="\$1"
ACTION="\$2"

[ "\$DOMAIN" = "$VM_NAME" ] || exit 0

rules_add() {
  iptables -t nat -C PREROUTING -p tcp --dport $HOST_PORT -j DNAT --to-destination $VM_IP:$GUEST_PORT 2>/dev/null || \\
    iptables -t nat -I PREROUTING -p tcp --dport $HOST_PORT -j DNAT --to-destination $VM_IP:$GUEST_PORT
  iptables -t nat -C OUTPUT -o lo -p tcp --dport $HOST_PORT -j DNAT --to-destination $VM_IP:$GUEST_PORT 2>/dev/null || \\
    iptables -t nat -I OUTPUT -o lo -p tcp --dport $HOST_PORT -j DNAT --to-destination $VM_IP:$GUEST_PORT
  iptables -C FORWARD -d $VM_IP/32 -p tcp --dport $GUEST_PORT -j ACCEPT 2>/dev/null || \\
    iptables -I FORWARD -d $VM_IP/32 -p tcp --dport $GUEST_PORT -j ACCEPT
}

rules_del() {
  iptables -t nat -D PREROUTING -p tcp --dport $HOST_PORT -j DNAT --to-destination $VM_IP:$GUEST_PORT 2>/dev/null || true
  iptables -t nat -D OUTPUT -o lo -p tcp --dport $HOST_PORT -j DNAT --to-destination $VM_IP:$GUEST_PORT 2>/dev/null || true
  iptables -D FORWARD -d $VM_IP/32 -p tcp --dport $GUEST_PORT -j ACCEPT 2>/dev/null || true
}

case "\$ACTION" in
  start|reconnect) rules_add ;;
  stopped|release) rules_del ;;
esac
EOF

chmod 755 "$HOOK"
systemctl restart libvirtd

echo "→ Применяем правила к уже запущенной VM"
"$HOOK" "$VM_NAME" start || true

HOST_IP=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
echo
echo "Готово. Проверка с хоста:  curl -s http://127.0.0.1:$HOST_PORT/api/health"
echo "С телефона в той же сети:  http://${HOST_IP:-<ip-хоста>}:$HOST_PORT"
echo
echo "Правила живут до перезагрузки libvirtd/VM — хук навешивает их заново при каждом старте домена."
