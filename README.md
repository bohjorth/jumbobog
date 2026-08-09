# Jumbobøger – cover-picker

Lille intern app til at vælge det korrekte cover for hver Jumbobog. Søger
billeder via [Serper.dev](https://serper.dev)'s Google Images API, og gemmer
det valgte billede lokalt i `covers/<id>.jpg` når du klikker på det.

## Kom i gang lokalt

```bash
npm install
```

Opret en `.env`-fil (kopiér `.env.example`) og sæt din egen nøgle ind:

```bash
cp .env.example .env
# rediger .env og sæt din rigtige SERPER_API_KEY ind
```

Start serveren:

```bash
npm start
```

Åbn <http://localhost:8080>.

## Få en API-nøgle

1. Opret en gratis konto på <https://serper.dev> (intet kreditkort krævet).
2. Du får 2.500 gratis søgninger.
3. Kopiér nøglen fra dashboardet ind i din `.env`-fil.

## Antal bøger

Sat i toppen af `<script>`-blokken i `index.html` som `const TOTAL = 700;`.
Ret tallet hvis samlingen ændrer størrelse.

## Funktioner

- Dovent indlæste bøger (kun søgt når de scrolles i visning) for at spare
  søgekreditter.
- "Gå til bog", "Næste manglende" og "Vis kun manglende" til at navigere i
  en stor samling.
- Allerede gemte covers markeres og huskes ved genindlæsning.
- "Søg igen" hvis ingen forslag passer; "Prøv igen" hvis en søgning fejler.

## Deploy på en Debian-server

Se [`deploy/jumboboger.service`](deploy/jumboboger.service) — en
systemd-service der starter appen automatisk og genstarter den ved fejl.

```bash
# 1. Opdatér systemet
sudo apt update && sudo apt upgrade -y

# 2. Installér Node.js 20 LTS og git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# 3. Opret en dedikeret bruger
sudo useradd --system --create-home --shell /usr/sbin/nologin jumboboger

# 4. Klon repoet
sudo git clone https://github.com/bohjorth/jumbobog.git /opt/jumbobog
sudo chown -R jumboboger:jumboboger /opt/jumbobog

# 5. Installér afhængigheder
cd /opt/jumbobog
sudo -u jumboboger npm install

# 6. Opret .env med den rigtige nøgle (denne fil committes ALDRIG til git)
sudo -u jumboboger cp .env.example .env
sudo -u jumboboger nano .env    # sæt din rigtige SERPER_API_KEY ind
sudo chmod 600 .env

# 7. Sæt systemd-servicen op
sudo cp deploy/jumboboger.service /etc/systemd/system/jumboboger.service
sudo systemctl daemon-reload
sudo systemctl enable --now jumboboger

# 8. Tjek at den kører
sudo systemctl status jumboboger
sudo journalctl -u jumboboger -f
```

Appen kører herefter på `http://server-ip:8080`.

### Firewall

```bash
sudo ufw allow 8080/tcp
```

Kun nødvendigt hvis serveren skal tilgås udefra dit lokale netværk og `ufw`
er aktiveret.

### Opdatere til nyeste version

```bash
cd /opt/jumbobog
sudo systemctl stop jumboboger
sudo -u jumboboger git pull
sudo -u jumboboger npm install
sudo systemctl start jumboboger
```

## Sikkerhed

- `.env` og `covers/*.jpg` er i `.gitignore` og bliver aldrig committet.
- Del aldrig din rigtige `SERPER_API_KEY` i issues, commits eller andre
  offentlige steder i dette repo. Hvis en nøgle ved et uheld bliver
  committet, så regenerér den med det samme på serper.dev.
