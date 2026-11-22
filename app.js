const $ = id => document.getElementById(id);

/* =====================================================================
   BANNER SET — template measured from BCX2025 (Flag1/Flag2 + Long)
   Flat banner: 260×146. Each piece takes a strip [x0, x0+w) and stretches
   each column between a parabolic top edge and bottom edge
   (a, m, b) = value at the left edge, center and right edge
   ===================================================================== */
const BW = 260, BH = 146;
const PIECES = [
  {id:'Flag1a',    g:'g1', x0:0,   w:86,  h:154, t:[0.35,6.75,0.02], b:[146.88,153.54,147.04]},
  {id:'Flag1b',    g:'g1', x0:86,  w:89,  h:154, t:[7.66,0.47,7.84], b:[154.00,145.81,153.62]},
  {id:'Flag1c',    g:'g1', x0:175, w:85,  h:154, t:[0.15,8.43,0.40], b:[145.59,153.66,145.12]},
  {id:'Flag2a',    g:'g2', x0:1,   w:85,  h:152, t:[6.57,0.28,7.29], b:[151.73,145.50,151.81]},
  {id:'Flag2b',    g:'g2', x0:86,  w:89,  h:154, t:[0.30,7.93,0.12], b:[146.91,153.60,146.50]},
  {id:'Flag2c',    g:'g2', x0:175, w:85,  h:152, t:[6.30,0.31,6.58], b:[151.71,145.43,151.74]},
  {id:'Flag1bLong',g:'g3', x0:88,  w:130, h:154, t:[6.95,0.27,7.65], b:[153.58,146.77,154.14]},
  {id:'Flag2cLong',g:'g3', x0:132, w:128, h:153, t:[5.62,0.42,5.94], b:[152.56,147.24,153.06]},
];
/* Avatar: window of the flat banner (x 63.75, y 13.125, 128×122) stretched to 128×128, rounded corners */
const AVT = {x:63.75, y:13.125, w:128, h:122, size:128, r:28};
function renderAvatar(fc, k) {
  const S = AVT.size*k, c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const r = AVT.r*k;
  g.beginPath();
  if (g.roundRect) g.roundRect(0, 0, S, S, r);
  else { g.moveTo(r,0); g.arcTo(S,0,S,S,r); g.arcTo(S,S,0,S,r); g.arcTo(0,S,0,0,r); g.arcTo(0,0,S,0,r); g.closePath(); }
  g.clip();
  g.drawImage(fc, AVT.x*k, AVT.y*k, AVT.w*k, AVT.h*k, 0, 0, S, S);
  return c;
}
const quad = (u, a, m, b) => a*2*(u-.5)*(u-1) + m*(-4*u*(u-1)) + b*2*u*(u-.5);

let srcImg = null, name = 'sprite', srcData = null;
let flat = null;          // flat banner ImageData at scale k
let pieceCanvases = [];   // [{id, canvas}]
let mode = 'set';

// Downscale by halves to avoid aliasing when shrinking a lot
function drawScaled(img, sx, sy, sw, sh, dw, dh) {
  let cur = document.createElement('canvas'); cur.width = img.width; cur.height = img.height;
  cur.getContext('2d').drawImage(img, 0, 0);
  let cx = sx, cy = sy, cw = sw, ch = sh;
  while (cw / 2 >= dw && ch / 2 >= dh) {
    const nx = Math.max(1, Math.floor(cw / 2)), ny = Math.max(1, Math.floor(ch / 2));
    const c = document.createElement('canvas'); c.width = nx; c.height = ny;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(cur, cx, cy, cw, ch, 0, 0, nx, ny);
    cur = c; cx = 0; cy = 0; cw = nx; ch = ny;
  }
  const out = document.createElement('canvas'); out.width = dw; out.height = dh;
  const g = out.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(cur, cx, cy, cw, ch, 0, 0, dw, dh);
  return out;
}

