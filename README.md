# CSAIS Guard Check-In

Replaces the hourly phone check-in call for CSAIS (Canadian security company).
While a guard is on duty the system pings them **every 15 minutes**. They must
send a **live camera photo or video within 5 minutes**. If they miss, **every
admin is alerted immediately** with the guard's name, site, phone number and
timestamps so dispatch can call them.

## Features

- **Guard flow** — register with mandatory full name + mobile phone, guided
  single-screen UX (only the next step is shown), type the site name to start
  a shift, live "time on duty" and "next check-in" countdowns, camera-only
  check-ins (getUserMedia or the phone camera app — gallery uploads are
  rejected), optional one-time or live GPS, end shift (auto-end after 12 h).
- **Dispatch console** — live duty board (WAITING / MISSED — CALL NOW /
  ON DUTY) refreshing every 5 seconds, instant toasts + browser Web
  Notifications on a miss, copy-to-clipboard phone numbers, Google Maps links,
  per-check-in detail (media, source verdict, all timestamps, GPS), guard
  list, site list, admin management, manual "Ping now", rolling 24 h / 7 d
  report.
- **Media anti-cheat** — file-picker uploads rejected, reused file hashes
  rejected, EXIF capture time before the ping rejected as gallery, videos
  longer than 45 s rejected, EXIF-less camera-app photos accepted but flagged
  `UNVERIFIED`.
- **Anti-cheat engine** — server-clock-only deadlines (device clock changes
  can never extend a window; big skews are flagged), each shift bound to the
  starting device + IP (different device mid-shift = critical alert, new IP =
  warning), GPS spoof detection (impossible speed, mock-provider accuracy,
  replayed fixes), and every rejected cheat attempt logged to a Security page
  for dispatch with live-board ⚠ badges.
- **Background worker** (in-process, started with the server) — sends due
  pings (first ~15 s after shift start, then every 15 min), expires pending
  check-ins after 5 min and fires the CALL NOW alert, auto-ends 12 h shifts,
  and delivers the daily report at **07:00 America/Toronto** (idempotent
  across restarts).
- All timestamps stored in **UTC**, displayed in **America/Toronto**.

## Panels and guides

The app has two fully separated panels:

- **Guard panel** (`/app`, login at `/login`, register at `/register`) —
  phone-first, one guided step at a time. Guards never see admin menus.
- **Dispatch admin panel** (`/dispatch`, login at `/admin/login`) — the live
  board, alerts, reports and management pages. Admins are redirected here
  automatically.

Step-by-step user guides (also available in-app via the **Help** links):

- [Guard panel guide](docs/GUARD_GUIDE.md) — register, start a shift, answer
  pings with the camera, GPS, end shift.
- [Admin panel guide](docs/ADMIN_GUIDE.md) — live board sections, the
  missed-check-in drill, ping now, reports, guards/sites/admins management.

## Tech stack

Next.js 15 (App Router, TypeScript, RSC) · Tailwind CSS 4 · PostgreSQL via
Prisma 6 · NextAuth v5 (credentials) · node-cron + interval sweep worker ·
media stored on disk (`UPLOAD_DIR`) · 5-second polling for live views.

## Run locally

Prerequisites: Node.js 20+, PostgreSQL 14+ (or SQLite, see below).

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create the database (adjust to your setup)
sudo -u postgres psql -c "CREATE USER csais WITH PASSWORD 'csais_dev_password' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE csais OWNER csais;"

# 3. Configure environment
cp .env.example .env
# edit .env: set DATABASE_URL and a fresh AUTH_SECRET (openssl rand -base64 32)

# 4. Create tables
npx prisma migrate dev

# 5. Seed the first admin (admin@csais.local / ChangeMe!123)
npm run db:seed

# 6. Start
npm run dev
```

Open http://localhost:3000:

- **Admin**: log in with `admin@csais.local` / `ChangeMe!123` → `/dispatch`.
  Change this password in production.
- **Guard**: open a second browser (or phone) → `/register` → full name +
  phone + password → start a shift by typing the site name.

> Camera and GPS require a secure context. `http://localhost` works; when
> testing from a phone on your LAN, use an HTTPS tunnel (e.g.
> `npx untun@latest tunnel http://localhost:3000` or ngrok), because browsers
> block `getUserMedia`/geolocation on plain http.

### SQLite fallback (no Postgres available)

