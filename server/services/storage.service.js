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
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
// On serverless hosts the local disk is per-instance and temporary: files written there are lost, so
// uploads are refused ('unavailable') until a Blob store is connected instead of failing later.
const DRIVER = process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : isServerless ? 'unavailable' : 'local';
if (DRIVER === 'unavailable') {
  console.error('[Storage] BLOB_READ_WRITE_TOKEN is not set on a serverless host: document uploads are disabled. Connect a Vercel Blob store.');
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

// Lazily loaded so local development does not need the Blob SDK initialised
const blobSdk = () => require('@vercel/blob');

// In-memory cache for blobs to make document viewing instantaneous (<10ms)
// Key: filePath (URL) -> { buffer: Buffer, expiresAt: number }
const blobCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL
const MAX_CACHE_ENTRIES = 100;

const localPath = (fileName) => {
  const safe = path.basename(fileName || '');
  return safe ? path.join(uploadDir, safe) : null;
};

/** Sends a stored document to the HTTP response. Returns false when the file no longer exists. */
const streamTo = async (ref, res) => {
  if (ref.storage === 'blob') {
    const cached = blobCache.get(ref.filePath);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('Content-Length', cached.buffer.length);
      res.end(cached.buffer);
      return true;
    }

    const result = await blobSdk().get(ref.filePath, { access: 'private' });
    if (!result || !result.stream) return false;

    // Buffer the stream chunks for caching and fast response
    const chunks = [];
    const reader = result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
    }
    const buffer = Buffer.concat(chunks);

    if (blobCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = blobCache.keys().next().value;
      blobCache.delete(oldestKey);
    }
    blobCache.set(ref.filePath, { buffer, expiresAt: Date.now() + CACHE_TTL_MS });

    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
    return true;
  }
  const p = localPath(ref.fileName);
  if (!p || !fs.existsSync(p)) return false;
  res.sendFile(p);
  return true;
};

/** Whether a stored document's file still exists (local disk check or a Blob HEAD request). */
const exists = async (ref) => {
  try {
    if (ref.storage === 'blob') {
      const cached = blobCache.get(ref.filePath);
      if (cached && cached.expiresAt > Date.now()) return true;
      return !!(await headBlob(ref.filePath));
    }
    const p = localPath(ref.fileName);
    return !!p && fs.existsSync(p);
  } catch (err) {
    console.error('[Storage] Existence check failed:', err.message);
    return true; // unknown: do not tell the applicant to re-upload because of a transient error
  }
};

/** Best-effort delete; storage clean-up must never fail the business operation. */
const remove = async ({ storage, key, fileName, filePath }) => {
  try {
    const blobKey = key || filePath;
    if (blobKey) blobCache.delete(blobKey);
    if (storage === 'blob') {
      await blobSdk().del(blobKey);
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

module.exports = { DRIVER, MAX_BYTES, ALLOWED_TYPES, streamTo, remove, headBlob, exists, ownerPrefix };
