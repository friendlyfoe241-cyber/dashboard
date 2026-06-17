// First-party file uploads (avatars, résumés, paper PDFs).
//
// Default storage is the local disk under UPLOAD_DIR, served statically at
// /uploads. This works out of the box for dev and self-hosted/persistent-disk
// deployments. On ephemeral hosts (e.g. Render free tier) files are lost on
// restart — point UPLOAD_DIR at a mounted disk, or swap this module for S3/R2
// (the multer storage + publicUrl() are the only things to change).

import multer from 'multer';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(ROOT, '..', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Allowed kinds → permitted MIME types + extension.
const KINDS = {
  avatar: { mimes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], max: 5 * 1024 * 1024 },
  resume: { mimes: ['application/pdf'], max: 15 * 1024 * 1024 },
  pdf: { mimes: ['application/pdf'], max: 30 * 1024 * 1024 },
  image: { mimes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], max: 8 * 1024 * 1024 },
};

const extFor = (mime) => ({ 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'application/pdf': '.pdf' }[mime] || '');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${extFor(file.mimetype)}`),
});

// Returns multer middleware for one file of the given kind; validates type+size.
export function uploadMiddleware(kind) {
  const cfg = KINDS[kind] || KINDS.image;
  return multer({
    storage,
    limits: { fileSize: cfg.max, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (cfg.mimes.includes(file.mimetype)) return cb(null, true);
      cb(new Error(`Only ${cfg.mimes.map((m) => m.split('/')[1]).join(', ')} files are allowed here`));
    },
  }).single('file');
}

// Public URL for a stored file (absolute so cross-origin frontends can use it).
export function publicUrl(req, filename) {
  const base = (process.env.UPLOAD_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return `${base}/uploads/${filename}`;
}