1. In `prisma/schema.prisma` change the datasource provider to `sqlite`.
2. In `.env` set `DATABASE_URL="file:./dev.db"`.
3. Delete `prisma/migrations/` and run `npx prisma migrate dev --name init`.

Switch back by reverting those two changes and re-running the migration
against Postgres.

## Environment variables

Every variable is documented in [`.env.example`](.env.example). Summary:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres (or SQLite) connection string |
| `AUTH_SECRET` | NextAuth JWT secret — generate with `openssl rand -base64 32` |
| `AUTH_URL` / `AUTH_TRUST_HOST` | Public URL of the deployment |
| `UPLOAD_DIR` | Directory for check-in media files (default `./uploads`) |
| `APP_TIMEZONE` | Display/report timezone (keep `America/Toronto`) |
| `SMTP_*` | Optional email channel for admin alerts + daily report |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Credentials used by `npm run db:seed` |

Never commit `.env` — only `.env.example` is tracked.

## Production build

```bash
npm run build
npm start        # honours PORT, defaults to 3000
```

The background worker starts automatically with the server (via
`instrumentation.ts`), in dev and production. Run **one** app instance per
database, or move the worker to a single dedicated instance, so pings and
alerts are not duplicated.

## Deploy on a VPS

### Option A — Node + Postgres + systemd

```bash
# as root, once
apt update && apt install -y postgresql nodejs npm nginx
sudo -u postgres psql -c "CREATE USER csais WITH PASSWORD '<strong-password>';"
sudo -u postgres psql -c "CREATE DATABASE csais OWNER csais;"

# deploy user
git clone <this-repo> /opt/csais && cd /opt/csais
cp .env.example .env   # set DATABASE_URL, AUTH_SECRET, AUTH_URL=https://your.domain, UPLOAD_DIR=/var/lib/csais/uploads
npm ci
npx prisma migrate deploy
npm run db:seed
npm run build
mkdir -p /var/lib/csais/uploads
```

`/etc/systemd/system/csais.service`:

```ini
[Unit]
Description=CSAIS guard check-in
After=network.target postgresql.service

[Service]
WorkingDirectory=/opt/csais
EnvironmentFile=/opt/csais/.env
Environment=NODE_ENV=production PORT=3000
ExecStart=/usr/bin/npm start
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now csais
```

Put nginx (or Caddy) in front with HTTPS — required for camera and GPS:

```nginx
server {
  server_name your.domain;
  client_max_body_size 150m;   # 45 s phone videos
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

The daily 07:00 report runs inside the app via node-cron — no OS crontab
needed. If you prefer systemd timers, you can instead call
`dailyReport()` from a small script on a `OnCalendar=*-*-* 07:00:00
America/Toronto` timer.

### Option B — Docker Compose

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: csais
      POSTGRES_PASSWORD: change-me
      POSTGRES_DB: csais
    volumes: ["pgdata:/var/lib/postgresql/data"]
  app:
    build: .
    depends_on: [db]
    environment:
      DATABASE_URL: postgresql://csais:change-me@db:5432/csais
      AUTH_SECRET: change-me-openssl-rand
      AUTH_URL: https://your.domain
      AUTH_TRUST_HOST: "true"
      UPLOAD_DIR: /data/uploads
      APP_TIMEZONE: America/Toronto
    volumes: ["uploads:/data/uploads"]
    ports: ["3000:3000"]
    command: sh -c "npx prisma migrate deploy && npm run db:seed && npm start"
volumes:
  pgdata:
  uploads:
```

with a standard Node 20 `Dockerfile` (`npm ci && npm run build`, then
`npm start`).

## Extending notifications (SMS / Telegram)

All admin alerts flow through one function: `notifyAdmins(event)` in
[`lib/notify.ts`](lib/notify.ts). It currently writes in-app notifications
(which drive the dispatch toasts and browser notifications) and optionally
sends SMTP email. Add a Twilio or Telegram sender inside that function — no
caller changes needed.

## Project layout

```
app/                  pages + API route handlers
  app/                guard screens (guided flow, on-duty, history)
  dispatch/           admin console (live board, missed, guards, sites, report, admins, check-in detail)
  api/                REST endpoints (auth, shift, checkin upload, gps, board, notifications, media)
components/           client components (camera capture, live board, toasts, ...)
lib/                  prisma, auth, check-in engine, worker, media verdicts, notify, report, geo, time
prisma/               schema, migrations, seed
instrumentation.ts    starts the background worker with the server
```
