/* OMR engine for the Vietnamese THPT 2025 answer sheet (Phiếu trả lời trắc nghiệm).
   Pure JS, no dependencies. Works on RGBA pixel buffers in the browser or Node. */
const OMR = (function () {
  'use strict';

  // ---------------------------------------------------------------- template
  // All coordinates in PDF points (595 x 842), origin top-left.
  function buildTemplate() {
    const T = {
      W: 595, H: 842,
      corners: [[34.15, 49.75], [560.55, 49.75], [560.55, 792.05], [34.15, 792.05]], // TL TR BR BL
      cornerSize: 13.5,
      smallSize: 7.6,
      small: [],
      bubbles: [],
      groups: [],
    };
    const sq = [[412.5, 93.7], [501.7, 93.7], [412.5, 264.5], [501.7, 264.5],
      [30.3, 278.2], [162.0, 278.2], [293.6, 278.2], [556.8, 278.2],
      [30.3, 453.6], [162.0, 453.6], [293.6, 453.6], [425.1, 453.6], [556.8, 453.6],
      [30.3, 564.2], [118.0, 564.2], [162.0, 564.2], [205.8, 564.2], [293.6, 564.2], [381.3, 564.2], [425.1, 564.2], [469.0, 564.2], [556.8, 564.2],
      [118.0, 788.3], [205.8, 788.3], [293.6, 788.3], [381.3, 788.3], [469.0, 788.3]];
    T.small = sq.map(([x, y]) => [x + 3.8, y + 3.8]);

    const groupIndex = {};
    function group(key, kind, info) {
      const g = Object.assign({ key, kind, members: [] }, info);
      groupIndex[key] = T.groups.length;
      T.groups.push(g);
      return g;
    }
    function bubble(g, x, y, r, v) {
      g.members.push(T.bubbles.length);
      T.bubbles.push({ x, y, r, g: groupIndex[g.key], v });
    }
    // Số báo danh: 6 columns of digits
    const digY = d => 115.86 + 14.88 * d;
    [432.02, 442.58, 453.02, 463.58, 474.02, 484.58].forEach((x, c) => {
      const g = group('sbd' + c, 'sbd', { col: c });
      for (let d = 0; d < 10; d++) bubble(g, x, digY(d), 3.8, String(d));
    });
    // Mã đề: 3 columns
    [520.34, 530.9, 541.34].forEach((x, c) => {
      const g = group('made' + c, 'made', { col: c });
      for (let d = 0; d < 10; d++) bubble(g, x, digY(d), 3.8, String(d));
    });
    // Phần I: 40 questions A-D
    const p1x = [[65.06, 92.54, 120.02, 147.5], [196.7, 224.18, 251.66, 279.02], [328.34, 355.7, 383.18, 410.66], [459.86, 487.34, 514.82, 542.3]];
    for (let b = 0; b < 4; b++) for (let i = 0; i < 10; i++) {
      const q = b * 10 + i + 1, y = 317.82 + 12.827 * i;
      const g = group('p1_' + q, 'p1', { q });
      'ABCD'.split('').forEach((v, k) => bubble(g, p1x[b][k], y, 4.6, v));
    }
    // Phần II: 8 questions, sub-items a-d, Đúng / Sai
    const p2x = [[65.06, 92.54], [120.02, 147.5], [196.7, 224.18], [251.66, 279.02], [328.34, 355.7], [383.18, 410.66], [459.86, 487.34], [514.82, 542.3]];
    const p2y = [509.46, 522.3, 535.14, 547.98];
    for (let q = 1; q <= 8; q++) for (let s = 0; s < 4; s++) {
      const g = group('p2_' + q + 'abcd'[s], 'p2', { q, sub: s });
      bubble(g, p2x[q - 1][0], p2y[s], 4.6, 'T');
      bubble(g, p2x[q - 1][1], p2y[s], 4.6, 'F');
    }
    // Phần III: 6 questions, 4 columns each
    const p3x = [[65.06, 77.9, 90.74, 103.58], [152.9, 165.62, 178.46, 191.3], [240.62, 253.46, 266.18, 279.02],
      [328.34, 341.18, 353.9, 366.74], [416.06, 428.9, 441.74, 454.46], [503.78, 516.62, 529.46, 542.3]];
    const p3dig = [651.3, 664.14, 676.98, 689.82, 702.66, 715.5, 728.34, 741.06, 753.9, 766.74];
    for (let q = 1; q <= 6; q++) for (let c = 0; c < 4; c++) {
      const g = group('p3_' + q + '_' + c, 'p3', { q, col: c });
      const x = p3x[q - 1][c];
      if (c === 0) bubble(g, x, 625.74, 4.6, '-');
      if (c === 1 || c === 2) bubble(g, x, 638.58, 4.6, ',');
      for (let d = 0; d < 10; d++) bubble(g, x, p3dig[d], 4.6, String(d));
    }
    T.groupIndex = groupIndex;
    return T;
  }
  const TPL = buildTemplate();

  // ---------------------------------------------------------------- image prep
  // Downscale (area average) to maxDim and build the reading channel.
  // Channel = 0.75*R + 0.25*min(R,G,B): pink/red form printing nearly vanishes,
  // pencil and dark ink stay dark.
  function prepare(rgba, w, h, maxDim) {
    maxDim = maxDim || 2000;
    const s = Math.min(1, maxDim / Math.max(w, h));
    const W = Math.max(1, Math.round(w * s)), Hh = Math.max(1, Math.round(h * s));
    const out = new Uint8ClampedArray(W * Hh * 4);
    if (s === 1) out.set(rgba.subarray ? rgba.subarray(0, w * h * 4) : rgba);
    else {
      const inv = 1 / s;
      for (let y = 0; y < Hh; y++) {
        const y0 = Math.floor(y * inv), y1 = Math.min(h, Math.max(y0 + 1, Math.floor((y + 1) * inv)));
        for (let x = 0; x < W; x++) {
          const x0 = Math.floor(x * inv), x1 = Math.min(w, Math.max(x0 + 1, Math.floor((x + 1) * inv)));
          let r = 0, g = 0, b = 0, n = 0;
          for (let yy = y0; yy < y1; yy++) {
            let p = (yy * w + x0) * 4;
            for (let xx = x0; xx < x1; xx++, p += 4) { r += rgba[p]; g += rgba[p + 1]; b += rgba[p + 2]; n++; }
          }
          const o = (y * W + x) * 4;
          out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
        }
      }
    }
    const v = new Uint8Array(W * Hh);
    for (let i = 0, p = 0; i < v.length; i++, p += 4) {
      const r = out[p], g = out[p + 1], b = out[p + 2];
      const mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
      v[i] = 0.75 * r + 0.25 * mn;
    }
    return { w: W, h: Hh, rgba: out, v, scale: s };
  }

  // Bradley adaptive threshold → 1 = dark
  function adaptiveDark(v, w, h, win, t) {
    const I = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        row += v[y * w + x];
        I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row;
      }
    }
    const m = new Uint8Array(w * h), r = win >> 1;
    for (let y = 0; y < h; y++) {
      const ya = Math.max(0, y - r), yb = Math.min(h, y + r + 1);
      for (let x = 0; x < w; x++) {
        const xa = Math.max(0, x - r), xb = Math.min(w, x + r + 1);
        const cnt = (yb - ya) * (xb - xa);
        const sum = I[yb * (w + 1) + xb] - I[ya * (w + 1) + xb] - I[yb * (w + 1) + xa] + I[ya * (w + 1) + xa];
        if (v[y * w + x] * cnt < sum * (1 - t)) m[y * w + x] = 1;
      }
    }
    return m;
  }

  // 8-connected components with moments
  function components(mask, w, h) {
    const lab = new Int32Array(w * h).fill(-1);
    const comps = [];
    const stack = new Int32Array(w * h);
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i] || lab[i] >= 0) continue;
      const id = comps.length;
      let sp = 0; stack[sp++] = i; lab[i] = id;
      let area = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
      while (sp) {
        const p = stack[--sp];
        const x = p % w, y = (p - x) / w;
        area++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; if (xx < 0 || xx >= w) continue;
            const q = yy * w + xx;
            if (mask[q] && lab[q] < 0) { lab[q] = id; stack[sp++] = q; }
          }
        }
      }
      const cx = sx / area, cy = sy / area;
      const cxx = sxx / area - cx * cx + 1 / 12, cyy = syy / area - cy * cy + 1 / 12, cxy = sxy / area - cx * cy;
      const tr = cxx + cyy, det = Math.max(1e-9, cxx * cyy - cxy * cxy);
      const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
      const l1 = tr / 2 + disc, l2 = Math.max(1e-9, tr / 2 - disc);
      comps.push({
        area, cx, cy, x0, y0, x1, y1,
        elong: Math.sqrt(l1 / l2),
        compact: area / (12 * Math.sqrt(det)),
        fill: area / ((x1 - x0 + 1) * (y1 - y0 + 1)),
      });
    }
    return comps;
  }

  // ---------------------------------------------------------------- geometry
  function solve(A, b) { // Gaussian elimination, A n×n (array of arrays), in place
    const n = b.length;
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (Math.abs(A[piv][c]) < 1e-12) return null;
      [A[c], A[piv]] = [A[piv], A[c]];[b[c], b[piv]] = [b[piv], b[c]];
      for (let r = c + 1; r < n; r++) {
        const f = A[r][c] / A[c][c];
        if (!f) continue;
        for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    const x = new Array(n);
    for (let r = n - 1; r >= 0; r--) {
      let s = b[r];
      for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
      x[r] = s / A[r][r];
    }
    return x;
  }
  function normT(pts) {
    let mx = 0, my = 0;
    pts.forEach(p => { mx += p[0]; my += p[1]; });
    mx /= pts.length; my /= pts.length;
    let d = 0;
    pts.forEach(p => { d += Math.hypot(p[0] - mx, p[1] - my); });
    const s = Math.SQRT2 / (d / pts.length || 1);
    return [s, 0, -s * mx, 0, s, -s * my, 0, 0, 1];
  }
  function mul3(A, B) {
    const C = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    return C;
  }
  function inv3(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
      B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
      C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
  }
  function apply(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
  }
  // least-squares homography src→dst (≥4 points)
  function homography(src, dst) {
    const Ts = normT(src), Td = normT(dst);
    const A = Array.from({ length: 8 }, () => new Array(8).fill(0)), b = new Array(8).fill(0);
    for (let k = 0; k < src.length; k++) {
      const [x, y] = apply(Ts, src[k][0], src[k][1]);
      const [u, v] = apply(Td, dst[k][0], dst[k][1]);
      const r1 = [x, y, 1, 0, 0, 0, -u * x, -u * y], r2 = [0, 0, 0, x, y, 1, -v * x, -v * y];
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) A[i][j] += r1[i] * r1[j] + r2[i] * r2[j];
        b[i] += r1[i] * u + r2[i] * v;
      }
    }
    const h = solve(A, b);
    if (!h) return null;
    const Hn = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
    const H = mul3(inv3(Td), mul3(Hn, Ts));
    const s = H[8];
    return H.map(v => v / s);
  }

  // ---------------------------------------------------------------- locate sheet
  function sampleMask(mask, w, h, cx, cy, rad) {
    let n = 0, d = 0;
    const r = Math.max(1, rad);
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      if (y < 0 || y >= h) { n += 2 * r; continue; }
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue;
        n++; if (x >= 0 && x < w && mask[y * w + x]) d++;
      }
    }
    return n ? d / n : 0;
  }
  function polyArea(p) {
    let a = 0;
    for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
    return a / 2;
  }

  function locate(img) {
    const { w, h, v } = img;
    const M = Math.max(w, h);
    let win = Math.round(M / 10) | 1;
    const mask = adaptiveDark(v, w, h, win, 0.3);
    const comps = components(mask, w, h);
    const sMin = 0.006 * M, sMax = 0.06 * M;
    let cand = comps.filter(c => {
      const s = Math.sqrt(c.area);
      return s >= sMin && s <= sMax && c.elong < 1.6 && c.compact > 0.8 && c.compact < 1.2 && c.fill > 0.45;
    });
    cand.sort((a, b) => b.area - a.area);
    cand = cand.slice(0, 16);
    if (cand.length < 4) throw new OMRError('corners', 'Could not find the 4 black corner squares.');

    const quads = [];
    const n = cand.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
      const set = [cand[a], cand[b], cand[c], cand[d]];
      const areas = set.map(s => s.area);
      if (Math.max(...areas) / Math.min(...areas) > 3) continue;
      const mx = (set[0].cx + set[1].cx + set[2].cx + set[3].cx) / 4, my = (set[0].cy + set[1].cy + set[2].cy + set[3].cy) / 4;
      set.sort((p, q) => Math.atan2(p.cy - my, p.cx - mx) - Math.atan2(q.cy - my, q.cx - mx));
      const P = set.map(s => [s.cx, s.cy]);
      let sign = 0, convex = true;
      for (let i = 0; i < 4; i++) {
        const A = P[i], B = P[(i + 1) % 4], C = P[(i + 2) % 4];
        const cr = (B[0] - A[0]) * (C[1] - B[1]) - (B[1] - A[1]) * (C[0] - B[0]);
        const sg = Math.sign(cr);
        if (!sign) sign = sg; else if (sg !== sign) { convex = false; break; }
      }
      if (!convex) continue;
      const L = i => Math.hypot(P[(i + 1) % 4][0] - P[i][0], P[(i + 1) % 4][1] - P[i][1]);
      const s0 = L(0), s1 = L(1), s2 = L(2), s3 = L(3);
      if (Math.max(s0, s2) / Math.min(s0, s2) > 1.8 || Math.max(s1, s3) / Math.min(s1, s3) > 1.8) continue;
      const asp = ((s0 + s2) / 2) / ((s1 + s3) / 2);
      const lr = Math.max(asp, 1 / asp);
      if (lr < 1.12 || lr > 1.9) continue;
      const qa = Math.abs(polyArea(P));
      const ms = areas.reduce((t, x) => t + Math.sqrt(x), 0) / 4;
      const ratio = ms / Math.sqrt(qa);
      if (ratio < 0.011 || ratio > 0.045) continue;
      quads.push({ P, qa, set });
    }
    if (!quads.length) throw new OMRError('corners', 'Could not find the 4 black corner squares.');
    quads.sort((a, b) => b.qa - a.qa);

    // validate orientation with the small squares
    let best = null;
    for (const q of quads.slice(0, 10)) {
      for (let k = 0; k < 4; k++) {
        const dst = [0, 1, 2, 3].map(i => q.P[(i + k) % 4]);
        const H = homography(TPL.corners, dst);
        if (!H) continue;
        const sc = Math.sqrt(Math.abs(polyArea(dst)) / ((560.55 - 34.15) * (792.05 - 49.75)));
        let tot = 0;
        for (const [x, y] of TPL.small) {
          const [u, vv] = apply(H, x, y);
          tot += sampleMask(mask, w, h, u, vv, 2.0 * sc);
        }
        const score = tot / TPL.small.length;
        if (!best || score > best.score) best = { score, H, dst, sc, quad: q, k };
      }
    }
    if (!best || best.score < 0.45) throw new OMRError('orientation', 'Found dark squares but they do not match this answer sheet layout.');

    // refine with every marker we can find
    const sc = best.sc;
    const src = [], dst = [];
    const expSmall = (TPL.smallSize * sc) ** 2, expBig = (TPL.cornerSize * sc) ** 2;
    const markerComps = comps.filter(c => c.area > expSmall * 0.25 && c.area < expBig * 3 && c.elong < 2 && c.fill > 0.4);
    function nearest(u, vv, exp, maxD) {
      let bestC = null, bd = maxD;
      for (const c of markerComps) {
        if (c.area < exp * 0.3 || c.area > exp * 2.5) continue;
        const d = Math.hypot(c.cx - u, c.cy - vv);
        if (d < bd) { bd = d; bestC = c; }
      }
      return bestC;
    }
    TPL.corners.forEach(([x, y]) => {
      const [u, vv] = apply(best.H, x, y);
      const c = nearest(u, vv, expBig, 8 * sc);
      if (c) { src.push([x, y]); dst.push([c.cx, c.cy]); }
    });
    TPL.small.forEach(([x, y]) => {
      const [u, vv] = apply(best.H, x, y);
      const c = nearest(u, vv, expSmall, 7 * sc);
      if (c) { src.push([x, y]); dst.push([c.cx, c.cy]); }
    });
    let H = best.H, used = src.map((_, i) => i);
    if (src.length >= 6) {
      for (let iter = 0; iter < 6; iter++) {
        const Hf = homography(used.map(i => src[i]), used.map(i => dst[i]));
        if (!Hf) break;
        H = Hf;
        let worst = -1, wd = 0;
        used.forEach(i => {
          const [u, vv] = apply(H, src[i][0], src[i][1]);
          const d = Math.hypot(u - dst[i][0], vv - dst[i][1]) / sc;
          if (d > wd) { wd = d; worst = i; }
        });
        if (wd > 4 && used.length > 6) used = used.filter(i => i !== worst); else break;
      }
    }
    // residual field (image px) for paper curl / lens distortion
    const res = used.map(i => {
      const [u, vv] = apply(H, src[i][0], src[i][1]);
      return { x: src[i][0], y: src[i][1], dx: dst[i][0] - u, dy: dst[i][1] - vv };
    });
    let rms = 0;
    res.forEach(r => { rms += (r.dx * r.dx + r.dy * r.dy) / (sc * sc); });
    rms = Math.sqrt(rms / Math.max(1, res.length));
    function map(x, y) {
      const [u, vv] = apply(H, x, y);
      if (!res.length) return [u, vv];
      let sw = 0, sx = 0, sy = 0;
      for (const r of res) {
        const d2 = (x - r.x) * (x - r.x) + (y - r.y) * (y - r.y);
        const wt = 1 / (d2 + 400);
        sw += wt; sx += wt * r.dx; sy += wt * r.dy;
      }
      return [u + sx / sw, vv + sy / sw];
    }
    return { map, H, scale: sc, markers: used.length, markerScore: best.score, rms, corners: best.dst };
  }

  // ---------------------------------------------------------------- reading
  function background(v, w, h) {
    const B = 16;
    const bw = Math.ceil(w / B), bh = Math.ceil(h / B);
    let m = new Float32Array(bw * bh);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      // 90th percentile approximated by max of 2x2-mean to resist noise
      let mx = 0;
      for (let y = by * B; y < Math.min(h, by * B + B); y += 2) for (let x = bx * B; x < Math.min(w, bx * B + B); x += 2) {
        const a = v[y * w + x];
        if (a > mx) mx = a;
      }
      m[by * bw + bx] = mx;
    }
    // dilate (max) twice, then blur
    for (let pass = 0; pass < 2; pass++) {
      const o = new Float32Array(m.length);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        let mx = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const yy = Math.min(bh - 1, Math.max(0, y + dy)), xx = Math.min(bw - 1, Math.max(0, x + dx));
          if (m[yy * bw + xx] > mx) mx = m[yy * bw + xx];
        }
        o[y * bw + x] = mx;
      }
      m = o;
    }
    const o = new Float32Array(m.length);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy < 0 || yy >= bh || xx < 0 || xx >= bw) continue;
        s += m[yy * bw + xx]; n++;
      }
      o[y * bw + x] = s / n;
    }
    return function (x, y) {
      const fx = Math.min(bw - 1, Math.max(0, x / B - 0.5)), fy = Math.min(bh - 1, Math.max(0, y / B - 0.5));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(bw - 1, x0 + 1), y1 = Math.min(bh - 1, y0 + 1);
      const ax = fx - x0, ay = fy - y0;
      return (o[y0 * bw + x0] * (1 - ax) + o[y0 * bw + x1] * ax) * (1 - ay) + (o[y1 * bw + x0] * (1 - ax) + o[y1 * bw + x1] * ax) * ay;
    };
  }
  function bilinear(v, w, h, x, y) {
    if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return 255;
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
    const ax = x - x0, ay = y - y0;
    return (v[y0 * w + x0] * (1 - ax) + v[y0 * w + x1] * ax) * (1 - ay) + (v[y1 * w + x0] * (1 - ax) + v[y1 * w + x1] * ax) * ay;
  }

  function readScores(img, loc) {
    const { w, h, v } = img;
    const bg = background(v, w, h);
    const scores = new Float32Array(TPL.bubbles.length);
    const pts = [];
    const N = 4;
    for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) if (i * i + j * j <= N * N) pts.push([i / N, j / N]);
    TPL.bubbles.forEach((b, k) => {
      const [cx, cy] = loc.map(b.x, b.y);
      const [ux, uy] = loc.map(b.x + 1, b.y);
      const [vx, vy] = loc.map(b.x, b.y + 1);
      const ax = ux - cx, ay = uy - cy, bx = vx - cx, by = vy - cy;
      const ri = b.r * 0.55;
      let s = 0;
      for (const [p, q] of pts) s += bilinear(v, w, h, cx + (ax * p + bx * q) * ri, cy + (ay * p + by * q) * ri);
      s /= pts.length;
      const paper = Math.max(40, bg(cx, cy));
      scores[k] = Math.max(0, Math.min(1, 1 - s / paper));
    });
    return scores;
  }

  function otsu(vals) {
    const bins = 100, hist = new Array(bins).fill(0);
    vals.forEach(x => hist[Math.min(bins - 1, Math.floor(x * bins))]++);
    const total = vals.length;
    let sum = 0; for (let i = 0; i < bins; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 30;
    for (let i = 0; i < bins; i++) {
      wB += hist[i]; if (!wB) continue;
      const wF = total - wB; if (!wF) break;
      sumB += i * hist[i];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thr = i + 1; }
    }
    return thr / bins;
  }

  // Turn scores into filled/not-filled per bubble, plus per-group review flags
  function decide(scores) {
    const all = Array.from(scores);
    const mx = Math.max(...all);
    let thr = 0.3;
    if (mx >= 0.2) {
      // split into empty / filled clusters, then put the cut halfway between their medians
      const t0 = otsu(all);
      const lo = all.filter(s => s < t0).sort((a, b) => a - b), hi = all.filter(s => s >= t0).sort((a, b) => a - b);
      if (lo.length && hi.length) {
        const mE = lo[lo.length >> 1], mF = hi[hi.length >> 1];
        thr = mE + 0.5 * (mF - mE);
      } else thr = t0;
      thr = Math.min(0.45, Math.max(0.18, thr));
    }
    const band = 0.07;
    const filled = new Uint8Array(scores.length);
    const flags = {};
    TPL.groups.forEach(g => {
      const ms = g.members.map(i => ({ i, s: scores[i] })).sort((a, b) => b.s - a.s);
      const s1 = ms[0].s, s2 = ms.length > 1 ? ms[1].s : 0;
      if (s1 < thr) {
        if (s1 > thr - band) flags[g.key] = 'unsure';
        return;
      }
      filled[ms[0].i] = 1;
      if (s2 >= thr) {
        if (s1 - s2 > 0.25 && s2 < thr + 0.1) flags[g.key] = 'unsure'; // likely an erasure next to a real mark
        else {
          ms.forEach(m => { if (m.s >= thr) filled[m.i] = 1; });
          flags[g.key] = 'multi';
        }
      } else if (s1 < thr + band || s2 > thr - band) flags[g.key] = 'unsure';
    });
    return { filled, flags, thr };
  }

  // Read answers from the filled bitmap
  function decode(filled) {
    const val = key => {
      const g = TPL.groups[TPL.groupIndex[key]];
      const on = g.members.filter(i => filled[i]);
      if (!on.length) return null;
      if (on.length > 1) return '*';
      return TPL.bubbles[on[0]].v;
    };
    const digits = (prefix, n) => {
      let s = '';
      for (let c = 0; c < n; c++) { const d = val(prefix + c); s += d === null ? '_' : d === '*' ? '?' : d; }
      return s;
    };
    const out = { sbd: digits('sbd', 6), made: digits('made', 3), p1: [], p2: [], p3: [], p3raw: [] };
    for (let q = 1; q <= 40; q++) out.p1.push(val('p1_' + q));
    for (let q = 1; q <= 8; q++) out.p2.push([0, 1, 2, 3].map(s => val('p2_' + q + 'abcd'[s])));
    for (let q = 1; q <= 6; q++) {
      const cols = [0, 1, 2, 3].map(c => val('p3_' + q + '_' + c));
      out.p3raw.push(cols);
      if (cols.includes('*')) { out.p3.push('*'); continue; }
      const s = cols.filter(c => c !== null).join('');
      out.p3.push(s || null);
    }
    return out;
  }

  // Straightened colour image of the sheet for review (template coords × scale)
  function warp(img, loc, scale) {
    const W = Math.round(TPL.W * scale), H = Math.round(TPL.H * scale);
    const out = new Uint8ClampedArray(W * H * 4);
    const G = 8; // grid step in output px
    const gw = Math.ceil(W / G) + 1, gh = Math.ceil(H / G) + 1;
    const gx = new Float32Array(gw * gh), gy = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const [u, v] = loc.map(i * G / scale, j * G / scale);
      gx[j * gw + i] = u; gy[j * gw + i] = v;
    }
    const { w, h, rgba } = img;
    for (let y = 0; y < H; y++) {
      const fy = y / G, j0 = Math.floor(fy), ay = fy - j0;
      for (let x = 0; x < W; x++) {
        const fx = x / G, i0 = Math.floor(fx), ax = fx - i0;
        const p00 = j0 * gw + i0, p01 = p00 + 1, p10 = p00 + gw, p11 = p10 + 1;
        const sx = (gx[p00] * (1 - ax) + gx[p01] * ax) * (1 - ay) + (gx[p10] * (1 - ax) + gx[p11] * ax) * ay;
        const sy = (gy[p00] * (1 - ax) + gy[p01] * ax) * (1 - ay) + (gy[p10] * (1 - ax) + gy[p11] * ax) * ay;
        const o = (y * W + x) * 4;
        if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) { out[o] = out[o + 1] = out[o + 2] = 200; out[o + 3] = 255; continue; }
        const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
        const bx = sx - x0, by = sy - y0;
        for (let c = 0; c < 3; c++) {
          out[o + c] = (rgba[(y0 * w + x0) * 4 + c] * (1 - bx) + rgba[(y0 * w + x1) * 4 + c] * bx) * (1 - by)
            + (rgba[(y1 * w + x0) * 4 + c] * (1 - bx) + rgba[(y1 * w + x1) * 4 + c] * bx) * by;
        }
        out[o + 3] = 255;
      }
    }
    return { w: W, h: H, data: out };
  }

  function OMRError(code, message) { this.code = code; this.message = message; }
  OMRError.prototype = Object.create(Error.prototype);

  // Full pipeline. Returns {ok, scores, filled, flags, thr, answers, quality, view?} or {ok:false, code, message}
  function analyze(rgba, w, h, opts) {
    opts = opts || {};
    const img = prepare(rgba, w, h, opts.maxDim || 2000);
    let loc;
    try { loc = locate(img); }
    catch (e) {
      if (e instanceof OMRError) return { ok: false, code: e.code, message: e.message };
      throw e;
    }
    const scores = readScores(img, loc);
    const d = decide(scores);
    const res = {
      ok: true, scores, filled: d.filled, flags: d.flags, thr: d.thr,
      answers: decode(d.filled),
      quality: { markers: loc.markers, markerScore: loc.markerScore, rms: loc.rms, pxPerPt: loc.scale },
    };
    if (opts.viewScale) res.view = warp(img, loc, opts.viewScale);
    return res;
  }

  // One unit of work for a background worker (or the main thread as a fallback).
  // detect: find the sheet in a small video frame → page outline in frame pixels
  // read:   full read of a captured frame
  function task(m) {
    if (m.type === 'detect') {
      const img = prepare(new Uint8ClampedArray(m.buf), m.w, m.h, Math.max(m.w, m.h));
      let loc;
      try { loc = locate(img); } catch (e) { return { msg: { id: m.id, ok: false } }; }
      const outline = [[22, 38], [TPL.W - 22, 38], [TPL.W - 22, TPL.H - 38], [22, TPL.H - 38]].map(([x, y]) => loc.map(x, y)); // just outside the 4 corner squares
      return { msg: { id: m.id, ok: true, outline, markers: loc.markers, rms: loc.rms } };
    }
    if (m.type === 'read') {
      const r = analyze(new Uint8ClampedArray(m.buf), m.w, m.h, { maxDim: 2000, viewScale: 1.4 });
      if (!r.ok) return { msg: { id: m.id, ok: false, code: r.code } };
      return {
        msg: { id: m.id, ok: true, filled: r.filled, flags: r.flags, thr: r.thr, answers: r.answers, quality: r.quality, view: r.view },
        transfer: [r.view.data.buffer, r.filled.buffer],
      };
    }
    return { msg: { id: m.id, ok: false, code: 'unknown' } };
  }

  return { TPL, analyze, decode, decide, prepare, locate, readScores, warp, homography, apply, task };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = OMR;
