const fileInput = document.getElementById('fileInput');
const uploadZone = document.getElementById('uploadZone');
const pixelSizeSlider = document.getElementById('pixelSize');
const pixelSizeVal = document.getElementById('pixelSizeVal');
const contrastSlider = document.getElementById('contrastSlider');
const contrastVal = document.getElementById('contrastVal');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('downloadBtn');
const emptyState = document.getElementById('emptyState');
const previewMeta = document.getElementById('previewMeta');
const paletteBtns = document.querySelectorAll('.palette-btn');

let originalImage = null;
let currentPalette = 'original';

// Palette definitions
const PALETTES = {
  original: null,
  retro: [
    [0,0,0],[34,34,34],[85,0,0],[139,0,0],[255,69,0],[255,140,0],
    [255,215,0],[0,100,0],[34,139,34],[0,0,139],[0,0,205],[75,0,130],
    [255,255,255],[192,192,192],[128,128,128]
  ],
  grayscale: null,
  neon: [
    [0,0,0],[20,0,20],[255,0,128],[255,0,255],[128,0,255],
    [0,255,255],[0,255,128],[255,255,0],[255,128,0],[255,255,255]
  ],
  warm: [
    [15,5,0],[60,15,5],[123,28,12],[194,46,19],[230,97,45],
    [240,154,80],[245,198,130],[252,232,180],[255,248,220],[255,255,240]
  ],
  cool: [
    [5,10,20],[10,30,60],[20,60,110],[30,100,160],[50,140,200],
    [100,180,230],[160,210,245],[200,230,250],[225,240,255],[240,248,255]
  ]
};

// Upload zone click
uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) loadImage(e.target.files[0]);
});

// Drag & drop
uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImage(file);
});

// Paste from clipboard
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
      renderPixelArt();
      setTimeout(() => canvas.classList.remove('flash-in'), 400);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

// Sliders
pixelSizeSlider.addEventListener('input', () => {
  pixelSizeVal.textContent = pixelSizeSlider.value + 'px';
  if (originalImage) renderPixelArt();
});

contrastSlider.addEventListener('input', () => {
  contrastVal.textContent = contrastSlider.value + '%';
  if (originalImage) renderPixelArt();
});

// Palette buttons
paletteBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    paletteBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPalette = btn.dataset.palette;
    if (originalImage) renderPixelArt();
  });
});

function renderPixelArt() {
  if (!originalImage) return;

  const pixelSize = parseInt(pixelSizeSlider.value);
  const contrast = parseInt(contrastSlider.value) / 100;

  // Max display size
  const maxW = 800;
  const maxH = 600;
  let w = originalImage.width;
  let h = originalImage.height;
  const ratio = Math.min(maxW / w, maxH / h, 1);
  w = Math.round(w * ratio);
  h = Math.round(h * ratio);

  canvas.width = w;
  canvas.height = h;

  // Step 1: Draw small
  const smallW = Math.max(1, Math.round(w / pixelSize));
  const smallH = Math.max(1, Math.round(h / pixelSize));

  const offscreen = document.createElement('canvas');
  offscreen.width = smallW;
  offscreen.height = smallH;
  const offCtx = offscreen.getContext('2d');

  offCtx.filter = `contrast(${contrast})`;
  offCtx.imageSmoothingEnabled = true;
  offCtx.drawImage(originalImage, 0, 0, smallW, smallH);

  // Step 2: Get pixel data
  const imageData = offCtx.getImageData(0, 0, smallW, smallH);
  const data = imageData.data;

  // Step 3: Apply palette
  if (currentPalette === 'grayscale') {
    for (let i = 0; i < data.length; i += 4) {
      const avg = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
      data[i] = avg;
      data[i+1] = avg;
      data[i+2] = avg;
    }
    offCtx.putImageData(imageData, 0, 0);
  } else if (PALETTES[currentPalette]) {
    const palette = PALETTES[currentPalette];
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = findClosestColor(data[i], data[i+1], data[i+2], palette);
      data[i] = r;
      data[i+1] = g;
      data[i+2] = b;
    }
    offCtx.putImageData(imageData, 0, 0);
  }

  // Step 4: Draw big with no smoothing = pixel art effect
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offscreen, 0, 0, w, h);

  // Update meta
  previewMeta.textContent = `${w} × ${h}px · ${smallW}×${smallH} blok`;
}

function findClosestColor(r, g, b, palette) {
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const dr = r - c[0], dg = g - c[1], db = b - c[2];
    const dist = dr*dr + dg*dg + db*db;
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best;
}

// Download
downloadBtn.addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'pixel-art-' + Date.now() + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});
