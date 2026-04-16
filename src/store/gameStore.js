import { create } from 'zustand';

export const BASE_LANE_SCALE = 1.8;
export const MIN_BALL_SIZE = 0.41;
export const ballSizeFromLaneScale = (scale) => Math.max(0.23 * scale, MIN_BALL_SIZE);

const FULL_PIN_IDS = Array.from({ length: 10 }, (_, index) => index);
const defaultCelebration = {
  active: false,
  type: null,
  label: '',
  frame: 0,
  nonce: 0,
};

const defaultHandState = {
  present: false,
  position: { x: 0.5, y: 0.5 },
  landmarks: [],
  speed: 0,
  gesture: 'OPEN',
  roll: 0,
  releasePosition: null,
  release: {
    speed: 0,
    roll: 0,
    averagedVelocity: { x: 0, y: 0, z: 0 },
    peakVelocity: { x: 0, y: 0, z: 0 },
  },
};

const defaultPose = {
  rightShoulder: null,
  rightElbow: null,
  leftShoulder: null,
  leftElbow: null,
};

const defaultCalibration = {
  active: true,
  scale: 1,
  rotationX: -0.1,
  height: -1.5,
};

const defaultSettings = {
  ballSize: ballSizeFromLaneScale(BASE_LANE_SCALE),
  pinScale: BASE_LANE_SCALE,
};

const createEmptyFrames = () => Array.from({ length: 10 }, () => ({ rolls: [] }));

const formatPins = (pins) => {
  if (pins == null) return '';
  return pins === 0 ? '-' : String(pins);
};

const isTenthFrameComplete = (rolls) => {
  if (rolls.length < 2) return false;
  if (rolls[0] === 10 || rolls[0] + rolls[1] === 10) {
    return rolls.length >= 3;
  }
  return rolls.length >= 2;
};

const getNextRolls = (frames, frameIndex) => frames.slice(frameIndex + 1).flatMap((frame) => frame.rolls);

const buildFrameMarks = (rolls, frameIndex) => {
  if (frameIndex < 9) {
    const [first, second] = rolls;
    if (first === 10) {
      return ['X', ''];
    }

    return [
      first == null ? '' : formatPins(first),
      second == null ? '' : first + second === 10 ? '/' : formatPins(second),
    ];
  }

  const [first, second, third] = rolls;
  const marks = ['', '', ''];

  if (first != null) {
    marks[0] = first === 10 ? 'X' : formatPins(first);
  }

  if (second != null) {
    if (first === 10) {
      marks[1] = second === 10 ? 'X' : formatPins(second);
    } else {
      marks[1] = first + second === 10 ? '/' : formatPins(second);
    }
  }

  if (third != null) {
    if (first === 10 && second === 10) {
      marks[2] = third === 10 ? 'X' : formatPins(third);
    } else if (first === 10 && second + third === 10) {
      marks[2] = '/';
    } else {
      marks[2] = third === 10 ? 'X' : formatPins(third);
    }
  }

  return marks;
};

const buildScoreboard = (frames) => {
  let runningTotal = 0;

  return frames.map((frame, index) => {
    const rolls = frame.rolls;
    let frameScore = null;

    if (index < 9) {
      const [first = null, second = null] = rolls;
      const nextRolls = getNextRolls(frames, index);

      if (first === 10) {
        if (nextRolls.length >= 2) {
          frameScore = 10 + nextRolls[0] + nextRolls[1];
        }
      } else if (second != null) {
        if (first + second === 10) {
          if (nextRolls.length >= 1) {
            frameScore = 10 + nextRolls[0];
          }
        } else {
          frameScore = first + second;
        }
      }
    } else if (isTenthFrameComplete(rolls)) {
      frameScore = rolls.reduce((sum, pins) => sum + pins, 0);
    }

    if (frameScore != null) {
      runningTotal += frameScore;
    }

    return {
      index,
      rolls,
      marks: buildFrameMarks(rolls, index),
      frameScore,
      cumulative: frameScore != null ? runningTotal : null,
      complete: index < 9 ? rolls[0] === 10 || rolls.length >= 2 : isTenthFrameComplete(rolls),
    };
  });
};

const getTotalScore = (scoreboard) =>
  scoreboard.reduce((latest, frame) => (frame.cumulative == null ? latest : frame.cumulative), 0);

const createBowlingState = (overrides = {}) => {
  const frames = createEmptyFrames();
  const scoreboard = buildScoreboard(frames);

  return {
    frames,
    scoreboard,
    score: 0,
    currentFrame: 0,
    standingPinIds: FULL_PIN_IDS,
    pinRackId: 0,
    lastPinsKnocked: 0,
    lastRollSummary: 'Frame 1, ball 1 ready.',
    ...overrides,
  };
};

