# EndoControl

A lightweight, multi-user glucose platform for patients, families and doctors.
It speaks the **Nightscout v1 REST API**, so glucose from practically any CGM reaches it
through the apps people already use — and adds registration, a simple interface in 14 languages,
doctor access, messages and printable reports.

> Independent implementation. It does not contain Nightscout code (AGPL-3.0); it is only compatible with the public API.

## What it does

| Area | Features |
|---|---|
| Accounts | Registration and login (e-mail + password, scrypt hashes, HttpOnly session cookie), patient/family or doctor role, change password, data export (CSV), account deletion |
| Any sensor | **Cloud bridges** (server pulls every 5 min): LibreLinkUp (FreeStyle Libre 1/2/3), Dexcom Share (G6/G7/ONE, US/OUS/JP), another Nightscout site · **Uploaders** (push to us): xDrip+, Juggluco, Spike, Diabox, Tomato, Shuggah, Loop, Trio, iAPS, AndroidAPS (NSClient v1) · **CSV import**: LibreView, Dexcom Clarity, Medtronic CareLink, Eversense, Glooko, Tidepool, meters |
| Patient app | Current value with trend arrow, 3/6/12/24 h chart, diary (carbs, insulin, finger stick, exercise, notes), today's metrics |
| Reports | Time in ranges (international consensus), GMI, CV, AGP, TIR by day, a full chart for every day; 7/14/30/90 days; **PDF** via the browser's print dialog |
| AI analyst | Ask any question — about a moment ("why did glucose fall 2 h after breakfast today?"), patterns over days, or diabetes in general. Claude (Anthropic) gets a 15-minute glucose timeline for today and yesterday, every diary entry, meal rises found on the curve and 14-day statistics, plus clinical background after Ragnar Hanas' "Type 1 Diabetes in Children, Adolescents and Young Adults" and ISPAD 2022. Needs `ANTHROPIC_API_KEY`; without it, questions about a meal or time of day get a curve analysis and other questions a Diabetes school lesson. Never suggests doses |
| Diabetes school | 10 short lessons with mini quizzes and progress: basics, targets, CGM, insulin, carbs, hypo, high glucose and ketones, sport, sick days, school and travel (Russian and English; other languages fall back to them) |
| Doctors | Patient sends a read-only link → doctor adds it → patient list sorted with TIR/hypo flags, full history, reports, messages and written conclusions |
| Languages | English, 简体中文, Español, العربية (RTL), Português, Bahasa Indonesia, Français, 日本語, Русский, Deutsch, Қазақша, Türkçe, हिन्दी, 한국어 · units mg/dL or mmol/L per user |

## Run it locally

Requirements: **Node.js 22.5 or newer** (uses the built-in `node:sqlite`). The only npm package, `@anthropic-ai/sdk`, is needed just for the AI analyst.

```bash
npm install               # only needed for the AI analyst
node scripts/demo.js      # optional: demo accounts with 30 days of data
node server.js            # http://localhost:1337
```

Demo logins (after `scripts/demo.js`): `demo@endocontrol.app` / `demo1234` (patient), `doctor@endocontrol.app` / `demo1234` (doctor).

## Connect a sensor (for users)

Open **Connect sensor** in the app and pick the device; every method shows its own steps.
For uploader apps the app shows three values:

- **Site URL** — your server address, e.g. `https://glucose.example.com`
- **API secret** — unique per user; it also identifies the account, so many users share one server
- **xDrip+ Base URL** — `https://<secret>@glucose.example.com/api/v1/`

Phones need **HTTPS** to upload, so put the server on a domain with a certificate (see below).

## Deploy

Any host that runs Node.js 22+ or Docker works (VPS, Railway, Render, Fly.io, a home server behind Cloudflare Tunnel…).

```bash
docker build -t endocontrol .
docker run -d -p 1337:1337 -v endocontrol-data:/app/data \
  -e SECRET_KEY=$(openssl rand -hex 32) -e PUBLIC_URL=https://glucose.example.com endocontrol
```

Put a reverse proxy with TLS in front (Caddy: `glucose.example.com { reverse_proxy localhost:1337 }`).

Environment variables:

| Variable | Meaning |
|---|---|
| `PORT` | HTTP port (default 1337) |
| `DATA_DIR` | where the SQLite database and key live (default `./data`) — back it up |
| `SECRET_KEY` | 64 hex chars; encrypts sensor-cloud passwords and API secrets. If unset, one is generated in `DATA_DIR/secret.key` — **keep it**, without it stored passwords cannot be decrypted |
| `PUBLIC_URL` | public address shown to users (otherwise taken from the request) |
| `APP_NAME` | product name shown in the UI and to Nightscout clients |
| `ANTHROPIC_API_KEY` | turns on the AI analyst (Claude); can also go in a `.env` file next to `server.js`, which git and Docker ignore. Without it the analyst shows a rule-based review. The question and a 14-day data summary are sent to Anthropic, so cover this in the privacy policy |
| `AI_MODEL` | Claude model for the analyst (default `claude-opus-5-5`) |
| `AI_LIMIT_PER_HOUR` | questions per user per hour (default 30) |

## Nightscout API compatibility

Base path `/api/v1/`. Authentication as in Nightscout:
`api-secret: <SHA-1 of the user's API secret>` header (or `?secret=`) for read/write; a share token as `?token=` or `Authorization: Bearer` for read-only.

Implemented: `GET/POST/DELETE entries` (`.json`, `/current`, `/sgv`, `/mbg`, `find[date][$gte]`, `count`, text format), `GET/POST/PUT/DELETE treatments`,
`GET/POST devicestatus`, `GET profile`, `GET status.json`, `GET verifyauth`.
Not yet: API v3 and websockets (needed by newer AndroidAPS NSClient v3 and the Nightscout web UI), CareLink and Glooko bridges.

## Project layout

```
server.js            HTTP server, app API (/app/*), Nightscout API (/api/v1/*), static files
lib/db.js            SQLite schema
lib/security.js      password hashing, encryption at rest, tokens, rate limiting
lib/nsdata.js        Nightscout data model: entries, treatments, devicestatus
lib/bridges.js       LibreLinkUp, Dexcom Share, Nightscout pull of glucose and treatments (every 5 min)
lib/csvimport.js     CSV import with automatic column/unit detection
public/explain.js    curve analysis shared by server and browser: meal rises, peaks, falls
public/robot.js      the AI analyst's 3D robot (three.js 0.160.0, vendored in public/vendor/three, MIT)
lib/ai.js            AI analyst: data summary, timeline and the Claude request
public/school.js     Diabetes school lessons and quizzes
public/              web app: index.html, app.js, charts.js, i18n.js (translations), app.css
scripts/demo.js      demo data
```

## Before going live with real patients

This is a working foundation, not a certified medical device. Before public launch:
legal review for health-data rules in your markets (GDPR, HIPAA, local laws such as Kazakhstan's personal-data law),
a privacy policy and terms, backups, monitoring, e-mail verification and password reset by e-mail, and a security review.
Glucose shown here must not be the only source for treatment decisions or low-glucose alarms.
