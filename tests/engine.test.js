const test = require('node:test'), assert = require('node:assert'), E = require('../js/engine.js');
const play = (t, id, side) => { const m = t.by[id]; E.setResult(t, id, { w: (side === 'a' ? m.ea : m.eb).t }); };
const L = n => 'ABCDEFGHIJKLMNOP'.slice(0, n).split('');

test('parseTeams trims, dedupes case-insensitively, ignores blanks', () => assert.deepStrictEqual(E.parseTeams('A\n a \n\nB, C\nb'), ['A', 'B, C', 'b']));
test('seedOrder gives standard pairings', () => assert.deepStrictEqual(E.seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]));
test('single elimination with odd teams: only one team gets a bye, everyone else plays round 1', () => {
  const t = E.create(L(5), 'single'); assert.strictEqual(t.matches.length, 4);
  const r1 = t.matches.filter(m => m.round === 1); assert.strictEqual(r1.length, 2);
  assert.ok(!r1.some(m => m.ea.t === 'A' || m.eb.t === 'A')); assert.strictEqual(t.by[3].ea.t, 'A');
});
test('single elimination: byes per team count = count % 2 in round 1, n-1 matches, always completes', () => {
  for (let n = 2; n <= 40; n++) { const t = E.create(L(n).concat(Array.from({ length: Math.max(0, n - 16) }, (_, i) => 'X' + i)).slice(0, n), 'single');
    const r1 = t.matches.filter(m => m.round === 1).length; assert.strictEqual(n - 2 * r1, n % 2, 'round 1 byes for ' + n); assert.strictEqual(t.matches.length, n - 1);
    let g = 0; while (g++ < 99) { const m = t.matches.find(x => x.ea.t && x.eb.t && !x.res); if (!m) break; play(t, m.id, 'a'); } assert.ok(E.champion(t), 'champion for ' + n); }
});
test('winner propagation, un-pick and stale-result clearing', () => {
  const t = E.create(L(4), 'single'); play(t, 1, 'a'); play(t, 2, 'a'); play(t, 3, 'b');
  assert.strictEqual(E.champion(t), 'B'); play(t, 1, 'b'); // change an earlier result
  assert.strictEqual(t.by[3].res, null); assert.strictEqual(E.champion(t), null);
});
test('ties are rejected in elimination but allowed in round robin', () => {
  assert.throws(() => E.setResult(E.create(L(4), 'single'), 1, { sa: 2, sb: 2 }), /level/);
  const r = E.create(L(4), 'roundrobin'); E.setResult(r, 1, { sa: 1, sb: 1 }); assert.strictEqual(E.standings(r).filter(x => x.d).length, 2);
});
test('third place match is fed by the semifinal losers', () => {
  const t = E.create(L(4), 'single', true); play(t, 1, 'a'); play(t, 2, 'a');
  const m = t.matches.at(-1); assert.strictEqual(m.stage, 'T'); assert.deepStrictEqual([m.ea.t, m.eb.t], ['D', 'C']);
});
test('double elimination: winners-side champion ends it, reset game is skipped', () => {
  const t = E.create(L(4), 'double'); assert.strictEqual(t.matches.length, 7);
  play(t, 1, 'a'); play(t, 2, 'a'); play(t, 3, 'a'); play(t, 4, 'a'); play(t, 5, 'b'); play(t, 6, 'a');
  assert.strictEqual(E.champion(t), 'A'); assert.strictEqual(E.stats(t).open, 0);
});
test('double elimination: losers-side winner forces a reset game', () => {
  const t = E.create(L(4), 'double'); play(t, 1, 'a'); play(t, 2, 'a'); play(t, 3, 'a'); play(t, 4, 'a'); play(t, 5, 'b'); play(t, 6, 'b');
  assert.strictEqual(E.champion(t), null); assert.ok(t.by[7].ea.t && t.by[7].eb.t); play(t, 7, 'b'); assert.strictEqual(E.champion(t), 'B');
});
test('double elimination works with byes (3, 5 and 8 teams reach a champion)', () => {
  for (const n of [3, 5, 8]) { const t = E.create(L(n), 'double'); let guard = 0;
    while (!E.champion(t) && guard++ < 99) { const m = t.matches.find(x => x.ea.t && x.eb.t && !x.res); play(t, m.id, 'a'); }
    assert.ok(E.champion(t), 'champion for ' + n); }
});
test('round robin schedules each pair exactly once', () => {
  for (const n of [4, 5]) { const t = E.create(L(n), 'roundrobin'), seen = new Set();
    t.matches.forEach(m => seen.add([m.ea.t, m.eb.t].sort().join())); assert.strictEqual(seen.size, n * (n - 1) / 2); assert.strictEqual(t.matches.length, seen.size); }
});
test('standings: points, then goal difference', () => {
  const t = E.create(L(3), 'roundrobin'); E.setResult(t, 1, { sa: 3, sb: 0 }); const s = E.standings(t); assert.strictEqual(s[0].team, 'B'); assert.strictEqual(s[0].pts, 3);
});
test('share codes round-trip and bad input is rejected', () => {
  const t = E.create(['Zoë 🏆', 'B', 'C', 'D'], 'double'); play(t, 1, 'a');
  const back = E.fromSnap(E.decode(E.encode(E.snap(t)))); assert.strictEqual(back.by[1].w, 'Zoë 🏆'); assert.strictEqual(back.by[3].ea.t, 'Zoë 🏆');
  assert.throws(() => E.fromSnap({ f: 'x', t: [] }), /valid/); assert.throws(() => E.fromSnap({ f: 'single', t: ['a', 'A'] }), /team/);
});
test('schedule details are validated and survive a share round-trip', () => {
  const t = E.create(L(4), 'single'); E.setSched(t, 1, 'v', 'Court 2'); E.setSched(t, 1, 'd', '2026-10-10');
  const back = E.fromSnap(E.decode(E.encode(E.snap(t)))); assert.deepStrictEqual(back.sched[1], { v: 'Court 2', d: '2026-10-10' });
  assert.throws(() => E.setSched(t, 99, 'v', 'x'), /Unknown/); assert.throws(() => E.setSched(t, 1, 'zz', 'x'), /Unknown/);
});
