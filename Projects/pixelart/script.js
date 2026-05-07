/* ═══════════════════════════════════════════════════════
   PIXEL ART CONVERTER — script.js
   Features: pixel art, dithering, live blob color sync,
             tilt effect, particle easter egg on download
═══════════════════════════════════════════════════════ */

const fileInput    = document.getElementById('fileInput');
const uploadZone   = document.getElementById('uploadZone');
const pixelSlider  = document.getElementById('pixelSize');
const pixelVal     = document.getElementById('pixelSizeVal');
const contrastSldr = document.getElementById('contrastSlider');
const contrastVal  = document.getElementById('contrastVal');
const canvas       = document.getElementById('canvas');
const ctx          = canvas.getContext('2d');
const downloadBtn  = document.getElementById('downloadBtn');
const emptyState   = document.getElementById('emptyState');
const previewMeta  = document.getElementById('previewMeta');
const canvasArea   = document.getElementById('canvasArea');

const blob1 = document.getElementById('blob1');
const blob2 = document.getElementById('blob2');
const blob3 = document.getElementById('blob3');
const blob4 = document.getElementById('blob4');

const pCanvas = document.getElementById('particleCanvas');
const pCtx    = pCanvas.getContext('2d');

let originalImage  = null;
let currentPalette = 'original';
let currentDither  = 'none';
let syncedHues     = [258, 298, 218, 178]; // default hues for blobs

/* ══════════════════════════════════════
   PARTICLE CANVAS SETUP
══════════════════════════════════════ */
function resizeParticleCanvas() {
  pCanvas.width  = window.innerWidth;
  pCanvas.height = window.innerHeight;
}
resizeParticleCanvas();
window.addEventListener('resize', resizeParticleCanvas);

/* ══════════════════════════════════════
   PALETTES
══════════════════════════════════════ */
const PALETTES = {
  original:  null,
  grayscale: 'grayscale',
  retro: [
    [0,0,0],[34,34,34],[85,0,0],[139,0,0],[255,69,0],[255,140,0],
    [255,215,0],[0,100,0],[34,139,34],[0,0,139],[0,0,205],[75,0,130],
    [255,255,255],[192,192,192],[128,128,128]
  ],
  neon: [
    [0,0,0],[20,0,20],[255,0,128],[255,0,255],[128,0,255],
    [0,255,255],[0,255,128],[255,255,0],[255,128,0],[255,255,255]
  ],
  warm: [
    [15,5,0],[60,15,5],[123,28,12],[194,46,19],[230,97,45],
    [240,154,80],[245,198,130],[252,232,180],[255,248,220]
  ],
  cool: [
    [5,10,20],[10,30,60],[20,60,110],[30,100,160],[50,140,200],
    [100,180,230],[160,210,245],[200,230,250],[225,240,255]
  ]
};

const BAYER4 = [
  [ 0/16,  8/16,  2/16, 10/16],
  [12/16,  4/16, 14/16,  6/16],
  [ 3/16, 11/16,  1/16,  9/16],
  [15/16,  7/16, 13/16,  5/16]
];

/* ══════════════════════════════════════
   UPLOAD
══════════════════════════════════════ */
uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => { if (e.target.files[0]) loadImage(e.target.files[0]); });

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadImage(f);
});

document.addEventListener('paste', e => {
  const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
  if (item) loadImage(item.getAsFile());
});

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = evt => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      emptyState.style.display = 'none';
      canvas.hidden = false;
      canvas.classList.add('flash-in');
      downloadBtn.disabled = false;
      syncAccentColor(img);
      render();
      setTimeout(() => canvas.classList.remove('flash-in'), 400);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

