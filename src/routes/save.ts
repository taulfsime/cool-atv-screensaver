import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import logger from '../services/logger';
import tempStorage from '../tempStorage';
import { processImage } from '../services/imageProcessor';

interface SaveRequestBody {
  tempId?: string;
  blur?: number;
  scale?: number;
}

// clamp value to min/max range, use default if invalid
function clampValue(value: unknown, min: number, max: number, defaultValue: number): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return defaultValue;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

// save route handler
async function saveHandler(req: Request, res: Response): Promise<void> {
  const log = logger.get();
  const { tempId, blur, scale } = req.body as SaveRequestBody;

  // validate tempId
  if (!tempId) {
    res.status(400).json({ error: 'Missing tempId' });
    return;
  }

  // get stored image
  const entry = tempStorage.get(tempId);

  if (!entry) {
    res.status(404).json({ error: 'Image not found or expired. Please upload again.' });
    return;
  }

  // validate and clamp settings
  const settings = {
    blur: clampValue(blur, config.limits.blur.min, config.limits.blur.max, config.defaults.blur),
    scale: clampValue(scale, config.limits.scale.min, config.limits.scale.max, config.defaults.scale),
  };

  try {
    // process full resolution image
    const processedBuffer = await processImage(entry.buffer, {
      ...settings,
      outputSize: 'full',
    });

    // generate filename: YYYY-MM-DD_uuid.jpg
    const dateStr = new Date().toISOString().split('T')[0];
    const shortUuid = uuidv4().split('-')[0];
    const filename = `${dateStr}_${shortUuid}.jpg`;
    const outputPath = path.join(config.outputPath, filename);

    // ensure output directory exists
    if (!fs.existsSync(config.outputPath)) {
      fs.mkdirSync(config.outputPath, { recursive: true });
    }

    // write file
    fs.writeFileSync(outputPath, processedBuffer);

    // remove from temp storage
    tempStorage.remove(tempId);

    // log the save
    log.save(filename, settings);

    res.json({
      success: true,
      filename,
      settings,
    });
  } catch (error) {
    const err = error as Error;
    log.error('Save failed', err);
    res.status(500).json({ error: 'Failed to save image' });
  }
}

export default saveHandler;
