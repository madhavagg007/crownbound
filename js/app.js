(() => {
'use strict';
const E = window.Engine, $ = id => document.getElementById(id), CUR = 'crownbound:current', LIB = 'crownbound:library';
const SAMPLE = 'Falcons\nTitans\nWolves\nSharks\nRavens\nKings\nWarriors\nDragons';
let T = null, name = 'Weekend Cup', undoStack = [], timer;
// Elements are built with textContent only, so team names can never inject HTML.
const h = (tag, p = {}, ...kids) => { const e = document.createElement(tag);
  for (const [k, v] of Object.entries(p)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else if (v !== false && v != null) e.setAttribute(k, v); }
  e.append(...kids.flat().filter(x => x != null && x !== false)); return e; };
const toast = (m, undo, kind) => { const t = $('toast'); t.className = 'show ' + (kind || '');
  t.replaceChildren(m, ...(undo ? [h('button', { class: 'tbtn', onclick: () => { undo[1](); t.classList.remove('show'); } }, undo[0])] : []));
  clearTimeout(timer); timer = setTimeout(() => t.classList.remove('show'), undo ? 6000 : 2800); };
const ask = (msg, ok = 'Delete') => new Promise(res => { const d = $('askDlg'); d.returnValue = '';
  d.replaceChildren(h('div', {}, h('h3', {}, msg), h('div', { class: 'btns end' }, h('button', { class: 'secondary', onclick: () => d.close() }, 'Cancel'), h('button', { class: 'dangerfill', onclick: () => d.close('yes') }, ok))));
  d.onclose = () => res(d.returnValue === 'yes'); d.showModal(); });
const snap = () => T ? { n: name, ...E.snap(T) } : null;
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Browser storage is unavailable or full'); } };
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const persist = () => store(CUR, snap());

function open(s) { T = E.fromSnap(s); name = String(s.n || 'Tournament').slice(0, 50); $('name').value = name; $('teams').value = T.teams.join('\n'); $('format').value = T.format; $('third').checked = T.third; syncForm(); }
function act(fn) { const before = snap(); try { fn(); } catch (e) { toast(e.message); return render(); }
  if (before) { undoStack.push(before); if (undoStack.length > 50) undoStack.shift(); } persist(); render(); }
function generate(teams = E.parseTeams($('teams').value)) {
  const f = $('format').value; if (teams.length < 2) return toast('Add at least 2 teams, one per line');
  if (teams.length > (f === 'roundrobin' ? 32 : 64)) return toast(`Maximum ${f === 'roundrobin' ? 32 : 64} teams for this format`);
  act(() => { name = $('name').value.trim().slice(0, 50) || 'Tournament'; T = E.create(teams, f, $('third').checked); }); if ($('newDlg').open) $('newDlg').close(); go('bracket'); if ($('third').checked && f === 'single' && T && !T.third) toast('Third-place match needs two semifinals, so it was skipped'); 
}
function syncForm() { $('third').disabled = $('format').value !== 'single'; }

const ROUND = { W: (r, max, c) => r === max ? 'Final' : r === max - 1 && c === 2 ? 'Semifinals' : r === max - 2 && c === 4 ? 'Quarterfinals' : 'Round ' + r, F: r => r === 1 ? 'Grand final' : 'Bracket reset', R: r => 'Matchday ' + r, T: () => 'Bronze match', L: r => 'Round ' + r };
const STAGE = { W: 'Winners bracket', L: 'Losers bracket', F: 'Grand final', T: 'Third place', R: 'Fixtures' };

function card(m) {
  const slot = side => { const e = m['e' + side], s = m[side], won = m.res && m.res.w === e.t;
    const label = e.t || (e.dead ? 'BYE' : s && s.win ? 'Winner of M' + s.win : s && s.lose ? 'Loser of M' + s.lose : 'TBD');
    const sc = m.res && m.res.sa != null ? (side === 'a' ? m.res.sa : m.res.sb) : '';
    return h('button', { class: 'slot' + (won ? ' win' : '') + (e.t ? '' : ' ph'), disabled: !(m.ea.t && m.eb.t) || null, 'aria-pressed': String(!!won), onclick: () => act(() => E.setResult(T, m.id, { w: e.t })) },
      h('span', { class: 'seed' }, e.t && T.format !== 'roundrobin' ? T.teams.indexOf(e.t) + 1 : ''), h('span', { class: 'nm' }, label), h('b', {}, sc)); };
  const byeIn = [m.a, m.b].some(s => s && ((s.team && m.round > 1) || (s.win && T.by[s.win].round < m.round - 1))), sc = T.sched && T.sched[m.id], when = sc ? [sc.d, sc.t, sc.v].filter(Boolean).join(' · ') : '';
  return h('article', { class: 'match' + (m.auto ? ' auto' : ''), 'data-id': m.id }, h('div', { class: 'meta' }, h('button', { class: 'ghost', 'aria-label': 'Edit match ' + m.id, onclick: () => openMatch(m.id) }, '✎'), 'M' + m.id + (m.auto || byeIn ? ' · bye' : '') + (when ? ' · ' + when : '')), slot('a'), slot('b'));
}
function renderBracket() {
  const root = $('bracket'); root.replaceChildren();
  if (!T) return root.append(h('p', { class: 'empty' }, 'Add teams and generate a tournament to begin.'));
  for (const st of 'WLFTR') {
    const ms = T.matches.filter(m => m.stage === st && !(m.ea.dead && m.eb.dead)); if (!ms.length) continue;
    const max = Math.max(...ms.map(m => m.round)), cols = [];
    for (let r = 1; r <= max; r++) { const rm = ms.filter(m => m.round === r); if (rm.length) cols.push(h('div', { class: 'round' }, h('h4', {}, ROUND[st](r, max, rm.length)), h('div', { class: 'matches' }, rm.map(card)))); }
    root.append(h('h3', {}, st === 'W' && T.format === 'single' ? 'Bracket' : STAGE[st]), h('div', { class: 'rounds' }, cols));
  }
}
function drawLinks() { // elbow connectors from each feeder match to the match it advances into
  if (!T) return; const NS = 'http://www.w3.org/2000/svg';
  document.querySelectorAll('.rounds').forEach(box => {
    box.querySelector('svg')?.remove(); const b = box.getBoundingClientRect(), svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'links'); svg.setAttribute('width', box.scrollWidth); svg.setAttribute('height', box.scrollHeight);
    const pt = (el, right) => { const r = el.getBoundingClientRect(); return [r.left - b.left + box.scrollLeft + (right ? r.width : 0), r.top - b.top + box.scrollTop + r.height / 2]; };
    box.querySelectorAll('.match').forEach(el => { const m = T.by[el.dataset.id];
      for (const s of [m.a, m.b]) { const src = s && s.win && box.querySelector(`[data-id="${s.win}"]`); if (!src) continue;
        const [x1, y1] = pt(src, 1), [x2, y2] = pt(el, 0), mx = (x1 + x2) / 2, p = document.createElementNS(NS, 'path');
        p.setAttribute('d', `M${x1} ${y1}H${mx}V${y2}H${x2}`); svg.append(p); } });
    box.prepend(svg); });
}
function layout(ms) { // simple tree layout used by the PNG export
  const pos = {}, rounds = {}; ms.forEach(m => (rounds[m.round] = rounds[m.round] || []).push(m)); let maxY = 0;
  for (const r of Object.keys(rounds).sort((a, b) => a - b)) { let next = 0;
    for (const m of rounds[r]) { const f = [m.a, m.b].map(s => s && s.win && pos[s.win]).filter(Boolean);
      const y = Math.max(f.length ? f.reduce((a, p) => a + p.y, 0) / f.length : next, next); pos[m.id] = { x: (r - 1) * 240, y }; next = y + 84; maxY = Math.max(maxY, y + 56); } }
  return { pos, w: Object.keys(rounds).length * 240, h: maxY };
}
function exportPng() {
  if (!T) return toast('Generate a tournament first');
  const L = [...'WLFTR'].map(st => { const ms = T.matches.filter(m => m.stage === st && !(m.ea.dead && m.eb.dead)); return { st, ms, ...layout(ms) }; }).filter(s => s.ms.length);
  const W = Math.max(...L.map(s => s.w)) + 60, H = L.reduce((a, s) => a + s.h + 90, 60) + 20, c = document.createElement('canvas');
  c.width = W * 2; c.height = H * 2; const x = c.getContext('2d'); x.scale(2, 2); x.fillStyle = '#0b1020'; x.fillRect(0, 0, W, H); x.textBaseline = 'middle';
  x.font = '700 22px system-ui'; x.fillStyle = '#f3f5fc'; x.fillText(name, 30, 32); const ch = E.champion(T);
  if (ch) { x.fillStyle = '#f4b942'; x.font = '700 15px system-ui'; const t = '🏆 ' + ch; x.fillText(t, W - 30 - x.measureText(t).width, 32); }
  let oy = 60;
  for (const s of L) {
    x.fillStyle = '#97a3bf'; x.font = '700 12px system-ui'; x.fillText((s.st === 'W' && T.format === 'single' ? 'BRACKET' : STAGE[s.st].toUpperCase()), 30, oy + 8); oy += 26;
    x.strokeStyle = '#2a3860'; x.lineWidth = 2;
    for (const m of s.ms) for (const sr of [m.a, m.b]) { const f = sr && sr.win && s.pos[sr.win]; if (!f) continue; const p = s.pos[m.id], x1 = 30 + f.x + 200, y1 = oy + f.y + 28, x2 = 30 + p.x, y2 = oy + p.y + 28, mx = (x1 + x2) / 2;
      x.beginPath(); x.moveTo(x1, y1); x.lineTo(mx, y1); x.lineTo(mx, y2); x.lineTo(x2, y2); x.stroke(); }
    for (const m of s.ms) { const p = s.pos[m.id], px = 30 + p.x, py = oy + p.y; x.fillStyle = '#1a2542'; x.beginPath(); x.roundRect(px, py, 200, 56, 10); x.fill();
      [['a', m.ea], ['b', m.eb]].forEach(([k, e], i) => { const won = m.res && m.res.w === e.t;
        if (won) { x.fillStyle = 'rgba(39,211,168,.25)'; x.fillRect(px + 4, py + i * 26 + 3, 192, 24); }
        x.fillStyle = e.t ? '#f3f5fc' : '#97a3bf'; x.font = (won ? '700 ' : '500 ') + '13px system-ui'; x.textAlign = 'left'; x.fillText((e.t || (e.dead ? 'BYE' : 'TBD')).slice(0, 22), px + 10, py + i * 26 + 15);
        if (m.res && m.res.sa != null) { x.textAlign = 'right'; x.fillText(String(k === 'a' ? m.res.sa : m.res.sb), px + 190, py + i * 26 + 15); x.textAlign = 'left'; } }); }
    oy += s.h + 64;
  }
  c.toBlob(b => { const a = h('a', { href: URL.createObjectURL(b), download: name.replace(/[^\w-]+/g, '-') + '.png' }); a.click(); URL.revokeObjectURL(a.href); });
}
function renderTable() {
  const p = $('table'); p.replaceChildren();
  if (!T || T.format !== 'roundrobin') return p.append(h('p', { class: 'empty' }, 'Standings are shown for round robin tournaments.'));
  p.append(h('table', {}, h('thead', {}, h('tr', {}, ['#', 'Team', 'P', 'W-D-L', 'Diff', 'Pts'].map(x => h('th', {}, x)))),
    h('tbody', {}, E.standings(T).map((s, i) => h('tr', {}, h('td', {}, i + 1), h('td', {}, s.team), h('td', {}, s.p), h('td', {}, `${s.w}-${s.d}-${s.l}`), h('td', {}, s.pf - s.pa), h('td', {}, h('b', {}, s.pts)))))));
}
function renderLibrary() {
  const p = $('library'), lib = read(LIB, []); p.replaceChildren();
  if (!lib.length) return p.append(h('p', { class: 'empty' }, 'Saved tournaments appear here.'));
  lib.slice().reverse().forEach(s => p.append(h('div', { class: 'row lib' }, h('span', {}, `${s.n} · ${s.f} · ${s.t.length} teams · ${new Date(s.id).toLocaleDateString()}`),
    h('button', { class: 'secondary', onclick: () => { try { undoStack = []; open(s); persist(); render(); go('bracket'); } catch (e) { toast(e.message); } } }, 'Load'),
    h('button', { class: 'danger', onclick: async () => { if (!await ask(`Delete saved "${s.n}"?`)) return; const all = read(LIB, []); store(LIB, all.filter(x => x.id !== s.id)); renderLibrary(); toast('Deleted from Library', ['Undo', () => { store(LIB, all); renderLibrary(); }]); } }, 'Delete'))));
}
let flt = 'all';
const go = t => document.querySelector(`.tab[data-tab="${t}"]`).click(), openNew = () => $('newDlg').showModal();
const kpi = (v, l) => h('div', { class: 'kpi' }, h('b', {}, v), l);
function renderDash() {
  const p = $('dash'); p.replaceChildren();
  if (!T) return p.append(h('div', { class: 'hero' }, h('div', { class: 'crown' }, '👑'), h('h2', {}, 'Run your first tournament'), h('p', {}, 'Seed teams, track results and crown a champion. Works offline, no sign-up.'),
    h('div', { class: 'btns' }, h('button', { onclick: openNew }, 'New tournament'), h('button', { class: 'secondary', onclick: () => { $('teams').value = SAMPLE; generate(); } }, 'Try the 8-team sample'))));
  const st = E.stats(T), pct = st.total ? Math.round(st.played / st.total * 100) : 0, up = T.matches.filter(m => m.ea.t && m.eb.t && !m.res);
  p.append(h('div', { class: 'kpis' }, kpi(T.teams.length, 'Teams'), kpi(st.total, 'Matches'), kpi(st.played, 'Played'), kpi(pct + '%', 'Complete')), h('div', { class: 'bar' }, h('i', { style: `width:${pct}%` })), h('h3', {}, 'Up next'),
    h('div', {}, up.length ? up.slice(0, 6).map(m => h('div', { class: 'row next' }, h('span', {}, `M${m.id} · ${STAGE[m.stage]}`),
      h('button', { class: 'secondary', onclick: () => act(() => E.setResult(T, m.id, { w: m.ea.t })) }, m.ea.t), h('button', { class: 'secondary', onclick: () => act(() => E.setResult(T, m.id, { w: m.eb.t })) }, m.eb.t),
      h('button', { class: 'ghost', 'aria-label': 'Match details', onclick: () => openMatch(m.id) }, '⋯'))) : h('p', { class: 'empty' }, E.champion(T) ? 'All matches played.' : 'Nothing is ready yet.')));
}
function renderMatches() {
  const p = $('matches'); p.replaceChildren(); if (!T) return p.append(h('p', { class: 'empty' }, 'Create a tournament to see its matches.'));
  const all = T.matches.filter(m => !(m.ea.dead || m.eb.dead)), shown = all.filter(m => flt === 'all' || (flt === 'done' ? m.res : m.ea.t && m.eb.t && !m.res));
  p.append(h('div', { class: 'chips' }, [['all', 'All'], ['ready', 'Ready'], ['done', 'Done']].map(([k, l]) => h('button', { class: 'chip' + (flt === k ? ' on' : ''), onclick: () => { flt = k; renderMatches(); } }, l))));
  if (!shown.length) p.append(h('p', { class: 'empty' }, 'No matches here yet.'));
  for (const m of shown) { const s = (T.sched || {})[m.id], when = s ? [s.d, s.t, s.v].filter(Boolean).join(' · ') : '', r = m.res;
    p.append(h('button', { class: 'mcard', onclick: () => openMatch(m.id) }, h('span', { class: 'mid' }, 'M' + m.id), h('span', { class: 'mt' }, h('b', {}, (m.ea.t || 'TBD') + ' vs ' + (m.eb.t || 'TBD')), h('small', {}, [STAGE[m.stage], when].filter(Boolean).join(' · '))),
      h('span', { class: 'badge' + (r ? ' ok' : '') }, r ? (r.sa != null ? r.sa + ' – ' + r.sb : 'Done') : m.ea.t && m.eb.t ? 'Ready' : 'Waiting'))); }
}
function openMatch(id) {
  const m = T.by[id], d = $('matchDlg'), s = (T.sched || {})[id] || {}, r = m.res || {}, ready = m.ea.t && m.eb.t;
  const num = (v, l) => h('input', { type: 'number', min: 0, value: v ?? '', 'aria-label': l }), a = num(r.sa, (m.ea.t || '') + ' score'), b = num(r.sb, (m.eb.t || '') + ' score');
  const f = (k, type, ph) => [k, h('input', { type, placeholder: ph, 'aria-label': ph, value: s[k] || '' })], fs = [f('d', 'date', 'Date'), f('t', 'time', 'Time'), f('v', 'text', 'Court / venue')];
  d.replaceChildren(h('div', {}, h('h3', {}, `M${id} · ${m.ea.t || 'TBD'} vs ${m.eb.t || 'TBD'}`),
    ready ? [h('div', { class: 'mrow' }, h('span', {}, m.ea.t), a), h('div', { class: 'mrow' }, h('span', {}, m.eb.t), b)] : h('p', { class: 'hint' }, 'Scores unlock when both teams are known.'),
    h('div', { class: 'sched' }, fs.map(x => x[1])),
    h('div', { class: 'btns end' }, ready && m.res ? h('button', { class: 'danger', onclick: () => { act(() => E.setResult(T, id, { clear: true })); d.close(); } }, 'Clear result') : null, h('button', { class: 'secondary', onclick: () => d.close() }, 'Close'),
      h('button', { onclick: () => { act(() => { if (ready && (a.value !== '' || b.value !== '')) E.setResult(T, id, { sa: a.value, sb: b.value }); fs.forEach(([k, i]) => E.setSched(T, id, k, i.value)); }); d.close(); } }, 'Save'))));
  d.showModal();
}
function render() {
  $('title').textContent = name; $('undo').disabled = !undoStack.length;
  const st = T ? E.stats(T) : { total: 0, played: 0, open: 0 }, champ = T && E.champion(T);
    $('status').textContent = champ ? 'Champion: ' + champ : T ? `${st.played}/${st.total} played` : 'Ready';
  $('champion').replaceChildren(...(champ ? [h('div', { class: 'champion' }, '🏆 Champion · ' + champ)] : []));
  renderDash(); renderBracket(); renderMatches(); renderTable(); renderLibrary(); requestAnimationFrame(drawLinks);
}

document.querySelectorAll('.tab').forEach(t => t.onclick = () => { document.querySelectorAll('.tab,.panel').forEach(x => x.classList.remove('on')); t.classList.add('on'); $(t.dataset.tab).classList.add('on'); if (t.dataset.tab === 'bracket') requestAnimationFrame(drawLinks); });
$('format').onchange = syncForm; $('generate').onclick = () => generate();
$('sample').onclick = () => { $('teams').value = SAMPLE; generate(); };
$('shuffle').onclick = () => { const a = E.parseTeams($('teams').value); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } $('teams').value = a.join('\n'); };
$('undo').onclick = () => { const s = undoStack.pop(); if (s) { open(s); persist(); render(); } };
$('reset').onclick = async () => { if (!T) return toast('Nothing to delete'); if (!await ask(`Delete "${name}"? Copies saved in Library are kept.`)) return;
  const prev = snap(); T = null; undoStack = []; localStorage.removeItem(CUR); $('teams').value = ''; render(); go('dash'); toast('Tournament deleted', ['Undo', () => { open(prev); persist(); render(); }]); };