/* ══════════════════════════════════════
   SMART COLOR SYNC → LIVE BLOB PAINTING
   ─────────────────────────────────────
   Builds a weighted hue histogram,
   finds 4 distinct dominant peaks,
   paints each blob a different hue.
   CSS `transition: background 1.6s`
   makes the color shift silky smooth.
══════════════════════════════════════ */
function syncAccentColor(img) {
  const SIZE = 56;
  const sc   = document.createElement('canvas');
  sc.width   = sc.height = SIZE;
  const sctx = sc.getContext('2d');
  sctx.drawImage(img, 0, 0, SIZE, SIZE);
  const d = sctx.getImageData(0, 0, SIZE, SIZE).data;

  // Weighted hue histogram
  const hist = new Float32Array(360);

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]/255, g = d[i+1]/255, b = d[i+2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), delta = max - min;
    if (delta < 0.09 || max < 0.07) continue;

    let h = 0;
    if      (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * (((b - r) / delta) + 2);
    else                h = 60 * (((r - g) / delta) + 4);
    if (h < 0) h += 360;

    const lum    = (max + min) / 2;
    const weight = delta * (1 - Math.abs(2*lum - 1));

    // Gaussian kernel spread
    for (let k = -10; k <= 10; k++) {
      const bucket = Math.round((h + k + 360)) % 360;
      hist[bucket] += weight * Math.exp(-0.5 * (k/4)**2);
    }
  }

  // Extract up to 4 distinct peaks (≥35° apart)
  const peaks = [];
  const used  = new Uint8Array(360);

  for (let attempt = 0; attempt < 4; attempt++) {
    let bestVal = -1, bestH = 0;
    for (let i = 0; i < 360; i++) {
      if (!used[i] && hist[i] > bestVal) { bestVal = hist[i]; bestH = i; }
    }
    if (bestVal < 0.04) break;
    peaks.push(bestH);
    for (let k = -35; k <= 35; k++) used[(bestH + k + 360) % 360] = 1;
  }

  if (peaks.length === 0) return;

  // Fill to 4 hues if image lacks variety
  const base = peaks[0];
  while (peaks.length < 4) peaks.push((base + 90 * peaks.length) % 360);

  syncedHues = peaks;

  // Update CSS accent with primary hue
  const root = document.documentElement;
  root.style.setProperty('--dyn-h', peaks[0]);
  root.style.setProperty('--dyn-s', '72%');
  root.style.setProperty('--dyn-l', '66%');

  // Paint blobs — CSS handles the smooth 1.6s color fade
  blob1.style.background = `hsla(${peaks[0]}, 78%, 58%, 0.24)`;
  blob2.style.background = `hsla(${peaks[1]}, 72%, 55%, 0.19)`;
  blob3.style.background = `hsla(${peaks[2]}, 68%, 60%, 0.15)`;
  blob4.style.background = `hsla(${peaks[3]}, 65%, 57%, 0.13)`;
}

