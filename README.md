# Cacho e' Cabra · Karaoke Web

Mobile-first karaoke app for the venue: guests join by QR, pick a YouTube karaoke version, take a branded selfie, wait in a live queue, use their phone as a muted lyrics monitor while singing, and rate other tables. The host runs the night from a panel; TVs show the stage.

Plan and architecture: [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

## Status

UI phase complete. Every screen from the spec is implemented on a typed domain layer and a local reactive store that syncs across browser tabs, so the panel in one tab drives phones and TVs in others. The Supabase backend, YouTube catalog sync and realtime transport replace the store adapter in the next steps of the plan.

## Run

```bash
npm install
npm run dev
```

| Route | Screen |
| --- | --- |
| `/karaoke?table=8` | Guest flow (open in a phone-sized window; several tabs act as several phones) |
| `/panel` | Host panel |
| `/tv/demo-night` | Stage TV |

Demo walkthrough: open the panel and the TV in two tabs, open `/karaoke?table=8` in a third, request a song, approve it in the panel, click Iniciar, and watch the TV and the guest phone switch to the performance. Open `/karaoke` in a fourth tab to vote.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build with type check and lint |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript only |

## Deploy (Hostinger VPS, Docker + Nginx + Let's Encrypt)

The app runs in Docker bound to `127.0.0.1:3000`. TLS is terminated by Nginx in one of two ways.

**Mode A, host Nginx (current VPS).** The server already has Nginx and a certbot-managed certificate for `karaokecachoecabra.cl`. As a user in the `docker` group:

```bash
git clone <repo-url> ~/karaoke && cd ~/karaoke
cp .env.example .env      # keep COMPOSE_PROFILES empty; fill the keys when available
docker compose up -d --build
sudo cp deploy/nginx/host-site.conf /etc/nginx/sites-available/karaoke
sudo ln -sf /etc/nginx/sites-available/karaoke /etc/nginx/sites-enabled/karaoke
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**Mode B, containerized edge.** For a server without host Nginx, set `COMPOSE_PROFILES=edge` and `CERTBOT_EMAIL` in `.env`, then run `bash deploy/init-letsencrypt.sh`. It starts Nginx and Certbot in Docker, obtains the certificate for `DOMAIN`, and renews it automatically. DNS for `DOMAIN` must already point at the VPS.

Every push to `main` then deploys through GitHub Actions: lint and typecheck, then SSH into the VPS, pull, and `docker compose up -d --build`. Repository secrets required: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (private key of a deploy-only key pair), `VPS_APP_DIR` (for example `/home/deploy/karaoke`).

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
src/lib/search/       query normalization and karaoke scoring
src/lib/selfie/       branded 1:1 selfie rendering
src/lib/store/        reducer, cross-tab store, hooks, draft
src/lib/mock/         demo catalog
```
