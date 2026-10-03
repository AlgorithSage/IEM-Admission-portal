const Upload = require('../models/Upload');
const { httpError } = require('./workflow.service');

/**
 * Atomically claims the caller's unconsumed uploads. Returns them keyed like the input map, or throws.
 * Call releaseUploads() if the operation that needed them fails.
 */
const claimUploads = async (ownerId, idsBySlot) => {
  const entries = Object.entries(idsBySlot).filter(([, id]) => id);
  const ids = entries.map(([, id]) => String(id));
  if (new Set(ids).size !== ids.length) throw httpError(400, 'The same file cannot be used for two documents.');
  const now = new Date();
  const claimed = await Upload.updateMany(
    { _id: { $in: ids }, owner: String(ownerId), consumedAt: null },
    { $set: { consumedAt: now } }
  ).catch(() => ({ modifiedCount: 0 }));
  if (claimed.modifiedCount !== ids.length) {
    await Upload.updateMany({ _id: { $in: ids }, consumedAt: now }, { $set: { consumedAt: null } }).catch(() => {});
    throw httpError(400, 'One or more uploaded files are missing or were already used. Please upload them again.');
  }
  const uploads = await Upload.find({ _id: { $in: ids } });
  const byId = new Map(uploads.map((u) => [String(u._id), u]));
  return Object.fromEntries(entries.map(([slot, id]) => [slot, byId.get(String(id))]));
};

const releaseUploads = (uploadsBySlot) =>
  Upload.updateMany({ _id: { $in: Object.values(uploadsBySlot).map((u) => u._id) } }, { $set: { consumedAt: null } }).catch(() => {});

/** Document reference embedded in an application for a claimed upload. */
const refFromUpload = (upload) => ({
  storage: upload.storage,
  fileName: upload.storage === 'blob' ? upload.pathname : upload.key,
  filePath: upload.storage === 'blob' ? upload.key : '',
  originalName: upload.originalName,
  mimeType: upload.mimeType,
  fileSize: upload.size,
  uploadedAt: new Date(),
  verification: { status: 'Pending', remarks: '' }
});

module.exports = { claimUploads, releaseUploads, refFromUpload };