/* ══════════════════════════════════════
   TILT EFFECT
══════════════════════════════════════ */
function initTilt(el) {
  const MAX  = 6;
  const PERS = 1000;
  el.addEventListener('mousemove', e => {
    const r  = el.getBoundingClientRect();
    const x  = (e.clientX - r.left)  / r.width  - 0.5;
    const y  = (e.clientY - r.top)   / r.height - 0.5;
    el.style.transform = `perspective(${PERS}px) rotateX(${-y*MAX}deg) rotateY(${x*MAX}deg) scale3d(1.015,1.015,1.015)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = `perspective(${PERS}px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)`;
  });
}
initTilt(document.getElementById('ctrlPanel'));
initTilt(document.getElementById('previewPanel'));

/* ══════════════════════════════════════
   EASTER EGG — PARTICLE BURST
   Fires on download. Pixel-art squares
   explode from center of download btn,
   colored with the image's dominant hues.
══════════════════════════════════════ */
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l, 1-l);
  const f = n => l - a*Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n),1)));
  return [Math.round(f(0)*255), Math.round(f(8)*255), Math.round(f(4)*255)];
}

let particles = [];
let animFrame = null;

function launchParticles() {
  const rect  = downloadBtn.getBoundingClientRect();
  const cx    = rect.left + rect.width  / 2;
  const cy    = rect.top  + rect.height / 2;
  const count = 80;

  // Ripple-distort the whole page shell briefly
  const shell = document.querySelector('.shell');
  shell.classList.add('ripple-distort');
  setTimeout(() => shell.classList.remove('ripple-distort'), 950);

  particles = [];
  for (let i = 0; i < count; i++) {
    const hue   = syncedHues[i % syncedHues.length];
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 3 + Math.random() * 8;
    const size  = 4 + Math.random() * 10;
    const [r,g,b] = hslToRgb(hue, 80, 65);
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - Math.random() * 4,
      size,
      life: 1,
      decay: 0.012 + Math.random() * 0.018,
      color: `rgb(${r},${g},${b})`,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
    });
  }

  if (animFrame) cancelAnimationFrame(animFrame);
  animateParticles();
}

function animateParticles() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

  particles = particles.filter(p => p.life > 0);

  for (const p of particles) {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.25;          // gravity
    p.vx *= 0.98;          // air drag
    p.life -= p.decay;
    p.rotation += p.spin;

    pCtx.save();
    pCtx.globalAlpha = Math.max(0, p.life);
    pCtx.translate(p.x, p.y);
    pCtx.rotate(p.rotation);
    pCtx.fillStyle = p.color;
    pCtx.shadowColor = p.color;
    pCtx.shadowBlur  = 8;
    // Pixel-art square
    pCtx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
    pCtx.restore();
  }

  if (particles.length > 0) {
    animFrame = requestAnimationFrame(animateParticles);
  } else {
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  }
}

/* ══════════════════════════════════════
   CONTROLS
══════════════════════════════════════ */
pixelSlider.addEventListener('input', () => {
  pixelVal.textContent = pixelSlider.value + 'px';
  if (originalImage) render();
});

contrastSldr.addEventListener('input', () => {
  contrastVal.textContent = contrastSldr.value + '%';
  if (originalImage) render();
});

document.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDither = btn.dataset.dither;
    if (originalImage) render();
  });
});

document.querySelectorAll('.pal-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pal-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPalette = btn.dataset.palette;
    if (originalImage) render();
  });
});

/* ══════════════════════════════════════
   RENDER
══════════════════════════════════════ */
function render() {
  if (!originalImage) return;

  const pixelSize = parseInt(pixelSlider.value);
  const contrast  = parseInt(contrastSldr.value) / 100;

  const areaW = canvasArea.clientWidth  - 40;
  const areaH = canvasArea.clientHeight - 40;
  const ratio = Math.min(areaW / originalImage.width, areaH / originalImage.height, 1);
  const dispW = Math.round(originalImage.width  * ratio);
  const dispH = Math.round(originalImage.height * ratio);

  canvas.width  = dispW;
  canvas.height = dispH;

  const blocksW = Math.max(1, Math.round(dispW / pixelSize));
  const blocksH = Math.max(1, Math.round(dispH / pixelSize));

  const off = document.createElement('canvas');
  off.width = blocksW; off.height = blocksH;
  const offCtx = off.getContext('2d');
  offCtx.filter = `contrast(${contrast})`;
  offCtx.imageSmoothingEnabled = true;
  offCtx.drawImage(originalImage, 0, 0, blocksW, blocksH);
  offCtx.filter = 'none';

  const imgData = offCtx.getImageData(0, 0, blocksW, blocksH);
  const data    = imgData.data;
  const palette = PALETTES[currentPalette];
  const isGray  = currentPalette === 'grayscale';

  if (isGray) {
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.round(0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2]);
      data[i] = data[i+1] = data[i+2] = v;
    }
  }

  if      (currentDither === 'none')  applyPalette(data, palette, isGray);
  else if (currentDither === 'bayer') applyBayer(data, blocksW, blocksH, palette, isGray);
  else if (currentDither === 'floyd') applyFloydSteinberg(data, blocksW, blocksH, palette, isGray);

  offCtx.putImageData(imgData, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, dispW, dispH);

  previewMeta.textContent = `${dispW}×${dispH}px · ${blocksW}×${blocksH} blokov`;
}

/* ══════════════════════════════════════
   IMAGE PROCESSING
══════════════════════════════════════ */
function applyPalette(data, palette, isGray) {
  if (!palette || isGray) return;
  for (let i = 0; i < data.length; i += 4) {
    const [r,g,b] = closest(data[i], data[i+1], data[i+2], palette);
    data[i]=r; data[i+1]=g; data[i+2]=b;
  }
}

function applyBayer(data, w, h, palette, isGray) {
  const spread = 60;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i  = (y*w+x)*4;
      const th = (BAYER4[y%4][x%4] - 0.5) * spread;
      let r = clamp(data[i]+th), g = clamp(data[i+1]+th), b = clamp(data[i+2]+th);
      if (palette && !isGray)  [r,g,b] = closest(r,g,b,palette);
      else if (isGray) { const v=Math.round(0.299*r+0.587*g+0.114*b); r=g=b=v; }
      data[i]=r; data[i+1]=g; data[i+2]=b;
    }
  }
}

function applyFloydSteinberg(data, w, h, palette, isGray) {
  const buf = new Float32Array(w*h*3);
  for (let i=0,j=0; i<data.length; i+=4,j+=3) {
    buf[j]=data[i]; buf[j+1]=data[i+1]; buf[j+2]=data[i+2];
  }
  for (let y=0; y<h; y++) {
    for (let x=0; x<w; x++) {
      const j=(y*w+x)*3;
      let oR=clamp(buf[j]), oG=clamp(buf[j+1]), oB=clamp(buf[j+2]);
      let nR,nG,nB;
      if (palette && !isGray)  [nR,nG,nB]=closest(oR,oG,oB,palette);
      else { const v=Math.round(clamp(0.299*oR+0.587*oG+0.114*oB)/32)*32; nR=nG=nB=v; }
      buf[j]=nR; buf[j+1]=nG; buf[j+2]=nB;
      const eR=oR-nR, eG=oG-nG, eB=oB-nB;
      spreadErr(buf,w,h,x+1,y,  eR,eG,eB,7/16);
      spreadErr(buf,w,h,x-1,y+1,eR,eG,eB,3/16);
      spreadErr(buf,w,h,x,  y+1,eR,eG,eB,5/16);
      spreadErr(buf,w,h,x+1,y+1,eR,eG,eB,1/16);
    }
  }
  for (let i=0,j=0; i<data.length; i+=4,j+=3) {
    data[i]=clamp(buf[j]); data[i+1]=clamp(buf[j+1]); data[i+2]=clamp(buf[j+2]);
  }
}

function spreadErr(buf,w,h,x,y,eR,eG,eB,f) {
  if (x<0||x>=w||y<0||y>=h) return;
  const j=(y*w+x)*3; buf[j]+=eR*f; buf[j+1]+=eG*f; buf[j+2]+=eB*f;
}

function clamp(v) { return Math.max(0,Math.min(255,Math.round(v))); }

function closest(r,g,b,palette) {
  let best=palette[0], bestD=Infinity;
  for (const c of palette) {
    const d=(r-c[0])**2+(g-c[1])**2+(b-c[2])**2;
    if (d<bestD){bestD=d;best=c;}
  }
  return best;
}

/* ══════════════════════════════════════
   DOWNLOAD + EASTER EGG
══════════════════════════════════════ */
downloadBtn.addEventListener('click', () => {
  // Fire easter egg first
  launchParticles();

  // Then download
  const a = document.createElement('a');
  a.download = 'pixel-art-' + Date.now() + '.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
});

window.addEventListener('resize', () => {
  resizeParticleCanvas();
  if (originalImage) render();
});
