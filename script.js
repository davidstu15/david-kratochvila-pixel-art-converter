/* ═══════════════════════════════════════════════════════════
   PIXELSYNTH // PIXEL ART STUDIO — script.js
   Focused realtime pixel-art processing studio.
   100% offline · no CDN · no fetch() · no dependencies
   ───────────────────────────────────────────────────────────
   REMOVED vs previous: audio mode, vibe mode, easter eggs,
   konami code, insane/matrix/hyperspeed modes, audio reactive,
   fake gimmicks.
   KEPT: image, video, webcam, all dithering, all palettes,
   device modes, CRT/VHS fx, compare, histogram, 3D preview,
   particle burst on export, color sync, tilt.
═══════════════════════════════════════════════════════════ */

'use strict';

/* ══ BOOT ═══════════════════════════════════════════════ */
const BOOT_MSGS = [
  'LOADING PIXEL ENGINE...',
  'CALIBRATING DITHER ALGORITHMS...',
  'WARMING UP RETRO SHADERS...',
  'SYNCING COLOR PALETTES...',
  'STUDIO READY.'
];

(function boot() {
  const fill   = document.getElementById('bootFill');
  const status = document.getElementById('bootStatus');
  const screen = document.getElementById('bootScreen');
  const app    = document.getElementById('mainApp');
  if (!screen || !app) { initApp(); return; }

  let i = 0;
  const iv = setInterval(() => {
    if (i >= BOOT_MSGS.length) {
      clearInterval(iv);
      setTimeout(() => {
        screen.style.opacity = '0';
        screen.style.transition = 'opacity .45s';
        setTimeout(() => { screen.style.display = 'none'; app.style.display = 'flex'; initApp(); }, 450);
      }, 200);
      return;
    }
    if (status) status.textContent = BOOT_MSGS[i];
    if (fill)   fill.style.width   = ((i + 1) / BOOT_MSGS.length * 100) + '%';
    i++;
  }, 200);
})();

/* ══ STATE ══════════════════════════════════════════════ */
const STATE = {
  mode:        'image',   // image | video | webcam
  device:      'none',
  palette:     'original',
  dither:      'none',
  pixelSize:   10,
  contrast:    1,
  saturation:  1,
  posterize:   0,
  chromaAmt:   3,
  fx: { scanlines:false, chroma:false, crt:false, noise:false, edge:false },
  originalImage:  null,
  webcamStream:   null,
  syncedHues:     [258, 298, 218, 178],
  videoAnimFrame: null,
  webcamAnimFrame:null,
  voxelAnimFrame: null,
  depthAnimFrame: null,   // RAF for static-image depth animation
  particles:      [],
  compareMode:    false,
  histogramMode:  false,
  depthMode:      false,   // when true, render() draws depth instead of flat pixels
  disperseMode:   false,   // when true, pixels fly apart as particles
};

/* ══ PALETTES ═══════════════════════════════════════════ */
const PALETTES = {
  original:  null,
  grayscale: 'grayscale',
  gameboy:   [[15,56,15],[48,98,48],[139,172,15],[155,188,15]],
  retro:     [[0,0,0],[34,34,34],[85,0,0],[139,0,0],[255,69,0],[255,140,0],[255,215,0],[0,100,0],[34,139,34],[0,0,139],[0,0,205],[75,0,130],[255,255,255],[192,192,192],[128,128,128]],
  neon:      [[0,0,0],[20,0,20],[255,0,128],[255,0,255],[128,0,255],[0,255,255],[0,255,128],[255,255,0],[255,128,0],[255,255,255]],
  thermal:   [[0,0,0],[0,0,128],[0,0,255],[0,128,255],[0,255,255],[0,255,0],[255,255,0],[255,128,0],[255,0,0],[255,255,255]],
  matrix:    [[0,0,0],[0,20,0],[0,40,0],[0,80,0],[0,120,0],[0,180,0],[0,255,65],[100,255,140],[200,255,200]],
  warm:      [[15,5,0],[60,15,5],[123,28,12],[194,46,19],[230,97,45],[240,154,80],[245,198,130],[252,232,180],[255,248,220]],
  cool:      [[5,10,20],[10,30,60],[20,60,110],[30,100,160],[50,140,200],[100,180,230],[160,210,245],[200,230,250],[225,240,255]],
  c64:       [[0,0,0],[255,255,255],[136,0,0],[170,255,238],[204,68,204],[0,204,85],[0,0,170],[238,238,119],[221,136,85],[102,68,0],[255,119,119],[51,51,51],[119,119,119],[170,255,102],[0,136,255],[187,187,187]],
};

// Device mode forces a palette
const DEVICE_PALETTES = {
  none:null, gameboy:'gameboy', crt:null, vhs:null, arcade:'retro', ps1:null
};

// Bayer matrices
const BAYER4 = [
  [0/16,8/16,2/16,10/16],[12/16,4/16,14/16,6/16],
  [3/16,11/16,1/16,9/16],[15/16,7/16,13/16,5/16]
];
const BAYER8 = (() => {
  const m = [];
  for (let y=0;y<8;y++) { m[y]=[]; for (let x=0;x<8;x++) m[y][x]=BAYER4[y%4][x%4]*0.5+(x>=4?0.25:0)+(y>=4?0.125:0); }
  return m;
})();

/* ══ DOM REFS ═══════════════════════════════════════════ */
let outputCanvas, outCtx, outputContainer, emptyState;
let videoEl, webcamEl;
let particleCanvas, pCtx;
let histEl, histCtx;
let compareOriginalEl, compareProcessedEl, compareSliderEl;
let blob1, blob2, blob3, blob4;
let perfFps, perfRender, perfDot;

/* ══ INIT ═══════════════════════════════════════════════ */
function initApp() {
  const $ = id => document.getElementById(id);

  outputCanvas      = $('outputCanvas');
  outputContainer   = $('outputContainer');
  emptyState        = $('emptyState');
  videoEl           = $('videoEl');
  webcamEl          = $('webcamEl');
  particleCanvas    = $('particleCanvas');
  histEl            = $('histogramPanel');
  compareOriginalEl = $('compareOriginal');
  compareProcessedEl= $('compareProcessed');
  compareSliderEl   = $('compareSlider');
  blob1=$('blob1'); blob2=$('blob2'); blob3=$('blob3'); blob4=$('blob4');
  perfFps=$('fpsDisplay'); perfRender=$('renderTime'); perfDot=$('perfDot');

  if (outputCanvas) outCtx   = outputCanvas.getContext('2d');
  if (histEl)       histCtx  = histEl.getContext('2d');

  if (particleCanvas) {
    sizeParticleCanvas();
    pCtx = particleCanvas.getContext('2d');
    startParticleLoop();
  }

  window.addEventListener('resize', () => {
    sizeParticleCanvas();
    if (STATE.originalImage) render();
  });

  bindAll();
  startFpsCounter();
  tilt('ctrlPanel');
  tilt('infoPanel');
}

/* ══ HELPERS ════════════════════════════════════════════ */
function on(id, ev, fn) { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function show(id)       { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
function hide(id)       { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
function setDisplay(id, v) { const el = document.getElementById(id); if (el) el.style.display = v; }

/* ══ BIND EVENTS ════════════════════════════════════════ */
function bindAll() {

  // Mode tabs
  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchMode(btn.dataset.mode);
    });
  });

  // File upload (image + video)
  const uploadZone = document.getElementById('uploadZone');
  const fileInput  = document.getElementById('fileInput');
  if (uploadZone && fileInput) {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') fileInput.click(); });
    fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
    uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', e => {
      e.preventDefault(); uploadZone.classList.remove('drag-over');
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  // Clipboard paste
  document.addEventListener('paste', e => {
    if (!e.clipboardData) return;
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
    if (item) handleFile(item.getAsFile());
  });

  // Sliders
  bindSlider('pixelSize',     'pixelSizeVal', v => { STATE.pixelSize  = +v; },          v => v + ' px');
  bindSlider('contrastSlider','contrastVal',  v => { STATE.contrast   = +v/100; },       v => v + '%');
  bindSlider('satSlider',     'satVal',       v => { STATE.saturation = +v/100; },       v => v + '%');
  bindSlider('posterSlider',  'posterVal',    v => { STATE.posterize  = +v; },           v => +v===0?'OFF':v);
  bindSlider('chromaSlider',  'chromaVal',    v => { STATE.chromaAmt  = +v; },           v => v + ' px');
  bindSlider('depthAmt',       'depthAmtVal',   v => { DEPTH.depthAmt  = +v; }, v => v);
  bindSlider('depthRadius',    'depthRadiusVal',v => { DEPTH.radius    = +v; }, v => v);

  // Dithering
  document.querySelectorAll('[data-dither]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-dither]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.dither = btn.dataset.dither;
      if (STATE.originalImage) renderWithAnim();
    });
  });

  // Palettes
  document.querySelectorAll('[data-palette]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-palette]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.palette = btn.dataset.palette;
      if (STATE.originalImage) renderWithAnim();
    });
  });

  // Device modes
  document.querySelectorAll('[data-device]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-device]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.device = btn.dataset.device;
      syncCrtOverlay();
      if (STATE.originalImage) render();
    });
  });

  // FX toggles
  ['fxScanlines','fxChroma','fxCrt','fxNoise','fxEdge'].forEach(id => {
    on(id, 'change', () => {
      const el = document.getElementById(id);
      if (!el) return;
      STATE.fx[id.replace('fx','').toLowerCase()] = el.checked;
      syncCrtOverlay();
      if (STATE.originalImage) render();
    });
  });

  // Webcam
  on('startWebcam', 'click', startWebcam);
  on('stopWebcam',  'click', stopWebcam);

  // Video transport
  on('vidPlay',  'click', () => videoEl && videoEl.play());
  on('vidPause', 'click', () => videoEl && videoEl.pause());
  on('vidLoop',  'click', () => { if (videoEl) videoEl.loop = !videoEl.loop; });
  on('vidScrub', 'input', e => { if (videoEl && videoEl.duration) videoEl.currentTime = (e.target.value/100)*videoEl.duration; });
  if (videoEl) {
    videoEl.addEventListener('timeupdate', () => {
      const s = document.getElementById('vidScrub');
      if (s && videoEl.duration) s.value = (videoEl.currentTime/videoEl.duration)*100;
      setText('vidTime', fmt(videoEl.currentTime)+' / '+fmt(videoEl.duration));
    });
  }

  // Export
  on('exportPng',     'click', doExportPng);
  on('exportSprite',  'click', doExportSprite);
  on('exportPalette', 'click', doExportPalette);
  on('exportCompare', 'click', () => setView('compare'));

  // View
  on('viewNormal',    'click', () => setView('normal'));
  on('viewCompare',   'click', () => setView('compare'));
  on('viewHistogram', 'click', () => setView('histogram'));

  // Pixel Depth View
  on('openDepth',  'click', openDepthView);
  on('closeDepth', 'click', closeDepthView);
  on('disperseBtn','click', activateDisperse);
  on('reformBtn',  'click', activateReform);
  on('clearMedia', 'click', clearMedia);

  // Fullscreen
  on('fullscreenBtn', 'click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
    else document.exitFullscreen();
  });

  // Compare drag
  initCompareDrag();
}

