const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../engine.js');

test('North accepts both 000 and 360; invalid input cannot score', () => {
  assert.equal(M.parse('000'), 0);
  assert.equal(M.parse('360'), 0);
  assert.equal(M.parse('90'), 90);
  for (const value of ['', '361', '-1', '1.5', '1e2', 'Infinity', '0000']) assert.equal(M.parse(value), null);
});
test('Shortest angular error crosses north in both directions', () => {
  assert.equal(M.difference(5, 355), 10);
  assert.equal(M.difference(355, 5), -10);
  assert.equal(M.difference(360, 0), 0);
  assert.equal(Math.abs(M.difference(90, 270)), 180);
});
test('Radar cardinal and intercardinal bearings preserve geometry', () => {
  for (const [heading, x, y] of [[0, 450, 280], [90, 550, 380], [180, 450, 480], [270, 350, 380]]) {
    const point = M.point(heading, 100);
    assert.ok(Math.abs(point.x - x) < 1e-8);
    assert.ok(Math.abs(point.y - y) < 1e-8);
  }
  const diagonal = M.point(45, 100);
  assert.ok(Math.abs(diagonal.x - 450 - (380 - diagonal.y)) < 1e-8);
});
test('Every target is on the selected grid; all values are reachable and consecutive repeats excluded', () => {
  for (const step of [5, 15, 30]) {
    const count = 360 / step;
    const generated = new Set();
    for (let index = 0; index < count; index++) generated.add(M.pickHeading(step, undefined, () => (index + .5) / count));
    assert.equal(generated.size, count);
    for (const target of generated) {
      assert.equal(target % step, 0);
      for (const rng of [0, .5, .999999]) assert.notEqual(M.pickHeading(step, target, () => rng), target);
    }
  }
});
test('Hit tolerance is inclusive and independent of grid spacing', () => {
  assert.equal(M.assess(5, 0, 5).hit, true);
  assert.equal(M.assess(354, 0, 5).hit, false);
  assert.equal(M.assess(0, 0, 0).hit, true);
  assert.equal(M.assess(1, 0, 0).hit, false);
});
test('A timed-out target counts as a miss without skewing answered-heading means', () => {
  const stats = M.summarize([
    {...M.assess(5, 0, 5), seconds: 2},
    {...M.assess(330, 0, 5), seconds: 4},
    {...M.assess(null, 15, 5), seconds: 8}
  ]);
  assert.deepEqual(stats, {total: 3, hits: 1, accuracy: 33, meanError: 17.5, meanTime: 3});
});
test('An empty session has no invented accuracy or averages', () => {
  assert.deepEqual(M.summarize([]), {total: 0, hits: 0, accuracy: null, meanError: null, meanTime: null});
});

test('A 2.5-second radar step covers the distance given by ground speed', () => {
  const start = {x: 450, y: 380};
  const at240 = M.move(start, 90, 240, 2.5);
  const at480 = M.move(start, 90, 480, 2.5);
  assert.ok(Math.abs(at240.x - start.x - 25 / 6) < 1e-9);
  assert.equal(at240.y, start.y);
  assert.ok(Math.abs((at480.x - start.x) / (at240.x - start.x) - 2) < 1e-9);
  assert.deepEqual(M.move(start, 0, 240, 0), start);
});
test('The answer is computed from the displaced aircraft to a fixed waypoint', () => {
  const waypoint = {x: 450, y: 180};
  const original = {x: 450, y: 380};
  const displaced = {x: 650, y: 380};
  assert.equal(M.answerHeading(original, waypoint), 0);
  assert.equal(M.answerHeading(displaced, waypoint), 315);
  assert.deepEqual(waypoint, {x: 450, y: 180});
  assert.equal(M.assess(315, M.answerHeading(displaced, waypoint), 0).hit, true);
  assert.equal(M.assess(0, M.answerHeading(displaced, waypoint), 0).hit, false);
});
test('Dynamic answers round to whole degrees and normalize rounding through north', () => {
  const start = {x: 450, y: 380};
  assert.equal(M.answerHeading(start, M.point(359.7, 200, start)), 0);
  assert.equal(M.answerHeading(start, M.point(234.6, 200, start)), 235);
  const stepped = M.move(M.move(start, 225, 280, 2.5), 225, 280, 2.5);
  const batched = M.move(start, 225, 280, 5);
  assert.ok(Math.hypot(stepped.x - batched.x, stepped.y - batched.y) < 1e-9);
});
