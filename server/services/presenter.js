const { documentSlots } = require('./documents.service');
const { allowedTransitionsFor } = require('./workflow.service');

/** Flat list of an application's documents with their verification state (API shape). */
const documentsView = (app) =>
  documentSlots(app).map((slot) => {
    const ref = slot.get();
    return {
      key: slot.key,
      label: slot.label,
      originalName: ref.originalName,
      mimeType: ref.mimeType,
      fileSize: ref.fileSize,
      uploadedAt: ref.uploadedAt,
      verification: {
        status: ref.verification?.status || 'Pending',
        remarks: ref.verification?.remarks || '',
        verifiedAt: ref.verification?.verifiedAt
      }
    };
  });

/** API representation of an application. Admins also get the transitions they may perform. */
const serializeApplication = (app, { forAdmin = false } = {}) => {
  const json = app.toObject({ versionKey: true });
  json.documents = documentsView(app);
  if (forAdmin) json.allowedTransitions = allowedTransitionsFor(app.status);
  return json;
};

/**
 * Adds `available` to each document (does its file still exist?). Used on single-application
 * responses only, since it may cost one storage request per document.
 */
const withAvailability = async (json, app) => {
  const storage = require('./storage.service');
  const slots = documentSlots(app);
  await Promise.all(
    json.documents.map(async (doc) => {
      const slot = slots.find((s) => s.key === doc.key);
      doc.available = slot ? await storage.exists(slot.get()) : false;
    })
  );
  return json;
};

module.exports = { serializeApplication, documentsView, withAvailability };