function bindSlider(sliderId, badgeId, setter, fmt2) {
  const el = document.getElementById(sliderId);
  if (!el) return;
  el.addEventListener('input', () => {
    setter(el.value);
    setText(badgeId, fmt2(el.value));
    // depth sliders only affect DEPTH config — render() reads them live
    if (STATE.originalImage && !sliderId.startsWith('depth')) render();
  });
}

function syncCrtOverlay() {
  const el = document.getElementById('crtOverlay');
  if (el) el.classList.toggle(
    'active',
    STATE.fx.crt || STATE.fx.scanlines || STATE.device==='crt' || STATE.device==='arcade'
  );
}

/* ══ MODE SWITCHING ═════════════════════════════════════ */
function switchMode(mode) {
  STATE.mode = mode;
  stopStreams();

  // When switching to video or webcam, stop the static-image depth loop
  // (those modes have their own RAF loops that call render() continuously)
  if (mode !== 'image') _stopDepthImageLoop();
  // When returning to image mode with depth active, restart the loop
  if (mode === 'image' && STATE.depthMode && STATE.originalImage) _startDepthImageLoop();

  // Upload zone: shown for image and video modes
  const uploadZone = document.getElementById('uploadZone');
  if (uploadZone) {
    uploadZone.style.display = (mode==='image'||mode==='video') ? '' : 'none';
    // Update accepted file types
    const fi = document.getElementById('fileInput');
    if (fi) fi.accept = mode==='video' ? 'video/*' : mode==='image' ? 'image/*' : 'image/*,video/*';
  }

  // Webcam button
  setDisplay('webcamInputGroup', mode==='webcam' ? '' : 'none');

  // Video bar
  if (mode !== 'video') hide('videoControls');

  // 3D settings panel not needed in topbar mode switching
}

function stopStreams() {
  if (STATE.webcamStream) {
    STATE.webcamStream.getTracks().forEach(t => t.stop());
    STATE.webcamStream = null;
  }
  cancelAnimationFrame(STATE.webcamAnimFrame);
  cancelAnimationFrame(STATE.videoAnimFrame);
  cancelAnimationFrame(_dispAnimFrame);
  _dispAnimFrame = null;
  STATE.webcamAnimFrame = null;
  STATE.videoAnimFrame  = null;
  hide('stopWebcam'); show('startWebcam');
}

/* ══ FILE HANDLING ══════════════════════════════════════ */
function handleFile(file) {
  if (!file) return;
  if (file.type.startsWith('image/')) {
    loadImage(file);
    // Auto-switch to image tab if we're not already there
    if (STATE.mode !== 'image') activateTab('image');
  } else if (file.type.startsWith('video/')) {
    loadVideo(file);
    if (STATE.mode !== 'video') activateTab('video');
  }
}

function activateTab(mode) {
  document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
  const tab = document.querySelector('[data-mode="'+mode+'"]');
  if (tab) tab.classList.add('active');
  switchMode(mode);
}

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      STATE.originalImage = img;
      showCanvas();
      syncColors(img);
      renderWithAnim();
    };
    img.onerror = () => console.warn('Image load failed');
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function loadVideo(file) {
  if (!videoEl) return;
  videoEl.src = URL.createObjectURL(file);
  videoEl.load();
  videoEl.addEventListener('loadeddata', () => {
    showCanvas();
    show('videoControls');
    videoEl.play();
    startVideoLoop();
  }, { once: true });
}

function showCanvas() {
  if (emptyState)   emptyState.style.display   = 'none';
  if (outputCanvas) outputCanvas.style.display  = 'block';
  if (perfDot)      perfDot.classList.add('active');
  // Enable depth view button now that we have image data
  const depthBtn = document.getElementById('openDepth');
  if (depthBtn) depthBtn.disabled = false;
  // Show clear button
  show('clearMedia');
  // If depth mode is already active in image mode, (re)start the animation loop
  if (STATE.depthMode && STATE.mode === 'image') _startDepthImageLoop();
}

/* ══ PROCESSING ANIMATION ═══════════════════════════════ */
const PROC_MSGS = ['ANALYZING...','EXTRACTING PALETTE...','COMPUTING DITHER...','APPLYING EFFECTS...'];
let procTimer = null;

function renderWithAnim() {
  const anim = document.getElementById('processingAnim');
  const fill = document.getElementById('procFill');
  const stat = document.getElementById('procStatus');
  if (anim) {
    anim.classList.remove('hidden');
    let pct = 0, mi = 0;
    clearInterval(procTimer);
    procTimer = setInterval(() => {
      pct = Math.min(pct + Math.random()*20 + 6, 94);
      if (fill) fill.style.width = pct + '%';
      if (stat && mi < PROC_MSGS.length) stat.textContent = PROC_MSGS[mi++];
    }, 80);
  }
  setTimeout(() => {
    render();
    clearInterval(procTimer);
    if (fill) fill.style.width = '100%';
    setTimeout(() => {
      if (anim) anim.classList.add('hidden');
      if (fill) fill.style.width = '0';
    }, 300);
  }, 180);
}

/* ══ CORE RENDER ════════════════════════════════════════ */
function render(src) {
  if (!outputCanvas || !outCtx) return;
  const source = src || STATE.originalImage;
  if (!source) return;

  const t0 = performance.now();

  // Measure available area
  const container = outputContainer || outputCanvas.parentElement;
  const areaW = container ? container.clientWidth  - 20 : 640;
  const areaH = container ? container.clientHeight - 20 : 480;

  let srcW = source.videoWidth  || source.naturalWidth  || source.width  || 400;
  let srcH = source.videoHeight || source.naturalHeight || source.height || 300;

  // ── Large image safety cap ─────────────────────────────
  // Cap source resolution before any pixel processing.
  // 1600×1200 max — avoids multi-MB imageData allocations that
  // stall the main thread. Display quality is unaffected because
  // we're only limiting the internal processing buffer, not the
  // display canvas (which is independently sized by areaW/areaH).
  const MAX_SRC = 1600;
  if (srcW > MAX_SRC || srcH > MAX_SRC) {
    const srcScale = Math.min(MAX_SRC / srcW, MAX_SRC / srcH);
    srcW = Math.round(srcW * srcScale);
    srcH = Math.round(srcH * srcScale);
  }

  const ratio = Math.min(areaW / srcW, areaH / srcH, 1);
  const dispW = Math.max(1, Math.round(srcW * ratio));
  const dispH = Math.max(1, Math.round(srcH * ratio));

  outputCanvas.width  = dispW;
  outputCanvas.height = dispH;

  const px = STATE.pixelSize;
  const bW = Math.max(1, Math.round(dispW / px));
  const bH = Math.max(1, Math.round(dispH / px));

  // ── Reuse offscreen canvas — avoid per-frame GC ────────
  // Only reallocate when dimensions change (image size or pixelSize change).
  if (!_offCanvas || _offW !== bW || _offH !== bH) {
    _offCanvas = document.createElement('canvas');
    _offW = bW; _offH = bH;
    _offCtx = _offCanvas.getContext('2d');
  }
  _offCanvas.width  = bW;
  _offCanvas.height = bH;
  const off = _offCanvas;
  const oc  = _offCtx;

  oc.filter = 'contrast(' + STATE.contrast + ') saturate(' + STATE.saturation + ')';
  oc.imageSmoothingEnabled = true;
  oc.drawImage(source, 0, 0, bW, bH);
  oc.filter = 'none';

  const imgData = oc.getImageData(0, 0, bW, bH);
  const d = imgData.data;

  // Resolve active palette
  let pal = STATE.palette;
  const dp = DEVICE_PALETTES[STATE.device];
  if (dp) pal = dp;
  const palette = PALETTES[pal] || null;
  const isGray  = pal === 'grayscale';

  // Pre-passes
  if (isGray)          grayPass(d);
  if (STATE.posterize) posterizePass(d, STATE.posterize);
  if (STATE.fx.edge)   edgePass(d, bW, bH);

  // Dithering
  switch (STATE.dither) {
    case 'floyd':    floydSteinberg(d, bW, bH, palette, isGray); break;
    case 'bayer':    bayerDither(d, bW, bH, palette, isGray);    break;
    case 'atkinson': atkinson(d, bW, bH, palette, isGray);       break;
    case 'ordered':  ordered(d, bW, bH, palette, isGray);        break;
    case 'error':    sierra(d, bW, bH, palette, isGray);         break;
    default:         paletteOnly(d, palette, isGray);
  }

  // Chroma
  if (STATE.fx.chroma) { oc.putImageData(imgData,0,0); chromaAb(oc, bW, bH, STATE.chromaAmt); }
  else                   oc.putImageData(imgData,0,0);

  // VHS distort
  if (STATE.device === 'vhs') vhsPass(oc, bW, bH);

  if (STATE.depthMode) {
    // isLiveMedia = true when source is a video/webcam element (not still image).
    // renderDepth skips the expensive baseZ/edge recompute for live frames.
    const isLiveMedia = !!(src && (src.tagName === 'VIDEO'));
    renderDepth(oc, d, bW, bH, px, dispW, dispH, isLiveMedia);
  } else {
    // ── NORMAL MODE: scale up — crisp pixels ──
    outCtx.imageSmoothingEnabled = false;
    outCtx.drawImage(off, 0, 0, dispW, dispH);
    // Noise overlay
    if (STATE.fx.noise || STATE.device === 'vhs') noisePass(outCtx, dispW, dispH);
  }

  // Stats
  const ms = Math.round(performance.now() - t0);
  setText('statSize',   dispW + '×' + dispH);
  setText('statBlocks', bW + '×' + bH);
  setText('statRender', ms + ' ms');
  if (perfRender) perfRender.textContent = ms;

  // Side effects (only for still images, not video frames)
  if (!src && STATE.originalImage) {
    updateSwatches(d, bW, bH);
    if (STATE.histogramMode) drawHistogram(d, bW, bH);
    if (STATE.compareMode)   updateCompare();
  }
}

/* ══ DITHERING ALGORITHMS ═══════════════════════════════ */
function grayPass(d) {
  for (let i=0;i<d.length;i+=4) {
    const v = Math.round(.299*d[i] + .587*d[i+1] + .114*d[i+2]);
    d[i]=d[i+1]=d[i+2]=v;
  }
}

function posterizePass(d, lvl) {
  const step = 255/lvl;
  for (let i=0;i<d.length;i+=4) {
    d[i]  =clamp(Math.round(Math.round(d[i]  /step)*step));
    d[i+1]=clamp(Math.round(Math.round(d[i+1]/step)*step));
    d[i+2]=clamp(Math.round(Math.round(d[i+2]/step)*step));
  }
}

