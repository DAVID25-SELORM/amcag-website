// Helpers for the AMCAG daily question email.
const { QUESTIONS } = require('./question-bank');

const LETTERS = ['A', 'B', 'C', 'D'];
const SITE = 'https://amcag-af624.web.app';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Day number in Africa/Accra (UTC+0 all year, so UTC days work).
// Questions change twice a week (Monday and Thursday). The "day number" is the
// day number of the most recent Monday/Thursday, so every day in between maps to
// the same question. Epoch day 0 was a Thursday: d%7 === 0 Thu, d%7 === 4 Mon.
function dayNumber(date = new Date()) {
  const d = Math.floor(date.getTime() / 86400000);
  const r = d % 7;
  return r >= 4 ? d - (r - 4) : d - r;
}

// The question slot before the given one (Mon -> previous Thu, Thu -> previous Mon).
function previousDayNumber(dayNo) {
  return dayNo % 7 === 4 ? dayNo - 4 : dayNo - 3;
}

// Deterministic shuffle so the correct answer is not always the same letter,
// while a given question always shows its options in the same order.
function seededShuffle(length, seed) {
  let t = (seed + 1) * 0x6D2B79F5;
  const rand = () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const order = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function questionForDay(dayNo) {
  const n = QUESTIONS.length;
  const idx = ((dayNo % n) + n) % n;
  const q = QUESTIONS[idx];
  const order = seededShuffle(q.options.length, idx);
  return {
    index: idx,
    ...q,
    options: order.map((i) => q.options[i]),
    answer: order.indexOf(q.answer)
  };
}

function buildDailyQuestionEmail({ name, today, yesterday, unsubscribeUrl }) {
  const firstName = escapeHtml(String(name || 'Member').split(' ')[0]);
  const options = today.options
    .map((opt, i) => `<tr><td style="padding:6px 10px;font-weight:bold;color:#0b5d3b;width:28px">${LETTERS[i]}.</td><td style="padding:6px 10px">${escapeHtml(opt)}</td></tr>`)
    .join('');

  const yesterdayBlock = yesterday
    ? `<div style="background:#eaf3ee;border-left:4px solid #0b5d3b;padding:12px 16px;margin:24px 0;border-radius:4px">
         <div style="font-size:12px;color:#5a6778;text-transform:uppercase;letter-spacing:.5px">Previous question's answer</div>
         <div style="margin:6px 0 4px"><strong>${escapeHtml(yesterday.question)}</strong></div>
         <div><strong style="color:#0b5d3b">${LETTERS[yesterday.answer]}. ${escapeHtml(yesterday.options[yesterday.answer])}</strong></div>
         <div style="margin-top:6px;color:#33415c">${escapeHtml(yesterday.explanation)}</div>
       </div>`
    : '';

  const html = `<!doctype html><html><body style="margin:0;background:#f3f6f4;font-family:Segoe UI,Arial,sans-serif;color:#1a2433">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:#0b5d3b;color:#fff;padding:18px 24px;border-radius:8px 8px 0 0">
      <div style="font-size:20px;font-weight:bold">AMCAG Question of the Day</div>
      <div style="font-size:13px;opacity:.85">${escapeHtml(today.topic)}</div>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px">
      <p style="margin-top:0">Good morning ${firstName},</p>
      <p style="font-size:17px;line-height:1.5"><strong>${escapeHtml(today.question)}</strong></p>
      <table style="border-collapse:collapse;width:100%;background:#f8faf9;border-radius:6px">${options}</table>
      <p style="text-align:center;margin:22px 0"><a href="${escapeHtml(SITE)}/member-dashboard/daily-question.html" style="background:#0b5d3b;color:#fff;text-decoration:none;padding:13px 28px;border-radius:6px;font-weight:bold;display:inline-block">Answer this question</a></p>
      <p style="color:#5a6778;font-size:14px">Sign in to submit your answer and see the explanation straight away. Your answer is visible to your regional and national executives.</p>
      ${yesterdayBlock}
      <p style="font-size:12px;color:#8892a0;margin-top:28px;line-height:1.5">
        This is a learning aid. Always follow the current Pharmacy Council rules, FDA directives and the Ghana Standard Treatment Guidelines.<br>
        <a href="${escapeHtml(SITE)}" style="color:#0b5d3b">AMCAG website</a> &middot;
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8892a0">Unsubscribe from daily questions</a>
      </p>
    </div>
  </div></body></html>`;

  const text = [
    `Good morning ${String(name || 'Member').split(' ')[0]},`,
    '',
    `AMCAG Question of the Day (${today.topic})`,
    today.question,
    ...today.options.map((o, i) => `${LETTERS[i]}. ${o}`),
    '',
    `Answer online: ${SITE}/member-dashboard/daily-question.html`,
    yesterday ? `\nPrevious question's answer: ${LETTERS[yesterday.answer]}. ${yesterday.options[yesterday.answer]}\n${yesterday.explanation}` : '',
    '',
    `Unsubscribe: ${unsubscribeUrl}`
  ].join('\n');

  return { subject: `Question of the Day: ${today.topic}`, html, text };
}

module.exports = { dayNumber, previousDayNumber, questionForDay, buildDailyQuestionEmail, escapeHtml, seededShuffle };
