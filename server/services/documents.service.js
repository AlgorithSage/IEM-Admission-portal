const { COMPETITIVE_EXAMS } = require('../config/admission.rules');

/**
 * Lists every uploaded document on an application as addressable slots.
 * key   — stable identifier used by the API (e.g. classXMarksheet, scorecard_WBJEE)
 * get() — returns the embedded document reference (or undefined)
 * set() — replaces the embedded document reference
 */
const documentSlots = (app) => {
  const slots = [];
  if (app.classX) {
    slots.push({ key: 'classXMarksheet', label: 'Class X Marksheet', get: () => app.classX.marksheet, set: (ref) => { app.classX.marksheet = ref; } });
  }
  if (app.classXII) {
    slots.push({
      key: 'classXIIMarksheet',
      label: 'Class XII Marksheet',
      get: () => app.classXII.marksheet,
      set: (ref) => { app.classXII.marksheet = ref; app.document = ref; }
    });
  } else if (app.document && app.document.fileName) {
    // Applications from the legacy single-document form
    slots.push({ key: 'marksheet', label: 'Marksheet', get: () => app.document, set: (ref) => { app.document = ref; } });
  }
  if (app.graduation) {
    slots.push({ key: 'graduationMarksheet', label: 'Graduation Marksheet', get: () => app.graduation.marksheet, set: (ref) => { app.graduation.marksheet = ref; } });
  }
  (app.competitiveExams || []).forEach((exam) => {
    const label = (COMPETITIVE_EXAMS[exam.exam] || { label: exam.exam }).label;
    slots.push({ key: `scorecard_${exam.exam}`, label: `${label} Scorecard`, get: () => exam.scorecard, set: (ref) => { exam.scorecard = ref; } });
  });
  return slots.filter((slot) => slot.get() && slot.get().fileName);
};

const findSlot = (app, key) => documentSlots(app).find((slot) => slot.key === key);

module.exports = { documentSlots, findSlot };
