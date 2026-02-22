import type { Config } from './types';

// required environment variables
const required = ['UPLOAD_PASSWORD', 'SESSION_SECRET'] as const;

for (const key of required) {
  if (!process.env[key]) {
    console.error(`ERROR: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const config: Config = {
  // server
  port: parseInt(process.env.PORT || '8443', 10),
  certsPath: process.env.CERTS_PATH || './certs',

  // authentication
  uploadPassword: process.env.UPLOAD_PASSWORD!,
  sessionSecret: process.env.SESSION_SECRET!,

  // processing
  previewDebounceMs: parseInt(process.env.PREVIEW_DEBOUNCE_MS || '300', 10),
  tempStorageMaxMb: parseInt(process.env.TEMP_STORAGE_MAX_MB || '50', 10),
  tempStorageTtlMs: 10 * 60 * 1000, // 10 minutes

  // output
  outputPath: process.env.OUTPUT_PATH || './output',

  // logging
  logPath: process.env.LOG_PATH || './logs',
  logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '30', 10),

  // image processing defaults
  defaults: {
    blur: 40,
    scale: 85,
  },

  // image processing limits
  limits: {
    blur: { min: 10, max: 100 },
    scale: { min: 60, max: 100 },
    maxUploadBytes: 25 * 1024 * 1024, // 25 MB
  },

  // output dimensions
  output: {
    full: { width: 3840, height: 2160 },
    preview: { width: 960, height: 540 },
  },

  // allowed mime types
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
  ],
};

export default config;
