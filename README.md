# cool-atv-screensaver

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

### 1. Generate certificates

```bash
./scripts/generate-certs.sh
```

This creates self-signed TLS certificates and outputs a session secret.

### 2. Configure environment

```bash
cp .env.example .env
# edit .env with your password and session secret
```

### 3. Start the service

```bash
docker-compose up -d
```

### 4. Access the UI

Open `https://your-server:8443` in your browser.

Your browser will warn about the self-signed certificate — this is expected. Accept the warning to continue.

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