function buildFlat(k) {
  const W = BW*k, H = BH*k, fit = $('fit').value, iw = srcImg.width, ih = srcImg.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (fit === 'stretch') {
    g.drawImage(drawScaled(srcImg, 0, 0, iw, ih, W, H), 0, 0);
  } else if (fit === 'cover') {
    const s = Math.max(W/iw, H/ih), cw = W/s, ch = H/s;
    g.drawImage(drawScaled(srcImg, (iw-cw)/2, (ih-ch)/2, cw, ch, W, H), 0, 0);
  } else {
    const s = Math.min(W/iw, H/ih), dw = Math.max(1, Math.round(iw*s)), dh = Math.max(1, Math.round(ih*s));
    g.drawImage(drawScaled(srcImg, 0, 0, iw, ih, dw, dh), Math.round((W-dw)/2), Math.round((H-dh)/2));
  }
  return c;
}

function renderPiece(F, k, P, smooth) {
  const Wk = P.w*k, Hk = P.h*k, out = new Uint8ClampedArray(Wk*Hk*4), d = F.data, FW = F.width, FH = F.height;
  for (let xo = 0; xo < Wk; xo++) {
    const u = (xo + .5) / Wk;
    const t = quad(u, P.t[0], P.t[1], P.t[2]) * k, b = quad(u, P.b[0], P.b[1], P.b[2]) * k, span = b - t;
    if (span < 1) continue;
    const xs = Math.min(FW-1, P.x0*k + xo);
    const y0 = Math.max(0, Math.floor(t)), y1 = Math.min(Hk-1, Math.ceil(b) - 1);
    for (let y = y0; y <= y1; y++) {
      const cov = Math.min(y+1, b) - Math.max(y, t); if (cov <= 0) continue;
      const v = (y + .5 - t) / span * FH - .5, o = (y*Wk + xo) * 4;
      if (!smooth) {
        const i = (Math.max(0, Math.min(FH-1, Math.round(v))) * FW + xs) * 4;
        out[o]=d[i]; out[o+1]=d[i+1]; out[o+2]=d[i+2]; out[o+3]=d[i+3]*cov; continue;
      }
      const vi = Math.floor(v), f = v - vi;
      const i0 = (Math.max(0, Math.min(FH-1, vi)) * FW + xs) * 4, i1 = (Math.max(0, Math.min(FH-1, vi+1)) * FW + xs) * 4;
      const a0 = d[i0+3]*(1-f), a1 = d[i1+3]*f, A = a0 + a1;
      if (A > 0) for (let c = 0; c < 3; c++) out[o+c] = (d[i0+c]*a0 + d[i1+c]*a1) / A;
      out[o+3] = A * cov;
    }
  }
  const cv = document.createElement('canvas'); cv.width = Wk; cv.height = Hk;
  cv.getContext('2d').putImageData(new ImageData(out, Wk, Hk), 0, 0);
  return cv;
}

