import { useEffect, useMemo, useState } from 'react';
import useGameStore from '../store/gameStore';
import HandOverlay from './HandOverlay';

const statusCopy = {
  idle: 'Waiting to initialize tracking.',
  requesting_camera: 'Requesting camera access.',
  camera_ready: 'Camera is live. Hold your hands in frame.',
  ready: 'Tracking is active.',
  error: 'Tracking unavailable.',
};

const isTransientTrackingError = (message) =>
  typeof message === 'string' &&
  (message.includes('interrupted by a new load request') || message.includes('play() request'));

const FrameCell = ({ frame, isCurrent }) => {
  const rolls = frame.marks;

  return (
    <article
      className={`hud__frame ${isCurrent ? 'hud__frame--current' : ''} ${frame.complete ? 'hud__frame--complete' : ''} ${frame.index === 9 ? 'hud__frame--tenth' : ''}`}
    >
      <span className="hud__frame-number">{frame.index + 1}</span>
      <div className={`hud__frame-rolls ${frame.index === 9 ? 'hud__frame-rolls--tenth' : ''}`}>
        {rolls.map((mark, index) => (
          <span key={`${frame.index}-${index}`} className="hud__frame-roll">
            {mark || '\u00a0'}
          </span>
        ))}
      </div>
      <strong className="hud__frame-total">{frame.cumulative ?? '\u00a0'}</strong>
    </article>
  );
};

