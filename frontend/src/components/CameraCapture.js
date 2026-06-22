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