$('resetRes').onclick = async () => { if (!T) return toast('Nothing to reset'); if (await ask('Clear all results and start over? Teams and schedule are kept.', 'Reset')) act(() => { const s = T.sched; T = E.create(T.teams, T.format, T.third); T.sched = s; }); };
$('save').onclick = () => { if (!T) return toast('Generate a tournament first'); const s = { id: Date.now(), ...snap() };
  store(LIB, [...read(LIB, []).filter(x => !(x.n === s.n && x.f === s.f)), s].slice(-20)); renderLibrary(); toast('Saved to Library', null, 'ok'); };
$('share').onclick = async () => { if (!T) return toast('Generate a tournament first'); const url = location.href.split('#')[0] + '#t=' + E.encode(snap());
  try { await navigator.clipboard.writeText(url); toast('Link copied', null, 'ok'); } catch (e) { prompt('Copy this link:', url); } };
$('exportBtn').onclick = () => { if (!T) return toast('Generate a tournament first'); const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(snap(), null, 1)], { type: 'application/json' })), download: name.replace(/[^\w-]+/g, '-') + '.json' }); a.click(); URL.revokeObjectURL(a.href); };
$('newBtn').onclick = openNew; $('cancelNew').onclick = () => $('newDlg').close(); $('pngBtn').onclick = exportPng; $('printBtn').onclick = () => window.print(); window.addEventListener('resize', drawLinks);
$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const s = JSON.parse(await f.text()); undoStack = []; open(s); persist(); render(); toast('Imported', null, 'ok'); } catch (err) { toast(err.message || 'Could not read that file'); } };

document.querySelectorAll('.menu button').forEach(b => b.addEventListener('click', () => b.closest('details').removeAttribute('open')));
addEventListener('keydown', e => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector('dialog[open]')) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); $('undo').click(); } else if (e.key === 'n') { e.preventDefault(); openNew(); } });
try { const m = location.hash.match(/^#t=([\w-]+)$/); if (m) open(E.decode(m[1])); else if (read(CUR, null)) open(read(CUR)); } catch (e) { T = null; toast('Could not open the saved tournament'); }
if (location.hash) history.replaceState(null, '', location.pathname);
syncForm(); render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js');
})();
