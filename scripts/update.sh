#!/bin/bash

# cool-atv-screensaver updater
# usage: curl -fsSL https://raw.githubusercontent.com/taulfsime/cool-atv-screensaver/main/scripts/update.sh | bash

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

echo -e "${BLUE}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║        cool-atv-screensaver updater       ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# check if install directory exists
if [ ! -d "${INSTALL_DIR}" ]; then
  echo -e "${RED}Error: Install directory not found: ${INSTALL_DIR}${NC}"
  echo "Run the install script first:"
  echo "  curl -fsSL https://raw.githubusercontent.com/taulfsime/cool-atv-screensaver/main/scripts/install.sh | bash"
  exit 1
fi

cd "${INSTALL_DIR}"

# check if docker-compose.yml exists
if [ ! -f docker-compose.yml ]; then
  echo -e "${RED}Error: docker-compose.yml not found in ${INSTALL_DIR}${NC}"
  exit 1
fi

# get current image ID
echo -e "${BLUE}Checking for updates...${NC}"
CURRENT_ID=$(docker images -q "${IMAGE}" 2>/dev/null || echo "")

# pull latest image
echo -e "${BLUE}Pulling latest image...${NC}"
docker pull "${IMAGE}"

# get new image ID
NEW_ID=$(docker images -q "${IMAGE}" 2>/dev/null || echo "")

if [ "$CURRENT_ID" = "$NEW_ID" ] && [ -n "$CURRENT_ID" ]; then
  echo -e "${GREEN}✓ Already up to date${NC}"
  exit 0
fi

echo -e "${GREEN}✓ New version downloaded${NC}"

# restart service
echo -e "${BLUE}Restarting service...${NC}"

if docker compose version &> /dev/null; then
  docker compose down
  docker compose up -d
else
  docker-compose down
  docker-compose up -d
fi

echo -e "${GREEN}✓ Service restarted${NC}"

# cleanup old images
echo -e "${BLUE}Cleaning up old images...${NC}"
docker image prune -f > /dev/null 2>&1 || true
echo -e "${GREEN}✓ Cleanup complete${NC}"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 Update complete!                          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
