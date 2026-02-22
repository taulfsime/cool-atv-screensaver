# cool-atv-screensaver

[![CI](https://github.com/taulfsime/cool-atv-screensaver/actions/workflows/ci.yml/badge.svg)](https://github.com/taulfsime/cool-atv-screensaver/actions/workflows/ci.yml)

Self-hosted service that converts portrait photos into 4K Apple TV screensaver images with blurred backgrounds.

## Features

- Upload portrait photos via web UI
- Live preview with adjustable blur and scale
- Outputs 4K (3840×2160) images optimized for Apple TV
- Shared family password authentication
- HTTPS with self-signed certificates
- Runs in Docker as non-root user
- Daily rotating logs
- Written in TypeScript

## Quick Start

### One-line install (on your server)

```bash
curl -fsSL https://raw.githubusercontent.com/taulfsime/cool-atv-screensaver/main/scripts/install.sh | bash
```

This will:
- Create `~/cool-atv-screensaver` directory
- Generate self-signed certificates
- Prompt for your family password
- Pull and start the Docker container

### Manual install

#### 1. Generate certificates

```bash
./scripts/generate-certs.sh
```

#### 2. Configure environment

```bash
cp .env.example .env
# edit .env with your password and session secret
```

#### 3. Start the service

```bash
docker-compose up -d
```

</details>

### Access the UI

Open `https://your-server:8443` in your browser.

Your browser will warn about the self-signed certificate — this is expected. Accept the warning to continue.

### Update

```bash
curl -fsSL https://raw.githubusercontent.com/taulfsime/cool-atv-screensaver/main/scripts/update.sh | bash
```

This pulls the latest image and restarts the service.

## Apple TV Setup

1. On your Mac, import processed images from `/srv/photos/processed` into Photos
2. Create an album for your screensaver images
3. On Apple TV: Settings → General → Screen Saver → Type → Photos → Select your album

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `UPLOAD_PASSWORD` | *required* | Shared password for family access |
| `SESSION_SECRET` | *required* | Secret for signing session cookies |
| `PORT` | `8443` | HTTPS port |
| `CERTS_PATH` | `/certs` | Path to TLS certificates |
| `OUTPUT_PATH` | `/srv/photos/processed` | Where processed images are saved |
| `LOG_PATH` | `/logs` | Directory for log files |
| `LOG_RETENTION_DAYS` | `30` | Days to keep log files (0 = forever) |
| `PREVIEW_DEBOUNCE_MS` | `300` | Delay before regenerating preview |
| `TEMP_STORAGE_MAX_MB` | `50` | Max memory for temp image storage |

## Image Processing

- **Input**: Portrait photos (JPG, PNG, HEIC) up to 25MB
- **Output**: 3840×2160 JPEG at 95% quality
- **Background**: Blurred version of the photo (adjustable 10-100)
- **Foreground**: Centered portrait (adjustable 60-100% of frame)

## Logs

Logs are written to daily files in the log directory:

```
logs/
├── app-2026-02-22.log
├── app-2026-02-23.log
└── ...
```

Log format:
```
[2026-02-22 10:30:00] LOGIN_SUCCESS: Session started
[2026-02-22 10:31:00] UPLOAD: photo.jpg (2.40MB) - validated
[2026-02-22 10:32:00] SAVE: 2026-02-22_a1b2c3d4.jpg (blur=45, scale=80)
```

## Deployment

### Option 1: Pull from GitHub Container Registry (recommended)

```bash
docker pull ghcr.io/taulfsime/cool-atv-screensaver:latest
```

### Option 2: Build locally

```bash
# build for current platform
./scripts/build.sh

# build for specific platform (e.g., x86_64 Linux server)
./scripts/build.sh --platform linux/amd64

# build for ARM64 (e.g., Raspberry Pi, ARM server)
./scripts/build.sh --platform linux/arm64
```

### Option 3: Transfer manually

```bash
# save image to file
docker save cool-atv-screensaver:1.0.0 | gzip > cool-atv-screensaver-1.0.0.tar.gz

# copy to server
scp cool-atv-screensaver-1.0.0.tar.gz user@server:~

# on server: load image
gunzip -c cool-atv-screensaver-1.0.0.tar.gz | docker load
```

### Run on server

```bash
# create directories
mkdir -p ~/cool-atv-screensaver/{certs,logs,photos}
cd ~/cool-atv-screensaver

# generate certificates
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout certs/server.key -out certs/server.crt \
  -days 365 -subj "/CN=localhost"

# create .env file
cat > .env << EOF
UPLOAD_PASSWORD=your-family-password
SESSION_SECRET=$(openssl rand -hex 32)
EOF

# create docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  cool-atv-screensaver:
    image: ghcr.io/taulfsime/cool-atv-screensaver:latest
    container_name: cool-atv-screensaver
    ports:
      - "8443:8443"
    env_file: .env
    volumes:
      - ./certs:/certs:ro
      - ./photos:/srv/photos/processed
      - ./logs:/logs
    restart: unless-stopped
EOF

# start
docker-compose up -d
```

## Development

```bash
# install dependencies
npm install

# copy env file
cp .env.example .env

# start dev server (HTTP, hot reload)
npm run dev
```

Open `http://localhost:8443` (HTTP in dev mode, no certs needed).

### Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled build |
| `npm run typecheck` | Type check without emitting |

### Project structure

```
cool-atv-screensaver/
├── src/
│   ├── server.ts           # main entry point
│   ├── config.ts           # environment config
│   ├── auth.ts             # authentication
│   ├── tempStorage.ts      # in-memory image storage
│   ├── types.ts            # typescript types
│   ├── routes/
│   │   ├── upload.ts       # POST /upload
│   │   ├── preview.ts      # POST /preview
│   │   └── save.ts         # POST /save
│   ├── services/
│   │   ├── imageProcessor.ts  # sharp processing
│   │   └── logger.ts          # file logging
│   └── public/
│       ├── login.html
│       ├── upload.html
│       ├── styles.css
│       └── app.js
├── dist/                   # compiled output (gitignored)
├── Dockerfile
├── docker-compose.yml
└── tsconfig.json
```

## Security

- HTTPS only in production (HTTP in dev mode)
- Secure session cookies (HttpOnly, Secure, SameSite=Strict)
- Non-root container user
- Read-only container filesystem
- No original images retained
- Randomized output filenames

## License

MIT
