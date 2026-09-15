#!/usr/bin/env bash
# One-time certificate bootstrap for the containerized edge (COMPOSE_PROFILES=edge).
# Not needed when the VPS's own Nginx terminates TLS (deploy/nginx/host-site.conf).
# Run once from the repository root after DNS for $DOMAIN points at this server:
#   bash deploy/init-letsencrypt.sh
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; source .env; set +a
: "${DOMAIN:?DOMAIN missing in .env}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL missing in .env}"
export COMPOSE_PROFILES=edge

if docker compose run --rm --entrypoint "test -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem" certbot 2>/dev/null; then
  echo "Certificate for $DOMAIN already exists."
  exit 0
fi

echo "Creating temporary self-signed certificate so nginx can start..."
docker compose run --rm --entrypoint "sh -c '\
  mkdir -p /etc/letsencrypt/live/$DOMAIN && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj /CN=localhost'" certbot

docker compose up -d --build app nginx

echo "Requesting Let's Encrypt certificate for $DOMAIN..."
docker compose run --rm --entrypoint "sh -c '\
  rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf && \
  certbot certonly --webroot -w /var/www/certbot \
    --email $CERTBOT_EMAIL --agree-tos --no-eff-email \
    -d $DOMAIN --rsa-key-size 4096'" certbot

docker compose exec nginx nginx -s reload
docker compose up -d
echo "Done. https://$DOMAIN is live."