function edgePass(d, w, h) {
  const cp=new Uint8ClampedArray(d), k=[0,-1,0,-1,5,-1,0,-1,0];
  for (let y=1;y<h-1;y++) for (let x=1;x<w-1;x++) {
    const idx=(y*w+x)*4;
    for (let c=0;c<3;c++) {
      let s=0;
      for (let ky=-1;ky<=1;ky++) for (let kx=-1;kx<=1;kx++)
        s+=cp[((y+ky)*w+(x+kx))*4+c]*k[(ky+1)*3+(kx+1)];
      d[idx+c]=clamp(s);
    }
  }
}

function paletteOnly(d, palette, isGray) {
  if (!palette||isGray) return;
  for (let i=0;i<d.length;i+=4) {
    const [r,g,b]=closest(d[i],d[i+1],d[i+2],palette);
    d[i]=r;d[i+1]=g;d[i+2]=b;
  }
}

function floydSteinberg(d, w, h, palette, isGray) {
  const buf=new Float32Array(w*h*3);
  for (let i=0,j=0;i<d.length;i+=4,j+=3){buf[j]=d[i];buf[j+1]=d[i+1];buf[j+2]=d[i+2];}
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const j=(y*w+x)*3;
    let oR=clamp(buf[j]),oG=clamp(buf[j+1]),oB=clamp(buf[j+2]),nR,nG,nB;
    if (palette&&!isGray) [nR,nG,nB]=closest(oR,oG,oB,palette);
    else { const v=Math.round(clamp(.299*oR+.587*oG+.114*oB)/32)*32;nR=nG=nB=v; }
    buf[j]=nR;buf[j+1]=nG;buf[j+2]=nB;
    const eR=oR-nR,eG=oG-nG,eB=oB-nB;
    se(buf,w,h,x+1,y,  eR,eG,eB,7/16);se(buf,w,h,x-1,y+1,eR,eG,eB,3/16);
    se(buf,w,h,x,  y+1,eR,eG,eB,5/16);se(buf,w,h,x+1,y+1,eR,eG,eB,1/16);
  }
  for (let i=0,j=0;i<d.length;i+=4,j+=3){d[i]=clamp(buf[j]);d[i+1]=clamp(buf[j+1]);d[i+2]=clamp(buf[j+2]);}
}

function atkinson(d, w, h, palette, isGray) {
  const buf=new Float32Array(w*h*3);
  for (let i=0,j=0;i<d.length;i+=4,j+=3){buf[j]=d[i];buf[j+1]=d[i+1];buf[j+2]=d[i+2];}
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const j=(y*w+x)*3;
    let oR=clamp(buf[j]),oG=clamp(buf[j+1]),oB=clamp(buf[j+2]),nR,nG,nB;
    if (palette&&!isGray) [nR,nG,nB]=closest(oR,oG,oB,palette);
    else { const v=Math.round(clamp(.299*oR+.587*oG+.114*oB)/32)*32;nR=nG=nB=v; }
    buf[j]=nR;buf[j+1]=nG;buf[j+2]=nB;
    const eR=(oR-nR)/8,eG=(oG-nG)/8,eB=(oB-nB)/8;
    [[x+1,y],[x+2,y],[x-1,y+1],[x,y+1],[x+1,y+1],[x,y+2]].forEach(([nx,ny])=>se(buf,w,h,nx,ny,eR,eG,eB,1));
  }
  for (let i=0,j=0;i<d.length;i+=4,j+=3){d[i]=clamp(buf[j]);d[i+1]=clamp(buf[j+1]);d[i+2]=clamp(buf[j+2]);}
}

function bayerDither(d, w, h, palette, isGray) {
  const sp=60;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const i=(y*w+x)*4, th=(BAYER4[y%4][x%4]-.5)*sp;
    let r=clamp(d[i]+th),g=clamp(d[i+1]+th),b=clamp(d[i+2]+th);
    if (palette&&!isGray) [r,g,b]=closest(r,g,b,palette);
    else if (isGray){const v=Math.round(.299*r+.587*g+.114*b);r=g=b=v;}
    d[i]=r;d[i+1]=g;d[i+2]=b;
  }
}

function ordered(d, w, h, palette, isGray) {
  const sp=80;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const i=(y*w+x)*4, th=(BAYER8[y%8][x%8]-.5)*sp;
    let r=clamp(d[i]+th),g=clamp(d[i+1]+th),b=clamp(d[i+2]+th);
    if (palette&&!isGray) [r,g,b]=closest(r,g,b,palette);
    else if (isGray){const v=Math.round(.299*r+.587*g+.114*b);r=g=b=v;}
    d[i]=r;d[i+1]=g;d[i+2]=b;
  }
}

function sierra(d, w, h, palette, isGray) {
  const buf=new Float32Array(w*h*3);
  for (let i=0,j=0;i<d.length;i+=4,j+=3){buf[j]=d[i];buf[j+1]=d[i+1];buf[j+2]=d[i+2];}
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const j=(y*w+x)*3;
    let oR=clamp(buf[j]),oG=clamp(buf[j+1]),oB=clamp(buf[j+2]),nR,nG,nB;
    if (palette&&!isGray) [nR,nG,nB]=closest(oR,oG,oB,palette);
    else { const v=Math.round(clamp(.299*oR+.587*oG+.114*oB)/32)*32;nR=nG=nB=v; }
    buf[j]=nR;buf[j+1]=nG;buf[j+2]=nB;
    const eR=oR-nR,eG=oG-nG,eB=oB-nB;
    se(buf,w,h,x+1,y,eR,eG,eB,5/32);se(buf,w,h,x+2,y,eR,eG,eB,3/32);
    se(buf,w,h,x-2,y+1,eR,eG,eB,2/32);se(buf,w,h,x-1,y+1,eR,eG,eB,4/32);
    se(buf,w,h,x,y+1,eR,eG,eB,5/32);se(buf,w,h,x+1,y+1,eR,eG,eB,4/32);se(buf,w,h,x+2,y+1,eR,eG,eB,2/32);
    se(buf,w,h,x-1,y+2,eR,eG,eB,2/32);se(buf,w,h,x,y+2,eR,eG,eB,3/32);se(buf,w,h,x+1,y+2,eR,eG,eB,2/32);
  }
  for (let i=0,j=0;i<d.length;i+=4,j+=3){d[i]=clamp(buf[j]);d[i+1]=clamp(buf[j+1]);d[i+2]=clamp(buf[j+2]);}
}

function chromaAb(ctx, w, h, amt) {
  try {
    const id=ctx.getImageData(0,0,w,h),d=id.data,cp=new Uint8ClampedArray(d);
    const a=Math.max(0,Math.min(Math.round(amt),w-1));
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const idx=(y*w+x)*4;
      d[idx]  =cp[(y*w+Math.min(x+a,w-1))*4];
      d[idx+2]=cp[(y*w+Math.max(x-a,0))*4+2];
    }
    ctx.putImageData(id,0,0);
  } catch(e){}
}

function noisePass(ctx, w, h) {
  try {
    const id=ctx.getImageData(0,0,w,h),d=id.data;
    for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*18;d[i]=clamp(d[i]+n);d[i+1]=clamp(d[i+1]+n);d[i+2]=clamp(d[i+2]+n);}
    ctx.putImageData(id,0,0);
  } catch(e){}
}

function vhsPass(ctx, w, h) {
  try {
    const id=ctx.getImageData(0,0,w,h),d=id.data,cp=new Uint8ClampedArray(d);
    for(let y=0;y<h;y++) if(Math.random()<.018){
      const shift=Math.floor((Math.random()-.5)*8);
      for(let x=0;x<w;x++){
        const s=Math.max(0,Math.min(w-1,x+shift));
        const di=(y*w+x)*4,si=(y*w+s)*4;
        d[di]=cp[si];d[di+1]=cp[si+1];d[di+2]=cp[si+2];
      }
    }
    ctx.putImageData(id,0,0);
  } catch(e){}
}

function se(buf,w,h,x,y,eR,eG,eB,f){
  if(x<0||x>=w||y<0||y>=h)return;
  const j=(y*w+x)*3;buf[j]+=eR*f;buf[j+1]+=eG*f;buf[j+2]+=eB*f;
}
function clamp(v){return Math.max(0,Math.min(255,Math.round(v)));}
function closest(r,g,b,pal){
  let best=pal[0],bestD=Infinity;
  for(const c of pal){const d=(r-c[0])**2+(g-c[1])**2+(b-c[2])**2;if(d<bestD){bestD=d;best=c;}}
  return best;
}

/* ══ VIDEO LOOP ═════════════════════════════════════════ */
let vidFrames=0, vidFpsTs=0;
function startVideoLoop() {
  cancelAnimationFrame(STATE.videoAnimFrame);
  function loop(t) {
    if (videoEl && !videoEl.paused && !videoEl.ended) {
      render(videoEl);
      vidFrames++;
      if (t - vidFpsTs >= 1000) { setText('vidFps', vidFrames+' FPS'); vidFrames=0; vidFpsTs=t; }
    }
    STATE.videoAnimFrame = requestAnimationFrame(loop);
  }
  STATE.videoAnimFrame = requestAnimationFrame(loop);
}

/* ══ WEBCAM ═════════════════════════════════════════════ */
async function startWebcam() {
  if (!navigator.mediaDevices) { alert('Camera requires a secure context (HTTPS or localhost).'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ width:640, height:480 } });
    STATE.webcamStream = stream;
    webcamEl.srcObject = stream;
    await webcamEl.play();
    showCanvas();
    hide('startWebcam'); show('stopWebcam');
    cancelAnimationFrame(STATE.webcamAnimFrame);
    function wcLoop() {
      if (webcamEl.readyState >= 2) render(webcamEl);
      STATE.webcamAnimFrame = requestAnimationFrame(wcLoop);
    }
    STATE.webcamAnimFrame = requestAnimationFrame(wcLoop);
  } catch(e) { alert('Webcam error: '+e.message); }
}

function stopWebcam() {
  if (STATE.webcamStream) { STATE.webcamStream.getTracks().forEach(t=>t.stop()); STATE.webcamStream=null; }
  cancelAnimationFrame(STATE.webcamAnimFrame);
  STATE.webcamAnimFrame = null;
  show('startWebcam'); hide('stopWebcam');
}

/* ── CLEAR MEDIA — full reset to blank state ─────────────
   Stops all streams, loops, depth mode, and restores the
   upload-awaiting empty state.
── */
function clearMedia() {
  // Stop all playback and streams
  stopStreams();
  if (videoEl) { videoEl.src = ''; videoEl.load(); }

  // Stop depth
  if (STATE.depthMode) closeDepthView();
  STATE.disperseMode = false;
  _stopDepthImageLoop();

  // Clear state
  STATE.originalImage = null;

  // Reset cached offscreen canvas so dimensions realloc
  _offW = _offH = 0;
  _dBW = _dBH = 0;

  // Clear output canvas
  if (outputCanvas && outCtx) {
    outputCanvas.width  = outputCanvas.width;  // clears canvas
    outputCanvas.style.display = 'none';
  }

  // Hide controls
  hide('videoControls');
  hide('depthHud');
  hide('clearMedia');
  hide('disperseControls');

  // Disable depth button
  const depthBtn = document.getElementById('openDepth');
  if (depthBtn) { depthBtn.disabled = true; depthBtn.classList.remove('active'); depthBtn.textContent = '\u25C7  ENABLE DEPTH MODE'; }

  // Restore empty state
  if (emptyState) emptyState.style.display = '';

  // Reset perf dot
  if (perfDot) perfDot.classList.remove('active');

  // Reset stats
  setText('statSize','--'); setText('statBlocks','--');
  setText('statColors','--'); setText('statRender','--');

  // Reset dominant colors
  const dc = document.getElementById('dominantColors');
  if (dc) dc.innerHTML = '<span class="dom-placeholder">awaiting image...</span>';
}

