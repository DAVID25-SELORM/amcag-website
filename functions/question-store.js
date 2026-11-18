// Question bank storage, review workflow and daily scheduling.
//
// Collections:
//   question_bank/{id}            one document per question (status: pending | approved | retired | rejected)
//   daily_question_schedule/{day} frozen snapshot of the question used on a given day, so later edits never
//                                 change what members saw or what executives see in the results
//   question_bank_audit/{auto}    who approved / rejected / retired what
const crypto = require('crypto');
const { QUESTIONS } = require('./question-bank');
const dailyQuestions = require('./daily-questions');

// Days up to and including this one use the original built-in list (they were already emailed or scheduled that way).
const LEGACY_CUTOFF_DAY = 20775; // 2026-11-18
const STATUSES = ['pending', 'approved', 'retired', 'rejected'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function normalise(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function questionId(text) {
  return crypto.createHash('sha1').update(normalise(text)).digest('hex').slice(0, 20);
}

function seedFor(id) {
  return parseInt(crypto.createHash('sha1').update(String(id)).digest('hex').slice(0, 8), 16) % 100000;
}

// Returns { ok, value } or { ok:false, error }.
function validateQuestion(input) {
  const q = input || {};
  const topic = String(q.topic || '').trim();
  const question = String(q.question || '').trim();
  const explanation = String(q.explanation || '').trim();
  const options = Array.isArray(q.options) ? q.options.map((o) => String(o == null ? '' : o).trim()) : [];
  const answer = Number(q.answer);
  const difficulty = DIFFICULTIES.includes(String(q.difficulty || '').toLowerCase())
    ? String(q.difficulty).toLowerCase() : 'medium';
  if (topic.length < 2 || topic.length > 60) return { ok: false, error: 'Topic must be 2-60 characters' };
  if (question.length < 10 || question.length > 500) return { ok: false, error: 'Question must be 10-500 characters' };
  if (options.length !== 4) return { ok: false, error: 'Exactly 4 options are required' };
  if (options.some((o) => !o || o.length > 200)) return { ok: false, error: 'Each option must be 1-200 characters' };
  if (new Set(options.map(normalise)).size !== 4) return { ok: false, error: 'Options must all be different' };
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) return { ok: false, error: 'Answer must be 0-3 (A-D)' };
  if (explanation.length < 10 || explanation.length > 800) return { ok: false, error: 'Explanation must be 10-800 characters' };
  return {
    ok: true,
    value: {
      topic, question, options, answer, explanation, difficulty,
      source: String(q.source || '').trim().slice(0, 200)
    }
  };
}

function shapeFromSnapshot(s) {
  return {
    id: s.questionId || null,
    index: typeof s.legacyIndex === 'number' ? s.legacyIndex : null,
    topic: s.topic, question: s.question, options: s.options, answer: s.answer, explanation: s.explanation
  };
}

function legacyShape(dayNo) {
  const q = dailyQuestions.questionForDay(dayNo);
  return { ...q, id: 'seed-' + String(q.index + 1).padStart(3, '0') };
}

function chooseCandidate(docs, yesterdayTopic) {
  if (!docs.length) return null;
  const withMeta = docs.map((d) => ({
    id: d.id,
    topic: d.get('topic') || '',
    asked: Number(d.get('timesAsked') || 0),
    last: Number(d.get('lastAskedDay') || 0)
  }));
  const min = Math.min(...withMeta.map((c) => c.asked));
  let pool = withMeta.filter((c) => c.asked === min);
  const varied = pool.filter((c) => c.topic !== yesterdayTopic);
  if (varied.length) pool = varied;
  const oldest = Math.min(...pool.map((c) => c.last));
  pool = pool.filter((c) => c.last === oldest);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Question for a day. create=false never writes (used for "yesterday" lookups and old results).
async function getQuestionForDay(db, admin, dayNo, { create = true } = {}) {
  if (dayNo <= LEGACY_CUTOFF_DAY) {
    const ref = db.collection('daily_question_schedule').doc(String(dayNo));
    const existing = await ref.get();
    if (existing.exists) return shapeFromSnapshot(existing.data());
    const l = legacyShape(dayNo);
    if (create) {
      await ref.set({
        dayNo, questionId: l.id, legacyIndex: l.index, topic: l.topic, question: l.question,
        options: l.options, answer: l.answer, explanation: l.explanation,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: false }).catch(() => {});
    }
    return l;
  }

  const ref = db.collection('daily_question_schedule').doc(String(dayNo));
  const existing = await ref.get();
  if (existing.exists) return shapeFromSnapshot(existing.data());
  if (!create) return null;

  const approved = await db.collection('question_bank').where('status', '==', 'approved')
    .select('topic', 'timesAsked', 'lastAskedDay').get();
  let yesterdayTopic = '';
  const ySnap = await db.collection('daily_question_schedule').doc(String(dayNo - 1)).get();
  if (ySnap.exists) yesterdayTopic = ySnap.get('topic') || '';

  const pick = chooseCandidate(approved.docs, yesterdayTopic);
  if (!pick) {
    // Nothing approved yet: keep the original rotation going.
    return legacyShape(dayNo);
  }
  const bankRef = db.collection('question_bank').doc(pick.id);
  return db.runTransaction(async (tx) => {
    const again = await tx.get(ref);
    if (again.exists) return shapeFromSnapshot(again.data());
    const bankSnap = await tx.get(bankRef);
    if (!bankSnap.exists || bankSnap.get('status') !== 'approved') return legacyShape(dayNo);
    const b = bankSnap.data();
    const order = dailyQuestions.seededShuffle(b.options.length, seedFor(pick.id));
    const snap = {
      dayNo, questionId: pick.id, topic: b.topic, question: b.question,
      options: order.map((i) => b.options[i]), answer: order.indexOf(b.answer),
      explanation: b.explanation, createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    tx.set(ref, snap);
    tx.update(bankRef, {
      timesAsked: admin.firestore.FieldValue.increment(1),
      lastAskedDay: dayNo
    });
    return shapeFromSnapshot(snap);
  });
}

module.exports = {
  LEGACY_CUTOFF_DAY, STATUSES, DIFFICULTIES,
  normalise, questionId, validateQuestion, getQuestionForDay, legacyShape
};
