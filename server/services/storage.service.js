const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { uploadDir } = require('../middlewares/upload.middleware');

/**
 * Document storage.
 *   blob  — Vercel Blob (private access). Used whenever BLOB_READ_WRITE_TOKEN is set (Vercel injects it
 *           when a Blob store is connected to the project). Browsers upload directly to Blob, so no
 *           request through the API carries file bytes (avoids the 4.5 MB serverless body limit).
 *   local — server disk (development). Not suitable for serverless: /tmp is per-instance and ephemeral.
 */
const DRIVER = process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'local';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

// Lazily loaded so local development does not need the Blob SDK initialised
const blobSdk = () => require('@vercel/blob');

const localPath = (fileName) => {
  const safe = path.basename(fileName || '');
  return safe ? path.join(uploadDir, safe) : null;
};

/** Sends a stored document to the HTTP response. Returns false when the file no longer exists. */
const streamTo = async (ref, res) => {
  if (ref.storage === 'blob') {
    const result = await blobSdk().get(ref.filePath, { access: 'private' });
    if (!result || !result.stream) return false;
    Readable.fromWeb(result.stream).pipe(res);
    return true;
  }
  const p = localPath(ref.fileName);
  if (!p || !fs.existsSync(p)) return false;
  res.sendFile(p);
  return true;
};

/** Best-effort delete; storage clean-up must never fail the business operation. */
const remove = async ({ storage, key, fileName, filePath }) => {
  try {
    if (storage === 'blob') {
      await blobSdk().del(key || filePath);
    } else {
      const p = localPath(key || fileName);
      if (p) fs.unlink(p, () => {});
    }
  } catch (err) {
    console.error('[Storage] Delete failed:', err.message);
  }
};

/** Metadata of an uploaded blob, or null when it does not exist. */
const headBlob = async (url) => {
  try {
    return await blobSdk().head(url);
  } catch (err) {
    if (err && err.name === 'BlobNotFoundError') return null;
    throw err;
  }
};

/** Pathname prefix each applicant may upload to; enforced when issuing client upload tokens. */
const ownerPrefix = (userId) => `applicants/${String(userId).replace(/[^a-zA-Z0-9_-]/g, '')}/`;

module.exports = { DRIVER, MAX_BYTES, ALLOWED_TYPES, streamTo, remove, headBlob, ownerPrefix };