function renderSet() {
  if (!srcImg) return;
  const k = +$('scale').value, smooth = true;
  const fc = buildFlat(k);
  flat = fc.getContext('2d').getImageData(0, 0, fc.width, fc.height);
  const fv = $('flat'); fv.width = fc.width; fv.height = fc.height;
  fv.getContext('2d').drawImage(fc, 0, 0);
  fv.style.width = BW*2 + 'px'; fv.style.height = BH*2 + 'px';
  pieceCanvases = PIECES.map(P => ({ id: P.id, canvas: renderPiece(flat, k, P, smooth) }));
  pieceCanvases.push({ id: 'Avatar', canvas: renderAvatar(fc, k) });
  ['g1','g2','g3','g4'].forEach(g => $(g).innerHTML = '');
  pieceCanvases.forEach((pc, i) => {
    const P = PIECES[i] || { id:'Avatar', g:'g4', w:AVT.size, h:AVT.size}, box = document.createElement('div'); box.className = 'piece';
    const wrap = document.createElement('div'); wrap.className = 'checker'; wrap.style.marginTop = '0';
    const im = document.createElement('img'); im.src = pc.canvas.toDataURL();
    im.style.width = P.w*(P.id==='Avatar'?1:2) + 'px'; im.style.height = P.h*(P.id==='Avatar'?1:2) + 'px'; im.title = 'Click to download';
    im.onclick = () => saveBlob(pc.canvas, fileName(P.id));
    wrap.appendChild(im);
    const cap = document.createElement('div'); cap.dataset.id = pc.id; cap.textContent = `${fileName(P.id)} · ${pc.canvas.width}×${pc.canvas.height}`;
    box.appendChild(wrap); box.appendChild(cap); $(P.g).appendChild(box);
  });
  $('setHint').hidden = true; $('setOut').hidden = false;
  $('zip').disabled = false; $('each').disabled = false; if (!$('pick').hidden) drawPick();
  $('info').textContent = `Source ${srcImg.width}×${srcImg.height} → flat banner ${fc.width}×${fc.height}`;
}
const safe = t => (t || '').replace(/[\\/:*?"<>|]+/g, '_').trim();
const baseName = () => safe($('oname').value) || 'sprite';
const fileName = id => {
  if (id === 'Avatar') return baseName() + '.png';
  const f = safe($('ofmt').value) || 'a_{id}_{nombre}';
  return f.replace(/\{id\}/gi, id).replace(/\{nombre\}/gi, baseName()).replace(/\.png$/i, '') + '.png';
};
function refreshNames() {
  document.querySelectorAll('.piece [data-id]').forEach(cap => {
    const pc = pieceCanvases.find(p => p.id === cap.dataset.id);
    if (pc) cap.textContent = `${fileName(pc.id)} · ${pc.canvas.width}×${pc.canvas.height}`;
  });
}
$('oname').oninput = $('ofmt').oninput = refreshNames;
function saveBlob(canvas, fname) {
  canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fname; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }, 'image/png');
}
['fit','scale'].forEach(id => $(id).onchange = renderSet);
const picked = new Set();
function drawPick() {
  const box = $('pickList'); box.innerHTML = '';
  pieceCanvases.forEach(pc => {
    const l = document.createElement('label'); l.className = 'chk';
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = picked.has(pc.id);
    c.onchange = () => { c.checked ? picked.add(pc.id) : picked.delete(pc.id); };
    l.appendChild(c); l.appendChild(document.createTextNode(' ' + pc.id)); box.appendChild(l);
  });
}
$('each').onclick = () => { $('pick').hidden = !$('pick').hidden; if (!$('pick').hidden) drawPick(); };
$('pickAll').onclick = () => { pieceCanvases.forEach(pc => picked.add(pc.id)); drawPick(); };
$('pickNone').onclick = () => { picked.clear(); drawPick(); };
$('pickGo').onclick = () => pieceCanvases.filter(pc => picked.has(pc.id)).forEach((pc, i) => setTimeout(() => saveBlob(pc.canvas, fileName(pc.id)), i * 350));

/* ---------- ZIP (uncompressed) ---------- */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, 0, true); lh.setUint16(12, 33, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true);
    lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 33, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    cen.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + sz;
  }
  const cenSize = cen.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
