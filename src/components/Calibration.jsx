import { useCallback, useEffect, useMemo, useState } from 'react';
import useGameStore, { BASE_LANE_SCALE, ballSizeFromLaneScale } from '../store/gameStore';

const trackingCopy = {
  idle: 'Waiting for the tracking system to initialize.',
  requesting_camera: 'Allow camera access to begin calibration.',
  camera_ready: 'Camera is live. Bring both hands into frame.',
  ready: 'Tracking is active. Left fist and lane controls resize the whole setup automatically.',
  error: 'Camera or tracking is unavailable right now.',
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const Calibration = () => {
  const calibration = useGameStore((state) => state.calibration);
  const pinScale = useGameStore((state) => state.gameSettings.pinScale);
  const leftHand = useGameStore((state) => state.leftHand);
  const rightHand = useGameStore((state) => state.rightHand);
  const trackingStatus = useGameStore((state) => state.trackingStatus);
  const trackingError = useGameStore((state) => state.trackingError);
  const setCalibration = useGameStore((state) => state.setCalibration);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const completeCalibration = useGameStore((state) => state.completeCalibration);
  const resetCalibration = useGameStore((state) => state.resetCalibration);
  const [expanded, setExpanded] = useState(false);

  const updateScale = useCallback((nextScale) => {
    const scale = clamp(nextScale, BASE_LANE_SCALE, 3);
    updateSettings({ pinScale: scale, ballSize: ballSizeFromLaneScale(scale) });
  }, [updateSettings]);

  const leftFistActive = leftHand.present && leftHand.gesture === 'FIST';
  const bothFistsReady =
    rightHand.present &&
    leftHand.present &&
    rightHand.gesture === 'FIST' &&
    leftHand.gesture === 'FIST';

  const handSummary = useMemo(() => {
    if (bothFistsReady) {
      return 'Both fists detected. You can start immediately.';
    }
    if (leftFistActive) {
      return 'Left fist lane resize is live. Move it up to enlarge the lane, or down to return toward the default size.';
    }
    if (rightHand.present && leftHand.present) {
      return 'Both hands detected. Make your left hand a fist to resize.';
    }
    if (rightHand.present || leftHand.present) {
      return 'One hand detected. Bring the other hand into frame for easier setup.';
    }
    return 'No hands detected yet. Step back a little and keep your upper body visible.';
  }, [bothFistsReady, leftFistActive, leftHand.present, rightHand.present]);

  useEffect(() => {
    if (!calibration.active) return;

    const handleKeyDown = (event) => {
      const step = 0.05;
      const rotStep = 0.02;

      switch (event.key.toLowerCase()) {
        case 'arrowup':
          setCalibration({ rotationX: calibration.rotationX - rotStep });
          break;
        case 'arrowdown':
          setCalibration({ rotationX: calibration.rotationX + rotStep });
          break;
        case 'w':
          setCalibration({ height: calibration.height + step });
          break;
        case 's':
          setCalibration({ height: calibration.height - step });
          break;
        case 'a':
          updateScale(pinScale - 0.05);
          break;
        case 'd':
          updateScale(pinScale + 0.05);
          break;
        case 'r':
          resetCalibration();
          break;
        case 'enter':
          completeCalibration();
          break;
        case 'tab':
          event.preventDefault();
          setExpanded((current) => !current);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    calibration,
    completeCalibration,
    pinScale,
    resetCalibration,
    setCalibration,
    updateScale,
    updateSettings,
  ]);

  if (!calibration.active) return null;

  const canStart = trackingStatus === 'ready' || trackingStatus === 'camera_ready';

  return (
    <div className="calibration-overlay">
      <div className="calibration-overlay__beam" />

      <div className={`calibration-panel ${expanded ? 'calibration-panel--expanded' : ''}`}>
        <div className="calibration-panel__header">
          <div>
            <p className="calibration-card__eyebrow">Launch Setup</p>
            <h2>Line up the lane, then start.</h2>
          </div>

          <div className="calibration-panel__header-actions">
            <div className={`calibration-card__status calibration-card__status--${trackingStatus}`}>
              {trackingStatus.replaceAll('_', ' ')}
            </div>
            <button
              type="button"
              className="calibration-toggle"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? 'Compact' : 'Advanced'}
            </button>
          </div>
        </div>

        <p className="calibration-card__copy">
          {trackingError || trackingCopy[trackingStatus] || trackingCopy.idle}
        </p>

        <div className="calibration-panel__status-row">
          <div className={`calibration-chip ${leftFistActive ? 'calibration-chip--active' : ''}`}>
            {leftFistActive ? 'Left Fist Resize Active' : 'Left Fist Resize Idle'}
          </div>
          <div className={`calibration-chip ${bothFistsReady ? 'calibration-chip--ready' : ''}`}>
            {bothFistsReady ? 'Two Fists Ready To Start' : 'Make Two Fists To Quick-Start'}
          </div>
        </div>

        <div className="calibration-card__stats calibration-card__stats--compact">
          <div>
            <span>Tilt</span>
            <strong>{(calibration.rotationX * 57.3).toFixed(1)}&deg;</strong>
          </div>
          <div>
            <span>Height</span>
            <strong>{calibration.height.toFixed(2)}</strong>
          </div>
          <div>
            <span>Lane</span>
            <strong>{pinScale.toFixed(2)}x</strong>
          </div>
        </div>

        <div className="calibration-card__summary">
          <span className="calibration-card__summary-label">Tracking</span>
          <p>{handSummary}</p>
        </div>

        {expanded && (
          <div className="calibration-controls">
            <label className="calibration-control">
              <span>Tilt</span>
              <input
                type="range"
                min="-0.45"
                max="0.15"
                step="0.01"
                value={calibration.rotationX}
                onChange={(event) => setCalibration({ rotationX: Number(event.target.value) })}
              />
            </label>

            <label className="calibration-control">
              <span>Floor Height</span>
              <input
                type="range"
                min="-2.5"
                max="0"
                step="0.01"
                value={calibration.height}
                onChange={(event) => setCalibration({ height: Number(event.target.value) })}
              />
            </label>

            <label className="calibration-control">
              <span>Lane Scale</span>
              <input
                type="range"
                min={String(BASE_LANE_SCALE)}
                max="3"
                step="0.05"
                value={pinScale}
                onChange={(event) => updateScale(Number(event.target.value))}
              />
            </label>
          </div>
        )}

        <div className="calibration-card__controls calibration-card__controls--compact">
          <span>Arrow Up / Down: tilt</span>
          <span>W / S: floor height</span>
          <span>A / D: lane scale</span>
          <span>Tab: advanced controls</span>
          <span>Enter: start</span>
        </div>

        <div className="calibration-card__actions calibration-card__actions--compact">
          <button
            type="button"
            className="calibration-button calibration-button--secondary"
            onClick={() => resetCalibration()}
          >
            Reset
          </button>
          <button
            type="button"
            className="calibration-button"
            onClick={() => completeCalibration()}
            disabled={!canStart}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
};

export default Calibration;
