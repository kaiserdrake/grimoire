'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_SCALE  = 0.05;  // smallest zoom, relative to the image's natural size
const MAX_SCALE  = 8;     // largest zoom
const CANVAS_PAD = 16;    // breathing room left around a fitted image
const ZOOM_STEP  = 1.25;  // one press of the +/- buttons
const TWEEN_MS   = 260;   // fit / fly-to animation
const PAN_SLOP   = 3;     // px of movement before a press counts as a pan, not a click
const FRAME_PAD  = 72;    // room left around a framed group of pins

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Stored cameras for one game, keyed by map id. Entries that aren't a camera are
// dropped on read — that quietly retires the { w, h } records written by the old
// resize-based viewer, so no migration is needed.
function readStore(key) {
  if (typeof window === 'undefined') return {};
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (!saved || typeof saved !== 'object') return {};
    return Object.fromEntries(Object.entries(saved).filter(([, v]) =>
      v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.scale)
    ));
  } catch { return {}; }
}

// Spread and midpoint of the active pointers, in client coordinates.
function measure(pointers) {
  const pts = [...pointers.values()];
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const dist = pts.length < 2 ? 0 : Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  return { cx, cy, dist };
}

// The camera for the map canvas: a { x, y, scale } transform applied to the layer
// holding the image and its pins, kept per map and persisted per game.
//
// Only a camera the user positioned themselves is stored — a map with no entry is
// fitted to the viewport when opened, so the default adapts to whatever screen it
// is being viewed on.
//
// Also owns every way the camera can move: the wheel, drag-panning, pinch-zoom,
// the toolbar actions and the animated fly-to used by the sidebar.
export function useMapView(gameId, { imgRef, activeMapId }) {
  const storageKey = `grimoire:mapView:${gameId}`;

  // The canvas is mounted a render later than this hook — it lives behind the
  // page's loading spinner. A callback ref lets the listeners below attach the
  // moment it appears; a plain ref would still read null on their only pass.
  const [viewportEl, setViewportEl] = useState(null);
  const viewportRef = useRef(null);
  const setViewport = useCallback((node) => {
    viewportRef.current = node;
    setViewportEl(node);
  }, []);

  // null until the image has decoded and been fitted; the canvas stays hidden
  // until then so a natural-size image never flashes at the wrong zoom.
  const [view, setViewState] = useState(null);
  const [panning, setPanning] = useState(false);

  // Published so callers can project image coordinates onto the screen — which
  // is what culling off-screen markers and reading the URL's camera both need.
  const [viewportSize, setViewportSize] = useState(null); // { w, h } of the canvas
  const [imageSize, setImageSize] = useState(null);       // { w, h } natural pixels

  // Mirrors for the event handlers, which must not be rebuilt as the view moves.
  const viewRef   = useRef(null);         viewRef.current   = view;
  const activeRef = useRef(activeMapId);  activeRef.current = activeMapId;

  const storeRef = useRef(null);
  if (storeRef.current === null) storeRef.current = readStore(storageKey);
  useEffect(() => { storeRef.current = readStore(storageKey); }, [storageKey]);

  // Writes are batched: a pan produces a camera per frame, and none of them are
  // worth a synchronous trip through JSON and localStorage.
  const flushRef = useRef(null);
  const persist = useCallback((mapId, v) => {
    if (mapId == null || !v) return;
    storeRef.current = { ...storeRef.current, [mapId]: { x: v.x, y: v.y, scale: v.scale } };
    clearTimeout(flushRef.current);
    flushRef.current = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(storeRef.current)); } catch {}
    }, 200);
  }, [storageKey]);
  useEffect(() => () => clearTimeout(flushRef.current), []);

  // Every camera write goes through here, so nothing escapes the zoom limits and
  // every view the user produced is remembered. `remember` is false only for the
  // automatic fit, which must stay re-computable on the next screen.
  const setView = useCallback((next, remember = true) => {
    const v = { x: next.x, y: next.y, scale: clamp(next.scale, MIN_SCALE, MAX_SCALE) };
    viewRef.current = v;
    setViewState(v);
    if (remember) persist(activeRef.current, v);
  }, [persist]);

  // ── Animation ───────────────────────────────────────────────────────────────
  const tweenRef = useRef(null);
  const stopTween = useCallback(() => {
    if (tweenRef.current) cancelAnimationFrame(tweenRef.current);
    tweenRef.current = null;
  }, []);
  useEffect(() => stopTween, [stopTween]);

  const tweenTo = useCallback((target) => {
    stopTween();
    const from = viewRef.current;
    if (!from) { setView(target); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / TWEEN_MS, 1);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setView({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        // Zoom reads as linear only when it is interpolated geometrically.
        scale: from.scale * Math.pow(target.scale / from.scale, e),
      });
      tweenRef.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    tweenRef.current = requestAnimationFrame(step);
  }, [setView, stopTween]);

  // ── Geometry ────────────────────────────────────────────────────────────────
  const vpBox = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return null;
    const r = vp.getBoundingClientRect();
    return r.width && r.height ? r : null;
  }, []);

  const natural = useCallback(() => {
    const img = imgRef.current;
    if (!img?.naturalWidth || !img?.naturalHeight) return null;
    return { w: img.naturalWidth, h: img.naturalHeight };
  }, [imgRef]);

  // Zoom about a point in client coordinates — the pixel under it stays put.
  const zoomBy = useCallback((factor, anchor) => {
    const v = viewRef.current;
    const box = vpBox();
    if (!v || !box) return;
    const next = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
    if (Math.abs(next - v.scale) < 1e-6) return;
    const k = next / v.scale; // recomputed after clamping, or the anchor drifts
    const ax = (anchor ? anchor.x : box.left + box.width  / 2) - box.left;
    const ay = (anchor ? anchor.y : box.top  + box.height / 2) - box.top;
    setView({ x: ax - (ax - v.x) * k, y: ay - (ay - v.y) * k, scale: next });
  }, [setView, vpBox]);

  const zoomIn  = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP), [zoomBy]);

  // Nudge the camera by a screen-space delta — the keyboard's equivalent of a drag.
  const panBy = useCallback((dx, dy) => {
    const v = viewRef.current;
    if (!v) return;
    stopTween();
    setView({ ...v, x: v.x + dx, y: v.y + dy });
  }, [setView, stopTween]);

  // Zoom to an absolute scale about the centre of the canvas (the 1:1 button).
  const zoomTo = useCallback((scale) => {
    const v = viewRef.current;
    const box = vpBox();
    if (!v || !box) return;
    const next = clamp(scale, MIN_SCALE, MAX_SCALE);
    const k = next / v.scale;
    const ax = box.width / 2, ay = box.height / 2;
    tweenTo({ x: ax - (ax - v.x) * k, y: ay - (ay - v.y) * k, scale: next });
  }, [tweenTo, vpBox]);

  const computeFit = useCallback(() => {
    const box = vpBox(), nat = natural();
    if (!box || !nat) return null;
    const w = Math.max(box.width  - CANVAS_PAD * 2, 40);
    const h = Math.max(box.height - CANVAS_PAD * 2, 40);
    const scale = clamp(Math.min(w / nat.w, h / nat.h), MIN_SCALE, MAX_SCALE);
    return {
      scale,
      x: (box.width  - nat.w * scale) / 2,
      y: (box.height - nat.h * scale) / 2,
    };
  }, [natural, vpBox]);

  // Instant, unremembered fit: a map being opened, or the canvas being resized
  // before the user has positioned it.
  const autoFit = useCallback(() => {
    const target = computeFit();
    if (!target) return false;
    stopTween();
    setView(target, false);
    return true;
  }, [computeFit, setView, stopTween]);

  // The toolbar's fit button — animated, and remembered like any other gesture.
  const fitToView = useCallback(() => {
    const target = computeFit();
    if (target) tweenTo(target);
  }, [computeFit, tweenTo]);

  // Centre an image point given in the 0–100 percentages pins are stored in.
  // `animate: false` jumps — used when restoring a camera from the URL, where a
  // fly-in from wherever the map happened to open reads as a glitch.
  const focusOn = useCallback((xPercent, yPercent, { scale, animate = true } = {}) => {
    const v = viewRef.current, box = vpBox(), nat = natural();
    if (!v || !box || !nat) return;
    const next = clamp(scale ?? v.scale, MIN_SCALE, MAX_SCALE);
    const target = {
      scale: next,
      x: box.width  / 2 - (xPercent / 100) * nat.w * next,
      y: box.height / 2 - (yPercent / 100) * nat.h * next,
    };
    if (animate) tweenTo(target);
    else { stopTween(); setView(target); }
  }, [natural, setView, stopTween, tweenTo, vpBox]);

  // Where the canvas is currently centred, in the same 0–100 percentages — the
  // portable half of a camera, since x/y are screen offsets that mean nothing on
  // a different window size.
  const centerPercent = useCallback(() => {
    const v = viewRef.current, box = vpBox(), nat = natural();
    if (!v || !box || !nat) return null;
    return {
      x: ((box.width  / 2 - v.x) / v.scale / nat.w) * 100,
      y: ((box.height / 2 - v.y) / v.scale / nat.h) * 100,
      scale: v.scale,
    };
  }, [natural, vpBox]);

  // Frame a group of pins: their bounding box, padded, centred.
  const frameAll = useCallback((points) => {
    const box = vpBox(), nat = natural();
    if (!box || !nat || !points?.length) return;
    const xs = points.map(p => (p.x_percent / 100) * nat.w);
    const ys = points.map(p => (p.y_percent / 100) * nat.h);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    // One pin — or a row of them — has no extent on an axis, which would divide
    // through to an infinite scale. Give the box a floor.
    const w = Math.max(x1 - x0, nat.w * 0.15);
    const h = Math.max(y1 - y0, nat.h * 0.15);
    // The padding can exceed a small canvas outright, which would flip the scale
    // negative — floor the space it is subtracted from.
    const availW = Math.max(box.width  - FRAME_PAD * 2, 40);
    const availH = Math.max(box.height - FRAME_PAD * 2, 40);
    const scale = clamp(Math.min(availW / w, availH / h), MIN_SCALE, MAX_SCALE);
    tweenTo({
      scale,
      x: box.width  / 2 - ((x0 + x1) / 2) * scale,
      y: box.height / 2 - ((y0 + y1) / 2) * scale,
    });
  }, [natural, tweenTo, vpBox]);

  // Drop a stored camera so the map re-fits (e.g. its image was swapped for one
  // with a different aspect ratio). The re-fit is needed whether or not there was
  // anything stored — an auto-fit for the old image is just as wrong.
  const clearMapView = useCallback((mapId) => {
    if (mapId == null) return;
    if (mapId in storeRef.current) {
      const next = { ...storeRef.current };
      delete next[mapId];
      storeRef.current = next;
      clearTimeout(flushRef.current);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
    }
    if (mapId === activeRef.current) {
      stopTween();
      viewRef.current = null;
      setViewState(null);
    }
  }, [stopTween, storageKey]);

  // ── Fitting lifecycle ───────────────────────────────────────────────────────

  // Switching maps: restore that map's camera, or clear it so the map is fitted
  // once its image reports a natural size.
  useEffect(() => {
    stopTween();
    const stored = (activeMapId != null && storeRef.current[activeMapId]) || null;
    viewRef.current = stored;
    setViewState(stored);
    setImageSize(null); // the incoming image has its own dimensions
  }, [activeMapId, stopTween]);

  // Natural size is only known once the image has decoded…
  const publishImageSize = useCallback(() => {
    const nat = natural();
    setImageSize(prev => (prev && nat && prev.w === nat.w && prev.h === nat.h) ? prev : nat);
  }, [natural]);

  const handleImageLoad = useCallback(() => {
    publishImageSize();
    if (!viewRef.current) autoFit();
  }, [autoFit, publishImageSize]);

  // …but a cached image can already be complete by the time it mounts, so `load`
  // never fires. `view` is a dependency so this retries after the reset above.
  useEffect(() => {
    if (!imgRef.current?.complete) return;
    publishImageSize();
    if (!viewRef.current) autoFit();
  }, [activeMapId, autoFit, imgRef, publishImageSize, view]);

  // Keep an auto-fitted map fitted as the canvas resizes (window resize, sidebar
  // layout shifts). A camera the user positioned is left exactly where it is.
  useEffect(() => {
    if (!viewportEl || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setViewportSize(prev => (prev && prev.w === r.width && prev.h === r.height)
        ? prev
        : { w: r.width, h: r.height });
      const id = activeRef.current;
      if (id == null || storeRef.current[id]) return;
      autoFit();
    });
    ro.observe(viewportEl);
    return () => ro.disconnect();
  }, [autoFit, viewportEl]);

  // ── Wheel ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!viewportEl) return;

    // Registered natively because React's onWheel is passive at the root, where
    // preventDefault is a no-op.
    const onWheel = (e) => {
      if (!viewRef.current) return;
      e.preventDefault();
      stopTween();
      // Firefox reports lines (deltaMode 1) and pages (2) rather than pixels.
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewportEl.clientHeight : 1;
      // Ctrl/Cmd + wheel is how a trackpad pinch arrives: same path, larger delta.
      zoomBy(Math.exp(-e.deltaY * unit * 0.0015), { x: e.clientX, y: e.clientY });
    };

    viewportEl.addEventListener('wheel', onWheel, { passive: false });
    return () => viewportEl.removeEventListener('wheel', onWheel);
  }, [stopTween, viewportEl, zoomBy]);

  // ── Drag-pan and pinch ──────────────────────────────────────────────────────
  const gestureRef = useRef({
    pointers: new Map(),   // pointerId → { x, y }
    start: null,           // where the single-pointer gesture began
    last: null,
    pinch: null,           // last { cx, cy, dist }
    moved: false,          // has this gesture passed the click/pan threshold
    suppressClick: false,
  });

  const onPointerDown = useCallback((e) => {
    if (e.button === 2) return;                              // right-click adds a pin
    if (e.target?.closest?.('.map-pin, [data-no-pan]')) return; // pins own their drag
    const g = gestureRef.current;
    // A pan that ended outside the map container leaves its click suppression
    // unclaimed; clearing it here stops that stale flag eating a later click.
    g.suppressClick = false;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stopTween();
    if (g.pointers.size === 1) {
      g.start = { x: e.clientX, y: e.clientY };
      g.last  = { x: e.clientX, y: e.clientY };
      g.moved = false;
    } else {
      g.pinch = measure(g.pointers);
    }
  }, [stopTween]);

  // Move and release are tracked on the window rather than through pointer
  // capture: capture would retarget the trailing click away from the map
  // container, and placing a pin depends on that click landing there.
  useEffect(() => {
    const onMove = (e) => {
      const g = gestureRef.current;
      if (!g.pointers.has(e.pointerId)) return;
      g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const v = viewRef.current;
      if (!v) return;

      if (g.pointers.size >= 2) {
        const prev = g.pinch;
        const next = measure(g.pointers);
        g.pinch = next;
        if (!g.moved) { g.moved = true; setPanning(true); }
        const box = vpBox();
        if (!prev?.dist || !next.dist || !box) return;
        // Scale about the midpoint, then follow the midpoint — so a pinch zooms,
        // a two-finger drag pans, and doing both at once does both.
        const scale = clamp(v.scale * (next.dist / prev.dist), MIN_SCALE, MAX_SCALE);
        const k = scale / v.scale;
        const ax = prev.cx - box.left, ay = prev.cy - box.top;
        setView({
          scale,
          x: (ax - (ax - v.x) * k) + (next.cx - prev.cx),
          y: (ay - (ay - v.y) * k) + (next.cy - prev.cy),
        });
        return;
      }

      const dx = e.clientX - g.last.x;
      const dy = e.clientY - g.last.y;
      g.last = { x: e.clientX, y: e.clientY };
      if (!g.moved) {
        // Below the threshold this is still a click in waiting — placing a pin,
        // opening a callout — so the camera must not drift, and the cursor must
        // not flicker to "grabbing" on what turns out to be a plain click.
        if (Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) < PAN_SLOP) return;
        g.moved = true;
        setPanning(true);
      }
      setView({ ...v, x: v.x + dx, y: v.y + dy });
    };

    const onUp = (e) => {
      const g = gestureRef.current;
      if (!g.pointers.delete(e.pointerId)) return;
      if (g.pointers.size < 2) g.pinch = null;
      if (g.pointers.size === 1) {
        // A finger lifted out of a pinch — carry on panning with the other one.
        const [pt] = g.pointers.values();
        g.start = { ...pt };
        g.last  = { ...pt };
      } else if (g.pointers.size === 0) {
        if (g.moved) g.suppressClick = true; // the click that ends a drag isn't one
        g.moved = false;
        setPanning(false);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [setView, vpBox]);

  // True once, for the click that merely ended a pan. Called at the top of the
  // canvas click handler.
  const consumePanClick = useCallback(() => {
    const g = gestureRef.current;
    if (!g.suppressClick) return false;
    g.suppressClick = false;
    return true;
  }, []);

  return {
    view, panning, viewportRef: setViewport,
    viewportSize, imageSize, centerPercent,
    minScale: MIN_SCALE, maxScale: MAX_SCALE,
    zoomIn, zoomOut, zoomTo, panBy, fitToView, focusOn, frameAll,
    handleImageLoad, clearMapView, onPointerDown, consumePanClick,
  };
}

export default useMapView;
