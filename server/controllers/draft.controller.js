const Draft = require('../models/Draft');
const Upload = require('../models/Upload');
const { httpError } = require('../services/workflow.service');

const MAX_DRAFT_BYTES = 50 * 1024;
const SLOT_RE = /^(classXMarksheet|classXIIMarksheet|graduationMarksheet|scorecard_[A-Z_]+)$/;

const view = (d) => (d ? { data: d.data, documents: d.documents, step: d.step, updatedAt: d.updatedAt } : null);

// @desc    The applicant's saved draft (or null)
// @route   GET /api/applications/my-draft
const getDraft = async (req, res, next) => {
  try {
    const draft = await Draft.findOne({ owner: String(req.user.id) });
    res.status(200).json({ success: true, draft: view(draft) });
  } catch (error) {
    next(error);
  }
};

// @desc    Save the form as a draft. Only the caller's own, not-yet-used uploads can be referenced.
// @route   PUT /api/applications/my-draft   { data, documents, step }
const saveDraft = async (req, res, next) => {
  try {
    const { data, documents, step } = req.body || {};
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw httpError(400, 'Nothing to save.');
    if (JSON.stringify(req.body).length > MAX_DRAFT_BYTES) throw httpError(413, 'Draft is too large.');

    // Keep only well-formed document entries that point to the caller's unconsumed uploads
    const entries = Object.entries(documents && typeof documents === 'object' ? documents : {}).filter(
      ([slot, doc]) => SLOT_RE.test(slot) && doc && typeof doc.uploadId === 'string'
    );
    const owned = await Upload.find({
      _id: { $in: entries.map(([, d]) => d.uploadId).filter((id) => /^[a-f0-9]{24}$/.test(id)) },
      owner: String(req.user.id),
      consumedAt: null
    }).select('_id originalName mimeType size');
    const byId = new Map(owned.map((u) => [String(u._id), u]));
    const cleanDocs = {};
    entries.forEach(([slot, d]) => {
      const u = byId.get(d.uploadId);
      if (u) cleanDocs[slot] = { uploadId: String(u._id), name: u.originalName, type: u.mimeType, size: u.size };
    });

    const { declaration, ...values } = data; // the declaration must be ticked again at submission
    const draft = await Draft.findOneAndUpdate(
      { owner: String(req.user.id) },
      { $set: { data: values, documents: cleanDocs, step: String(step || '').slice(0, 30) } },
      { new: true, upsert: true }
    );
    res.status(200).json({ success: true, draft: view(draft) });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDraft, saveDraft };
