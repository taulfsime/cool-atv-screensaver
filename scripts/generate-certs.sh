#!/bin/bash

# generate self-signed TLS certificates for cool-atv-screensaver

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$PROJECT_DIR/certs"

# create certs directory
mkdir -p "$CERTS_DIR"

# certificate settings
DAYS=365
COUNTRY="US"
STATE="State"
CITY="City"
ORG="cool-atv-screensaver"
CN="localhost"

# get local IP for SAN
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")

echo "Generating self-signed certificate..."
echo "  Valid for: $DAYS days"
echo "  Common Name: $CN"
echo "  Local IP: $LOCAL_IP"
echo ""

# generate certificate with SAN for localhost and local IP
openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$CERTS_DIR/server.key" \
    -out "$CERTS_DIR/server.crt" \
    -days "$DAYS" \
    -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/CN=$CN" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$LOCAL_IP"

# set permissions
chmod 600 "$CERTS_DIR/server.key"
chmod 644 "$CERTS_DIR/server.crt"

echo "Certificates generated successfully!"
echo ""
echo "Files created:"
echo "  $CERTS_DIR/server.crt"
echo "  $CERTS_DIR/server.key"
echo ""
echo "Note: These are self-signed certificates."
echo "Your browser will show a security warning - this is expected."
echo ""

# generate session secret
SESSION_SECRET=$(openssl rand -hex 32)
echo "Generated session secret (add to .env or docker-compose):"
echo "  SESSION_SECRET=$SESSION_SECRET"
echo ""