const HUD = () => {
  const rightHand = useGameStore((state) => state.rightHand);
  const leftHand = useGameStore((state) => state.leftHand);
  const score = useGameStore((state) => state.score);
  const scoreboard = useGameStore((state) => state.scoreboard);
  const currentFrame = useGameStore((state) => state.currentFrame);
  const gameStatus = useGameStore((state) => state.gameStatus);
  const ballState = useGameStore((state) => state.ballState);
  const pose = useGameStore((state) => state.pose);
  const calibrationActive = useGameStore((state) => state.calibration.active);
  const trackingStatus = useGameStore((state) => state.trackingStatus);
  const trackingError = useGameStore((state) => state.trackingError);
  const debugEnabled = useGameStore((state) => state.debugEnabled);
  const lastRollSummary = useGameStore((state) => state.lastRollSummary);
  const restartBowling = useGameStore((state) => state.restartBowling);
  const toggleDebug = useGameStore((state) => state.toggleDebug);

  const [scorePulse, setScorePulse] = useState(false);

  useEffect(() => {
    setScorePulse(true);
    const timer = window.setTimeout(() => setScorePulse(false), 280);
    return () => window.clearTimeout(timer);
  }, [score]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      if (key === 'd') {
        toggleDebug();
      }
      if (key === 'n' && !calibrationActive) {
        restartBowling();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calibrationActive, restartBowling, toggleDebug]);

  const turnLabel = useMemo(() => {
    if (gameStatus === 'GAME_OVER') {
      return 'Final Card';
    }

    return `Frame ${Math.min(currentFrame + 1, 10)}`;
  }, [currentFrame, gameStatus]);

  const statusLine = useMemo(() => {
    if (trackingError && !isTransientTrackingError(trackingError)) {
      return trackingError;
    }
    if (gameStatus === 'GAME_OVER') {
      return `Game complete. Final score ${score}.`;
    }
    if (gameStatus === 'THROWN') {
      return 'Ball in play.';
    }
    if (!rightHand.present && !leftHand.present && trackingStatus === 'ready') {
      return 'Show both hands to track cleanly.';
    }
    if (ballState === 'LOCKED') {
      return 'Close either hand to grab the ball.';
    }
    if (ballState === 'HELD') {
      return 'Aim through the lane and release.';
    }
    return lastRollSummary;
  }, [
    ballState,
    gameStatus,
    lastRollSummary,
    leftHand.present,
    rightHand.present,
    score,
    trackingError,
    trackingStatus,
  ]);

  const drawArm = () => {
    const toScreen = (point) => ({ x: (1 - point.x) * 100, y: point.y * 100 });

    const renderLimb = (shoulder, elbow, wrist, color) => {
      if (!shoulder || !elbow || !wrist) return null;
      const s = toScreen(shoulder);
      const e = toScreen(elbow);
      const w = toScreen(wrist);

      return (
        <g>
          <path
            d={`M ${s.x} ${s.y} L ${e.x} ${e.y} L ${w.x} ${w.y}`}
            stroke={color}
            strokeWidth="0.7"
            fill="none"
            filter="url(#hud-glow)"
            opacity="0.8"
          />
          <circle cx={s.x} cy={s.y} r="0.7" stroke={color} strokeWidth="0.2" fill="none" />
          <circle cx={e.x} cy={e.y} r="0.7" stroke={color} strokeWidth="0.2" fill="none" />
          <circle cx={w.x} cy={w.y} r="1.2" stroke={color} strokeWidth="0.2" fill="rgba(8, 13, 22, 0.7)" />
          <circle cx={w.x} cy={w.y} r="0.4" fill={color} />
        </g>
      );
    };

    return (
      <svg className="hud__arms" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <filter id="hud-glow">
            <feGaussianBlur stdDeviation="0.3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {renderLimb(pose.rightShoulder, pose.rightElbow, rightHand.position, '#ff6b4a')}
        {renderLimb(pose.leftShoulder, pose.leftElbow, leftHand.position, '#25e7ff')}
      </svg>
    );
  };

  return (
    <div className="hud">
      <HandOverlay />
      {drawArm()}

      {calibrationActive ? null : (
        <>
          <section className={`hud__scoreboard ${scorePulse ? 'hud__scoreboard--pulse' : ''}`}>
            <div className="hud__scoreboard-header">
              <div>
                <span className="hud__label">Air Bowl</span>
                <p className="hud__scoreboard-subtitle">{turnLabel}</p>
              </div>
              <div className="hud__scoreboard-actions">
                {gameStatus === 'GAME_OVER' ? (
                  <button type="button" className="hud__action" onClick={restartBowling}>
                    New Game
                  </button>
                ) : null}
                <div className="hud__score-total">
                  <span className="hud__label">Total</span>
                  <strong>{score}</strong>
                </div>
              </div>
            </div>

            <div className="hud__frames">
              {scoreboard.map((frame) => (
                <FrameCell
                  key={frame.index}
                  frame={frame}
                  isCurrent={gameStatus !== 'GAME_OVER' && frame.index === currentFrame}
                />
              ))}
            </div>

            <div className="hud__scoreboard-meta">
              <span>{statusLine}</span>
              <span>
                {isTransientTrackingError(trackingError)
                  ? statusCopy.ready
                  : statusCopy[trackingStatus] || 'Initializing sensors.'}
                {gameStatus === 'GAME_OVER' ? ' Press N or use New Game.' : ' Press N to restart.'}
              </span>
            </div>
          </section>

          {rightHand.present && (
            <div
              className="hud__reticle"
              style={{
                left: `${(1 - rightHand.position.x) * 100}%`,
                top: `${rightHand.position.y * 100}%`,
                '--reticle-color': rightHand.gesture === 'FIST' ? '#ff6b4a' : '#25e7ff',
              }}
            />
          )}

          {debugEnabled && (
            <div className="hud__debug">
              <div className="hud__debug-title">Debug</div>
              <div>Tracking: {trackingStatus}</div>
              <div>Ball state: {ballState}</div>
              <div>Frame: {Math.min(currentFrame + 1, 10)}</div>
              <div>Right speed: {(rightHand.speed || 0).toFixed(2)}</div>
              <div>Left speed: {(leftHand.speed || 0).toFixed(2)}</div>
              <div>Gesture R: {rightHand.gesture}</div>
              <div>Gesture L: {leftHand.gesture}</div>
            </div>
          )}
        </>
      )}

      <div className="hud__corners" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
};

export default HUD;
