/* Scoring, answer-key parsing and serialisation. Pure functions, no DOM. */
const Logic = (function () {
  'use strict';
  const PRESETS = {
    math: { p1: 0.25, p2: [0.1, 0.25, 0.5, 1], p3: 0.5 },
    sci: { p1: 0.25, p2: [0.1, 0.25, 0.5, 1], p3: 0.25 },
  };
  const DEFAULT_SETTINGS = PRESETS.math;

  function emptyKey() {
    return { p1: Array(40).fill(''), p2: Array.from({ length: 8 }, () => ['', '', '', '']), p3: Array(6).fill('') };
  }
  function cloneSettings(s) { return { p1: s.p1, p2: s.p2.slice(), p3: s.p3 }; }
  const r3 = x => Math.round(x * 1000) / 1000;

  // ---------- Part III numbers
  function normNum(s) { return String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/\./g, ','); }
  function p3Alts(k) { return String(k || '').split(/[;|]/).map(normNum).filter(Boolean); }
  const NUM_RE = /^-?\d+(,\d+)?$/;
  function toNum(s) { return parseFloat(s.replace(',', '.')); }
  function p3Valid(s) { return NUM_RE.test(s); }
  function p3Match(student, key) {
    if (!student || student === '*') return false;
    const s = normNum(student);
    return p3Alts(key).some(k => {
      if (k === s) return true;
      if (p3Valid(k) && p3Valid(s)) return Math.abs(toNum(k) - toNum(s)) < 1e-9;
      return false;
    });
  }
  // a key that cannot be bubbled on the sheet (too long, misplaced comma …)
  function p3Bubbleable(k) {
    return p3Alts(k).every(a => a.length <= 4 && NUM_RE.test(a) && (a.indexOf(',') === -1 || a.indexOf(',') === 1 || a.indexOf(',') === 2));
  }

  // ---------- key stats & scoring
  const p2Used = row => row && row.every(v => v === 'T' || v === 'F');
  function keyStats(key) {
    if (!key) return { n1: 0, n2: 0, n3: 0, p2partial: [] };
    const n1 = key.p1.filter(Boolean).length;
    const n2 = key.p2.filter(p2Used).length;
    const n3 = key.p3.filter(v => normNum(v)).length;
    const p2partial = key.p2.map((row, i) => row.some(Boolean) && !p2Used(row) ? i + 1 : 0).filter(Boolean);
    return { n1, n2, n3, p2partial };
  }
  function maxScore(key, st) {
    const k = keyStats(key);
    return r3(k.n1 * st.p1 + k.n2 * (st.p2[3] || 0) + k.n3 * st.p3);
  }
  function score(ans, key, st) {
    const out = { p1: { c: 0, n: 0, s: 0 }, p2: { c: 0, n: 0, s: 0, perQ: [] }, p3: { c: 0, n: 0, s: 0 }, total: 0, d1: [], d2: [], d3: [] };
    for (let q = 0; q < 40; q++) {
      const k = key.p1[q];
      if (!k) { out.d1.push(null); continue; }
      out.p1.n++;
      const ok = ans.p1[q] === k;
      if (ok) out.p1.c++;
      out.d1.push(ok);
    }
    for (let q = 0; q < 8; q++) {
      const row = key.p2[q];
      if (!p2Used(row)) { out.d2.push(null); out.p2.perQ.push(null); continue; }
      out.p2.n++;
      const d = row.map((v, s) => ans.p2[q][s] === v);
      const c = d.filter(Boolean).length;
      const pts = c ? (st.p2[c - 1] || 0) : 0;
      out.p2.s += pts; out.p2.perQ.push(c); out.d2.push(d);
      if (c === 4) out.p2.c++;
    }
    for (let q = 0; q < 6; q++) {
      const k = key.p3[q];
      if (!normNum(k)) { out.d3.push(null); continue; }
      out.p3.n++;
      const ok = p3Match(ans.p3[q], k);
      if (ok) out.p3.c++;
      out.d3.push(ok);
    }
    out.p1.s = r3(out.p1.c * st.p1);
    out.p2.s = r3(out.p2.s);
    out.p3.s = r3(out.p3.c * st.p3);
    out.total = r3(out.p1.s + out.p2.s + out.p3.s);
    return out;
  }

  // ---------- bitsets (filled bubbles) as hex
  function bitsToHex(bits) {
    let s = '';
    for (let i = 0; i < bits.length; i += 4) {
      const v = (bits[i] ? 8 : 0) | (bits[i + 1] ? 4 : 0) | (bits[i + 2] ? 2 : 0) | (bits[i + 3] ? 1 : 0);
      s += v.toString(16);
    }
    return s;
  }
  function hexToBits(hex, n) {
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const v = parseInt(hex[i >> 2] || '0', 16);
      b[i] = (v >> (3 - (i & 3))) & 1;
    }
    return b;
  }

  // ---------- Excel answer keys
  const LABEL_RE = /^(?:ph[aầ]n|part|p)?\s*(III|II|I|[123])\s*[.\-_:\/\s]\s*(?:c[aâ]u|q)?\s*(\d{1,2})$/i;
  function parseLabel(v) {
    if (v == null) return null;
    const m = String(v).trim().match(LABEL_RE);
    if (!m) return null;
    const part = { I: 1, II: 2, III: 3, '1': 1, '2': 2, '3': 3 }[m[1].toUpperCase()];
    const q = +m[2];
    const lim = [0, 40, 8, 6][part];
    if (q < 1 || q > lim) return null;
    return { part, q };
  }
  function normCode(v) {
    let s = String(v == null ? '' : v).trim();
    if (/^\d+(\.0+)?$/.test(s)) s = String(parseInt(s, 10));
    if (/^\d{1,3}$/.test(s)) s = s.padStart(3, '0');
    return s;
  }
  const TRUE_CH = 'ĐđDdTt1YyVv✓', FALSE_CH = 'SsFf0NnXx✗';
  function parseP2(v) {
    const s = String(v == null ? '' : v).replace(/[\s,;.\-|\/]/g, '');
    if (!s) return { ok: true, row: ['', '', '', ''] };
    const row = s.split('').map(ch => TRUE_CH.includes(ch) ? 'T' : FALSE_CH.includes(ch) ? 'F' : '?');
    if (row.length !== 4 || row.includes('?')) return { ok: false };
    return { ok: true, row };
  }
  function parseP1(v) {
    const s = String(v == null ? '' : v).trim().toUpperCase();
    if (!s) return { ok: true, v: '' };
    if (/^[ABCD]$/.test(s)) return { ok: true, v: s };
    return { ok: false };
  }
  function parseP3(v) {
    if (v == null || v === '') return { ok: true, v: '' };
    let s = typeof v === 'number' ? String(r3(v)).replace('.', ',') : String(v).trim();
    s = p3Alts(s).join('; ');
    if (!s) return { ok: true, v: '' };
    return { ok: p3Bubbleable(s), v: s };
  }
  // aoa: array of rows (arrays of cell values). Returns {keys:{code:key}, problems:[{code,label,value}], count}
  function parseKeyAoa(aoa) {
    const rows = aoa.map(r => (r || []).map(c => c == null ? '' : c));
    const nR = rows.length, nC = Math.max(0, ...rows.map(r => r.length));
    const colHits = Array(nC).fill(0), rowHits = Array(nR).fill(0);
    rows.forEach((r, i) => r.forEach((c, j) => { if (parseLabel(c)) { colHits[j]++; rowHits[i]++; } }));
    const bestCol = colHits.indexOf(Math.max(0, ...colHits)), bestRow = rowHits.indexOf(Math.max(0, ...rowHits));
    const byRows = (colHits[bestCol] || 0) >= (rowHits[bestRow] || 0);
    const get = (i, j) => byRows ? (rows[i] || [])[j] : (rows[j] || [])[i];
    const L = byRows ? bestCol : bestRow;         // index of the label line
    const span = byRows ? nR : nC;                 // along labels
    const across = byRows ? nC : nR;               // along codes
    const labelPos = [];
    for (let i = 0; i < span; i++) { const lb = parseLabel(get(i, L)); if (lb) labelPos.push({ i, lb }); }
    if (labelPos.length < 1) return { keys: {}, problems: [], count: 0, noLabels: true };
    // header line with the codes: the closest line before the first label that has codes
    let H = -1;
    for (let i = labelPos[0].i - 1; i >= 0; i--) {
      let has = false;
      for (let j = 0; j < across; j++) if (j !== L && String(get(i, j)).trim()) { has = true; break; }
      if (has) { H = i; break; }
    }
    const keys = {}, problems = [];
    for (let j = 0; j < across; j++) {
      if (j === L) continue;
      const code = H >= 0 ? normCode(get(H, j)) : '';
      if (!code) continue;
      const key = emptyKey();
      let any = false;
      labelPos.forEach(({ i, lb }) => {
        const raw = get(i, j);
        const label = ['', 'I', 'II', 'III'][lb.part] + '.' + lb.q;
        if (lb.part === 1) { const r = parseP1(raw); if (!r.ok) problems.push({ code, label, value: raw }); else if (r.v) { key.p1[lb.q - 1] = r.v; any = true; } }
        if (lb.part === 2) { const r = parseP2(raw); if (!r.ok) problems.push({ code, label, value: raw }); else if (r.row.some(Boolean)) { key.p2[lb.q - 1] = r.row; any = true; } }
        if (lb.part === 3) { const r = parseP3(raw); if (!r.ok) problems.push({ code, label, value: raw }); if (r.v) { key.p3[lb.q - 1] = r.v; any = true; } }
      });
      if (any) keys[code] = key;
    }
    return { keys, problems, count: Object.keys(keys).length };
  }
  // keys → array of rows in the template layout (questions down, codes across)
  function keysToAoa(keys, codes, labels) {
    const rows = [[labels.question].concat(codes)];
    for (let q = 1; q <= 40; q++) rows.push(['I.' + q].concat(codes.map(c => keys[c] ? keys[c].p1[q - 1] : '')));
    for (let q = 1; q <= 8; q++) rows.push(['II.' + q].concat(codes.map(c => {
      const r = keys[c] ? keys[c].p2[q - 1] : null;
      return r && r.some(Boolean) ? r.map(v => v === 'T' ? labels.T : v === 'F' ? labels.F : '?').join('') : '';
    })));
    for (let q = 1; q <= 6; q++) rows.push(['III.' + q].concat(codes.map(c => keys[c] ? keys[c].p3[q - 1] : '')));
    return rows;
  }

  return { PRESETS, DEFAULT_SETTINGS, emptyKey, cloneSettings, r3, normNum, p3Alts, p3Valid, p3Match, p3Bubbleable, keyStats, maxScore, score, bitsToHex, hexToBits, parseKeyAoa, keysToAoa, parseLabel, normCode, parseP2 };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Logic;
