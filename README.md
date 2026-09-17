# Cacho e' Cabra · Karaoke Web

Mobile-first karaoke app for the venue: guests join by QR, pick a YouTube karaoke version, take a branded selfie, wait in a live queue, use their phone as a muted lyrics monitor while singing, and rate other tables. The host runs the night from a panel; TVs show the stage.

Plan and architecture: [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

## Status

UI and backend in place. Screens run on a typed domain layer; state lives in Supabase Postgres, every mutation is a Postgres function called by the Next.js server, and phones, panel and TVs stay in sync through Supabase Realtime broadcasts with a polling fallback. Next: YouTube catalog sync and search fallback (plan Step 4), hardening (Step 8).

## Supabase setup (once per project)

1. Create a project at supabase.com. Copy the Project URL and the `anon` and `service_role` keys from Settings, API.
2. Open the SQL editor, paste the whole of `supabase/migrations/20260916000000_init.sql`, run it. It creates tables, RLS, functions, the private `selfies` bucket, 30 tables, one open night and the demo catalog.
3. Create the animador's login under Authentication, Users, Add user (email + password, auto-confirm). Then grant the role in the SQL editor:

   ```sql
   insert into admin_users (id, role, display_name)
   select id, 'OWNER', 'Nombre' from auth.users where email = 'correo@ejemplo.cl';
   ```

   Use `'HOST'` for animadores who should not open new nights.
4. Fill `.env` (see `.env.example`). `DEVICE_TOKEN_SECRET` is any random string of 32+ characters, for example the output of `openssl rand -hex 32`.

The `NEXT_PUBLIC_*` values are baked into the browser bundle at build time, so after changing `.env` rebuild with `docker compose up -d --build`.

## YouTube catalog

Guests search a local catalog, so a night of 200 people costs no YouTube quota. The catalog is fed by the trusted karaoke channels in `src/lib/youtube/categories.ts` (uploads imported at 1 quota unit per 50 videos) and by one-time genre searches for each category the venue asked for (100 units each, seeded once from `catalog_queries`). Only when the catalog has fewer than 3 hits does the search route ask YouTube, capped per night by the "Búsquedas en YouTube por noche" setting and cached for 30 days.

Setup:

1. The client creates a Google Cloud project, enables **YouTube Data API v3**, creates an API key and restricts it to the VPS IP and to that API. Put it in `.env` as `YOUTUBE_API_KEY`.
2. Run `supabase/migrations/20260917010000_catalog.sql` in the SQL editor.
3. Set `CRON_SECRET` in `.env` (`openssl rand -hex 32`) and add the nightly sync to the VPS crontab (`crontab -e`):

   ```text
   15 6 * * * curl -fsS -X POST -H "Authorization: Bearer $(grep ^CRON_SECRET= /opt/karaoke/.env | cut -d= -f2)" https://karaokecec.cl/api/cron/catalog-sync >> /var/log/karaoke-sync.log 2>&1
   ```

   Each run is bounded to ~50 s and stops at 7,000 units for the day, leaving the rest for the night. The first full seed therefore takes a few runs; "Sincronizar ahora" in the panel's Configuración triggers one on demand.

The panel shows songs per category, quota used today, and lets the host add a video by URL (enters as verified) or add a channel.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill the Supabase values
npm run dev
```

| Route | Screen |
| --- | --- |
| `/karaoke?table=8` | Guest flow (open in a phone-sized window; several tabs act as several phones) |
| `/panel` | Host panel |
| `/tv/demo-night` | Stage TV |

Walkthrough: open the panel on a computer, the TV on another screen, and `/karaoke?table=8` on a phone. Request a song, approve it in the panel, click Iniciar, and the TV and the phone switch to the performance. A second phone at `/karaoke` can vote.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build with type check and lint |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript only |

## Deploy (Hostinger VPS, Docker + Nginx + Let's Encrypt)

The app runs in Docker bound to `127.0.0.1:3100`. TLS is terminated by Nginx in one of two ways.

**Mode A, host Nginx (current VPS).** The server already has Nginx and certbot. As a user in the `docker` group, once public DNS for `karaokecec.cl` points at the VPS:

```bash
sudo git clone <repo-url> /opt/karaoke && sudo chown -R $USER /opt/karaoke && cd /opt/karaoke
cp .env.example .env      # keep COMPOSE_PROFILES empty; fill the keys when available
docker compose up -d --build
sudo cp deploy/nginx/host-site.conf /etc/nginx/sites-available/karaoke
sudo ln -sf /etc/nginx/sites-available/karaoke /etc/nginx/sites-enabled/karaoke
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx --redirect -d karaokecec.cl -d www.karaokecec.cl
```

**Mode B, containerized edge.** For a server without host Nginx, set `COMPOSE_PROFILES=edge` and `CERTBOT_EMAIL` in `.env`, then run `bash deploy/init-letsencrypt.sh`. It starts Nginx and Certbot in Docker, obtains the certificate for `DOMAIN`, and renews it automatically. DNS for `DOMAIN` must already point at the VPS.

Every push to `main` then deploys through GitHub Actions: lint and typecheck, then SSH into the VPS, pull, and `docker compose up -d --build`. Repository secrets required: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (private key of a deploy-only key pair), `VPS_APP_DIR` (for example `/opt/karaoke`).

Manual operations on the VPS:

| Task | Command |
| --- | --- |
| Logs | `docker compose logs -f app` |
| Restart | `docker compose restart app` |
| Rollback | `git checkout <previous-sha> && docker compose up -d --build` |
| Certificate status | `docker compose run --rm certbot certificates` |

## Layout

```text
src/app/karaoke/…     guest flow: inicio, buscar, datos, selfie, confirmar, fila, cantando, votar, resultado
src/app/panel/…       host panel: ahora, pendientes, cola, historial, configuracion, login
src/app/tv/[id]       stage screen
src/components/       ui primitives, brand, player, client, panel
src/lib/domain/       types, state machine, ETA, rating
src/lib/selfie/       branded 1:1 selfie rendering
src/lib/store/        actions contract, realtime client store, hooks, draft
src/lib/server/       device cookie, snapshot builder, realtime broadcast, HTTP helpers
src/lib/supabase/     server (service role, auth) and browser clients
supabase/migrations/  schema, RLS, functions, seed
```