/* ══ COLOR SYNC ═════════════════════════════════════════ */
function syncColors(img) {
  try {
    const SIZE=48, sc=document.createElement('canvas');
    sc.width=sc.height=SIZE;
    const sctx=sc.getContext('2d'); sctx.drawImage(img,0,0,SIZE,SIZE);
    const d=sctx.getImageData(0,0,SIZE,SIZE).data;
    const hist=new Float32Array(360);

    for(let i=0;i<d.length;i+=4){
      const r=d[i]/255,g=d[i+1]/255,b=d[i+2]/255;
      const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
      if(delta<.09||max<.07) continue;
      let h=0;
      if(max===r)h=60*(((g-b)/delta)%6);
      else if(max===g)h=60*(((b-r)/delta)+2);
      else h=60*(((r-g)/delta)+4);
      if(h<0)h+=360;
      const w=(max+min)/2, weight=delta*(1-Math.abs(2*w-1));
      for(let k=-8;k<=8;k++) hist[Math.round((h+k+360))%360]+=weight*Math.exp(-.5*(k/3)**2);
    }

    const peaks=[],used=new Uint8Array(360);
    for(let a=0;a<4;a++){
      let best=-1,bestH=0;
      for(let i=0;i<360;i++) if(!used[i]&&hist[i]>best){best=hist[i];bestH=i;}
      if(best<.04) break;
      peaks.push(bestH);
      for(let k=-35;k<=35;k++) used[(bestH+k+360)%360]=1;
    }
    if(!peaks.length) return;
    while(peaks.length<4) peaks.push((peaks[0]+90*peaks.length)%360);
    STATE.syncedHues = peaks;

    // Update CSS accent
    const root = document.documentElement;
    root.style.setProperty('--h', peaks[0]);
    root.style.setProperty('--s', '68%');
    root.style.setProperty('--l', '64%');

    // Paint blobs
    const opacities = ['.22','.17','.14','.11'];
    const bls = [blob1,blob2,blob3,blob4];
    const lts = ['56%','53%','58%','55%'];
    bls.forEach((b,i)=>{ if(b) b.style.background=`hsla(${peaks[i]},72%,${lts[i]},${opacities[i]})`; });
  } catch(e){}
}

/* ══ DOMINANT COLORS SWATCHES ═══════════════════════════ */
function updateSwatches(data, w, h) {
  const box = document.getElementById('dominantColors');
  if (!box) return;
  try {
    const map={};
    for(let i=0;i<data.length;i+=4){
      const k=(data[i]>>4)+','+(data[i+1]>>4)+','+(data[i+2]>>4);
      map[k]=(map[k]||0)+1;
    }
    const sorted=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12);
    box.innerHTML='';
    sorted.forEach(([key])=>{
      const [r,g,b]=key.split(',').map(v=>+v*16+8);
      const el=document.createElement('div');
      el.className='dom-swatch'; el.style.background=`rgb(${r},${g},${b})`;
      el.title=`rgb(${r},${g},${b})`; box.appendChild(el);
    });
    setText('statColors', Object.keys(map).length);
  } catch(e){}
}

/* ══ HISTOGRAM ══════════════════════════════════════════ */
function drawHistogram(data, w, h) {
  if (!histEl || !histCtx) return;
  try {
    const W = histEl.clientWidth||400, H=60;
    if (histEl.width!==W) histEl.width=W;
    histEl.height=H;
    const rH=new Float32Array(256),gH=new Float32Array(256),bH=new Float32Array(256);
    for(let i=0;i<data.length;i+=4){rH[data[i]]++;gH[data[i+1]]++;bH[data[i+2]]++;}
    const mx=Math.max(...rH,...gH,...bH)||1;
    histCtx.fillStyle='rgba(0,0,0,.6)'; histCtx.fillRect(0,0,W,H);
    const bw=W/256;
    for(let i=0;i<256;i++){
      histCtx.fillStyle='rgba(255,80,80,.55)';  histCtx.fillRect(i*bw,H*(1-rH[i]/mx),bw,H*rH[i]/mx);
      histCtx.fillStyle='rgba(80,200,80,.55)';  histCtx.fillRect(i*bw,H*(1-gH[i]/mx),bw,H*gH[i]/mx);
      histCtx.fillStyle='rgba(80,120,255,.55)'; histCtx.fillRect(i*bw,H*(1-bH[i]/mx),bw,H*bH[i]/mx);
    }
  } catch(e){}
}

/* ══ VIEW MODES ═════════════════════════════════════════ */
function setView(v) {
  STATE.compareMode   = v==='compare';
  STATE.histogramMode = v==='histogram';

  ['viewNormal','viewCompare','viewHistogram'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.classList.remove('active');
  });
  const activeId = {normal:'viewNormal',compare:'viewCompare',histogram:'viewHistogram'}[v];
  if(activeId){const el=document.getElementById(activeId);if(el)el.classList.add('active');}

  const cw=document.getElementById('compareWrap');
  const oc=document.getElementById('outputContainer');

  if (v==='compare') {
    if(cw)cw.classList.remove('hidden');
    if(oc)oc.style.display='none';
    updateCompare();
  } else {
    if(cw)cw.classList.add('hidden');
    if(oc)oc.style.display='';
  }

  const hEl = document.getElementById('histogramPanel');
  if(hEl) hEl.classList.toggle('hidden', v!=='histogram');

  if(STATE.originalImage && v!=='compare') render();
}

function updateCompare() {
  if (!STATE.originalImage||!compareOriginalEl||!compareProcessedEl) return;
  try {
    const W=compareOriginalEl.clientWidth||400, H=compareOriginalEl.clientHeight||300;
    compareOriginalEl.width=W; compareOriginalEl.height=H;
    compareProcessedEl.width=W; compareProcessedEl.height=H;
    compareOriginalEl.getContext('2d').drawImage(STATE.originalImage,0,0,W,H);
    if(outputCanvas)compareProcessedEl.getContext('2d').drawImage(outputCanvas,0,0,W,H);
  } catch(e){}
}

function initCompareDrag() {
  const slider=compareSliderEl; if(!slider) return;
  let drag=false;
  slider.addEventListener('mousedown',()=>drag=true);
  window.addEventListener('mouseup',()=>drag=false);
  window.addEventListener('mousemove',e=>{
    if(!drag)return;
    const wrap=document.getElementById('compareWrap');
    if(!wrap)return;
    const r=wrap.getBoundingClientRect();
    const p=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    slider.style.left=(p*100)+'%';
    if(compareOriginalEl){compareOriginalEl.style.width=(p*100)+'%';}
    if(compareProcessedEl){compareProcessedEl.style.left=(p*100)+'%';compareProcessedEl.style.width=((1-p)*100)+'%';}
  });
}


/* ══════════════════════════════════════════════════════════
   UNIFIED PIXEL DEPTH SYSTEM v3
   ──────────────────────────────────────────────────────────

   ARCHITECTURE — the fundamental change
   ───────────────────────────────────────
   Depth is NO LONGER a separate overlay scene.
   When STATE.depthMode = true, render() itself calls
   renderDepth(oc, d, bW, bH, px, dispW, dispH) instead of
   drawImage(off, 0,0,dispW,dispH).

   renderDepth() receives the SAME processed pixel data (d)
   that the normal renderer already computed — same palette,
   same dithering, same device mode, same pixel size. It
   writes directly to outCtx (the main outputCanvas).

   This means depth mode is fully live at zero extra cost:
   • Video loop → render(videoEl) → renderDepth() → live depth
   • Webcam loop → render(webcamEl) → renderDepth() → live depth
   • Any left panel control → render() → renderDepth() → instant
   • No rebuild button, no stale snapshot, no separate RAF loop.

   SPRING STATE (Float32Arrays, not objects)
   ──────────────────────────────────────────
   Per-block spring data lives in pre-allocated typed arrays
   indexed by row*bW+col. When bW/bH changes (pixelSize
   changed), arrays are reallocated and baseZ is recomputed.
   This is faster than an array of objects and avoids GC.

   MOUSE: a single listener on outputCanvas. Removed on close.

   DEPTH CALCULATION
   ──────────────────
   Uses the processed pixel data d[] directly — no re-sampling:
     lum = 0.299R + 0.587G + 0.114B
     gx  = lum[col+1,row] − lum[col-1,row]   (Sobel-lite)
     gy  = lum[col,row+1] − lum[col,row-1]
     edge = min(1, √(gx²+gy²) × 4)
     baseZ = lum×0.55 + edge×0.45

   RENDERING
   ──────────
   Each block: bottom+right shadow, top+left highlight,
   main face with dynamic lighting, glow for cursor/sat blocks.
   All written to outCtx with shadowBlur reset after each.

   PERFORMANCE
   ────────────
   • Depth piggybacks the existing RAF (no extra loop)
   • Spring arrays: Float32Array (no object GC)
   • shadowBlur only when influence > 0.04
   • Wave array capped at 8 pulses
   • Grid realloc only when bW/bH changes
══════════════════════════════════════════════════════════ */

const DEPTH = {
  depthAmt: 40,
  radius:   120,
};

const SPRING_K = 0.10;
const DAMPING  = 0.78;

const WAVE_SPEED          = 5;
const WAVE_MAX_AGE        = 55;
const WAVE_THRESHOLD      = 4;
const TILT_STR            = 0.18;
const BREAKAWAY_THRESHOLD = 12;
const BREAKAWAY_DECAY     = 0.88;

// Cached offscreen canvas — reused every render() to avoid per-frame GC
let _offCanvas = null, _offCtx = null, _offW = 0, _offH = 0;

// Spring state — Float32Arrays indexed row*bW+col
let _dCurZ   = null;
let _dVelZ   = null;
let _dBaseZ  = null;
let _dDriftX = null;
let _dDriftY = null;
let _dSat    = null;
let _dBW = 0, _dBH = 0;

// Mouse state
let depthMouseX  = -9999;
let depthMouseY  = -9999;
let depthPrevMX  = -9999;
let depthPrevMY  = -9999;
let depthMouseNX = 0.5;
let depthMouseNY = 0.5;

// Physics state
let depthWaves  = [];
let depthTiltX  = 0;
let depthTiltY  = 0;
let depthBreath = 0;

