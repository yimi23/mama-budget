// What a reason means. Pure, deterministic, no model: an occasion makes an item a plan, not a want (rules v2 then
// treats it as a need: never scolded). Everything else is a reason she remembers and quotes back, nothing more.

const OCCASIONS = [
  'graduation', 'wedding', 'interview', 'birthday', 'funeral', 'exam', 'visa', 'flight home', 'trip home', 'convocation',
  'baby', 'naming', 'anniversary', 'conference', 'first day', 'internship', 'presentation', 'church', 'mosque', 'hospital',
  'prescription', 'glasses', 'winter', 'school', 'class', 'course', 'textbook', 'work', 'job',
];

/** The occasion named in a reason, or null. "for my graduation next week" -> "graduation". */
function occasionOf(reason) {
  const r = String(reason || '').toLowerCase();
  if (!r.trim()) return null;
  return OCCASIONS.find((o) => r.includes(o)) || null;
}

/** A reason that is only a want dressed up: nothing to plan around. */
function isJustWant(reason) {
  return /\b(just want|because i want|i like it|looks nice|treat myself|why not|no reason)\b/i.test(String(reason || ''));
}

module.exports = { occasionOf, isJustWant, OCCASIONS };