$('zip').onclick = async () => {
  const files = [];
  for (const pc of pieceCanvases) {
    const b = await new Promise(r => pc.canvas.toBlob(r, 'image/png'));
    files.push({ name: fileName(pc.id), data: new Uint8Array(await b.arrayBuffer()) });
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(makeZip(files)); a.download = `${baseName()}_flags.zip`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

/* =====================================================================
   MANUAL MODE (sliders)
   ===================================================================== */
let PAD = 64;
const GROUPS = [
  ['Top edge (↕ px)',  [['tL','Left','o'],['tM','Center','o'],['tR','Right','o']]],
  ['Bottom edge (↕ px)',  [['bL','Left','o'],['bM','Center','o'],['bR','Right','o']]],
  ['Left edge (↔ px)', [['lT','Top','o'],['lM','Center','o'],['lB','Bottom','o']]],
  ['Right edge (↔ px)',   [['rT','Top','o'],['rM','Center','o'],['rB','Bottom','o']]],
  ['Vertical wave (↕)',      [['wvA','Amplitude','a'],['wvF','Frequency','f'],['wvP','Phase','p']]],
  ['Horizontal wave (↔)',    [['whA','Amplitude','a'],['whF','Frequency','f'],['whP','Phase','p']]],
  ['Panels (flag effect ↕)', [['pn','Panels','n'],['pA','Amplitude','a']]],
];
const S = {}, types = {};
let fitMode = true;
GROUPS.forEach(([title, items]) => {
  const fs = document.createElement('fieldset');
  fs.innerHTML = `<legend>${title}</legend>`;
  items.forEach(([k, label, t]) => {
    S[k] = 0; types[k] = t;
    const r = document.createElement('div'); r.className = 'row';
    r.innerHTML = `<span>${label}</span><input type="range" id="${k}" value="0"><span id="${k}v">0</span>`;
    r.querySelector('input').addEventListener('input', e => { S[k] = +e.target.value; $(k+'v').textContent = S[k]; schedule(); });
    fs.appendChild(r);
  });
  $('ctrls').appendChild(fs);
});
function setRanges() {
  for (const k in types) {
    const el = $(k), t = types[k];
    if (t === 'o') { el.min = -PAD; el.max = PAD; el.step = 1; }
    if (t === 'a') { el.min = 0;    el.max = PAD; el.step = 0.5; }
    if (t === 'n') { el.min = 1;    el.max = 8;   el.step = 1; }
    if (t === 'f') { el.min = 0;    el.max = 4;   el.step = 0.05; }
    if (t === 'p') { el.min = 0;    el.max = 1;   el.step = 0.01; }
    S[k] = Math.max(+el.min, Math.min(+el.max, S[k]));
    el.value = S[k]; $(k+'v').textContent = S[k];
  }
}
$('ctrls').lastElementChild.insertAdjacentHTML('beforeend',
  '<label class="chk"><input id="pI" type="checkbox" checked> Invert alternate panels</label>');
$('pI').onchange = schedule;
setRanges();
$('reset').onclick = () => { for (const k in S) S[k] = 0; $('pI').checked = true; setRanges(); schedule(); };
$('msmooth').onchange = schedule;

const wave = (u, A, F, P) => A * Math.sin(2*Math.PI*(F*u + P));
function warp(src, sw, sh, vert, f1, f2, smooth) {
  const lines = vert ? sw : sh, len = vert ? sh : sw, olen = len + 2*PAD;
  const ow = vert ? sw : olen, oh = vert ? olen : sh;
  const out = new Uint8ClampedArray(ow*oh*4);
  const si = (l,p) => (vert ? p*sw + l : l*sw + p) * 4;
  const oi = (l,p) => (vert ? p*ow + l : l*ow + p) * 4;
  const cl = p => p < 0 ? 0 : p > len-1 ? len-1 : p;
  for (let l = 0; l < lines; l++) {
    const u = lines > 1 ? l/(lines-1) : 0;
    const a = PAD + f1(u), b = PAD + len + f2(u), span = b - a;
    if (span < 1) continue;
    for (let p = Math.max(0, Math.ceil(a - .5)); p < olen && p + .5 <= b; p++) {
      const s = (p + .5 - a) / span * len - .5, o = oi(l,p);
      if (!smooth) {
        const k = si(l, cl(Math.round(s)));
        out[o]=src[k]; out[o+1]=src[k+1]; out[o+2]=src[k+2]; out[o+3]=src[k+3];
        continue;
      }
      const p0 = Math.floor(s), f = s - p0, i0 = si(l, cl(p0)), i1 = si(l, cl(p0+1));
      const a0 = src[i0+3]*(1-f), a1 = src[i1+3]*f, A = a0 + a1;
      if (A > 0) for (let c = 0; c < 3; c++) out[o+c] = (src[i0+c]*a0 + src[i1+c]*a1) / A;
      out[o+3] = A;
    }
  }
  return { data: out, w: ow, h: oh };
}
let result = null, pending = false;
function render() {
  pending = false;
  if (!srcData || mode !== 'man') return;
  const { w, h, data } = srcData, smooth = $('msmooth').checked;
  const pan = u => {
    const n = Math.round(S.pn), x = u*n, i = Math.min(n-1, Math.floor(x));
    const sg = ($('pI').checked && i % 2) ? -1 : 1;
    return sg * S.pA * Math.cos(2*Math.PI*(x - i));
  };
  const top = u => quad(u, S.tL, S.tM, S.tR) + wave(u, S.wvA, S.wvF, S.wvP) + pan(u);
  const bot = u => quad(u, S.bL, S.bM, S.bR) + wave(u, S.wvA, S.wvF, S.wvP) + pan(u);
  const lef = v => quad(v, S.lT, S.lM, S.lB) + wave(v, S.whA, S.whF, S.whP);
  const rig = v => quad(v, S.rT, S.rM, S.rB) + wave(v, S.whA, S.whF, S.whP);
  const p1 = warp(data, w, h, true, top, bot, smooth);
  const p2 = warp(p1.data, p1.w, p1.h, false, lef, rig, smooth);
  result = p2;
  const cv = $('cv');
  if (cv.width !== p2.w || cv.height !== p2.h) { cv.width = p2.w; cv.height = p2.h; }
  cv.getContext('2d').putImageData(new ImageData(p2.data, p2.w, p2.h), 0, 0);
  applyZoom();
  $('info').textContent = `Source ${w}×${h} → canvas ${p2.w}×${p2.h} (margin ${PAD}px)`;
}
function schedule() { if (!pending) { pending = true; requestAnimationFrame(render); } }
function setZoom(z) {
  z = Math.max(0.05, Math.min(10, z));
  $('zoom').value = z; $('zoomv').textContent = (+z.toFixed(2)) + 'x';
  const cv = $('cv');
  cv.style.width = cv.width * z + 'px'; cv.style.height = cv.height * z + 'px';
  cv.style.imageRendering = (z >= 2 && !$('msmooth').checked) ? 'pixelated' : 'auto';
}
function applyZoom() {
  const cv = $('cv'), m = $('main');
  if (fitMode) setZoom(Math.min((m.clientWidth - 40) / cv.width, (m.clientHeight - 40) / cv.height));
  else setZoom(+$('zoom').value);
}
$('zoom').oninput = () => { fitMode = false; applyZoom(); };
$('fit1').onclick = () => { fitMode = true; applyZoom(); };
$('one').onclick = () => { fitMode = false; setZoom(1); };
addEventListener('resize', () => { if (fitMode && srcData && mode === 'man') applyZoom(); });
$('save').onclick = () => {
  if (!result) return;
  const { w, h, data } = result;
  let x0 = 0, y0 = 0, x1 = w, y1 = h;
  if ($('crop').checked) {
    x0 = w; y0 = h; x1 = 0; y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y*w + x)*4 + 3] > 0) {
      if (x < x0) x0 = x; if (x >= x1) x1 = x + 1; if (y < y0) y0 = y; if (y >= y1) y1 = y + 1;
    }
    if (x1 <= x0) return;
  }
  const full = document.createElement('canvas'); full.width = w; full.height = h;
  full.getContext('2d').putImageData(new ImageData(data, w, h), 0, 0);
  const out = document.createElement('canvas'); out.width = x1 - x0; out.height = y1 - y0;
  out.getContext('2d').drawImage(full, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  saveBlob(out, baseName() + '_curved.png');
};