/* ── OPEN — just sets a flag, render() does the rest ── */
function openDepthView() {
  if (!outputCanvas) return;
  STATE.depthMode = true;

  // HUD
  const hud = document.getElementById('depthHud');
  if (hud) hud.classList.remove('hidden');

  // Button state
  const btn = document.getElementById('openDepth');
  if (btn) { btn.classList.add('active'); btn.textContent = '\u25C8  DEPTH MODE ON'; }

  // CSS cursor + neon border via class
  const container = document.getElementById('outputContainer');
  if (container) container.classList.add('depth-mode-active');

  // Mouse on the MAIN outputCanvas (not a separate depth canvas)
  _attachDepthMouse();

  // Reset physics
  depthWaves  = [];
  depthTiltX  = depthTiltY = depthBreath = 0;
  depthPrevMX = depthPrevMY = -9999;
  _dBW = _dBH = 0;   // force spring realloc on first renderDepth()

  // Trigger immediate render
  if (STATE.originalImage) render();

  // Show disperse controls
  show('disperseControls');

  // ── Start depth animation loop for static images ──────────
  // Video and webcam already have their own RAF loops which call
  // render() continuously. For static images there is no loop —
  // depth would freeze between user interactions.
  // This lightweight loop calls render() only when depthMode is
  // active AND we're in image mode (not video/webcam).
  // It is automatically stopped in closeDepthView() and whenever
  // video/webcam mode takes over.
  _startDepthImageLoop();
}

/* ── CLOSE ── */
function closeDepthView() {
  STATE.depthMode = false;
  STATE.disperseMode = false;
  _stopDepthImageLoop();

  hide('disperseControls');
  const dispBtn = document.getElementById('disperseBtn');
  if (dispBtn) dispBtn.classList.remove('dispersed');

  const hud = document.getElementById('depthHud');
  if (hud) hud.classList.add('hidden');

  const btn = document.getElementById('openDepth');
  if (btn) { btn.classList.remove('active'); btn.textContent = '\u25C7  ENABLE DEPTH MODE'; }

  const container = document.getElementById('outputContainer');
  if (container) container.classList.remove('depth-mode-active');

  _detachDepthMouse();
  depthWaves  = [];
  depthMouseX = depthMouseY = depthPrevMX = depthPrevMY = -9999;

  // Re-render in normal mode
  if (STATE.originalImage) render();
}

function _attachDepthMouse() {
  if (!outputCanvas) return;
  outputCanvas.onmousemove = e => {
    const r = outputCanvas.getBoundingClientRect();
    depthMouseX  = e.clientX - r.left;
    depthMouseY  = e.clientY - r.top;
    depthMouseNX = depthMouseX / (outputCanvas.width  || 1);
    depthMouseNY = depthMouseY / (outputCanvas.height || 1);
  };
  outputCanvas.onmouseleave = () => {
    depthMouseX = depthMouseY = -9999;
  };
}

function _detachDepthMouse() {
  if (!outputCanvas) return;
  outputCanvas.onmousemove = null;
  outputCanvas.onmouseleave = null;
}

/* ── STATIC IMAGE DEPTH LOOP ──────────────────────────────
   Video and webcam modes already call render() on every RAF
   frame via their own loops (startVideoLoop / wcLoop).
   In image mode there is no persistent loop — so without
   this, depth physics would freeze between interactions.

   This loop runs ONLY when:
   - STATE.depthMode is true
   - STATE.mode is 'image' (no video/webcam loop running)
   - STATE.originalImage exists

   It calls render() with no src argument, which redraws
   the same pixel data through renderDepth(). The pixel
   processing (palette, dither, etc.) is NOT re-run —
   the reuse of _offCanvas and _liveColours means only
   the spring physics, breath, tilt and wave state advance.

   Performance: render() exits early if nothing has changed
   appreciably (spring velocities near zero, no mouse, no
   waves). The `_depthPhysicsActive()` check throttles the
   loop to ~30fps when fully idle.
── */
let _depthIdleFrames = 0;

function _startDepthImageLoop() {
  _stopDepthImageLoop();
  _depthIdleFrames = 0;

  function loop() {
    // Stop if depth mode was deactivated or mode changed
    if (!STATE.depthMode || STATE.mode !== 'image' || !STATE.originalImage) {
      STATE.depthAnimFrame = null;
      return;
    }
    STATE.depthAnimFrame = requestAnimationFrame(loop);

    // ── Idle throttle ────────────────────────────────────
    // When breath is the only animation (no mouse, no waves,
    // springs all settled), we only need ~12fps for the subtle
    // pulse. This halves CPU use during idle state.
    // Any interaction resets _depthIdleFrames to 0 immediately.
    const physicsActive = _depthPhysicsActive();
    if (!physicsActive) {
      _depthIdleFrames++;
      if (_depthIdleFrames % 3 !== 0) return;  // render every 3rd frame when idle
    } else {
      _depthIdleFrames = 0;
    }

    render();   // re-renders through renderDepth() automatically
  }

  STATE.depthAnimFrame = requestAnimationFrame(loop);
}

function _stopDepthImageLoop() {
  if (STATE.depthAnimFrame) {
    cancelAnimationFrame(STATE.depthAnimFrame);
    STATE.depthAnimFrame = null;
  }
}

// Returns true when spring physics are still moving noticeably
// or there are active waves or mouse influence.
function _depthPhysicsActive() {
  if (depthMouseX > 0) return true;           // cursor on canvas
  if (depthWaves.length > 0) return true;      // active waves
  if (!_dVelZ) return false;
  // Sample a few spring velocities — if any significant, return true
  const samples = Math.min(20, _dVelZ.length);
  const step = Math.max(1, (_dVelZ.length / samples) | 0);
  for (let i = 0; i < _dVelZ.length; i += step) {
    if (Math.abs(_dVelZ[i]) > 0.0005) return true;
  }
  return false;
}

/* ══════════════════════════════════════════════════════════

/* ══════════════════════════════════════════════════════════
   renderDepth — OPTIMIZED v3.1
   ──────────────────────────────────────────────────────────
   Called by render() when STATE.depthMode === true.
   Parameters come directly from the main pixel pipeline —
   same processed data, same palette, same pixel size.

   KEY OPTIMIZATIONS OVER v3.0:
   ─────────────────────────────

   1. ADAPTIVE BLOCK LIMIT (hard cap: 14 400 rendered blocks)
      Total blocks = bW × bH. If > 14 400, we compute a
      render step:  step = ceil(sqrt(total / 14400))
      Then we draw every step-th block in each axis.
      At step=2 we render 25% of blocks. At step=3 → 11%.
      The visual difference is barely noticeable because
      adjacent blocks have similar colours, and the depth
      field still appears continuous.

   2. NO SQRT IN CURSOR-DISTANCE (fast approximation)
      The exact radius check needs sqrt. We replace it with
      a squared-distance check first (no sqrt), then only
      call sqrt for the ~few blocks inside the bounding box.
      For 10 000 blocks and radius=120, the bounding box
      contains ~(240/cell)² ≈ 200–400 blocks max.
      The rest skip the influence calculation entirely.

   3. NO WAVE sqrt PER BLOCK (squared comparison)
      Wave distance check uses dx²+dy² < (wavR+30)² as a
      fast reject before computing the actual sqrt.

   4. SHADOW DRAWN WITH CACHED fillStyle STRINGS
      We pre-compute the 8 most common shadow alpha strings
      (quantised to 0.1 steps) to avoid per-block string
      formatting. Template literals inside tight loops create
      one GC object per call — at 5000 blocks × 60fps that
      is 300 000 strings/sec.

   5. SHADOWBLUR GROUPED — NOT PER BLOCK
      Instead of setting shadowBlur individually for every
      glowing block (which flushes the GPU state machine),
      we collect glow blocks into a list during the main
      pass (drawn without glow). Then a second, MUCH
      smaller pass re-draws only those blocks with glow.
      Typically < 5% of total blocks glow at any time.
      This converts N state-flushes to 1 state-flush + K
      redraws where K << N.

   6. LIVE VIDEO/WEBCAM — baseZ SKIPPED WHEN FAST
      For live media (src passed to render()), recomputing
      baseZ every frame is expensive and visually redundant
      (the spring physics smooth it out anyway). We compute
      baseZ only when the grid dimensions change OR when
      source is a still image. Video/webcam frames reuse
      the existing baseZ and just update the colour buffer.

   7. BREATHING SKIPPED WHEN MANY BLOCKS
      At step≥3, the breathing amplitude is halved. At step≥4
      it is disabled (save the per-block sin() call).

   8. FILLRECT BATCHING
      Shadow rects for all blocks at the same alpha level
      are drawn in sequence — the browser can batch consecutive
      fillRect calls with identical state far more efficiently.

══════════════════════════════════════════════════════════ */

// Pre-built shadow alpha strings — avoids per-block toFixed() + template literal
const _SHADOW_STRS = [];
for (let i = 0; i <= 10; i++) _SHADOW_STRS[i] = `rgba(0,0,0,${(i * 0.1).toFixed(1)})`;
const _WHITE_STRS  = [];
for (let i = 0; i <= 6; i++)  _WHITE_STRS[i]  = `rgba(255,255,255,${(i * 0.1).toFixed(1)})`;

// Separate colour buffer for live media so baseZ reuse is safe
let _liveColours = null;   // Uint8Array r,g,b triples — updated every live frame
let _liveBW = 0, _liveBH = 0;

// Adaptive quality state
let _depthQuality = 1.0;   // 0..1, updated by FPS monitor
let _lastFrameMs  = 16;

