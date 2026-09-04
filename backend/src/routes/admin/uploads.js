const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { put } = require('@vercel/blob');
const { fromBuffer } = require('file-type');
const { asyncHandler } = require('../../middleware/errors');

const router = express.Router();

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

function handleUploadMiddlewareError(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ error: 'File too large — 5MB maximum' });
  next(err);
}

// POST /admin/upload-image — admin/supervisor content image upload
router.post('/upload-image', upload.single('file'), handleUploadMiddlewareError, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  // The client-supplied mimetype is just a request header the caller
  // controls — verify the actual file bytes before trusting it, so a
  // renamed/mislabeled file (e.g. an HTML/SVG payload sent as
  // "image/png") can't get published to public blob storage.
  const sniffed = await fromBuffer(req.file.buffer);
  if (!sniffed || !ALLOWED_MIME_TYPES.includes(sniffed.mime))
    return res.status(400).json({ error: 'Unsupported file type. Use JPEG, PNG, WEBP, or GIF.' });

  const filename = `${uuidv4()}.${sniffed.ext}`;

  const blob = await put(filename, req.file.buffer, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: sniffed.mime,
  });

  res.status(201).json({ url: blob.url });
}));

module.exports = router;
