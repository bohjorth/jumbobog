# Jumbobog-samlingen — selv-hostet webapp

Simpel Node.js/Express-app. Data gemmes i `data/collection.json` på serveren
(ingen database-server nødvendig). Virker fra alle enheder på dit netværk.

## 1. Opret LXC'en (Proxmox eller lxc-cli)

Brug et Debian 12-template. I Proxmox: Opret CT → vælg debian-12-standard
template → giv den fx 512 MB RAM, 2 GB disk, DHCP/statisk IP på dit LAN.

## 2. Installer Node.js i containeren

```bash
apt update && apt upgrade -y
apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # tjek at det virker
```

## 3. Kopiér projektet ind i containeren

Fra din egen maskine (uden for containeren), erstat `<CT-IP>` med
containerens IP:

```bash
scp -r jumbobog-app root@<CT-IP>:/opt/jumbobog-app
```

Eller hvis du bruger `pct` på Proxmox-hosten:

```bash
pct push <CTID> jumbobog-app.tar.gz /root/jumbobog-app.tar.gz
pct exec <CTID> -- bash -c "cd /opt && tar xzf /root/jumbobog-app.tar.gz"
```

## 4. Installer afhængigheder og test

Inde i containeren:

```bash
cd /opt/jumbobog-app
npm install
npm start
```

Åbn `http://<CT-IP>:3000` fra en browser på netværket — appen bør vise sig.
Stop med Ctrl+C når du har testet.

## 5. Kør den som en systemd-service (så den starter automatisk)

Opret `/etc/systemd/system/jumbobog.service`:

```ini
[Unit]
Description=Jumbobog-samling
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/jumbobog-app
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=PORT=3000
User=root

[Install]
WantedBy=multi-user.target
```

Aktivér og start:

```bash
systemctl daemon-reload
systemctl enable --now jumbobog
systemctl status jumbobog
```

Appen kører nu permanent på `http://<CT-IP>:3000`, tilgængelig fra alle
enheder på dit netværk.

## Valgfrit: fast hostname / reverse proxy

Vil du tilgå den via et pænt navn (fx `http://jumbobog.local`) i stedet for
IP + port, kan du sætte en let nginx op foran:

```bash
apt install -y nginx
```

og pege den på `localhost:3000` med `proxy_pass`, eller bare tilføje et
DNS/hosts-opslag til CT-IP'en.

## Data & backup

Al data ligger i `/opt/jumbobog-app/data/collection.json` — det er den
eneste fil du behøver at tage backup af (fx via en cron-job med `cp` til et
andet sted, eller inkludér den i din almindelige Proxmox/LXC-backup).

## Opdatere totalt antal numre

Er der udkommet flere Jumbobøger end 552, ret `TOTAL_BOOKS` i `server.js`
og genstart servicen (`systemctl restart jumbobog`) — eksisterende data
bevares, nye numre tilføjes automatisk.
