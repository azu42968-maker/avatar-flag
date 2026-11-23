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

let srcImg = null, name = 'sprite';
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
  $('posWrap').hidden = fit !== 'cover';
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (fit === 'stretch') {
    g.drawImage(drawScaled(srcImg, 0, 0, iw, ih, W, H), 0, 0);
  } else if (fit === 'cover') {
    const z = $('zoom').value / 100, s = Math.max(W/iw, H/ih) * z, cw = W/s, ch = H/s;
    g.drawImage(drawScaled(srcImg, (iw-cw)*$('posX').value/100, (ih-ch)*$('posY').value/100, cw, ch, W, H), 0, 0);
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
['posX','posY','zoom'].forEach(id => $(id).oninput = renderSet);
$('posReset').onclick = () => { $('posX').value = 50; $('posY').value = 50; $('zoom').value = 100; renderSet(); };

/* Avatar area guide over the flat preview */
(() => { const b = $('avBox').style; b.left = AVT.x*2 + 'px'; b.top = AVT.y*2 + 'px'; b.width = AVT.w*2 + 'px'; b.height = AVT.h*2 + 'px'; })();

/* Drag the flat preview to move the banner */
(() => {
  const cv = $('flat'); let drag = null;
  cv.style.cursor = 'grab'; cv.style.touchAction = 'none';
  cv.onpointerdown = e => { if (!srcImg || $('fit').value !== 'cover') return; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; drag = { x: e.clientX, y: e.clientY, px: +$('posX').value, py: +$('posY').value }; };
  cv.onpointermove = e => {
    if (!drag) return;
    const iw = srcImg.width, ih = srcImg.height, z = $('zoom').value / 100, s = Math.max(BW/iw, BH/ih) * z;
    const ox = iw - BW/s, oy = ih - BH/s;               // overflow in source px
    const dx = (e.clientX - drag.x) / 2 / s, dy = (e.clientY - drag.y) / 2 / s;
    if (ox > 0.5) $('posX').value = Math.max(0, Math.min(100, drag.px - dx / ox * 100));
    if (oy > 0.5) $('posY').value = Math.max(0, Math.min(100, drag.py - dy / oy * 100));
    renderSet();
  };
  cv.onpointerup = cv.onpointercancel = () => { drag = null; cv.style.cursor = 'grab'; };
})();
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
  $('tSet').className = m === 'set' ? 'on' : 'sec'; $('tRea').className = m === 'rea' ? 'on' : 'sec';
  $('setPanel').hidden = m !== 'set'; $('reaPanel').hidden = m !== 'rea';
  $('setView').hidden = m !== 'set'; $('reaView').hidden = m !== 'rea';
  $('loadBtns').hidden = m === 'rea';
  if (m === 'set') renderSet(); else rebuildRea();
}
$('tSet').onclick = () => setMode('set'); $('tRea').onclick = () => setMode('rea');

function loadFile(f) {
  if (!f || !f.type.startsWith('image/')) return;
  const im = new Image();
  im.onload = () => {
    srcImg = im;
    name = (f.name || 'sprite').replace(/\.[^.]+$/, '') || 'sprite';
    $('oname').value = name;
    if (mode === 'set') renderSet();
  };
  im.src = URL.createObjectURL(f);
}
$('file').onchange = e => loadFile(e.target.files[0]);
addEventListener('paste', e => { if (mode === 'rea') return; for (const it of e.clipboardData.items) if (it.type.startsWith('image/')) loadFile(it.getAsFile()); });
const main = $('main');
main.addEventListener('dragover', e => { e.preventDefault(); main.style.outline = '2px dashed #5b49d6'; });
main.addEventListener('dragleave', () => main.style.outline = '');
main.addEventListener('drop', e => { e.preventDefault(); main.style.outline = ''; if (mode === 'rea') loadPieces([...e.dataTransfer.files]); else loadFile(e.dataTransfer.files[0]); });