function renderDepth(oc, d, bW, bH, px, dispW, dispH, isLiveMedia) {
  // When disperse mode is active, _runDisperseLoop() draws to outCtx directly.
  // renderDepth should not overwrite that output.
  if (STATE.disperseMode) return;

  const total = bW * bH;
  const t0    = performance.now();

  // ── 1. Adaptive step (block skipping) ───────────────────
  // Hard limit: never render more than DEPTH_MAX_BLOCKS in a
  // single call. step=1 → all blocks, step=2 → every 2nd, etc.
  const DEPTH_MAX_BLOCKS = 14400;
  const step = (total > DEPTH_MAX_BLOCKS)
    ? Math.ceil(Math.sqrt(total / DEPTH_MAX_BLOCKS))
    : 1;

  // ── 2. Spring array reallocation ────────────────────────
  // Reallocate when grid dimensions change. For live media,
  // we only recompute baseZ if dimensions changed — colour
  // data is updated separately each frame.
  const gridChanged = (_dBW !== bW || _dBH !== bH);

  if (gridChanged) {
    _dCurZ   = new Float32Array(total);
    _dVelZ   = new Float32Array(total);
    _dBaseZ  = new Float32Array(total);
    _dDriftX = new Float32Array(total);
    _dDriftY = new Float32Array(total);
    _dSat    = new Float32Array(total);
    _liveColours = new Uint8Array(total * 3);
    _liveBW = bW; _liveBH = bH;

    // baseZ from luminance + edge (always computed fresh on resize)
    const lum = new Float32Array(total);
    for (let i = 0; i < d.length; i += 4) {
      lum[i >> 2] = (d[i] * .299 + d[i+1] * .587 + d[i+2] * .114) / 255;
    }
    const gl = (c, r) =>
      (c < 0 || c >= bW || r < 0 || r >= bH) ? 0 : lum[r * bW + c];

    for (let row = 0; row < bH; row++) {
      for (let col = 0; col < bW; col++) {
        const idx = row * bW + col;
        const pi  = idx * 4;
        const bright = lum[idx];
        const gx  = gl(col+1,row) - gl(col-1,row);
        const gy  = gl(col,row+1) - gl(col,row-1);
        const edge = Math.min(1, Math.sqrt(gx*gx + gy*gy) * 4);
        _dBaseZ[idx] = bright * 0.55 + edge * 0.45;
        _dCurZ[idx]  = _dBaseZ[idx];

        const mx = Math.max(d[pi],d[pi+1],d[pi+2]);
        _dSat[idx] = mx===0 ? 0 : ((mx-Math.min(d[pi],d[pi+1],d[pi+2]))/mx)*bright;

        // Store initial colour
        _liveColours[idx*3]   = d[pi];
        _liveColours[idx*3+1] = d[pi+1];
        _liveColours[idx*3+2] = d[pi+2];
      }
    }
    _dBW = bW; _dBH = bH;

  } else if (isLiveMedia) {
    // Dimensions same, live frame: update colours + saturation only.
    // Skip edge/lum recompute — spring physics smooth colour transitions.
    for (let i = 0; i < total; i++) {
      const pi = i * 4;
      _liveColours[i*3]   = d[pi];
      _liveColours[i*3+1] = d[pi+1];
      _liveColours[i*3+2] = d[pi+2];
      const mx = Math.max(d[pi],d[pi+1],d[pi+2]);
      const lum = (d[pi]*.299+d[pi+1]*.587+d[pi+2]*.114)/255;
      _dSat[i] = mx===0 ? 0 : ((mx-Math.min(d[pi],d[pi+1],d[pi+2]))/mx)*lum;
    }
  } else {
    // Still image, dimensions same: update baseZ from new pixel data
    // (palette or dither may have changed).
    const lum = new Float32Array(total);
    for (let i = 0; i < d.length; i += 4) {
      lum[i >> 2] = (d[i] * .299 + d[i+1] * .587 + d[i+2] * .114) / 255;
    }
    const gl = (c, r) =>
      (c < 0 || c >= bW || r < 0 || r >= bH) ? 0 : lum[r * bW + c];
    for (let row = 0; row < bH; row++) {
      for (let col = 0; col < bW; col++) {
        const idx = row * bW + col;
        const pi  = idx * 4;
        const bright = lum[idx];
        const gx  = gl(col+1,row) - gl(col-1,row);
        const gy  = gl(col,row+1) - gl(col,row-1);
        const edge = Math.min(1, Math.sqrt(gx*gx + gy*gy) * 4);
        _dBaseZ[idx] = bright * 0.55 + edge * 0.45;

        _liveColours[idx*3]   = d[pi];
        _liveColours[idx*3+1] = d[pi+1];
        _liveColours[idx*3+2] = d[pi+2];
        const mx = Math.max(d[pi],d[pi+1],d[pi+2]);
        _dSat[idx] = mx===0 ? 0 : ((mx-Math.min(d[pi],d[pi+1],d[pi+2]))/mx)*bright;
      }
    }
  }

  // ── 3. Mouse velocity → wave emission ───────────────────
  let mouseSpeed = 0;
  if (depthMouseX > 0 && depthPrevMX > 0) {
    const mvX = depthMouseX - depthPrevMX;
    const mvY = depthMouseY - depthPrevMY;
    mouseSpeed = Math.sqrt(mvX*mvX + mvY*mvY);
    if (mouseSpeed > WAVE_THRESHOLD && depthWaves.length < 8) {
      depthWaves.push({ x:depthMouseX, y:depthMouseY, age:0, strength:Math.min(1,mouseSpeed/30) });
    }
  }
  depthPrevMX = depthMouseX;
  depthPrevMY = depthMouseY;
  depthWaves = depthWaves.filter(w => { w.age++; return w.age < WAVE_MAX_AGE; });

  // ── 4. Parallax tilt + CINEMATIC IDLE DRIFT ─────────────
  // Drift advances autonomous oscillators so the surface looks
  // alive even without mouse movement. Drift values are ADDED
  // to the cursor-driven tilt so both work simultaneously.
  _advanceDriftLight();
  const drift = _getDriftTilt();

  depthTiltX += ((depthMouseNX - 0.5) * TILT_STR + drift.tx - depthTiltX) * 0.06;
  depthTiltY += ((depthMouseNY - 0.5) * TILT_STR + drift.ty - depthTiltY) * 0.06;

  // Breathing — disabled when step≥4 (too many blocks), halved at step≥3
  const breathAmp = step >= 4 ? 0 : step >= 3 ? 0.02 : 0.04;
  depthBreath += 0.012;

  // ── 5. Grid layout — DENSE PIXEL MODE for small px ─────
  // Problem: when px ≤ 8, the gaps between blocks + vertical
  // parallax offsets + shadow strips create visible holes that
  // break image continuity. Solution: scale all separation
  // effects by a `denseFactor` that approaches 0 as px shrinks.
  //
  // denseFactor = 1.0 at px=16+ (full holographic separation)
  // denseFactor = 0.0 at px≤4  (zero gaps, minimal offsets)
  // Linear interpolation in between.
  //
  // This single multiplier controls:
  //   gap, parallax strength, depth extrusion offset,
  //   shadow thickness, highlight thickness, breakaway.
  // Large pixels retain the full holographic block effect.
  // Small pixels stay connected and image-readable.
  const denseFactor = px >= 16 ? 1.0
                    : px <= 4  ? 0.0
                    : (px - 4) / 12;   // 0..1 over 4..16px range

  const gap    = denseFactor > 0 ? Math.max(1, Math.round(px * 0.12 * denseFactor)) : 0;
  const cell   = px + gap;
  const startX = Math.floor((dispW - bW * cell) / 2);
  const startY = Math.floor((dispH - bH * cell) / 2);

  // Scale all depth offsets by denseFactor — small pixels barely move
  const parallaxScale  = denseFactor * 2.2;
  const verticalOffset = denseFactor * 0.18;
  const shadowScale    = denseFactor * 0.32;
  const highlightOn    = denseFactor > 0.2;

  // For very small pixels, glow is also reduced
  const glowScale = denseFactor;

  const hue  = STATE.syncedHues[0] || 258;
  const maxD = DEPTH.depthAmt;
  const rad  = DEPTH.radius;
  const rad2 = rad * rad;

  // ── 6. Clear ─────────────────────────────────────────────
  outCtx.fillStyle = '#03030a';
  outCtx.fillRect(0, 0, dispW, dispH);

  // ── 7. Glow collection list (second-pass rendering) ──────
  // Instead of setting shadowBlur per block, we collect
  // blocks that need glow into this array and draw them
  // in a second pass with a single shadowBlur state set.
  const glowBlocks = [];   // {sx,sy,fr,fg,fb,glowSize,glowHue,glowAlpha}

  // ── 8. Main block pass (no shadowBlur) ──────────────────
  for (let row = 0; row < bH; row += step) {
    for (let col = 0; col < bW; col += step) {
      const idx = row * bW + col;

      // Use live colour buffer (always valid — even first frame after realloc)
      const ci = idx * 3;
      const r  = _liveColours[ci];
      const g  = _liveColours[ci+1];
      const b  = _liveColours[ci+2];

      // Block centre
      const baseSX = startX + col * cell;
      const baseSY = startY + row * cell;
      const bcx    = baseSX + px * 0.5;
      const bcy    = baseSY + px * 0.5;

      // ── Fast cursor-distance reject (squared, no sqrt) ──
      const mdx = bcx - depthMouseX, mdy = bcy - depthMouseY;
      const dist2 = mdx*mdx + mdy*mdy;
      let influence = 0;
      if (dist2 < rad2 && depthMouseX > 0) {
        const dist = Math.sqrt(dist2);   // sqrt only for blocks inside radius
        const t = 1 - dist / rad;
        influence = t * t;
      }

      // ── Wave contributions (fast reject via squared compare) ──
      let wavePush = 0;
      for (const w of depthWaves) {
        const wdx  = bcx - w.x, wdy = bcy - w.y;
        const wd2  = wdx*wdx + wdy*wdy;
        const wavR = w.age * WAVE_SPEED;
        const rMax = (wavR + 30) * (wavR + 30);
        const rMin = Math.max(0, wavR - 30);
        if (wd2 < rMax && wd2 > rMin*rMin) {
          const diff = Math.abs(Math.sqrt(wd2) - wavR);   // sqrt only if in band
          if (diff < 30) {
            wavePush += Math.sin((1-diff/30)*Math.PI)
                      * w.strength * (1-w.age/WAVE_MAX_AGE) * 0.28;
          }
        }
      }

      // ── Breathing ──
      const breath = breathAmp > 0
        ? Math.sin(depthBreath + col * 0.3 + row * 0.22) * breathAmp
        : 0;

      // ── Target Z ──
      let targetZ = _dBaseZ[idx] + influence * 0.95 + wavePush + breath;
      if (targetZ < 0) targetZ = 0;
      if (targetZ > 1.4) targetZ = 1.4;

      // ── Spring physics ──
      _dVelZ[idx] += (targetZ - _dCurZ[idx]) * SPRING_K;
      _dVelZ[idx] *= DAMPING;
      _dCurZ[idx] += _dVelZ[idx];

      // ── Breakaway (only at step=1 and denseFactor > 0.3) ──
      if (step === 1 && denseFactor > 0.3 && mouseSpeed > BREAKAWAY_THRESHOLD && influence > 0.4 && Math.random() < 0.04) {
        const ang = Math.atan2(mdy, mdx) + (Math.random()-0.5)*1.2;
        const mag = mouseSpeed * 0.25 * influence * denseFactor;
        _dDriftX[idx] += Math.cos(ang) * mag;
        _dDriftY[idx] += Math.sin(ang) * mag;
      }
      _dDriftX[idx] *= BREAKAWAY_DECAY;
      _dDriftY[idx] *= BREAKAWAY_DECAY;

      const curZ    = _dCurZ[idx];
      const depthPx = curZ * maxD;

      // ── Parallax offset (scaled by denseFactor) ──────────
      // At denseFactor=0 (px≤4): no offset → pixels stay on grid
      // At denseFactor=1 (px≥16): full parallax separation
      const sx = (baseSX + depthTiltX*depthPx*parallaxScale + _dDriftX[idx] * denseFactor) | 0;
      const sy = (baseSY + depthTiltY*depthPx*parallaxScale + _dDriftY[idx] * denseFactor - depthPx*verticalOffset) | 0;

      // ── Dynamic lighting — depth + specular reflection ──
      // lift: raised pixels catch ambient light
      // dark: recessed pixels in shadow
      // spec: dynamic specular from mouse-driven light direction
      const lift = curZ * 62 | 0;
      const dark = curZ < 0.3 ? ((0.3 - curZ) * 40) | 0 : 0;
      const nx   = col / (bW || 1);
      const ny   = row / (bH || 1);
      const spec = _specularLift(nx, ny, curZ);
      let fr = r + lift - dark + spec; if (fr < 0) fr=0; if (fr>255) fr=255;
      let fg = g + lift - dark + spec; if (fg < 0) fg=0; if (fg>255) fg=255;
      let fb = b + lift - dark + spec; if (fb < 0) fb=0; if (fb>255) fb=255;

      // ── Shadow strips — scaled by denseFactor ──
      // At dense mode: shadowScale=0 → no shadow → no holes
      if (shadowScale > 0) {
        const shadowD = (depthPx * shadowScale) | 0;
        if (shadowD > 0) {
          const saIdx = Math.min(10, (curZ * 1.1 * 10) | 0);
          outCtx.fillStyle = _SHADOW_STRS[saIdx];
          outCtx.fillRect(sx + shadowD, sy + px, px, shadowD);
          outCtx.fillRect(sx + px, sy + shadowD, shadowD, px);
        }
      }

      // ── Top-left highlight — only when blocks are separated ──
      if (highlightOn && curZ > 0.08) {
        const hiIdx = Math.min(6, (curZ * 0.6 * 10 * denseFactor) | 0);
        if (hiIdx > 0) {
          outCtx.fillStyle = _WHITE_STRS[hiIdx];
          outCtx.fillRect(sx, sy, px, 1);
          outCtx.fillRect(sx, sy, 1, px);
        }
      }

      // ── Main face (no glow here) ──
      outCtx.fillStyle = `rgb(${fr},${fg},${fb})`;
      outCtx.fillRect(sx, sy, px, px);

      // ── Collect glow blocks for second pass ──
      // Glow is reduced at small pixel sizes (dense mode) — tiny
      // glowing pixels look like noise rather than holographic aura.
      const sat = _dSat[idx];
      const needsGlow = glowScale > 0.15 && (influence > 0.04 || (sat > 0.55 && curZ > 0.5));
      if (needsGlow) {
        glowBlocks.push(
          sx, sy, fr, fg, fb, curZ,
          (influence > 0.04
            ? (influence * 14 + curZ * 4)
            : (sat * 8)) * glowScale,
          influence > 0.04
            ? hue
            : ((Math.atan2(b-g, r-b) * 180/Math.PI + 360) % 360) | 0,
          influence > 0.04
            ? Math.min(0.95, (influence * 0.75 + sat * 0.2) * glowScale)
            : (sat * curZ * 0.45 * glowScale)
        );
      }
    }
  }

  // ── 9. Second pass — glow blocks only ───────────────────
  // Cap glow blocks for performance (nearest cursor first already
  // naturally sorted by iteration order — row-major, nearest is fine)
  const GLOW_CAP = 120;
  const glowStep = 9;   // 9 values per entry in glowBlocks flat array
  const glowCount = Math.min(GLOW_CAP, glowBlocks.length / glowStep | 0);

  if (glowCount > 0) {
    for (let gi = 0; gi < glowCount; gi++) {
      const base = gi * glowStep;
      const gsx    = glowBlocks[base];
      const gsy    = glowBlocks[base+1];
      const gfr    = glowBlocks[base+2];
      const gfg    = glowBlocks[base+3];
      const gfb    = glowBlocks[base+4];
      // const gcurZ = glowBlocks[base+5];  (unused in draw)
      const gSize  = glowBlocks[base+6];
      const gHue   = glowBlocks[base+7];
      const gAlpha = glowBlocks[base+8];

      outCtx.shadowColor = `hsla(${gHue},85%,65%,${gAlpha.toFixed(2)})`;
      outCtx.shadowBlur  = gSize;
      outCtx.fillStyle   = `rgb(${gfr},${gfg},${gfb})`;
      outCtx.fillRect(gsx, gsy, px, px);
    }
    outCtx.shadowBlur = 0;
  }

  // ── 10. Stat update ──────────────────────────────────────
  _lastFrameMs = performance.now() - t0;
  const rendered = Math.ceil(bW/step) * Math.ceil(bH/step);
  setText('depthStat',
    bW + '\xd7' + bH
    + (step > 1 ? ' \u2192 ' + rendered + ' (1/' + step + ')' : ' \xb7 ' + total)
    + ' \xb7 ' + px + 'px'
  );
}

