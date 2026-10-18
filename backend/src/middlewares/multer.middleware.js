import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Ensure temp directory exists
const tempDir = path.join(process.cwd(), 'public', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // Never build a path from the client's filename: "../../x" would escape tempDir.
    const ext = path.extname(path.basename(file.originalname || '')).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 10);
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

// KYC documents, deposit slips and profile photos: images or PDF, 10 MB max.
export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_TYPES.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Only JPG, PNG, WEBP or PDF files are allowed'));
  },
});

export const supportUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype?.startsWith('image/') && file.mimetype !== 'image/svg+xml') return cb(null, true);
    return cb(new Error('Only image files are allowed for support attachments'));
  },
});
