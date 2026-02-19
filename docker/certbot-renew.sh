#!/bin/bash
# =============================================================================
# Certbot Certificate Renewal Script
# =============================================================================
# Renews Let's Encrypt certificates and reloads nginx.
#
# Usage:
#   ./certbot-renew.sh
#
# Cron (recommended - run twice daily):
#   0 0,12 * * * /volume2/docker/my-cinema/certbot-renew.sh >> /var/log/certbot-renew.log 2>&1
# =============================================================================

COMPOSE_DIR="/volume2/docker/my-cinema"

cd "$COMPOSE_DIR" || exit 1

# Attempt renewal
docker compose -f docker-compose.nginx-proxy.yml run --rm certbot renew --quiet

# Reload nginx to pick up any new certificates
docker compose -f docker-compose.nginx-proxy.yml exec nginx-proxy nginx -s reload 2>/dev/null

echo "[$(date)] Certificate renewal check completed"