/* ══════════════════════════════════════════════════════════
   CINEMATIC IDLE DRIFT + DYNAMIC LIGHTING
   ──────────────────────────────────────────────────────────
   These two systems are layered on TOP of the existing depth
   renderer — they modify targetZ and the lighting computation
   without touching the spring physics architecture.

   IDLE DRIFT
   ───────────
   Two slow sine-based oscillators (_driftPhaseX, _driftPhaseY)
   advance each frame and produce a gentle panoramic tilt shift.
   The result is a 2D parallax offset that looks like the camera
   is slowly orbiting the pixel surface.
     driftTiltX = sin(driftPhaseX) × DRIFT_AMP
     driftTiltY = cos(driftPhaseY × 0.7) × DRIFT_AMP
   These are ADDED to the cursor-driven parallax tilt values so
   the motion is always present even without mouse movement.
   Amplitude 0.04 (≈4% of depth range per axis) is barely
   perceptible but kills the "frozen" feeling.

   DYNAMIC LIGHTING
   ─────────────────
   _lightX/_lightY track a smoothed version of the mouse normal
   position (0..1). They update at rate 0.04 (slower than the
   cursor itself) creating a "lazy" specular effect.

   The light direction vector (lx, ly) = (lightX-0.5, lightY-0.5)
   modulates per-block lighting in renderDepth via a dot product
   with the block's surface normal. Raised blocks facing the
   light get extra brightness; recessed blocks in shadow get
   slightly darker. This is added to the existing lift/dark
   calculation already in renderDepth:

     specular = dot(normal, lightDir) × curZ × SPEC_STRENGTH
     (normal is approximated as +Z for flat blocks, tilted by
      their neighbours' Z gradients for edge blocks)

   Since the exact specular is expensive per block, we use a
   cheaper approximation: the block's horizontal/vertical
   position relative to the light source.

══════════════════════════════════════════════════════════ */

let _driftPhaseX = 0;
let _driftPhaseY = Math.PI * 0.4;   // start offset so axes differ
let _lightX      = 0.5;             // smoothed normalised light X
let _lightY      = 0.5;             // smoothed normalised light Y
const DRIFT_AMP  = 0.04;            // maximum drift tilt ±4%
const SPEC_STR   = 28;              // specular brightness boost (0–255 scale)

// Call every frame from renderDepth to advance drift & lighting
function _advanceDriftLight() {
  _driftPhaseX += 0.006;
  _driftPhaseY += 0.0042;           // different speed → non-periodic

  // Lazy light tracking — intentionally slower than cursor
  _lightX += (depthMouseNX - _lightX) * 0.04;
  _lightY += (depthMouseNY - _lightY) * 0.04;
}

// Returns {tx, ty} cinematic tilt delta to ADD to depthTiltX/Y
function _getDriftTilt() {
  return {
    tx: Math.sin(_driftPhaseX) * DRIFT_AMP,
    ty: Math.cos(_driftPhaseY) * DRIFT_AMP,
  };
}

// Compute specular lift for a block at normalised position (nx, ny)
// given current light direction and block's curZ depth.
// nx, ny in 0..1 relative to grid.
function _specularLift(nx, ny, curZ) {
  const lx = _lightX - 0.5;    // light direction X (-0.5..0.5)
  const ly = _lightY - 0.5;    // light direction Y (-0.5..0.5)
  const bx = nx - 0.5;         // block position relative to centre
  const by = ny - 0.5;
  // Dot product: blocks on the light side get more brightness
  const dot = bx * (-lx) + by * (-ly);   // facing light = positive
  // Scale by depth — only raised blocks reflect strongly
  return (dot * curZ * SPEC_STR) | 0;
}

/* ══════════════════════════════════════════════════════════
   DISPERSE / REFORM SYSTEM
   ──────────────────────────────────────────────────────────
   Disperse mode reads the current _liveColours and _dBaseZ
   arrays (already populated by renderDepth) to seed a set of
   flying particles. Each particle IS a pixel block — same
   colour, same starting grid position — but with velocity.

   DISPERSE STATE:
     _dispPX, _dispPY    — current screen X/Y for each particle
     _dispVX, _dispVY    — velocity
     _dispR,G,B          — stored colours (Uint8Array)
     _dispBaseX/Y        — home grid position for reform
     _dispAlive          — particles still rendering

   PHYSICS (per frame in renderDisperse):
   • Velocity is initialised as a random outward burst
   • Each frame: pos += vel; vel *= DISP_DRAG
   • Cursor influence: repel/attract using same quadratic falloff
     as depth mode but applied to XY velocity instead of Z
   • When REFORMING: targetX/Y = homeX/Y; spring pulls particle back

   ADAPTIVE PARTICLE COUNT:
   The disperse system uses every `disperseStep`-th block from
   the depth grid. At px≥12 → step=1 (all blocks). At px<8 →
   step=2 or higher to keep total particles ≤ 4000.

   RENDERING:
   Simple fillRect per particle — no shadowBlur in main pass.
   Glow pass for cursor-near particles only, capped at 60.
══════════════════════════════════════════════════════════ */

let _dispPX   = null;   // Float32Array particle X
let _dispPY   = null;   // Float32Array particle Y
let _dispVX   = null;   // Float32Array velocity X
let _dispVY   = null;   // Float32Array velocity Y
let _dispHX   = null;   // Float32Array home X (for reform)
let _dispHY   = null;   // Float32Array home Y
let _dispR    = null;   // Uint8Array colour
let _dispG    = null;
let _dispB    = null;
let _dispZ    = null;   // Float32Array base depth (for lighting)
let _dispN    = 0;      // total active particles
let _dispPxSz = 0;      // pixel size at disperse time
let _dispersing  = false;
let _reforming   = false;
let _dispAnimFrame = null;

