'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Text, Button, HStack, Spinner, Select } from '@chakra-ui/react';
import { FiCamera, FiRefreshCw } from 'react-icons/fi';

// Persist the chosen camera per browser profile / machine (localStorage is
// per-origin and never leaves this device).
const STORAGE_KEY = 'grimoire:cameraDeviceId';

const readSavedId = () => {
  try { return localStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
};
const persistId = (id) => {
  try { id ? localStorage.setItem(STORAGE_KEY, id) : localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
};

// ── Quick capture ─────────────────────────────────────────────────────────────
// Grab a single frame from the remembered camera without any UI: open the stream,
// wait for a decoded frame, draw it, release the camera. Used by note tables'
// one-click snapshot cells. Resolves to a JPEG File; rejects with a readable
// message. Pick the camera in the game Settings tab (Snapshot Camera) or the
// Insert image → Camera tab.
export async function captureCameraFrame() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera is not available in this browser, or the page is not served over HTTPS.');
  }
  const savedId = readSavedId();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: savedId ? { deviceId: { exact: savedId } } : true,
      audio: false,
    });
  } catch (err) {
    if (savedId && (err?.name === 'OverconstrainedError' || err?.name === 'NotFoundError')) {
      persistId(null);
      return captureCameraFrame();
    }
    if (err?.name === 'NotAllowedError') throw new Error('Camera permission was denied.');
    if (err?.name === 'NotReadableError') throw new Error('The camera is in use by another application.');
    throw new Error('Unable to access the camera.');
  }

  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    // Wait for a frame that has actually been painted — `play()` can resolve
    // before the first one is decoded, which would capture a black image.
    await new Promise((resolve) => {
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => resolve());
      else setTimeout(resolve, 150);
    });
    if (!video.videoWidth) throw new Error('The camera did not deliver a frame.');

    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) throw new Error('Unable to encode the snapshot.');
    return new File([blob], `snapshot-${Date.now()}.jpg`, { type: 'image/jpeg' });
  } finally {
    stream.getTracks().forEach(t => t.stop());
  }
}

