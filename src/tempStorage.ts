import { v4 as uuidv4 } from 'uuid';
import config from './config';
import type { TempStorageEntry, TempStorageStats } from './types';

class TempStorage {
  private maxSizeBytes: number;
  private ttlMs: number;
  private storage: Map<string, TempStorageEntry>;
  private totalSize: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxSizeMb: number, ttlMs: number) {
    this.maxSizeBytes = maxSizeMb * 1024 * 1024;
    this.ttlMs = ttlMs;
    this.storage = new Map();
    this.totalSize = 0;

    // cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  // store a buffer and return its temp ID
  store(buffer: Buffer, metadata: TempStorageEntry['metadata']): string {
    // check if adding this would exceed max size
    if (this.totalSize + buffer.length > this.maxSizeBytes) {
      // try to free space by removing oldest entries
      this.evictOldest(buffer.length);

      // check again after eviction
      if (this.totalSize + buffer.length > this.maxSizeBytes) {
        throw new Error('Temp storage full - try again later');
      }
    }

    const tempId = uuidv4();
    const entry: TempStorageEntry = {
      buffer,
      metadata,
      uploadedAt: Date.now(),
      size: buffer.length,
    };

    this.storage.set(tempId, entry);
    this.totalSize += buffer.length;

    return tempId;
  }

  // get a stored buffer by temp ID
  get(tempId: string): TempStorageEntry | null {
    const entry = this.storage.get(tempId);

    if (!entry) {
      return null;
    }

    // check if expired
    if (Date.now() - entry.uploadedAt > this.ttlMs) {
      this.remove(tempId);
      return null;
    }

    return entry;
  }

  // remove a stored buffer
  remove(tempId: string): boolean {
    const entry = this.storage.get(tempId);

    if (entry) {
      this.totalSize -= entry.size;
      this.storage.delete(tempId);
      return true;
    }

    return false;
  }

  // check if temp ID exists and is valid
  has(tempId: string): boolean {
    return this.get(tempId) !== null;
  }

  // get current usage stats
  stats(): TempStorageStats {
    return {
      count: this.storage.size,
      usedBytes: this.totalSize,
      maxBytes: this.maxSizeBytes,
      usedPercent: Math.round((this.totalSize / this.maxSizeBytes) * 100),
    };
  }

  // cleanup expired entries
  private cleanup(): void {
    const now = Date.now();

    for (const [tempId, entry] of this.storage) {
      if (now - entry.uploadedAt > this.ttlMs) {
        this.remove(tempId);
      }
    }
  }

  // evict oldest entries to free up space
  private evictOldest(neededBytes: number): void {
    // sort entries by upload time (oldest first)
    const entries = Array.from(this.storage.entries())
      .sort((a, b) => a[1].uploadedAt - b[1].uploadedAt);

    let freedBytes = 0;

    for (const [tempId] of entries) {
      if (this.totalSize - freedBytes + neededBytes <= this.maxSizeBytes) {
        break;
      }

      const entry = this.storage.get(tempId);
      if (entry) {
        freedBytes += entry.size;
        this.remove(tempId);
      }
    }
  }

  // cleanup on shutdown
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.storage.clear();
    this.totalSize = 0;
  }
}

// singleton instance
const instance = new TempStorage(config.tempStorageMaxMb, config.tempStorageTtlMs);

export default instance;