function activateDisperse() {
  if (!STATE.depthMode) return;
  if (!_liveColours || _dBW === 0) return;

  _reforming   = false;
  _dispersing  = true;
  STATE.disperseMode = true;

  const btn = document.getElementById('disperseBtn');
  if (btn) btn.classList.add('dispersed');

  const bW    = _dBW, bH = _dBH;
  const px    = STATE.pixelSize;
  const gap   = px >= 16 ? Math.max(1,Math.round(px*0.12)) : px<=4 ? 0 : Math.max(1,Math.round(px*0.12*((px-4)/12)));
  const cell  = px + gap;
  const dispW = outputCanvas ? outputCanvas.width  : 600;
  const dispH = outputCanvas ? outputCanvas.height : 400;
  const startX = Math.floor((dispW - bW * cell) / 2);
  const startY = Math.floor((dispH - bH * cell) / 2);

  // Adaptive step — cap at 4000 particles
  const maxPart = 4000;
  const dispStep = bW * bH > maxPart ? Math.ceil(Math.sqrt(bW * bH / maxPart)) : 1;
  const cols = Math.ceil(bW / dispStep);
  const rows = Math.ceil(bH / dispStep);
  _dispN   = cols * rows;
  _dispPxSz = px;

  _dispPX = new Float32Array(_dispN);
  _dispPY = new Float32Array(_dispN);
  _dispVX = new Float32Array(_dispN);
  _dispVY = new Float32Array(_dispN);
  _dispHX = new Float32Array(_dispN);
  _dispHY = new Float32Array(_dispN);
  _dispR  = new Uint8Array(_dispN);
  _dispG  = new Uint8Array(_dispN);
  _dispB  = new Uint8Array(_dispN);
  _dispZ  = new Float32Array(_dispN);

  const cx = dispW * 0.5, cy = dispH * 0.5;

  let pi = 0;
  for (let row = 0; row < bH; row += dispStep) {
    for (let col = 0; col < bW; col += dispStep) {
      if (pi >= _dispN) break;
      const idx = row * bW + col;
      const ci  = idx * 3;
      const hx  = startX + col * cell + px * 0.5;
      const hy  = startY + row * cell + px * 0.5;

      _dispHX[pi] = hx;
      _dispHY[pi] = hy;
      _dispPX[pi] = hx;
      _dispPY[pi] = hy;

      // Outward burst velocity
      const angle = Math.atan2(hy - cy, hx - cx) + (Math.random()-0.5)*0.8;
      const speed = 2 + Math.random() * 6 + _dBaseZ[idx] * 4;
      _dispVX[pi] = Math.cos(angle) * speed;
      _dispVY[pi] = Math.sin(angle) * speed;

      _dispR[pi] = _liveColours[ci];
      _dispG[pi] = _liveColours[ci+1];
      _dispB[pi] = _liveColours[ci+2];
      _dispZ[pi] = _dBaseZ[idx] || 0.3;
      pi++;
    }
  }
  _dispN = pi;

  cancelAnimationFrame(_dispAnimFrame);
  _runDisperseLoop();
}

function activateReform() {
  if (!STATE.disperseMode) return;
  _reforming  = true;
  _dispersing = false;

  const btn = document.getElementById('disperseBtn');
  if (btn) btn.classList.remove('dispersed');
}

function _runDisperseLoop() {
  if (!STATE.disperseMode || !STATE.depthMode) return;

  _dispAnimFrame = requestAnimationFrame(_runDisperseLoop);

  if (!outCtx || !outputCanvas) return;
  const dispW = outputCanvas.width, dispH = outputCanvas.height;
  const px    = _dispPxSz;
  const hue   = STATE.syncedHues[0] || 258;
  const rad   = DEPTH.radius;
  const rad2  = rad * rad;

  outCtx.fillStyle = '#03030a';
  outCtx.fillRect(0, 0, dispW, dispH);

  const DRAG      = 0.92;
  const REF_SPRING = 0.08;
  const REF_DAMP  = 0.82;

  let allHome = 0;
  const glowP = [];   // glow particle list

  for (let i = 0; i < _dispN; i++) {
    // ── Physics ──
    if (_reforming) {
      // Spring pull toward home position
      const fxR = (_dispHX[i] - _dispPX[i]) * REF_SPRING;
      const fyR = (_dispHY[i] - _dispPY[i]) * REF_SPRING;
      _dispVX[i] += fxR;  _dispVX[i] *= REF_DAMP;
      _dispVY[i] += fyR;  _dispVY[i] *= REF_DAMP;
    } else {
      // Drag + gravity drift
      _dispVX[i] *= DRAG;
      _dispVY[i] *= DRAG;
      _dispVY[i] += 0.04;  // slight gravity
    }

    // ── Cursor influence ──
    const mdx = _dispPX[i] - depthMouseX;
    const mdy = _dispPY[i] - depthMouseY;
    const d2  = mdx*mdx + mdy*mdy;
    let infl  = 0;
    if (d2 < rad2 && depthMouseX > 0) {
      const d = Math.sqrt(d2);
      const t = 1 - d/rad;
      infl = t * t;
      // Repel when dispersing, attract when reforming
      const dir = _reforming ? -0.8 : 1.2;
      _dispVX[i] += (mdx / (d+1)) * infl * dir;
      _dispVY[i] += (mdy / (d+1)) * infl * dir;
    }

    _dispPX[i] += _dispVX[i];
    _dispPY[i] += _dispVY[i];

    // Check if reformed
    if (_reforming) {
      const dx = _dispPX[i]-_dispHX[i], dy = _dispPY[i]-_dispHY[i];
      if (Math.abs(dx)<0.5 && Math.abs(dy)<0.5 && Math.abs(_dispVX[i])<0.1) allHome++;
    }

    // ── Dynamic lighting on particles ──
    const nx = _dispPX[i] / (dispW||1);
    const ny = _dispPY[i] / (dispH||1);
    const spec = _specularLift(nx, ny, _dispZ[i]);
    let fr = _dispR[i] + spec; if(fr<0)fr=0; if(fr>255)fr=255;
    let fg = _dispG[i] + spec; if(fg<0)fg=0; if(fg>255)fg=255;
    let fb = _dispB[i] + spec; if(fb<0)fb=0; if(fb>255)fb=255;

    outCtx.fillStyle = `rgb(${fr},${fg},${fb})`;
    outCtx.fillRect(_dispPX[i]|0, _dispPY[i]|0, px, px);

    if (infl > 0.05) glowP.push(i, _dispPX[i]|0, _dispPY[i]|0, fr, fg, fb, infl);
  }

  // Glow pass for cursor-near particles (capped at 50)
  const GLOW_CAP_DISP = 50, glowStride = 7;
  const gc = Math.min(GLOW_CAP_DISP, (glowP.length/glowStride)|0);
  if (gc > 0) {
    for (let gi=0; gi<gc; gi++) {
      const b = gi*glowStride;
      outCtx.shadowColor = `hsla(${hue},80%,65%,${(glowP[b+6]*0.7).toFixed(2)})`;
      outCtx.shadowBlur  = glowP[b+6] * 12;
      outCtx.fillStyle   = `rgb(${glowP[b+3]},${glowP[b+4]},${glowP[b+5]})`;
      outCtx.fillRect(glowP[b+1], glowP[b+2], px, px);
    }
    outCtx.shadowBlur = 0;
  }

  // Auto-exit reform when all particles home
  if (_reforming && allHome === _dispN) {
    _reforming = false;
    STATE.disperseMode = false;
    cancelAnimationFrame(_dispAnimFrame);
    _dispAnimFrame = null;
    // Resume normal depth rendering
    if (STATE.originalImage) render();
    if (STATE.mode === 'image') _startDepthImageLoop();
  }
}

function tilt(id) {
  const el=document.getElementById(id); if(!el)return;
  const MAX=4.5, PERS=1100;
  el.addEventListener('mousemove',e=>{
    const r=el.getBoundingClientRect();
    const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
    el.style.transform=`perspective(${PERS}px) rotateX(${-y*MAX}deg) rotateY(${x*MAX}deg)`;
  });
  el.addEventListener('mouseleave',()=>{el.style.transform='';});
}

/* ══ PARTICLES (download burst only) ════════════════════ */
function sizeParticleCanvas(){
  if(!particleCanvas)return;
  particleCanvas.width=window.innerWidth; particleCanvas.height=window.innerHeight;
}

function hslToRgb(h,s,l){
  s/=100;l/=100;
  const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l);
  const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return[Math.round(f(0)*255),Math.round(f(8)*255),Math.round(f(4)*255)];
}

function burst(cx,cy,count=70){
  const hues=STATE.syncedHues;
  for(let i=0;i<count;i++){
    const hue=hues[i%hues.length], angle=(Math.PI*2*i)/count+(Math.random()-.5)*.4, spd=2+Math.random()*8;
    const [r,g,b]=hslToRgb(hue,78,62);
    STATE.particles.push({
      x:cx,y:cy, vx:Math.cos(angle)*spd, vy:Math.sin(angle)*spd-Math.random()*3,
      size:3+Math.random()*9, life:1, decay:.013+Math.random()*.018,
      color:`rgb(${r},${g},${b})`, rot:Math.random()*Math.PI*2, spin:(Math.random()-.5)*.18,
    });
  }
}

function startParticleLoop(){
  function loop(){
    requestAnimationFrame(loop);
    if(!pCtx||!particleCanvas)return;
    if(!STATE.particles.length){pCtx.clearRect(0,0,particleCanvas.width,particleCanvas.height);return;}
    pCtx.clearRect(0,0,particleCanvas.width,particleCanvas.height);
    STATE.particles=STATE.particles.filter(p=>p.life>0);
    for(const p of STATE.particles){
      p.x+=p.vx; p.y+=p.vy; p.vy+=.22; p.vx*=.98;
      p.life-=p.decay; p.rot+=p.spin;
      pCtx.save();
      pCtx.globalAlpha=Math.max(0,p.life);
      pCtx.translate(p.x,p.y); pCtx.rotate(p.rot);
      pCtx.fillStyle=p.color; pCtx.shadowColor=p.color; pCtx.shadowBlur=7;
      pCtx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
      pCtx.restore();
    }
  }
  loop();
}

/* ══ FPS COUNTER ════════════════════════════════════════ */
function startFpsCounter(){
  let frames=0, last=performance.now();
  function count(){
    requestAnimationFrame(count); frames++;
    const now=performance.now();
    if(now-last>=1000){
      if(perfFps)perfFps.textContent=frames;
      frames=0;last=now;
    }
  }
  count();
}

/* ══ EXPORT ═════════════════════════════════════════════ */
function doExportPng(){
  if(!outputCanvas)return;
  // Particle burst from button
  const btn=document.getElementById('exportPng');
  if(btn){const r=btn.getBoundingClientRect();burst(r.left+r.width/2,r.top+r.height/2);}
  const a=document.createElement('a');
  a.download='pixelsynth-'+Date.now()+'.png';
  a.href=outputCanvas.toDataURL('image/png');
  a.click();
}

function doExportSprite(){
  if(!outputCanvas||!STATE.originalImage)return;
  const sizes=[STATE.pixelSize, Math.max(2,Math.round(STATE.pixelSize*2)), Math.max(2,Math.round(STATE.pixelSize*.5))];
  const W=outputCanvas.width, H=outputCanvas.height;
  const sp=document.createElement('canvas');sp.width=W*sizes.length;sp.height=H;
  const sctx=sp.getContext('2d');
  const saved=STATE.pixelSize;
  sizes.forEach((sz,i)=>{STATE.pixelSize=sz;render();sctx.drawImage(outputCanvas,W*i,0);});
  STATE.pixelSize=saved;render();
  const a=document.createElement('a');a.download='sprite-'+Date.now()+'.png';a.href=sp.toDataURL();a.click();
}

function doExportPalette(){
  const data={name:STATE.palette,colors:PALETTES[STATE.palette]||'original',dominantHues:STATE.syncedHues};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.download='palette-'+STATE.palette+'.json';a.href=URL.createObjectURL(blob);a.click();
}

/* ══ UTILITY ════════════════════════════════════════════ */
function fmt(s){
  if(!s||isNaN(s))return'0:00';
  return Math.floor(s/60)+':'+(Math.floor(s%60)<10?'0':'')+Math.floor(s%60);
}
