const fs = require('fs');
const path = require('path');
const Upload = require('../models/Upload');
const storage = require('../services/storage.service');
const { httpError } = require('../services/workflow.service');

const view = (u) => ({ uploadId: u._id, originalName: u.originalName, mimeType: u.mimeType, size: u.size });

// @desc    Which upload path the client must use
// @route   GET /api/uploads/config
const getConfig = (req, res) => {
  res.status(200).json({ success: true, driver: storage.DRIVER, maxBytes: storage.MAX_BYTES, allowedTypes: storage.ALLOWED_TYPES });
};

// @desc    Upload one file to server disk (local driver only)
// @route   POST /api/uploads   (multipart field: file)
const uploadLocal = async (req, res, next) => {
  try {
    if (storage.DRIVER !== 'local') {
      if (req.file) fs.unlink(req.file.path, () => {});
      throw httpError(400, 'Direct uploads are not enabled. Upload to blob storage instead.');
    }
    if (!req.file) throw httpError(400, 'Attach a file.');
    const upload = await Upload.create({
      owner: String(req.user.id),
      storage: 'local',
      key: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
    res.status(201).json({ success: true, upload: view(upload) });
  } catch (error) {
    next(error);
  }
};

// @desc    Issue a client token for a direct browser -> Vercel Blob upload, and receive Blob's completion callback
// @route   POST /api/uploads/blob-token
const blobToken = async (req, res, next) => {
  try {
    if (storage.DRIVER !== 'blob') throw httpError(400, 'Blob storage is not configured.');
    const { handleUpload } = require('@vercel/blob/client');
    const result = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Authorisation already ran for token requests (see route); the path must be inside the caller's folder
        if (!pathname.startsWith(storage.ownerPrefix(req.user.id)) || pathname.includes('..')) {
          throw httpError(403, 'Upload path not allowed.');
        }
        return {
          allowedContentTypes: storage.ALLOWED_TYPES,
          maximumSizeInBytes: storage.MAX_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000
        };
      },
      // Completion is confirmed explicitly by the client (POST /blob-confirm); the callback needs no work
      onUploadCompleted: async () => {}
    });
    res.status(200).json(result);
  } catch (error) {
    next(error.status ? error : httpError(400, error.message));
  }
};

// @desc    Register a finished blob upload after checking it really exists and belongs to the caller
// @route   POST /api/uploads/blob-confirm   { url, originalName }
const confirmBlob = async (req, res, next) => {
  try {
    if (storage.DRIVER !== 'blob') throw httpError(400, 'Blob storage is not configured.');
    const { url, originalName } = req.body || {};
    if (!url) throw httpError(400, 'Missing blob URL.');
    const meta = await storage.headBlob(url);
    if (!meta) throw httpError(404, 'Uploaded file not found in storage.');
    if (!meta.pathname.startsWith(storage.ownerPrefix(req.user.id))) throw httpError(403, 'This file does not belong to you.');
    if (meta.size > storage.MAX_BYTES || !storage.ALLOWED_TYPES.includes(meta.contentType)) {
      await storage.remove({ storage: 'blob', key: url });
      throw httpError(400, 'Only PDF, JPG or PNG files up to 5 MB are allowed.');
    }
    const existing = await Upload.findOne({ key: meta.url, owner: String(req.user.id) });
    const upload =
      existing ||
      (await Upload.create({
        owner: String(req.user.id),
        storage: 'blob',
        key: meta.url,
        pathname: meta.pathname,
        originalName: String(originalName || path.basename(meta.pathname)).slice(0, 200),
        mimeType: meta.contentType,
        size: meta.size
      }));
    res.status(201).json({ success: true, upload: view(upload) });
  } catch (error) {
    next(error);
  }
};

// @desc    Discard an upload the applicant replaced before submitting
// @route   DELETE /api/uploads/:id
const discardUpload = async (req, res, next) => {
  try {
    const upload = await Upload.findOneAndDelete({ _id: req.params.id, owner: String(req.user.id), consumedAt: null }).catch(() => null);
    if (upload) await storage.remove(upload);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete uploads that were never attached (default: older than 24 hours)
// @route   POST /api/admin/maintenance/cleanup-uploads
const cleanupStaleUploads = async (req, res, next) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stale = await Upload.find({ consumedAt: null, createdAt: { $lt: cutoff } }).limit(500);
    for (const u of stale) await storage.remove(u);
    await Upload.deleteMany({ _id: { $in: stale.map((u) => u._id) } });
    res.status(200).json({ success: true, removed: stale.length });
  } catch (error) {
    next(error);
  }
};

module.exports = { getConfig, uploadLocal, blobToken, confirmBlob, discardUpload, cleanupStaleUploads };
