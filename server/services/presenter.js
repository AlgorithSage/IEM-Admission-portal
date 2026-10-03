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

module.exports = { serializeApplication, documentsView };
