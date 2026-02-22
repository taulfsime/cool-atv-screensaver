#!/bin/bash

# cool-atv-screensaver installer
# usage: curl -fsSL https://raw.githubusercontent.com/taulfsime/cool-atv-screensaver/main/scripts/install.sh | bash

set -e

# colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # no color

# defaults
INSTALL_DIR="${INSTALL_DIR:-$HOME/cool-atv-screensaver}"
IMAGE="ghcr.io/taulfsime/cool-atv-screensaver:latest"
PORT="${PORT:-8443}"

echo -e "${BLUE}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║       cool-atv-screensaver installer      ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# check requirements
echo -e "${BLUE}Checking requirements...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}Error: docker is not installed${NC}"
  echo "Install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo -e "${RED}Error: docker-compose is not installed${NC}"
  echo "Install Docker Compose: https://docs.docker.com/compose/install/"
  exit 1
fi

if ! command -v openssl &> /dev/null; then
  echo -e "${RED}Error: openssl is not installed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ All requirements met${NC}"
echo ""

# create install directory
echo -e "${BLUE}Creating install directory: ${INSTALL_DIR}${NC}"
mkdir -p "${INSTALL_DIR}"/{certs,logs,photos}
cd "${INSTALL_DIR}"

# generate certificates if not exist
if [ ! -f certs/server.crt ] || [ ! -f certs/server.key ]; then
  echo -e "${BLUE}Generating self-signed certificates...${NC}"
  
  # get local IP
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
  
  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout certs/server.key \
    -out certs/server.crt \
    -days 365 \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${LOCAL_IP}" \
    2>/dev/null
  
  chmod 600 certs/server.key
  chmod 644 certs/server.crt
  
  echo -e "${GREEN}✓ Certificates generated${NC}"
else
  echo -e "${YELLOW}Certificates already exist, skipping...${NC}"
fi

# create .env file if not exist
if [ ! -f .env ]; then
  echo -e "${BLUE}Creating .env file...${NC}"
  
  # prompt for password (read from /dev/tty to work with curl | bash)
  echo ""
  echo -n "Enter upload password for your family: "
  read UPLOAD_PASSWORD < /dev/tty
  
  if [ -z "$UPLOAD_PASSWORD" ]; then
    echo -e "${RED}Error: Password cannot be empty${NC}"
    exit 1
  fi
  
  # generate session secret
  SESSION_SECRET=$(openssl rand -hex 32)
  
  cat > .env << EOF
UPLOAD_PASSWORD=${UPLOAD_PASSWORD}
SESSION_SECRET=${SESSION_SECRET}
EOF
  
  chmod 600 .env
  echo -e "${GREEN}✓ .env file created${NC}"
else
  echo -e "${YELLOW}.env file already exists, skipping...${NC}"
fi

# create docker-compose.yml
echo -e "${BLUE}Creating docker-compose.yml...${NC}"
cat > docker-compose.yml << EOF
services:
  cool-atv-screensaver:
    image: ${IMAGE}
    container_name: cool-atv-screensaver
    ports:
      - "${PORT}:8443"
    env_file: .env
    volumes:
      - ./certs:/certs:ro
      - ./photos:/srv/photos/processed
      - ./logs:/logs
    restart: unless-stopped
EOF

echo -e "${GREEN}✓ docker-compose.yml created${NC}"

# pull image
echo ""
echo -e "${BLUE}Pulling Docker image...${NC}"
docker pull "${IMAGE}"
echo -e "${GREEN}✓ Image pulled${NC}"

# start service
echo ""
echo -e "${BLUE}Starting service...${NC}"

if docker compose version &> /dev/null; then
  docker compose up -d
else
  docker-compose up -d
fi

echo -e "${GREEN}✓ Service started${NC}"

# get IP for display
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Installation complete!                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Access the UI at: ${BLUE}https://${LOCAL_IP}:${PORT}${NC}"
echo ""
echo -e "${YELLOW}Note: Your browser will show a security warning about the"
echo -e "self-signed certificate. This is expected - click 'Advanced'"
echo -e "and proceed to the site.${NC}"
echo ""
echo "Useful commands:"
echo "  cd ${INSTALL_DIR}"
echo "  docker-compose logs -f    # view logs"
echo "  docker-compose restart    # restart service"
echo "  docker-compose down       # stop service"
echo ""
echo "Processed photos are saved to: ${INSTALL_DIR}/photos"
echo ""
