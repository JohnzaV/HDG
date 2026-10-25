/* Heading math shared by the app and its Node tests. No browser dependencies. */
(function (root) {
  'use strict';
  const STEPS = [5, 15, 30];
  function normalize(value) { return ((value % 360) + 360) % 360; }
  function format(value) { return String(normalize(value) || 360).padStart(3, '0'); }
  function difference(answer, target) { return normalize(answer - target + 180) - 180; }
  function parse(value) {
    const raw = String(value).trim();
    if (!/^\d{1,3}$/.test(raw)) return null;
    const number = Number(raw);
    return number <= 360 ? normalize(number) : null;
  }
  function pickHeading(step, previous, rng = Math.random) {
    if (!STEPS.includes(step)) throw new RangeError('Unsupported target step');
    const values = Array.from({length: 360 / step}, (_, index) => index * step)
      .filter(value => value !== previous);
    return values[Math.min(values.length - 1, Math.max(0, Math.floor(rng() * values.length)))];
  }
  function point(heading, radius, center = {x: 450, y: 380}) {
    const angle = normalize(heading) * Math.PI / 180;
    return {x: center.x + radius * Math.sin(angle), y: center.y - radius * Math.cos(angle)};
  }
  function assess(answer, target, tolerance) {
    if (answer === null) return {answer: null, target, delta: null, error: null, hit: false};
    const delta = difference(answer, target);
    return {answer, target, delta, error: Math.abs(delta), hit: Math.abs(delta) <= tolerance};
  }
  function summarize(records) {
    const answered = records.filter(record => record.answer !== null);
    const total = records.length;
    const hits = records.filter(record => record.hit).length;
    return {
      total, hits,
      accuracy: total ? Math.round(hits / total * 100) : null,
      meanError: answered.length ? answered.reduce((sum, record) => sum + record.error, 0) / answered.length : null,
      meanTime: answered.length ? answered.reduce((sum, record) => sum + record.seconds, 0) / answered.length : null
    };
  }
  const api = {normalize, format, difference, parse, pickHeading, point, assess, summarize};
  root.HeadingMath = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