/* =====================================================================
   REBUILD — un-curves the pieces and reassembles the flat banner
   (exact inverse of renderPiece: each column between t and b is
   stretched back to the full banner height)
   ===================================================================== */
const recSlots = {};   // id -> { canvas }
const pieceById = Object.fromEntries(PIECES.map(P => [P.id.toLowerCase(), P]));
const idFromName = n => { const m = /Flag[12][abc]Long|Flag[12][abc]/i.exec(n); return m ? pieceById[m[0].toLowerCase()] : null; };

function loadPiece(f, P) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      c.getContext('2d').drawImage(im, 0, 0);
      recSlots[P.id] = { canvas: c };
      URL.revokeObjectURL(im.src); res();
    };
    im.onerror = res;
    im.src = URL.createObjectURL(f);
  });
}
async function loadPieces(files) {
  const unknown = []; let first = true;
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const P = idFromName(f.name);
    if (!P) { unknown.push(f.name); continue; }
    await loadPiece(f, P);
    if (first) {
      first = false;
      const n = f.name.replace(/\.[^.]+$/, '').replace(/Flag[12][abc](Long)?/i, '').replace(/^a_/i, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
      if (n) $('oname').value = n;
    }
  }
  rebuildRea(unknown.length ? 'Not recognized: ' + unknown.join(', ') : '');
}
function drawSlots() {
  const box = $('reaSlots'); box.innerHTML = '';
  PIECES.forEach(P => {
    const s = recSlots[P.id];
    const lb = document.createElement('label'); lb.className = 'slot' + (s ? ' ok' : '');
    lb.innerHTML = `<span>${P.id}</span><b>${s ? s.canvas.width + '×' + s.canvas.height : '—'}</b>`;
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true;
    inp.onchange = async () => { if (inp.files[0]) { await loadPiece(inp.files[0], P); rebuildRea(); } };
    lb.appendChild(inp); box.appendChild(lb);
  });
}
function rebuildRea(extra) {
  drawSlots();
  const loaded = PIECES.filter(P => recSlots[P.id]);
  $('reaSave').disabled = !loaded.length;
  $('reaHint').hidden = !!loaded.length; $('reaOut').hidden = !loaded.length;
  if (!loaded.length) { $('info').textContent = extra || ''; return; }
  const K = Math.max(1, ...loaded.map(P => Math.round(recSlots[P.id].canvas.width / P.w)));
  const pref = $('reaPref').value;
  const order = [...PIECES.filter(P => P.g === pref), ...PIECES.filter(P => P.g !== pref)].filter(P => recSlots[P.id]);
  const D = {};
  order.forEach(P => {
    const Wk = P.w*K, Hk = P.h*K, src = recSlots[P.id].canvas;
    let c = src;
    if (src.width !== Wk || src.height !== Hk) {
      c = document.createElement('canvas'); c.width = Wk; c.height = Hk;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, Wk, Hk);
    }
    D[P.id] = c.getContext('2d').getImageData(0, 0, Wk, Hk).data;
  });
  const W = BW*K, H = BH*K, out = new Uint8ClampedArray(W*H*4); let missing = 0;
  for (let xs = 0; xs < W; xs++) {
    const P = order.find(Q => xs >= Q.x0*K && xs < (Q.x0 + Q.w)*K);
    if (!P) { missing++; continue; }
    const Wk = P.w*K, Hk = P.h*K, d = D[P.id], xo = xs - P.x0*K, u = (xo + .5) / Wk;
    const t = quad(u, P.t[0], P.t[1], P.t[2]) * K, b = quad(u, P.b[0], P.b[1], P.b[2]) * K, span = b - t;
    if (span < 1) continue;
    const lo = Math.ceil(t), hi = Math.floor(b) - 1;   // fully covered rows (no smoothed edge)
    for (let v = 0; v < H; v++) {
      let y = (v + .5) / H * span + t - .5;
      if (hi >= lo) y = Math.max(lo, Math.min(hi, y));
      const yi = Math.floor(y), f = y - yi, o = (v*W + xs) * 4;
      const i0 = (Math.max(0, Math.min(Hk-1, yi)) * Wk + xo) * 4, i1 = (Math.max(0, Math.min(Hk-1, yi+1)) * Wk + xo) * 4;
      const a0 = d[i0+3]*(1-f), a1 = d[i1+3]*f, A = a0 + a1;
      if (A > 0) for (let c = 0; c < 3; c++) out[o+c] = (d[i0+c]*a0 + d[i1+c]*a1) / A;
      out[o+3] = A;
    }
  }
  const cv = $('reaCv'); cv.width = W; cv.height = H;
  cv.getContext('2d').putImageData(new ImageData(out, W, H), 0, 0);
  cv.style.width = BW*2 + 'px'; cv.style.height = BH*2 + 'px';
  $('info').textContent = `Rebuilt banner ${W}×${H} from ${order.length}/8 pieces` +
    (missing ? ` · ${missing} columns missing (no piece covers them)` : '') + (extra ? ' · ' + extra : '');
}
$('reaFiles').onchange = e => { loadPieces([...e.target.files]); e.target.value = ''; };
$('reaClear').onclick = () => { for (const k in recSlots) delete recSlots[k]; rebuildRea(); };
$('reaPref').onchange = () => rebuildRea();
$('reaSave').onclick = () => saveBlob($('reaCv'), baseName() + '_banner.png');

