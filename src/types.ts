import { Session } from 'express-session';

// extend express-session types
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
  }
}

// config types
export interface Config {
  port: number;
  certsPath: string;
  uploadPassword: string;
  sessionSecret: string;
  previewDebounceMs: number;
  tempStorageMaxMb: number;
  tempStorageTtlMs: number;
  outputPath: string;
  logPath: string;
  logRetentionDays: number;
  defaults: {
    blur: number;
    scale: number;
  };
  limits: {
    blur: { min: number; max: number };
    scale: { min: number; max: number };
    maxUploadBytes: number;
  };
  output: {
    full: { width: number; height: number };
    preview: { width: number; height: number };
  };
  allowedMimeTypes: string[];
}

// image processing types
export interface ProcessingOptions {
  blur?: number;
  scale?: number;
  outputSize?: 'full' | 'preview';
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  metadata?: ImageMetadata;
}

// temp storage types
export interface TempStorageEntry {
  buffer: Buffer;
  metadata: {
    originalName: string;
    width: number;
    height: number;
    format: string;
  };
  uploadedAt: number;
  size: number;
}

export interface TempStorageStats {
  count: number;
  usedBytes: number;
  maxBytes: number;
  usedPercent: number;
}

// logger types
export interface LogSettings {
  blur: number;
  scale: number;
}
