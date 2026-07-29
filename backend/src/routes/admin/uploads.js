const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { put } = require('@vercel/blob');
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

  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype))
    return res.status(400).json({ error: 'Unsupported file type. Use JPEG, PNG, WEBP, or GIF.' });

  const ext = req.file.originalname.split('.').pop();
  const filename = `${uuidv4()}.${ext}`;

  const blob = await put(filename, req.file.buffer, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: req.file.mimetype,
  });

  res.status(201).json({ url: blob.url });
}));

module.exports = router;