// ── Camera Capture ────────────────────────────────────────────────────────────
// Live webcam preview + snapshot. When `active` is true the camera stream is
// started; toggling it off (or unmounting) releases the stream. A captured
// frame is handed back to the parent as a File via `onCapture` so it can be
// uploaded through the same path as a picked file; `onCapture(null)` is emitted
// on retake (or camera switch) so the parent can clear its pending file.
//
// If more than one camera is present a selector is shown. The selection is
// remembered in localStorage and restored on the next open. A saved device that
// is no longer connected falls back to the browser default.
export default function CameraCapture({ active, onCapture }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const previewRef = useRef(null);          // last object URL, for revocation

  const [error,     setError]     = useState('');
  const [ready,     setReady]     = useState(false);
  const [preview,   setPreview]   = useState(null);
  const [devices,   setDevices]   = useState([]);    // [{ deviceId, label }]
  const [selectedId, setSelectedId] = useState(null); // user's desired camera (drives constraints)
  const [activeId,  setActiveId]  = useState(null);   // camera actually streaming (for the dropdown value)

  // Restore the saved camera once on mount (localStorage isn't available during SSR).
  useEffect(() => { setSelectedId(readSavedId()); }, []);

  const stop = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const clearPreview = () => {
    if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null; }
    setPreview(null);
  };

  useEffect(() => {
    if (!active) { stop(); return; }

    let cancelled = false;
    setError(''); setReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not available in this browser, or the page is not served over HTTPS.');
      return;
    }

    const constraintsFor = (id) => ({
      video: id ? { deviceId: { exact: id } } : { facingMode: 'environment' },
      audio: false,
    });

    const start = async () => {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraintsFor(selectedId));
      } catch (err) {
        // A remembered camera that's been unplugged → drop it and use the default.
        if (selectedId && (err?.name === 'OverconstrainedError' || err?.name === 'NotFoundError')) {
          persistId(null);
          if (!cancelled) setSelectedId(null);   // re-runs this effect with the default
          return;
        }
        if (cancelled) return;

        if (err?.name === 'NotAllowedError') {
          setError('Camera permission was denied.');
        } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError' || err?.name === 'AbortError') {
          // Hardware is busy (in use by another app/tab). Keep the picker usable
          // so the user can switch to a different camera.
          setError('The selected camera is in use by another application. Choose a different camera below, or close the other app and try again.');
          try {
            const list = await navigator.mediaDevices.enumerateDevices();
            if (!cancelled) setDevices(list.filter(d => d.kind === 'videoinput'));
          } catch { /* enumeration is best-effort */ }
        } else {
          setError('Unable to access the camera.');
        }
        return;
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setReady(true);

      // Reflect the camera that's actually live (labels are only populated after a grant).
      const track = stream.getVideoTracks()[0];
      const liveId = track?.getSettings?.().deviceId || null;
      if (liveId) setActiveId(liveId);

      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setDevices(list.filter(d => d.kind === 'videoinput'));
      } catch { /* enumeration is best-effort */ }
    };

    start();
    return () => { cancelled = true; stop(); };
  }, [active, selectedId]);

  // Release everything when the component unmounts.
  useEffect(() => () => { stop(); clearPreview(); }, []);

  const handleDeviceChange = (e) => {
    const id = e.target.value;
    clearPreview();
    onCapture(null);
    persistId(id);
    setSelectedId(id);   // triggers the effect to restart the stream on the new camera
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      clearPreview();
      const url = URL.createObjectURL(blob);
      previewRef.current = url;
      setPreview(url);
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
    }, 'image/jpeg', 0.92);
  };

  const retake = () => { clearPreview(); onCapture(null); };

  return (
    <Box>
      {devices.length > 1 && (
        <Select
          size="sm" mb={2}
          value={selectedId || activeId || ''}
          onChange={handleDeviceChange}
          aria-label="Select camera"
          style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          {devices.map((d, i) => (
            <option key={d.deviceId || i} value={d.deviceId}>
              {d.label || `Camera ${i + 1}`}
            </option>
          ))}
        </Select>
      )}

      <Box
        position="relative"
        borderRadius="var(--radius-md)"
        overflow="hidden"
        style={{ background: 'var(--color-bg-page)', border: '1px solid var(--color-border-subtle)' }}
      >
        {error ? (
          <Box py={6} px={4} textAlign="center">
            <FiCamera size={22} style={{ margin: '0 auto 0.4rem', color: 'var(--color-text-muted)' }} />
            <Text fontSize="sm" style={{ color: 'var(--color-text-muted)' }}>{error}</Text>
          </Box>
        ) : (
          <>
            {/* Live preview — hidden once a frame is captured. */}
            <video
              ref={videoRef}
              muted
              playsInline
              style={{
                display: preview ? 'none' : 'block',
                width: '100%', maxHeight: '260px', objectFit: 'contain', background: '#000',
              }}
            />
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Captured photo"
                style={{ width: '100%', maxHeight: '260px', objectFit: 'contain', background: '#000', display: 'block' }} />
            )}
            {!ready && !preview && (
              <Box position="absolute" inset={0} display="flex" alignItems="center" justifyContent="center">
                <Spinner size="sm" style={{ color: 'var(--color-accent)' }} />
              </Box>
            )}
          </>
        )}
      </Box>

      {!error && (
        <HStack spacing={2} mt={3} justify="center">
          {preview ? (
            <Button size="sm" variant="ghost" leftIcon={<FiRefreshCw size={13} />} onClick={retake}
              style={{ color: 'var(--color-text-secondary)' }}>
              Retake
            </Button>
          ) : (
            <Button size="sm" leftIcon={<FiCamera size={13} />} onClick={snap} isDisabled={!ready}
              style={{ background: 'var(--color-accent)', color: 'white', border: 'none' }}>
              Capture
            </Button>
          )}
        </HStack>
      )}
    </Box>
  );
}

