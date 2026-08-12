#!/usr/bin/env bash
# Шаг 2 (на хосте): создаём VM с Arch Linux под прокси.
# Настройки можно переопределить переменными окружения.
set -euo pipefail

VM_NAME=${VM_NAME:-yamusic}
VM_RAM_MB=${VM_RAM_MB:-2048}
VM_CPUS=${VM_CPUS:-2}
VM_DISK_GB=${VM_DISK_GB:-20}
VM_MAC=${VM_MAC:-52:54:00:6d:75:73}
VM_IP=${VM_IP:-192.168.122.50}
SSH_KEY=${SSH_KEY:-$HOME/.ssh/id_ed25519.pub}
IMAGE_URL=${IMAGE_URL:-https://geo.mirror.pkgbuild.com/images/latest/Arch-Linux-x86_64-cloudimg.qcow2}
POOL=${POOL:-/var/lib/libvirt/images}
WORK=${WORK:-$HOME/.cache/yamusic-vm}

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

if [[ ! -f $SSH_KEY ]]; then
  echo "Нет SSH-ключа $SSH_KEY. Создайте: ssh-keygen -t ed25519" >&2
  exit 1
fi

if virsh --connect qemu:///system dominfo "$VM_NAME" >/dev/null 2>&1; then
  echo "VM '$VM_NAME' уже существует. Удалить: virsh destroy $VM_NAME; virsh undefine --remove-all-storage $VM_NAME" >&2
  exit 1
fi

mkdir -p "$WORK"

echo "→ Качаем облачный образ Arch (кэшируется в $WORK)"
if [[ ! -f "$WORK/arch-cloudimg.qcow2" ]]; then
  curl -fL --progress-bar -o "$WORK/arch-cloudimg.qcow2.part" "$IMAGE_URL"
  mv "$WORK/arch-cloudimg.qcow2.part" "$WORK/arch-cloudimg.qcow2"
fi

echo "→ Готовим диск VM на ${VM_DISK_GB}G"
cp "$WORK/arch-cloudimg.qcow2" "$WORK/$VM_NAME.qcow2"
qemu-img resize "$WORK/$VM_NAME.qcow2" "${VM_DISK_GB}G"

echo "→ Собираем cloud-init seed"
SEED=$WORK/seed
rm -rf "$SEED" && mkdir -p "$SEED"
sed "s|__SSH_PUBKEY__|$(cat "$SSH_KEY")|" "$HERE/cloud-init/user-data" > "$SEED/user-data"
cat > "$SEED/meta-data" <<EOF
instance-id: $VM_NAME-001
local-hostname: $VM_NAME
EOF
xorriso -as mkisofs -quiet -o "$WORK/$VM_NAME-seed.iso" -V CIDATA -J -r "$SEED/user-data" "$SEED/meta-data"

echo "→ Закрепляем за VM адрес $VM_IP в сети default"
sudo virsh net-update default add ip-dhcp-host \
  "<host mac='$VM_MAC' name='$VM_NAME' ip='$VM_IP'/>" --live --config 2>/dev/null || \
  echo "  (запись уже была, продолжаем)"

echo "→ Переносим образы в $POOL"
sudo install -o root -g root -m 0660 "$WORK/$VM_NAME.qcow2" "$POOL/$VM_NAME.qcow2"
sudo install -o root -g root -m 0660 "$WORK/$VM_NAME-seed.iso" "$POOL/$VM_NAME-seed.iso"

echo "→ Создаём VM"
sudo virt-install \
  --connect qemu:///system \
  --name "$VM_NAME" \
  --memory "$VM_RAM_MB" \
  --vcpus "$VM_CPUS" \
  --cpu host-passthrough \
  --import \
  --disk "path=$POOL/$VM_NAME.qcow2,format=qcow2,bus=virtio,cache=writeback" \
  --disk "path=$POOL/$VM_NAME-seed.iso,device=cdrom,readonly=on" \
  --network "network=default,model=virtio,mac=$VM_MAC" \
  --osinfo archlinux \
  --graphics none \
  --console pty,target_type=serial \
  --noautoconsole

sudo virsh autostart "$VM_NAME"

echo
echo "→ Ждём, пока VM поднимет SSH (cloud-init ставит nodejs, это пара минут)"
for _ in $(seq 1 60); do
  if ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=3 \
      "yamusic@$VM_IP" 'command -v node' >/dev/null 2>&1; then
    echo "  VM готова: $VM_IP"
    echo
    echo "Дальше: ./03-deploy-app.sh"
    exit 0
  fi
  sleep 10
done

echo "SSH пока не отвечает. Посмотрите консоль: sudo virsh console $VM_NAME (выход — Ctrl+])" >&2
exit 1
