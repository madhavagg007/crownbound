/* Crownbound engine: pure tournament logic (no DOM). Matches form a graph; every
   slot is a source: a seeded team, a bye, the winner of a match, or the loser of one. */
(function (g) {
'use strict';
const FORMATS = ['single', 'double', 'roundrobin'];
const win = m => ({ win: m.id }), lose = m => ({ lose: m.id });
const pow2 = n => { let s = 2; while (s < n) s *= 2; return s; };
const seedOrder = n => { let o = [1]; while (o.length < n) { const m = o.length * 2; o = o.flatMap(s => [s, m + 1 - s]); } return o; };
const parseTeams = txt => { const seen = new Set(); return String(txt).split('\n').map(x => x.trim().slice(0, 40)).filter(x => { const k = x.toLowerCase(); if (!x || seen.has(k)) return false; seen.add(k); return true; }); };

function create(teams, format, third) {
  const ms = []; let id = 0, thirdOk = false;
  const add = (stage, round, a, b, x) => { const m = { id: ++id, stage, round, a, b, res: null, ...x }; ms.push(m); return m; };
  if (format === 'roundrobin') { // circle method: every team plays once per matchday
    const l = teams.slice(); if (l.length % 2) l.push(null); const n = l.length;
    for (let r = 1; r < n; r++) { for (let i = 0; i < n / 2; i++) if (l[i] && l[n - 1 - i]) add('R', r, { team: l[i] }, { team: l[n - 1 - i] }); l.splice(1, 0, l.pop()); }
  } else if (format === 'single') {
    // Pair best with worst each round. If the count is odd, only one team (best without a bye yet) skips the round.
    let slots = teams.map((t, i) => ({ rank: i + 1, src: { team: t }, had: false })); const rounds = [];
    while (slots.length > 1) {
      slots.sort((x, y) => x.rank - y.rank); let carry = null;
      if (slots.length % 2) { carry = slots.splice(Math.max(0, slots.findIndex(s => !s.had)), 1)[0]; carry.had = true; }
      const nodes = []; for (let i = 0, j = slots.length - 1; i < j; i++, j--) nodes.push({ a: slots[i], b: slots[j] });
      rounds.push(nodes); slots = nodes.map(nd => ({ rank: Math.min(nd.a.rank, nd.b.rank), node: nd, had: false })); if (carry) slots.push(carry);
    }
    let ord = 0; (function dfs(nd) { nd.ord = ord++; [nd.a, nd.b].forEach(s => { if (s.node) dfs(s.node); }); })(rounds.at(-1)[0]); // keeps feeders next to their parent
    const from = s => s.node ? win(s.node.m) : s.src;
    rounds.forEach((nodes, r) => nodes.sort((x, y) => x.ord - y.ord).forEach(nd => { nd.m = add('W', r + 1, from(nd.a), from(nd.b)); }));
    const fin = rounds.at(-1)[0], sa = fin.a.node, sb = fin.b.node;
    if (third && sa && sb && sa.m.round === fin.m.round - 1 && sb.m.round === fin.m.round - 1) { add('T', 1, lose(sa.m), lose(sb.m)); thirdOk = true; }
  } else {
    const size = pow2(teams.length), order = seedOrder(size);
    const src = s => s <= teams.length ? { team: teams[s - 1] } : { bye: 1 }; // byes go to top seeds
    let cur = []; for (let i = 0; i < size; i += 2) cur.push(add('W', 1, src(order[i]), src(order[i + 1])));
    const wr = [cur];
    for (let r = 2; cur.length > 1; r++) { const nx = []; for (let i = 0; i < cur.length; i += 2) nx.push(add('W', r, win(cur[i]), win(cur[i + 1]))); cur = nx; wr.push(cur); }
    const final = cur[0], k = wr.length;
    {
      let prev = null;
      for (let s = 1; s <= 2 * (k - 1); s++) {
        const cnt = size / 2 ** (Math.ceil(s / 2) + 1), row = [];
        for (let j = 0; j < cnt; j++) row.push(s === 1 ? add('L', 1, lose(wr[0][2 * j]), lose(wr[0][2 * j + 1]))
          : s % 2 ? add('L', s, win(prev[2 * j]), win(prev[2 * j + 1]))
          : add('L', s, win(prev[j]), lose(wr[s / 2][cnt - 1 - j]))); // reversed to delay rematches
        prev = row;
      }
      const gf1 = add('F', 1, win(final), prev ? win(prev[0]) : lose(final));
      add('F', 2, null, null, { reset: gf1.id }); // played only if the losers-side finalist wins GF1
    }
  }
  const t = { format, teams, third: thirdOk, matches: ms };
  return resolve(t);
}

function resolve(t) {
  const by = {}; t.matches.forEach(m => by[m.id] = m); t.by = by;
  const sl = s => { if (s.team) return { t: s.team }; if (s.bye) return { dead: 1 };
    const x = by[s.win || s.lose], v = s.win ? x.w : x.l; return v === undefined ? {} : v === null ? { dead: 1 } : { t: v }; };
  for (const m of t.matches) {
    let a, b;
    if (m.reset) { const g = by[m.reset]; if (g.w === undefined) a = b = {}; else if (g.w === g.eb.t) { a = g.ea; b = g.eb; } else a = b = { dead: 1 }; }
    else { a = sl(m.a); b = sl(m.b); }
    m.ea = a; m.eb = b; m.auto = false;
    if (a.dead || b.dead) { const o = a.dead ? b : a; m.res = null; m.l = null; m.w = o.dead ? null : o.t; m.auto = !!o.t; }
    else if (a.t && b.t) {
      if (m.res && (m.res.ta !== a.t || m.res.tb !== b.t)) m.res = null; // entrants changed: result is stale
      m.w = m.res ? m.res.w : undefined; m.l = m.res && m.res.w ? (m.res.w === a.t ? b.t : a.t) : undefined;
    } else { m.res = null; m.w = m.l = undefined; }
  }
  return t;
}

function setResult(t, id, r) {
  const m = t.by[id]; if (!m || !m.ea.t || !m.eb.t) throw new Error('Both teams must be known first');
  if (r.clear) { m.res = null; return resolve(t); }
  const has = r.sa !== undefined && r.sa !== '' && r.sb !== undefined && r.sb !== '';
  let sa = null, sb = null, w = r.w;
  if (has) {
    sa = Number(r.sa); sb = Number(r.sb);
    if (!Number.isFinite(sa) || !Number.isFinite(sb) || sa < 0 || sb < 0) throw new Error('Scores must be non-negative numbers');
    if (sa === sb) { if (t.format !== 'roundrobin') throw new Error('Elimination matches cannot end level - enter a winning score'); w = ''; }
    else w = sa > sb ? m.ea.t : m.eb.t;
  } else if (w !== m.ea.t && w !== m.eb.t) throw new Error('Enter both scores or pick a winner');
  else if (m.res && m.res.w === w && m.res.sa == null) { m.res = null; return resolve(t); } // click again to undo
  m.res = { ta: m.ea.t, tb: m.eb.t, w, sa, sb };
  return resolve(t);
}

function standings(t) {
  const T = {}; t.teams.forEach(n => T[n] = { team: n, p: 0, w: 0, d: 0, l: 0, pf: 0, pa: 0, pts: 0 });
  for (const m of t.matches) { const r = m.res; if (!r) continue; const A = T[r.ta], B = T[r.tb]; A.p++; B.p++;
    if (r.sa != null) { A.pf += r.sa; A.pa += r.sb; B.pf += r.sb; B.pa += r.sa; }
    if (r.w === '') { A.d++; B.d++; A.pts++; B.pts++; } else { const [x, y] = r.w === r.ta ? [A, B] : [B, A]; x.w++; y.l++; x.pts += 3; } }
  return Object.values(T).sort((x, y) => y.pts - x.pts || (y.pf - y.pa) - (x.pf - x.pa) || y.pf - x.pf || x.team.localeCompare(y.team));
}

function champion(t) {
  if (t.format === 'roundrobin') return t.matches.length && t.matches.every(m => m.res) ? standings(t)[0].team : null;
  if (t.format === 'double') { const g2 = t.matches.at(-1), g1 = t.matches.at(-2); return g1.w && g1.w === g1.ea.t ? g1.w : g2.w || null; }
  return t.matches.filter(m => m.stage === 'W').at(-1).w || null;
}

function stats(t) {
  const act = t.matches.filter(m => !(m.ea.dead || m.eb.dead));
  return { total: act.length, played: act.filter(m => m.res).length, open: act.filter(m => m.ea.t && m.eb.t && !m.res).length };
}

function setSched(t, id, k, v) {
  if (!t.by[id] || !['d', 't', 'v'].includes(k)) throw new Error('Unknown match');
  t.sched = t.sched || {}; const o = { ...t.sched[id], [k]: String(v).slice(0, 40) }; if (!v) delete o[k]; t.sched[id] = o; return t;
}
const snap = t => { const r = {}; t.matches.forEach(m => { if (m.res) r[m.id] = [m.res.w, m.res.sa, m.res.sb]; }); return { f: t.format, t: t.teams, th: t.third, r, s: t.sched || {} }; };
function fromSnap(s) {
  if (!s || typeof s !== 'object' || !FORMATS.includes(s.f) || !Array.isArray(s.t)) throw new Error('Not a valid tournament file');
  const teams = s.t.map(x => String(x).trim().slice(0, 40)).filter(Boolean);
  if (teams.length < 2 || teams.length > (s.f === 'roundrobin' ? 32 : 64) || new Set(teams.map(x => x.toLowerCase())).size !== teams.length) throw new Error('Invalid team list');
  const t = create(teams, s.f, s.th), r = s.r || {}; t.sched = {};
  for (const [i, o] of Object.entries(s.s || {})) if (t.by[i] && o && typeof o === 'object') t.sched[i] = Object.fromEntries(['d', 't', 'v'].filter(k => typeof o[k] === 'string').map(k => [k, o[k].slice(0, 40)]));
  for (const id of Object.keys(r).map(Number).sort((a, b) => a - b)) {
    resolve(t); const m = t.by[id], v = r[id];
    if (m && Array.isArray(v) && m.ea.t && m.eb.t && (v[0] === '' || v[0] === m.ea.t || v[0] === m.eb.t)) m.res = { ta: m.ea.t, tb: m.eb.t, w: v[0], sa: v[1] ?? null, sb: v[2] ?? null };
  }
  return resolve(t);
}
const encode = s => btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = c => JSON.parse(decodeURIComponent(escape(atob(c.replace(/-/g, '+').replace(/_/g, '/')))));

g.Engine = { FORMATS, parseTeams, seedOrder, create, setResult, setSched, standings, champion, stats, snap, fromSnap, encode, decode };
if (typeof module !== 'undefined') module.exports = g.Engine;
})(typeof window !== 'undefined' ? window : globalThis);