// ── Snapshot camera setting ───────────────────────────────────────────────────
// Standalone picker for the camera used by captureCameraFrame(), so the quick
// snapshot can be configured without opening the Insert image dialog. Shares the
// same localStorage key as the Camera tab, so either place updates both.
// Device labels stay blank until camera permission is granted; "Detect cameras"
// requests it once (and releases the stream immediately) to reveal them.
export function SnapshotCameraSetting() {
  const [devices,  setDevices]  = useState([]);    // videoinput MediaDeviceInfo[]
  const [savedId,  setSavedId]  = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [preview,  setPreview]  = useState(null);
  const previewRef = useRef(null);

  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  const hasLabels = devices.some(d => d.label);

  const refresh = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter(d => d.kind === 'videoinput'));
    } catch { /* enumeration is best-effort */ }
  };

  const clearPreview = () => {
    if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null; }
    setPreview(null);
  };

  useEffect(() => {
    setSavedId(readSavedId() || '');
    if (!navigator.mediaDevices?.enumerateDevices) return;
    refresh();
    // Keep the list current when cameras are plugged in or removed.
    navigator.mediaDevices.addEventListener?.('devicechange', refresh);
    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', refresh);
      clearPreview();
    };
  }, []);

  const detect = async () => {
    setError(''); setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach(t => t.stop());
      await refresh();
    } catch (err) {
      setError(err?.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'Unable to access the camera.');
    } finally {
      setBusy(false);
    }
  };

  const handleChange = (e) => {
    const id = e.target.value;
    persistId(id || null);
    setSavedId(id);
    setError('');
    clearPreview();
  };

  const test = async () => {
    setError(''); setBusy(true); clearPreview();
    try {
      const file = await captureCameraFrame();
      const url = URL.createObjectURL(file);
      previewRef.current = url;
      setPreview(url);
      // captureCameraFrame() forgets a camera that's gone; reflect that here.
      setSavedId(readSavedId() || '');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <Text fontSize="xs" style={{ color: 'var(--color-text-muted)' }}>
        Camera is not available in this browser, or the page is not served over HTTPS.
      </Text>
    );
  }

  const savedMissing = savedId && devices.length > 0 && !devices.some(d => d.deviceId === savedId);
  const selectStyle = { background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' };

  return (
    <Box>
      <HStack spacing={2} align="center" wrap="wrap">
        <Select size="xs" maxW="320px" value={savedId} onChange={handleChange}
          aria-label="Snapshot camera" style={selectStyle}>
          <option value="" style={{ background: 'var(--color-bg-surface)' }}>Browser default</option>
          {devices.map((d, i) => (
            <option key={d.deviceId || i} value={d.deviceId} style={{ background: 'var(--color-bg-surface)' }}>
              {d.label || `Camera ${i + 1}`}
            </option>
          ))}
          {savedMissing && (
            <option value={savedId} style={{ background: 'var(--color-bg-surface)' }}>Saved camera (not connected)</option>
          )}
        </Select>
        {!hasLabels && (
          <Button size="xs" variant="outline" leftIcon={<FiRefreshCw size={11} />} onClick={detect} isDisabled={busy}>
            Detect cameras
          </Button>
        )}
        <Button size="xs" variant="outline" leftIcon={busy ? <Spinner size="xs" /> : <FiCamera size={11} />}
          onClick={test} isDisabled={busy}>
          Test snapshot
        </Button>
      </HStack>

      {error && (
        <Text fontSize="xs" mt={2} style={{ color: 'var(--color-danger)' }}>{error}</Text>
      )}

      {preview && (
        <Box mt={2} maxW="240px" borderRadius="var(--radius-md)" overflow="hidden"
          style={{ border: '1px solid var(--color-border-subtle)' }}>
          <img src={preview} alt="Test snapshot" style={{ width: '100%', display: 'block' }} />
        </Box>
      )}
    </Box>
  );
}
