#!/usr/bin/env bash
# Шаг 1 (на хосте Arch Linux): ставим QEMU/KVM, libvirt и virt-manager.
set -euo pipefail

if [[ $EUID -eq 0 ]]; then
  echo "Запускайте от обычного пользователя, sudo вызывается внутри." >&2
  exit 1
fi

if [[ ! -e /dev/kvm ]]; then
  echo "Нет /dev/kvm — включите виртуализацию (VT-x/AMD-V) в BIOS." >&2
  exit 1
fi

echo "→ Ставим пакеты"
sudo pacman -S --needed --noconfirm \
  qemu-full libvirt virt-install virt-manager dnsmasq dmidecode \
  iptables-nft edk2-ovmf openbsd-netcat libisoburn openssh rsync curl

echo "→ Включаем libvirtd"
sudo systemctl enable --now libvirtd.socket
sudo systemctl enable --now virtlogd.socket

echo "→ Добавляем $USER в группы libvirt и kvm"
sudo usermod -aG libvirt,kvm "$USER"

echo "→ Поднимаем сеть default (NAT 192.168.122.0/24)"
if ! sudo virsh net-info default >/dev/null 2>&1; then
  sudo virsh net-define /usr/share/libvirt/networks/default.xml
fi
sudo virsh net-autostart default || true
sudo virsh net-start default 2>/dev/null || true

echo
echo "Готово. Проверка:"
sudo virsh net-list --all
echo
echo "ВАЖНО: перелогиньтесь (или 'newgrp libvirt'), чтобы членство в группе libvirt заработало."
echo "Дальше: ./02-create-vm.sh"
