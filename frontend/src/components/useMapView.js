'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_SCALE = 0.1;   // smallest zoom, relative to the image's natural width
const MAX_SCALE = 8;     // largest zoom
const CANVAS_PAD = 16;   // the canvas Box renders with p={4}

// View geometry for the map canvas: the rendered size of each map image, kept
// per map and persisted per game in localStorage.
//
// Only sizes the user explicitly produced (corner drag, ctrl/cmd + wheel, reset)
// are stored — a map with no entry is fitted to the viewport when opened, so the
// default adapts to whatever screen it is being viewed on.
//
// Also owns the wheel-zoom listener and the reset-to-fit-height action, since
// both are just different ways of writing that same size.
export function useMapView(gameId, { imgRef, viewportRef, resizerRef, activeMapId }) {
  const storageKey = `grimoire:mapView:${gameId}`;

  const [sizes, setSizes] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved === 'object') return saved;
    } catch {}
    return {};
  });

  // Contain-fit for a map with no stored size. Tagged with the map it was
  // computed for so it is never applied to the next map for a frame.
  const [fit, setFit] = useState(null); // { mapId, w, h }

  const persist = useCallback((next) => {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
    return next;
  }, [storageKey]);

  const setMapSize = useCallback((mapId, size) => {
    if (mapId == null || !size) return;
    const w = Math.round(size.w);
    const h = Math.round(size.h);
    if (!(w > 0) || !(h > 0)) return;
    setSizes((prev) => {
      const cur = prev[mapId];
      if (cur && cur.w === w && cur.h === h) return prev;
      return persist({ ...prev, [mapId]: { w, h } });
    });
  }, [persist]);

  // Drop a stored size so the map re-fits on the next render (e.g. its image was
  // swapped for one with a different aspect ratio).
  const clearMapSize = useCallback((mapId) => {
    setSizes((prev) => {
      if (mapId == null || !(mapId in prev)) return prev;
      const next = { ...prev };
      delete next[mapId];
      return persist(next);
    });
  }, [persist]);

  const storedSize  = activeMapId != null ? sizes[activeMapId] ?? null : null;
  const fittedSize  = fit && fit.mapId === activeMapId ? { w: fit.w, h: fit.h } : null;
  const appliedSize = storedSize ?? fittedSize;

  // Mirrors for callbacks that must not be rebuilt on every size change. The
  // applied size doubles as the reference the resize observer compares against,
  // so it is written during render — an effect could land after the observer.
  const storedRef  = useRef(storedSize);   storedRef.current  = storedSize;
  const activeRef  = useRef(activeMapId);  activeRef.current  = activeMapId;
  const appliedRef = useRef(null);         appliedRef.current = appliedSize;

  // Usable space inside the scrolling canvas: its own box minus the padding and
  // anything stacked above the image (the tool-mode hint banner).
  const measureAvailable = useCallback(() => {
    const vp = viewportRef.current;
    const box = resizerRef.current;
    if (!vp || !box) return null;
    const top = box.getBoundingClientRect().top - vp.getBoundingClientRect().top + vp.scrollTop;
    return {
      w: Math.max(vp.clientWidth - CANVAS_PAD * 2, 40),
      h: Math.max(vp.clientHeight - top - CANVAS_PAD, 40),
    };
  }, [viewportRef, resizerRef]);

  // mode 'contain' → whole image visible; 'height' → height fills the canvas.
  const computeFit = useCallback((mode) => {
    const img = imgRef.current;
    const avail = measureAvailable();
    if (!avail || !img?.naturalWidth || !img?.naturalHeight) return null;
    const scale = mode === 'height'
      ? avail.h / img.naturalHeight
      : Math.min(avail.w / img.naturalWidth, avail.h / img.naturalHeight);
    return { w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) };
  }, [imgRef, measureAvailable]);

  const refit = useCallback(() => {
    const mapId = activeRef.current;
    if (mapId == null || storedRef.current) return;
    const size = computeFit('contain');
    if (!size) return;
    setFit(prev => (prev && prev.mapId === mapId && prev.w === size.w && prev.h === size.h)
      ? prev
      : { mapId, ...size });
  }, [computeFit]);

  // Natural size is only known once the image has decoded…
  const handleImageLoad = useCallback(() => { refit(); }, [refit]);
  // …but a cached image can already be complete by the time we mount.
  useEffect(() => {
    if (imgRef.current?.complete) refit();
  }, [activeMapId, refit, imgRef]);

  // Re-fit unsized maps when the canvas itself changes size (window resize,
  // sidebar layout shifts).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => refit());
    ro.observe(vp);
    return () => ro.disconnect();
  }, [refit, viewportRef]);

  // Native corner-drag resize writes straight to the element's inline style;
  // mirror it back into state so it survives a map switch and a reload.
  useEffect(() => {
    const el = resizerRef.current;
    if (!el || activeMapId == null || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const applied = appliedRef.current;
      if (!applied) return; // not sized yet — this is the intrinsic image size
      const { width, height } = entry.contentRect;
      if (Math.abs(width - applied.w) < 1 && Math.abs(height - applied.h) < 1) return;
      setMapSize(activeMapId, { w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeMapId, resizerRef, setMapSize]);

  // Ctrl/Cmd + wheel zoom, anchored at the cursor. Registered natively because
  // React's onWheel is passive at the root, where preventDefault is a no-op.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || activeMapId == null) return;

    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const box = resizerRef.current;
      if (!box) return;
      const rect = box.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      e.preventDefault();

      let f = Math.exp(-e.deltaY * 0.0015);
      const nat = imgRef.current?.naturalWidth;
      if (nat) f = Math.min(Math.max(f, (nat * MIN_SCALE) / rect.width), (nat * MAX_SCALE) / rect.width);
      if (Math.abs(f - 1) < 0.001) return;

      // Where the pointer sits inside the image, so it stays put as it grows.
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setMapSize(activeMapId, { w: rect.width * f, h: rect.height * f });
      requestAnimationFrame(() => {
        vp.scrollLeft += px * (f - 1);
        vp.scrollTop  += py * (f - 1);
      });
    };

    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [activeMapId, imgRef, resizerRef, viewportRef, setMapSize]);

  // Reset: make the image exactly as tall as the space available to it.
  const resetView = useCallback(() => {
    const mapId = activeRef.current;
    if (mapId == null) return;
    const size = computeFit('height');
    if (!size) return;
    setMapSize(mapId, size);
    // A wide result can bring up a horizontal scrollbar, which eats part of the
    // height just measured — re-measure once and correct.
    requestAnimationFrame(() => {
      const corrected = computeFit('height');
      if (corrected && Math.abs(corrected.h - size.h) > 1) setMapSize(mapId, corrected);
    });
  }, [computeFit, setMapSize]);

  return { appliedSize, resetView, refit, handleImageLoad, clearMapSize };
}

export default useMapView;
