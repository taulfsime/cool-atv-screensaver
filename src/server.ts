import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import express from 'express';
import session from 'express-session';

import config from './config';
import logger from './services/logger';
import auth from './auth';
import uploadRoute from './routes/upload';
import previewRoute from './routes/preview';
import saveRoute from './routes/save';

// initialize logger
logger.init(config.logPath, config.logRetentionDays);
const log = logger.get();

// check if running in dev mode (no certs required)
const isDev = process.env.NODE_ENV === 'development';

// create express app
const app = express();

// trust proxy for secure cookies behind reverse proxy
app.set('trust proxy', 1);

// parse json bodies
app.use(express.json());

// session middleware
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: !isDev, // allow insecure cookies in dev mode
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// inject config values into upload.html (must be before static middleware)
app.get('/upload.html', auth.requireAuth, (_req, res) => {
  const filePath = path.join(__dirname, 'public', 'upload.html');
  let html = fs.readFileSync(filePath, 'utf8');

  // inject config values
  html = html.replace(/\{\{PREVIEW_DEBOUNCE_MS\}\}/g, String(config.previewDebounceMs));
  html = html.replace(/\{\{DEFAULT_BLUR\}\}/g, String(config.defaults.blur));
  html = html.replace(/\{\{DEFAULT_SCALE\}\}/g, String(config.defaults.scale));
  html = html.replace(/\{\{MIN_BLUR\}\}/g, String(config.limits.blur.min));
  html = html.replace(/\{\{MAX_BLUR\}\}/g, String(config.limits.blur.max));
  html = html.replace(/\{\{MIN_SCALE\}\}/g, String(config.limits.scale.min));
  html = html.replace(/\{\{MAX_SCALE\}\}/g, String(config.limits.scale.max));

  res.type('html').send(html);
});

// serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// auth routes
app.get('/login', auth.loginPage);
app.post('/login', auth.login);

// protected routes
app.get('/', auth.requireAuth, (_req, res) => {
  res.redirect('/upload.html');
});

app.post('/upload', auth.requireAuth, uploadRoute);
app.post('/preview', auth.requireAuth, previewRoute);
app.post('/save', auth.requireAuth, saveRoute);

// error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ensure output directory exists
if (!fs.existsSync(config.outputPath)) {
  fs.mkdirSync(config.outputPath, { recursive: true });
}

// create server (HTTPS in production, HTTP in dev)
let server: http.Server | https.Server;

if (isDev) {
  // dev mode: use HTTP
  server = http.createServer(app);
  log.info('SERVER_MODE', 'Running in development mode (HTTP)');
} else {
  // production mode: use HTTPS
  const certPath = path.join(config.certsPath, 'server.crt');
  const keyPath = path.join(config.certsPath, 'server.key');

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    log.error('TLS certificates not found', new Error(`Expected ${certPath} and ${keyPath}`));
    process.exit(1);
  }

  const httpsOptions = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };

  server = https.createServer(httpsOptions, app);
  log.info('SERVER_MODE', 'Running in production mode (HTTPS)');
}

server.listen(config.port, () => {
  const protocol = isDev ? 'http' : 'https';
  log.info('SERVER_START', `Server listening on ${protocol}://localhost:${config.port}`);
});

// graceful shutdown
const shutdown = (): void => {
  log.info('SERVER_STOP', 'Shutting down...');
  server.close(() => {
    log.close();
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
