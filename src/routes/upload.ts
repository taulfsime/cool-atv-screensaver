import { Request, Response } from 'express';
import multer from 'multer';
import config from '../config';
import logger from '../services/logger';
import tempStorage from '../tempStorage';
import { validateImage, generatePreviewBase64 } from '../services/imageProcessor';

// configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.limits.maxUploadBytes,
  },
  fileFilter: (_req, file, cb) => {
    // check mime type
    if (config.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  },
}).single('image');

// upload route handler
async function uploadHandler(req: Request, res: Response): Promise<void> {
  const log = logger.get();

  // handle multer upload
  upload(req, res, async (err) => {
    if (err) {
      const filename = req.file?.originalname || 'unknown';
      
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const maxMb = config.limits.maxUploadBytes / (1024 * 1024);
          log.uploadFailed(filename, `File too large (max ${maxMb}MB)`);
          res.status(400).json({ error: `File too large. Maximum size is ${maxMb}MB` });
          return;
        }
        log.uploadFailed(filename, err.message);
        res.status(400).json({ error: err.message });
        return;
      }

      log.uploadFailed(filename, err.message);
      res.status(400).json({ error: err.message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filename = req.file.originalname;
    const sizeMb = req.file.size / (1024 * 1024);

    try {
      // validate image
      const validation = await validateImage(req.file.buffer);

      if (!validation.valid || !validation.metadata) {
        log.uploadFailed(filename, validation.error || 'Unknown validation error');
        res.status(400).json({ error: validation.error });
        return;
      }

      // store in temp storage
      const tempId = tempStorage.store(req.file.buffer, {
        originalName: filename,
        ...validation.metadata,
      });

      // generate initial preview with default settings
      const preview = await generatePreviewBase64(req.file.buffer, {
        blur: config.defaults.blur,
        scale: config.defaults.scale,
      });

      log.upload(filename, sizeMb);

      res.json({
        success: true,
        tempId,
        metadata: validation.metadata,
        preview,
        defaults: config.defaults,
      });
    } catch (error) {
      const err = error as Error;
      log.error('Upload processing failed', err);
      res.status(500).json({ error: 'Failed to process image' });
    }
  });
}

export default uploadHandler;
