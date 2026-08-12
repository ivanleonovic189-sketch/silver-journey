# Моя музыка — Яндекс Музыка через свой сервер

Клиент Яндекс Музыки для телефона, у которого **весь трафик идёт через ваш сервер на Arch Linux**:
поиск, плейлисты, обложки и сам аудиопоток. Телефон общается только с вашей машиной и никогда
не видит токен Яндекса — он лежит в `.env` внутри виртуалки.

```
  Телефон (PWA)                Arch Linux + QEMU/KVM              Яндекс
 ┌──────────────┐            ┌───────────────────────┐         ┌──────────┐
 │  <audio>     │  HTTPS     │  VM «yamusic»         │  HTTPS  │ api.     │
 │  Range-запр. │ ─────────► │  node server.js :8080 │ ──────► │ music.   │
 │  MediaSession│ ◄───────── │  ├ прокси потока      │ ◄────── │ yandex.  │
 └──────────────┘   аудио    │  ├ кэш треков на диск │  mp3    │ net      │
                             │  └ подпись ссылок     │         └──────────┘
                             └───────────────────────┘
```

Что умеет:

- поиск треков, альбомов, исполнителей, плейлистов;
- свои плейлисты и «Мне нравится»;
- радио-станции («Моя волна» и остальные), с автопродлением очереди;
- перемотка (Range-запросы проксируются насквозь), фон, управление с локскрина (MediaSession);
- кэш прослушанного на диске сервера с LRU-вытеснением — повтор играет, не трогая Яндекс;
- переключение качества high/low прямо во время трека.

Зависимостей npm — ноль. Нужен только Node.js 20+.

---

## 1. Что понадобится

- Аккаунт Яндекс Музыки **с активной подпиской Плюс** (без неё API отдаёт только 30-секундные превью);
- сервер с Arch Linux, процессор с VT-x/AMD-V;
- телефон в той же сети (или доступ снаружи — см. раздел про HTTPS).

Проект использует неофициальный мобильный API Яндекс Музыки. Это ваш аккаунт и ваша подписка,
но формально такой клиент — вне пользовательского соглашения; ломать DRM и раздавать музыку
третьим лицам он не предназначен.

---

## 2. Токен Яндекс Музыки

Токен — это OAuth-токен вашего аккаунта. Самый простой способ получить:

1. Установите расширение [Yandex Music Token](https://github.com/MarshalX/yandex-music-token)
   или откройте страницу авторизации мобильного клиента:
   `https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d`
2. Войдите в аккаунт — токен окажется в адресной строке после `access_token=`.
3. Скопируйте его в `server/.env` (`YANDEX_MUSIC_TOKEN=y0_Ag...`).

Токен даёт полный доступ к аккаунту — держите его только на сервере, права на файл `600`.

---

## 3. Быстрый старт локально (без VM)

```bash
cd yamusic
cp server/env.example server/.env
npm run secret          # выведет строку для AUTH_SECRET
$EDITOR server/.env     # заполните YANDEX_MUSIC_TOKEN, APP_PASSWORD, AUTH_SECRET
npm start
```

Открывайте `http://localhost:8080`, вводите `APP_PASSWORD`. Так удобно проверить токен до возни с VM.

---

## 4. Развёртывание на Arch Linux в QEMU/KVM

Четыре скрипта в `deploy/arch/`, запускать по порядку **на хосте**:

```bash
cd yamusic/deploy/arch
chmod +x *.sh

./01-host-setup.sh        # qemu-full, libvirt, virt-manager, сеть default
#   перелогиньтесь, чтобы заработала группа libvirt
./02-create-vm.sh         # облачный образ Arch → VM «yamusic» на 192.168.122.50
./03-deploy-app.sh        # rsync кода в /opt/yamusic + systemd-сервис
sudo ./04-forward-port.sh # проброс порта 8080 хоста внутрь VM
```

Что делает каждый шаг:

| Скрипт | Действие |
| --- | --- |
| `01-host-setup.sh` | Ставит `qemu-full`, `libvirt`, `virt-manager`, `dnsmasq`, включает `libvirtd`, поднимает NAT-сеть `default` |
| `02-create-vm.sh` | Качает `Arch-Linux-x86_64-cloudimg.qcow2`, собирает cloud-init seed (xorriso), закрепляет за VM IP `192.168.122.50`, создаёт домен через `virt-install --import` |
| `03-deploy-app.sh` | Создаёт `server/.env` (если нет), заливает код по rsync, запускает `yamusic.service`, проверяет `/api/health` |
| `04-forward-port.sh` | Ставит хук `/etc/libvirt/hooks/qemu` с DNAT-правилами, они переустанавливаются при каждом старте VM |

Переопределяемые переменные (перед вызовом скрипта):

```bash
VM_NAME=music VM_RAM_MB=4096 VM_CPUS=4 VM_DISK_GB=60 VM_IP=192.168.122.60 ./02-create-vm.sh
HOST_PORT=9090 sudo ./04-forward-port.sh
```

VM видна в **virt-manager** как обычная машина: консоль — `sudo virsh console yamusic` (выход `Ctrl+]`),
логи сервиса — `ssh yamusic@192.168.122.50 'journalctl -u yamusic -f'`.

Обновить код после правок — снова `./03-deploy-app.sh`.

### Вариант без NAT

Если хотите, чтобы VM получила адрес прямо из вашей локальной сети (тогда `04-forward-port.sh` не нужен),
создайте в virt-manager бридж поверх физического интерфейса и укажите его при создании:

```bash
sudo virt-install ... --network bridge=br0,model=virtio
```

### Вариант вообще без VM

Всё то же самое работает прямо на хосте: скопируйте проект в `/opt/yamusic`,
`useradd -r -s /usr/bin/nologin yamusic`, положите `deploy/arch/yamusic.service` в `/etc/systemd/system/`
и `systemctl enable --now yamusic`.

---

## 5. Установка на телефон

1. Откройте адрес сервера в Chrome/Safari на телефоне.
2. Введите `APP_PASSWORD`. Сессия подписывается HMAC и живёт 90 дней (`TOKEN_TTL_DAYS`).
3. Меню браузера → **«Установить приложение» / «На экран Домой»**.

Приложение встанет иконкой, откроется без адресной строки, музыка продолжит играть в фоне,
на локскрине появятся обложка и кнопки.

### Про HTTPS

Установка PWA и service worker требуют HTTPS (исключение — `localhost`). По `http://192.168.x.x`
приложение работает и играет, но не устанавливается как отдельное приложение. Варианты:

- **Домен + Let's Encrypt** — `deploy/nginx/yamusic.conf`, порт 443 хоста пробросьте в VM
  (`HOST_PORT=443 GUEST_PORT=443 sudo ./04-forward-port.sh`);
- **Tailscale / WireGuard** — поднимите в VM, телефон ходит на её адрес из VPN; у Tailscale
  есть `tailscale cert` и HTTPS без публичного домена. Заодно музыка доступна вне дома;
- **самоподписанный сертификат** — работает, но браузер будет ругаться и PWA не поставится.

---

## 6. API сервера

Все методы, кроме `/api/health` и `/api/login`, требуют токен: заголовок `Authorization: Bearer <token>`
или `?t=<token>` в query (так ходит `<audio>`, который не умеет слать заголовки).

| Метод | Что делает |
| --- | --- |
| `GET /api/health` | Живость и признак «конфиг заполнен» |
| `POST /api/login` | `{password, device}` → `{token}` |
| `GET /api/account` | Логин, есть ли Плюс |
| `GET /api/search?q=&type=track\|album\|artist\|playlist` | Поиск |
| `GET /api/playlists` | Свои плейлисты |
| `GET /api/playlists/:kind?uid=` | Треки плейлиста |
| `GET /api/likes` | «Мне нравится» |
| `GET /api/albums/:id` | Альбом с треками |
| `GET /api/artists/:id/tracks` | Популярное исполнителя |
| `GET /api/tracks?ids=1,2,3` | Метаданные пачкой |
| `GET /api/stations` | Список радио-станций |
| `GET /api/stations/:id/tracks?queue=` | Очередь волны |
| `POST /api/stations/:id/feedback` | Обратная связь ротору |
| `GET /api/stream/:trackId?q=high\|low` | **Аудиопоток** с поддержкой `Range` |
| `GET /api/cover?uri=&size=` | Прокси обложек |
| `GET /api/cache`, `DELETE /api/cache` | Статистика и очистка кэша |

Пример проверки потока с хоста:

```bash
TOKEN=$(curl -s -XPOST localhost:8080/api/login -H 'content-type: application/json' \
  -d '{"password":"ваш-пароль"}' | jq -r .token)
curl -s "localhost:8080/api/search?q=queen" -H "authorization: Bearer $TOKEN" | jq '.tracks[0]'
curl -sI "localhost:8080/api/stream/<id>?t=$TOKEN" -H 'range: bytes=0-1023'
```

Заголовок `X-Yamusic-Source` в ответе показывает, откуда пришёл трек: `cache` (диск сервера)
или `live` (проксируем из Яндекса прямо сейчас).

---

## 7. Настройки (`server/.env`)

| Переменная | По умолчанию | Смысл |
| --- | --- | --- |
| `YANDEX_MUSIC_TOKEN` | — | OAuth-токен аккаунта |
| `APP_PASSWORD` | — | Пароль входа с телефона |
| `AUTH_SECRET` | — | Секрет подписи сессий (`npm run secret`) |
| `PORT` / `HOST` | `8080` / `0.0.0.0` | Где слушать |
| `STREAM_QUALITY` | `high` | Битрейт по умолчанию |
| `CACHE_ENABLED` | `1` | Кэш треков на диске |
| `CACHE_DIR` | `../.cache` | Где лежит кэш (в VM — `/var/lib/yamusic/cache`) |
| `CACHE_MAX_MB` | `4096` | Лимит кэша, старое вытесняется по LRU |
| `TOKEN_TTL_DAYS` | `90` | Срок жизни сессии телефона |
| `LOG_REQUESTS` | `1` | Логи запросов |

---

## 8. Если что-то не работает

| Симптом | Причина и что делать |
| --- | --- |
| `Токен Яндекс Музыки недействителен` | Токен протух — получите заново (раздел 2) |
| `Трек недоступен для загрузки` | Нет активной подписки Плюс либо трек не лицензирован в вашем регионе |
| Плеер молчит, в логах 403 от хранилища | Подписанная ссылка протухла: `linkCache` в `server/yandex.js` хранит её 8 минут, перезапустите трек |
| Не ставится как приложение | Нет HTTPS — см. раздел 5 |
| С телефона не открывается | Не выполнен `04-forward-port.sh`, либо на хосте закрыт порт: `sudo iptables -t nat -L PREROUTING -n` |
| VM не поднялась | `sudo virsh console yamusic`, `sudo journalctl -u libvirtd -n 50` |
| Сервис падает | `ssh yamusic@192.168.122.50 'journalctl -u yamusic -n 100'` |

Яндекс иногда меняет схему выдачи прямых ссылок. Вся эта логика собрана в одном месте —
`directLink()` в `server/yandex.js`; если поток перестанет отдаваться, править нужно только её.
