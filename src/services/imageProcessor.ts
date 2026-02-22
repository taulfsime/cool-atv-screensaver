import sharp from 'sharp';
import convert from 'heic-convert';
import config from '../config';
import type { ProcessingOptions, ValidationResult } from '../types';

// check if buffer is HEIC/HEIF format
function isHeic(buffer: Buffer): boolean {
  // HEIC files start with ftyp box containing heic, heix, hevc, or mif1
  if (buffer.length < 12) return false;
  
  const ftypBox = buffer.slice(4, 8).toString('ascii');
  if (ftypBox !== 'ftyp') return false;
  
  const brand = buffer.slice(8, 12).toString('ascii');
  return ['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heis', 'hevc', 'hevx'].includes(brand);
}

// convert HEIC to JPEG buffer
async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  const result = await convert({
    buffer,
    format: 'JPEG',
    quality: 1,
  });
  
  return Buffer.from(result);
}

// normalize buffer - convert HEIC to JPEG if needed
async function normalizeBuffer(buffer: Buffer): Promise<Buffer> {
  if (isHeic(buffer)) {
    return convertHeicToJpeg(buffer);
  }
  return buffer;
}

// process image with blurred background and centered foreground
export async function processImage(buffer: Buffer, options: ProcessingOptions = {}): Promise<Buffer> {
  const {
    blur = config.defaults.blur,
    scale = config.defaults.scale,
    outputSize = 'full',
  } = options;

  // convert HEIC to JPEG if needed
  const normalizedBuffer = await normalizeBuffer(buffer);

  // get output dimensions based on size type
  const dimensions = outputSize === 'preview'
    ? config.output.preview
    : config.output.full;

  // get source image metadata
  const metadata = await sharp(normalizedBuffer).metadata();

  // validate portrait orientation
  if (!metadata.width || !metadata.height || metadata.width >= metadata.height) {
    throw new Error('Image must be portrait orientation (height > width)');
  }

  // create blurred background
  // resize to cover the output dimensions, then blur
  const background = await sharp(normalizedBuffer)
    .resize(dimensions.width, dimensions.height, {
      fit: 'cover',
      position: 'center',
    })
    .blur(blur)
    .toBuffer();

  // calculate foreground size based on scale percentage
  // scale is percentage of output height the foreground should fill
  const maxHeight = Math.round(dimensions.height * (scale / 100));
  const maxWidth = Math.round(dimensions.width * (scale / 100));

  // resize foreground to fit within scaled bounds while maintaining aspect ratio
  const foreground = await sharp(normalizedBuffer)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: false,
    })
    .toBuffer();

  // get actual foreground dimensions for centering
  const fgMetadata = await sharp(foreground).metadata();

  if (!fgMetadata.width || !fgMetadata.height) {
    throw new Error('Failed to get foreground dimensions');
  }

  // calculate position to center foreground
  const left = Math.round((dimensions.width - fgMetadata.width) / 2);
  const top = Math.round((dimensions.height - fgMetadata.height) / 2);

  // composite foreground onto background
  const result = await sharp(background)
    .composite([{
      input: foreground,
      left,
      top,
    }])
    .jpeg({ quality: 95 })
    .toBuffer();

  return result;
}

// validate image buffer and return metadata
export async function validateImage(buffer: Buffer): Promise<ValidationResult> {
  try {
    // convert HEIC to JPEG if needed for validation
    const normalizedBuffer = await normalizeBuffer(buffer);
    const metadata = await sharp(normalizedBuffer).metadata();

    // check format (after normalization, HEIC becomes JPEG)
    const format = metadata.format;
    const validFormats = ['jpeg', 'png'];

    if (!format || !validFormats.includes(format)) {
      return {
        valid: false,
        error: `Invalid format: ${format}. Allowed: JPG, PNG, HEIC`,
      };
    }

    // check dimensions exist
    if (!metadata.width || !metadata.height) {
      return {
        valid: false,
        error: 'Could not determine image dimensions',
      };
    }

    // check orientation
    if (metadata.width >= metadata.height) {
      return {
        valid: false,
        error: 'Image must be portrait orientation (height > width)',
      };
    }

    return {
      valid: true,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format!,
      },
    };
  } catch (err) {
    const error = err as Error;
    return {
      valid: false,
      error: `Failed to read image: ${error.message}`,
    };
  }
}

// generate preview as base64 data URL
export async function generatePreviewBase64(buffer: Buffer, options: ProcessingOptions = {}): Promise<string> {
  const processed = await processImage(buffer, {
    ...options,
    outputSize: 'preview',
  });

  const base64 = processed.toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

export default {
  processImage,
  validateImage,
  generatePreviewBase64,
};
