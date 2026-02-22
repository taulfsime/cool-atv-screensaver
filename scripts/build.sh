#!/bin/bash

# build docker image for cool-atv-screensaver

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMAGE_NAME="cool-atv-screensaver"

# parse arguments
PLATFORM=""
PUSH=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    --push)
      PUSH=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --platform <platform>  Build for specific platform (e.g., linux/amd64, linux/arm64)"
      echo "  --push                 Push to registry after build (not implemented)"
      echo "  -h, --help             Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                          # Build for current platform"
      echo "  $0 --platform linux/amd64   # Build for x86_64 Linux"
      echo "  $0 --platform linux/arm64   # Build for ARM64 Linux"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

cd "$PROJECT_DIR"

# get version from package.json
VERSION=$(node -p "require('./package.json').version")

if [ -z "$VERSION" ]; then
  echo "Error: Could not read version from package.json"
  exit 1
fi

echo "Building $IMAGE_NAME:$VERSION..."
echo ""

# build docker command
BUILD_CMD="docker build"

if [ -n "$PLATFORM" ]; then
  BUILD_CMD="$BUILD_CMD --platform $PLATFORM"
  echo "Platform: $PLATFORM"
fi

BUILD_CMD="$BUILD_CMD -t $IMAGE_NAME:$VERSION -t $IMAGE_NAME:latest ."

echo "Running: $BUILD_CMD"
echo ""

# run build
eval $BUILD_CMD

echo ""
echo "✓ Built successfully"
echo ""
echo "Images created:"
echo "  $IMAGE_NAME:$VERSION"
echo "  $IMAGE_NAME:latest"
echo ""
echo "To save for transfer:"
echo "  docker save $IMAGE_NAME:$VERSION | gzip > $IMAGE_NAME-$VERSION.tar.gz"
echo ""
echo "To load on server:"
echo "  gunzip -c $IMAGE_NAME-$VERSION.tar.gz | docker load"
echo ""

if [ "$PUSH" = true ]; then
  echo "Warning: --push is not implemented yet"
fi
