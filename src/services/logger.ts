import fs from 'fs';
import path from 'path';
import type { LogSettings } from '../types';

class Logger {
  private logPath: string;
  private retentionDays: number;
  private currentDate: string | null = null;
  private currentStream: fs.WriteStream | null = null;

  constructor(logPath: string, retentionDays: number) {
    this.logPath = logPath;
    this.retentionDays = retentionDays;

    this.ensureLogDir();
    this.cleanupOldLogs();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logPath)) {
      fs.mkdirSync(this.logPath, { recursive: true });
    }
  }

  private getDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 19);
  }

  private getLogFilePath(dateString: string): string {
    return path.join(this.logPath, `app-${dateString}.log`);
  }

  private getStream(): fs.WriteStream {
    const dateString = this.getDateString();

    // rotate to new file if date changed
    if (this.currentDate !== dateString) {
      if (this.currentStream) {
        this.currentStream.end();
      }
      this.currentDate = dateString;
      this.currentStream = fs.createWriteStream(
        this.getLogFilePath(dateString),
        { flags: 'a' }
      );
    }

    return this.currentStream!;
  }

  private cleanupOldLogs(): void {
    // skip if retention is 0 (keep all)
    if (this.retentionDays === 0) {
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    try {
      const files = fs.readdirSync(this.logPath);

      for (const file of files) {
        // match app-YYYY-MM-DD.log pattern
        const match = file.match(/^app-(\d{4}-\d{2}-\d{2})\.log$/);
        if (!match) continue;

        const fileDate = new Date(match[1]);
        if (fileDate < cutoffDate) {
          const filePath = path.join(this.logPath, file);
          fs.unlinkSync(filePath);
          this.write('INFO', 'LOG_CLEANUP', `Deleted old log file: ${file}`);
        }
      }
    } catch (err) {
      const error = err as Error;
      console.error(`Failed to cleanup old logs: ${error.message}`);
    }
  }

  private write(level: string, event: string, message: string): void {
    const timestamp = this.getTimestamp();
    const line = `[${timestamp}] ${event}: ${message}\n`;

    // write to console
    if (level === 'ERROR') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }

    // write to file
    try {
      const stream = this.getStream();
      stream.write(line);
    } catch (err) {
      const error = err as Error;
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  // authentication events
  loginSuccess(): void {
    this.write('INFO', 'LOGIN_SUCCESS', 'Session started');
  }

  loginFailed(): void {
    this.write('WARN', 'LOGIN_FAILED', 'Invalid password attempt');
  }

  // upload events
  upload(filename: string, sizeMb: number): void {
    this.write('INFO', 'UPLOAD', `${filename} (${sizeMb.toFixed(2)}MB) - validated`);
  }

  uploadFailed(filename: string, reason: string): void {
    this.write('WARN', 'UPLOAD_FAILED', `${filename} - ${reason}`);
  }

  // save events
  save(outputFilename: string, settings: LogSettings): void {
    const settingsStr = `blur=${settings.blur}, scale=${settings.scale}`;
    this.write('INFO', 'SAVE', `${outputFilename} (${settingsStr})`);
  }

  // error events
  error(message: string, err?: Error): void {
    const errMsg = err ? `${message}: ${err.message}` : message;
    this.write('ERROR', 'ERROR', errMsg);
  }

  // generic info
  info(event: string, message: string): void {
    this.write('INFO', event, message);
  }

  // cleanup on shutdown
  close(): void {
    if (this.currentStream) {
      this.currentStream.end();
      this.currentStream = null;
    }
  }
}

// singleton instance - will be initialized in server.ts
let instance: Logger | null = null;

export function init(logPath: string, retentionDays: number): Logger {
  instance = new Logger(logPath, retentionDays);
  return instance;
}

export function get(): Logger {
  if (!instance) {
    throw new Error('Logger not initialized - call init() first');
  }
  return instance;
}

export default { init, get };