/* ---------- tabs and loading ---------- */
function setMode(m) {
  mode = m;
  $('tSet').className = m === 'set' ? 'on' : 'sec'; $('tMan').className = m === 'man' ? 'on' : 'sec'; $('tRea').className = m === 'rea' ? 'on' : 'sec';
  $('setPanel').hidden = m !== 'set'; $('manPanel').hidden = m !== 'man'; $('reaPanel').hidden = m !== 'rea';
  $('setView').hidden = m !== 'set'; $('manualView').hidden = m !== 'man'; $('reaView').hidden = m !== 'rea';
  $('loadBtns').hidden = m === 'rea';
  if (m === 'set') renderSet(); else if (m === 'man') schedule(); else rebuildRea();
}
$('tSet').onclick = () => setMode('set'); $('tMan').onclick = () => setMode('man'); $('tRea').onclick = () => setMode('rea');

function loadFile(f) {
  if (!f || !f.type.startsWith('image/')) return;
  const im = new Image();
  im.onload = () => {
    srcImg = im;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    srcData = { w: im.width, h: im.height, data: g.getImageData(0, 0, im.width, im.height).data };
    name = (f.name || 'sprite').replace(/\.[^.]+$/, '') || 'sprite';
    $('oname').value = name;
    PAD = Math.max(64, Math.round(Math.max(im.width, im.height) * 0.2));
    setRanges(); fitMode = true;
    $('hint').hidden = true; $('wrap').hidden = false;
    if (mode === 'set') renderSet(); else schedule();
  };
  im.src = URL.createObjectURL(f);
}
$('file').onchange = e => loadFile(e.target.files[0]);
addEventListener('paste', e => { if (mode === 'rea') return; for (const it of e.clipboardData.items) if (it.type.startsWith('image/')) loadFile(it.getAsFile()); });
const main = $('main');
main.addEventListener('dragover', e => { e.preventDefault(); main.style.outline = '2px dashed #5b49d6'; });
main.addEventListener('dragleave', () => main.style.outline = '');
main.addEventListener('drop', e => { e.preventDefault(); main.style.outline = ''; if (mode === 'rea') loadPieces([...e.dataTransfer.files]); else loadFile(e.dataTransfer.files[0]); });
