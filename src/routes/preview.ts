import { Request, Response } from 'express';
import config from '../config';
import logger from '../services/logger';
import tempStorage from '../tempStorage';
import { generatePreviewBase64 } from '../services/imageProcessor';

interface PreviewRequestBody {
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

// preview route handler
async function previewHandler(req: Request, res: Response): Promise<void> {
  const log = logger.get();
  const { tempId, blur, scale } = req.body as PreviewRequestBody;

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
    const preview = await generatePreviewBase64(entry.buffer, settings);

    res.json({
      success: true,
      preview,
      settings,
    });
  } catch (error) {
    const err = error as Error;
    log.error('Preview generation failed', err);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
}

export default previewHandler;