const useGameStore = create((set) => ({
  gameStatus: 'CALIBRATION',
  ballState: 'HIDDEN',
  activeHand: null,
  ballPosition: [0, 0.5, 5],
  ballVelocity: [0, 0, 0],
  ballSpin: [0, 0, 0],
  rightHand: defaultHandState,
  leftHand: defaultHandState,
  pose: defaultPose,
  gameSettings: defaultSettings,
  calibration: defaultCalibration,
  pinScaleLocked: false,
  trackingStatus: 'idle',
  trackingError: '',
  debugEnabled: false,
  celebration: defaultCelebration,
  ...createBowlingState(),

  updateHands: (right, left) =>
    set({
      rightHand: { ...defaultHandState, ...right },
      leftHand: { ...defaultHandState, ...left },
    }),

  updatePose: (poseData) => set({ pose: { ...defaultPose, ...poseData } }),

  updateSettings: (settings) =>
    set((state) => ({
      gameSettings: { ...state.gameSettings, ...settings },
    })),

  setCalibration: (updates) =>
    set((state) => ({
      calibration: { ...state.calibration, ...updates },
    })),

  setTrackingStatus: (trackingStatus) => set({ trackingStatus }),
  setTrackingError: (trackingError) => set({ trackingError }),
  toggleDebug: () => set((state) => ({ debugEnabled: !state.debugEnabled })),
  dismissCelebration: () =>
    set((state) => ({
      celebration: state.celebration.active
        ? { ...state.celebration, active: false }
        : state.celebration,
    })),

  setGameStatus: (status) => set({ gameStatus: status }),
  setBallState: (state) => set({ ballState: state }),
  setActiveHand: (hand) => set({ activeHand: hand }),

  lockCalibration: () =>
    set((state) => ({
      gameStatus: 'PLAYING',
      ballState: 'LOCKED',
      activeHand: null,
      pinScaleLocked: true,
      calibration: { ...state.calibration, active: false },
      celebration: defaultCelebration,
      ...createBowlingState(),
    })),

  completeCalibration: () =>
    set((state) => ({
      gameStatus: 'PLAYING',
      ballState: 'LOCKED',
      activeHand: null,
      pinScaleLocked: true,
      calibration: { ...state.calibration, active: false },
      celebration: defaultCelebration,
      ...createBowlingState(),
    })),

  restartBowling: () =>
    set((state) => ({
      gameStatus: 'PLAYING',
      ballState: 'LOCKED',
      activeHand: null,
      ballVelocity: [0, 0, 0],
      ballSpin: [0, 0, 0],
      ballPosition: [0, 0.5, 5],
      celebration: defaultCelebration,
      ...createBowlingState({ pinRackId: state.pinRackId + 1 }),
    })),

  resetCalibration: () =>
    set(() => ({
      calibration: defaultCalibration,
      gameSettings: defaultSettings,
      pinScaleLocked: false,
      gameStatus: 'CALIBRATION',
      ballState: 'HIDDEN',
      activeHand: null,
      ballVelocity: [0, 0, 0],
      ballSpin: [0, 0, 0],
      ballPosition: [0, 0.5, 5],
      celebration: defaultCelebration,
      ...createBowlingState(),
    })),

  updateHand: () => {},

  throwBall: (velocity, spin, position = null) =>
    set({
      ballState: 'THROWN',
      gameStatus: 'THROWN',
      ballPosition: position || [0, 0.5, 5],
      ballVelocity: velocity,
      ballSpin: spin,
    }),

  resetBall: () =>
    set((state) => ({
      ballState: 'LOCKED',
      gameStatus: state.currentFrame >= 10 ? 'GAME_OVER' : 'PLAYING',
      activeHand: null,
      ballVelocity: [0, 0, 0],
      ballSpin: [0, 0, 0],
      ballPosition: [0, Math.max(state.gameSettings.ballSize, 0.3), 4],
    })),

  recordRoll: (knockedPinIds) =>
    set((state) => {
      if (state.currentFrame >= 10 || state.gameStatus === 'CALIBRATION') {
        return {};
      }

      const frameIndex = state.currentFrame;
      const frame = state.frames[frameIndex];
      if (!frame) {
        return {};
      }

      const standingSet = new Set(state.standingPinIds);
      const uniqueKnocked = [...new Set(knockedPinIds)].filter((pinId) => standingSet.has(pinId));
      const pinsDown = uniqueKnocked.length;
      const nextFrames = state.frames.map((entry, index) =>
        index === frameIndex ? { ...entry, rolls: [...entry.rolls, pinsDown] } : { ...entry },
      );
      const currentRolls = nextFrames[frameIndex].rolls;
      const scoreboard = buildScoreboard(nextFrames);
      const score = getTotalScore(scoreboard);
      const priorRolls = currentRolls.slice(0, -1);
      let celebration = defaultCelebration;

      if (pinsDown === 10) {
        celebration = {
          active: true,
          type: 'strike',
          label: 'STRIKE',
          frame: frameIndex + 1,
          nonce: state.celebration.nonce + 1,
        };
      } else {
        const isStandardSpare =
          priorRolls.length === 1 &&
          priorRolls[0] < 10 &&
          priorRolls[0] + pinsDown === 10;
        const isTenthFillSpare =
          frameIndex === 9 &&
          priorRolls.length === 2 &&
          priorRolls[0] === 10 &&
          priorRolls[1] < 10 &&
          priorRolls[1] + pinsDown === 10;

        if (isStandardSpare || isTenthFillSpare) {
          celebration = {
            active: true,
            type: 'spare',
            label: 'SPARE',
            frame: frameIndex + 1,
            nonce: state.celebration.nonce + 1,
          };
        }
      }

      let currentFrame = frameIndex;
      let standingPinIds = state.standingPinIds.filter((pinId) => !uniqueKnocked.includes(pinId));
      let pinRackId = state.pinRackId;
      let gameStatus = 'PLAYING';
      let lastRollSummary = `${pinsDown} pins down.`;

      if (frameIndex < 9) {
        if (currentRolls.length === 1) {
          if (pinsDown === 10) {
            currentFrame = frameIndex + 1;
            standingPinIds = FULL_PIN_IDS;
            pinRackId += 1;
            lastRollSummary = `Strike on frame ${frameIndex + 1}.`;
          } else {
            pinRackId += 1;
            lastRollSummary =
              pinsDown === 0
                ? `Frame ${frameIndex + 1}, ball 2 ready.`
                : `${pinsDown} pin${pinsDown === 1 ? '' : 's'} down. Ball 2 ready.`;
          }
        } else {
          const frameTotal = currentRolls[0] + currentRolls[1];
          currentFrame = frameIndex + 1;
          standingPinIds = FULL_PIN_IDS;
          pinRackId += 1;
          lastRollSummary =
            frameTotal === 10
              ? `Spare on frame ${frameIndex + 1}.`
              : `Frame ${frameIndex + 1} closes at ${frameTotal}.`;
        }
      } else if (currentRolls.length === 1) {
        if (pinsDown === 10) {
          standingPinIds = FULL_PIN_IDS;
          pinRackId += 1;
          lastRollSummary = 'Strike in the tenth. Two fill balls remain.';
        } else {
          pinRackId += 1;
          lastRollSummary = `${pinsDown} pin${pinsDown === 1 ? '' : 's'} down. Final frame ball 2 ready.`;
        }
      } else if (currentRolls.length === 2) {
        const [first, second] = currentRolls;

        if (first === 10) {
          pinRackId += 1;
          if (second === 10) {
            standingPinIds = FULL_PIN_IDS;
            lastRollSummary = 'Back-to-back strikes in the tenth. One more ball.';
          } else {
            standingPinIds = FULL_PIN_IDS.filter((pinId) => !uniqueKnocked.includes(pinId));
            lastRollSummary = 'One fill ball left.';
          }
        } else if (first + second === 10) {
          standingPinIds = FULL_PIN_IDS;
          pinRackId += 1;
          lastRollSummary = 'Spare in the tenth. One fill ball left.';
        } else {
          currentFrame = 10;
          gameStatus = 'GAME_OVER';
          lastRollSummary = `Game complete. Final frame totals ${first + second}.`;
        }
      } else {
        currentFrame = 10;
        gameStatus = 'GAME_OVER';
        lastRollSummary = 'Game complete. Final score locked in.';
      }

      if (currentFrame >= 10) {
        gameStatus = 'GAME_OVER';
      }

      return {
        frames: nextFrames,
        scoreboard,
        score,
        currentFrame,
        standingPinIds,
        pinRackId,
        lastPinsKnocked: pinsDown,
        lastRollSummary,
        gameStatus,
        ballState: 'LOCKED',
        activeHand: null,
        ballVelocity: [0, 0, 0],
        ballSpin: [0, 0, 0],
        celebration,
      };
    }),

  resetGame: () =>
    set(() => ({
      gameStatus: 'CALIBRATION',
      ballState: 'HIDDEN',
      activeHand: null,
      pinScaleLocked: false,
      ballVelocity: [0, 0, 0],
      ballSpin: [0, 0, 0],
      ballPosition: [0, 0.5, 5],
      rightHand: defaultHandState,
      leftHand: defaultHandState,
      pose: defaultPose,
      calibration: defaultCalibration,
      trackingStatus: 'idle',
      trackingError: '',
      celebration: defaultCelebration,
      ...createBowlingState(),
    })),
}));

export default useGameStore;
