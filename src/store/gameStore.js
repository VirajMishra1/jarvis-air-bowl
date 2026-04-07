import { create } from 'zustand';

const useGameStore = create((set) => ({
  // Game Status
  gameStatus: 'CALIBRATION', // CALIBRATION, PLAYING, THROWN, SCORING, FINISHED
  
  // Ball State
  ballState: 'HIDDEN', // HIDDEN, LOCKED, HELD, THROWN
  activeHand: null, // 'right', 'left', or null
  ballPosition: [0, 0.5, 5], // Start position (at the beginning of lane)
  ballVelocity: [0, 0, 0],
  ballSpin: [0, 0, 0], // Changed to Vector3 [x, y, z]
  
  // Hand State (for UI/Debugging)
  // Right Hand (Ball Control)
  rightHand: {
    present: false,
    position: { x: 0, y: 0 },
    landmarks: [],
    speed: 0,
    gesture: 'OPEN',
    roll: 0
  },
  // Left Hand (Scale/Settings Control)
  leftHand: {
    present: false,
    position: { x: 0, y: 0 },
    landmarks: [],
    gesture: 'OPEN',
    speed: 0
  },
  // Pose (Shoulder/Elbow)
  pose: {
    rightShoulder: null,
    rightElbow: null,
    leftShoulder: null,
    leftElbow: null
  },

  // Game Settings (Controlled by Left Hand)
  gameSettings: {
    ballSize: 0.3, // Radius
    pinScale: 2.0, // Start bigger
  },

  updateHands: (right, left) => set({
      rightHand: { ...right },
      leftHand: { ...left }
  }),

  updatePose: (poseData) => set({ pose: poseData }),
  
  updateSettings: (settings) => set((state) => ({
      gameSettings: { ...state.gameSettings, ...settings }
  })),
  
  // Score
  score: 0,
  pinsKnocked: 0,
  roundId: 0, // Used to force-reset pins
  
  // Calibration State
  calibration: {
    active: true, // Start in calibration mode
    scale: 1,
    rotationX: -0.1, // Slight tilt
    height: -1.5,
  },
  pinScaleLocked: false, // Lock pin resizing after setup

  setCalibration: (updates) => set((state) => ({ 
    calibration: { ...state.calibration, ...updates } 
  })),

  // Actions
  setGameStatus: (status) => set({ gameStatus: status }),
  setBallState: (state) => set({ ballState: state }),
  setActiveHand: (hand) => set({ activeHand: hand }),
  
  // New Action: Lock Calibration
  lockCalibration: () => set({ 
      gameStatus: 'PLAYING', 
      ballState: 'LOCKED', // Wait for release
      pinScaleLocked: true
  }),

  // Deprecated: updateHand (Kept for compatibility if needed, but unused)
  updateHand: (x, y, speed, gesture, landmarks) => {},
  
  throwBall: (velocity, spin) => set({ 
    ballState: 'THROWN', 
    gameStatus: 'THROWN',
    ballVelocity: velocity,
    ballSpin: spin
  }),
  
  resetBall: () => set({ 
    ballState: 'HELD', 
    gameStatus: 'PLAYING',
    ballVelocity: [0, 0, 0],
    ballSpin: [0, 0, 0],
    ballPosition: [0, 0.5, 5]
  }),
  
  setScore: (pins) => set((state) => ({ 
    pinsKnocked: pins,
    score: state.score + pins,
    gameStatus: 'FINISHED'
  })),

  nextRound: () => set((state) => ({
    roundId: state.roundId + 1,
    gameStatus: 'PLAYING',
    ballState: 'HELD',
    ballVelocity: [0, 0, 0],
    ballSpin: [0, 0, 0],
    activeHand: 'right' // Default back to right hand
  })),

  resetGame: () => set({
    gameStatus: 'CALIBRATION',
    ballState: 'HIDDEN',
    pinScaleLocked: false,
    score: 0,
    pinsKnocked: 0,
    roundId: 0,
    ballVelocity: [0, 0, 0],
    ballPosition: [0, 0.5, 5]
  })
}));

export default useGameStore;
