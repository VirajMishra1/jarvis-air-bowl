import React, { useEffect, useRef, useState } from 'react';
import { Hands, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import useGameStore from '../store/gameStore';

const HandTracker = () => {
  const videoRef = useRef(null);
  
  // Store actions
  const updateHands = useGameStore((state) => state.updateHands);
  const updatePose = useGameStore((state) => state.updatePose);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const throwBall = useGameStore((state) => state.throwBall);
  const ballState = useGameStore((state) => state.ballState);
  const gameStatus = useGameStore((state) => state.gameStatus);
  const lockCalibration = useGameStore((state) => state.lockCalibration);
  const gameSettings = useGameStore((state) => state.gameSettings);
  const setBallState = useGameStore((state) => state.setBallState);
  const activeHand = useGameStore((state) => state.activeHand);
  const setActiveHand = useGameStore((state) => state.setActiveHand);

  // Local state for velocity calculation
  const historyRefRight = useRef([]); 
  const historyRefLeft = useRef([]);
  const lastGestureRefRight = useRef('OPEN');
  const lastGestureRefLeft = useRef('OPEN');
  
  const MAX_HISTORY = 8;
  const FLING_THRESHOLD = 0.1; // DRASTICALLY REDUCED (Was 0.5)

  // Peak Velocity Finder (Moved Up for Scope Access)
  const getPeakVelocity = (history) => {
      let maxSpeed = 0;
      let bestVel = { x: 0, y: 0, z: 0, roll: 0 };
      
      // Scan backwards through history
      for (let i = history.length - 1; i > 0; i--) {
          const curr = history[i];
          const prev = history[i-1];
          const dt = (curr.time - prev.time) / 1000;
          
          if (dt > 0 && dt < 0.1) { // Ignore large time gaps
              const vx = (curr.x - prev.x) / dt;
              const vy = (curr.y - prev.y) / dt;
              const vz = (curr.z - prev.z) / dt; // Added Z velocity
              const speed = Math.sqrt(vx*vx + vy*vy + vz*vz);
              
              if (speed > maxSpeed) {
                  maxSpeed = speed;
                  
                  // Calculate roll at this peak moment
                  const newIndex = curr.landmarks[5];
                  const newPinky = curr.landmarks[17];
                  const roll = Math.atan2(newPinky.y - newIndex.y, newPinky.x - newIndex.x);
                  
                  bestVel = { x: vx, y: vy, z: vz, roll };
              }
          }
      }
      return { speed: maxSpeed, ...bestVel };
  };

  // SHARED PHYSICS CALCULATION
  const calculateThrowVector = (handPos, peakVelocity) => {
      // 1. Position: Hand X [0..1] -> World X (approx)
      // Note: handPos.x is normalized [0,1].
      // In onHandResults, we did: (rightHandData.position.x * 2 - 1) * -1 * 2
      const handX = (handPos.x * 2 - 1) * -1 * 2; 
      
      // 2. Aim: Strong correction towards center
      const aimX = -handX * 2.0; 

      // 3. Forward Force
      // Based on Up (Y) and Forward (Z) speed
      const handSpeedForward = Math.abs(peakVelocity.y) * 25 + Math.abs(peakVelocity.z) * 25;
      
      // Clamp force for consistency
      const forwardForce = Math.min(70, Math.max(35, handSpeedForward));

      // 4. Side Force (Steering)
      const velocitySteer = -peakVelocity.x * 5;
      const aimSteer = aimX * 2; 
      const sideForce = velocitySteer + aimSteer;

      // 5. Up Force & Spin
      const upForce = 2; 
      
      // ADVANCED SPIN CALCULATION (User Request)
      // "add spin to the ball"
      // X-Axis Spin (Topspin/Backspin): Controlled by Wrist Flick (Velocity Y)
      // Y-Axis Spin (Curve/Hook): Controlled by Side Motion (Velocity X)
      // Z-Axis Spin (Spiral): Controlled by Hand Roll (peakVelocity.roll)
      
      const spinX = -peakVelocity.y * 5; // Topspin
      const spinY = -peakVelocity.x * 8; // Side Spin (Curve) - Stronger
      const spinZ = (peakVelocity.roll || 0) * 10; // Spiral
      
      const spin = [spinX, spinY, spinZ];

      return { vector: [sideForce, upForce, -forwardForce], spin };
  };

  // Shared Throw Execution
  const triggerThrow = (hand, velocity) => {
      // ADDITIVE FORCE LOGIC (User Request)
      // "Do exactly what the space bar does (Base Speed) but change the math according to the speed"
      
      const BASE_SPEED = 1.5; // The "Perfect" Spacebar Speed
      
      const effectiveVelocity = {
          x: velocity.x, // Steering is purely hand-based
          // Add Hand Speed to Base Speed
          // If static: 0 + 1.5 = 1.5 (Spacebar behavior)
          // If moving: velocity + 1.5 = Boosted Throw
          y: Math.abs(velocity.y) + BASE_SPEED, 
          z: Math.abs(velocity.z) // Forward Z adds to the "forwardForce" calculation in calculateThrowVector
      };

      const { vector, spin } = calculateThrowVector(hand.position, effectiveVelocity);
      
      console.log("EXECUTING THROW (Additive):", { original: velocity, effective: effectiveVelocity, vector });
      
      throwBall(vector, spin);
      setActiveHand(null);
  };

  // MAIN THROW FUNCTION
  // Called by both Spacebar (manual) and Hand Release (automatic)
  const executeThrow = () => {
      const state = useGameStore.getState();
      
      // Strict Check: Game must be playing and ball held
      if (state.gameStatus !== 'PLAYING' || state.ballState !== 'HELD') {
          console.warn("Throw attempt blocked: Game not playing or ball not held");
          return;
      }
      
      console.log("EXECUTE THROW TRIGGERED");
      
      const activeHand = state.activeHand;
      let velocity = { x: 0, y: 0, z: 0 };

      // Retrieve actual hand velocity from refs if available
      if (activeHand === 'right' && historyRefRight.current.length > 0) {
          const peak = getPeakVelocity(historyRefRight.current);
          velocity = peak;
      } else if (activeHand === 'left' && historyRefLeft.current.length > 0) {
          const peak = getPeakVelocity(historyRefLeft.current);
          velocity = peak;
      }

      // Determine which hand object to use
      let hand = { position: { x: 0.5, y: 0.5 } };
      if (activeHand === 'right' && state.rightHand.present) hand = state.rightHand;
      else if (activeHand === 'left' && state.leftHand.present) hand = state.leftHand;
      
      // Execute Throw with Speed Logic
      triggerThrow(hand, velocity);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
        if (e.code === 'Space') {
            executeThrow();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    let active = true;

    // 1. Hands Setup
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2, // Track both hands
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
        if (!active) return;
        onHandResults(results);
    });

    // 2. Pose Setup
    const pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });
    
    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    pose.onResults((results) => {
        if (!active) return;
        onPoseResults(results);
    });

    // 3. Camera Setup
    let camera = null;
    if (videoRef.current) {
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current && active) {
            await hands.send({ image: videoRef.current });
            await pose.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }

    return () => {
        active = false;
        hands.close();
        pose.close();
        if (camera) camera.stop();
    };
  }, []);

  // Gesture Detection Helper
  const detectGesture = (landmarks) => {
    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const mcp = landmarks[9] || landmarks[5];
    const handSize = dist(wrist, mcp) || 0.1;

    const dIndex = dist(wrist, indexTip) / handSize;
    const dMiddle = dist(wrist, middleTip) / handSize;
    const dRing = dist(wrist, ringTip) / handSize;
    const dPinky = dist(wrist, pinkyTip) / handSize;

    // LOWERED THRESHOLD: Make "OPEN" easier to detect
    const openThreshold = 1.0; // Was 1.2
    
    let openCount = 0;
    if (dIndex > openThreshold) openCount++;
    if (dMiddle > openThreshold) openCount++;
    if (dRing > openThreshold) openCount++;
    if (dPinky > openThreshold) openCount++;

    // DEBUG GESTURE
    // console.log("GESTURE DEBUG:", { openCount, dIndex, dMiddle, dRing, dPinky });

    if (openCount >= 3) return 'OPEN';
    
    // Check for FIST (Strictly Closed)
    // If fingers are curled in (distance is small)
    const closedThreshold = 0.9;
    let closedCount = 0;
    if (dIndex < closedThreshold) closedCount++;
    if (dMiddle < closedThreshold) closedCount++;
    if (dRing < closedThreshold) closedCount++;
    if (dPinky < closedThreshold) closedCount++;
    
    if (closedCount >= 3) return 'FIST';
    
    return 'UNKNOWN'; // New state for "In Between"
  };

  const onPoseResults = (results) => {
      if (!results.poseLandmarks) return;
      
      const landmarks = results.poseLandmarks;
      // 12: Right Shoulder, 14: Right Elbow
      // 11: Left Shoulder, 13: Left Elbow
      // Note: MediaPipe Pose "Right" is actually the person's right side.
      // If mirrored video, it appears on the left.
      
      updatePose({
          rightShoulder: landmarks[12],
          rightElbow: landmarks[14],
          leftShoulder: landmarks[11],
          leftElbow: landmarks[13]
      });
  };

  // Velocity Helper
  const calculateHandPhysics = (wrist, landmarks, historyRef) => {
      const now = Date.now();
      const history = historyRef.current;
      history.push({ x: wrist.x, y: wrist.y, z: wrist.z || 0, landmarks, time: now }); // Added Z
      if (history.length > MAX_HISTORY) history.shift();
      
      // Calculate instantaneous speed for display/debug
      let speed = 0;
      if (history.length > 2) {
          const newest = history[history.length - 1];
          const previous = history[history.length - 2];
          const dt = (newest.time - previous.time) / 1000;
          if (dt > 0) {
              const dx = newest.x - previous.x;
              const dy = newest.y - previous.y;
              // Z is usually comparable in scale to X/Y in normalized landmarks?
              // MediaPipe Z is roughly same scale as X.
              const dz = newest.z - previous.z;
              speed = Math.sqrt(dx*dx + dy*dy + dz*dz) / dt;
          }
      }
      return { speed };
  };

  // Distance Tracker for Throwing
  const throwStartPosRight = useRef(null);
  const throwStartPosLeft = useRef(null);

  const onHandResults = (results) => {
    // FIX: Get fresh state directly from store to avoid stale closures in callback
    const currentState = useGameStore.getState();
    const { activeHand, ballState, gameStatus } = currentState;

    let rightHandData = { present: false, position: {x:0,y:0}, landmarks: [], speed: 0, gesture: 'OPEN', roll: 0 };
    let leftHandData = { present: false, position: {x:0,y:0}, landmarks: [], speed: 0, gesture: 'OPEN', roll: 0 };

    if (results.multiHandLandmarks && results.multiHandedness) {
        results.multiHandedness.forEach((handedness, index) => {
            const landmarks = results.multiHandLandmarks[index];
            const label = handedness.label; // "Left" or "Right"
            const wrist = landmarks[0];
            const gesture = detectGesture(landmarks);
            
            if (label === 'Right') {
                // Physics
                const { speed } = calculateHandPhysics(wrist, landmarks, historyRefRight);
                
                rightHandData = {
                    present: true,
                    position: { x: wrist.x, y: wrist.y },
                    landmarks,
                    speed,
                    gesture,
                    roll: 0 // Will be calc'd on throw
                };
                
                // Unlock logic (Transition from Locked -> Held)
                if (gameStatus === 'PLAYING' && ballState === 'LOCKED') {
                     if (gesture === 'OPEN') {
                         setBallState('HELD');
                     }
                }

                // Interaction Logic (Throw/Catch)
                if (gameStatus === 'PLAYING') {
                    // CATCH / TRANSFER (Right Hand)
                    // Allow FIST or UNKNOWN to grab (permissive grabbing)
                    const isGrabbing = gesture === 'FIST' || gesture === 'UNKNOWN';
                    // We need to track if we WERE grabbing to detect release
                    const wasGrabbing = lastGestureRefRight.current === 'FIST' || lastGestureRefRight.current === 'UNKNOWN';
                    
                    // If we just grabbed, and the ball is NOT in our hand...
                    if (isGrabbing && !wasGrabbing) {
                        if (activeHand !== 'right') {
                            console.log("RIGHT HAND GRABBED BALL (TRANSFER)");
                            setActiveHand('right');
                            setBallState('HELD');
                        }
                    }

                    // THROW LOGIC (Right Hand)
                    if (activeHand === 'right' && ballState === 'HELD') {
                         const peak = getPeakVelocity(historyRefRight.current);
                         
                         // STATE-BASED RELEASE (User Request):
                         // "Look the hand is open but it is not thrown"
                         // This happens because the "Transition" (wasGrabbing) check fails if we missed the frame where it was closed.
                         // Or if the user starts with an open hand and the ball snaps to it.
                         
                         // NEW LOGIC: If hand is explicitly OPEN, just throw it.
                         // We don't care if it was closed before. 
                         // The user has to close their hand to grab it (handled above in CATCH).
                         // Once they have it (HELD), any OPEN state means "Let go".
                         
                         if (gesture === 'OPEN') {
                              console.log("RELEASE TRIGGERED (Right) - HAND IS OPEN", { gesture, peak });
                              executeThrow();
                              throwStartPosRight.current = null;
                         }
                         
                         // Keep Fling support for safety
                         else if (peak.speed > 2.0) {
                              console.log("RELEASE TRIGGERED (Right) - FLING", { speed: peak.speed });
                              executeThrow();
                              throwStartPosRight.current = null;
                         }
                    }
                }
                
                lastGestureRefRight.current = gesture;

            } else if (label === 'Left') {
                // Physics
                const { speed } = calculateHandPhysics(wrist, landmarks, historyRefLeft);
                
                leftHandData = {
                    present: true,
                    position: { x: wrist.x, y: wrist.y },
                    landmarks,
                    speed,
                    gesture,
                    roll: 0
                };
                
                if (gameStatus === 'PLAYING') {
                     // CATCH / TRANSFER (Left Hand)
                     const isGrabbing = gesture === 'FIST' || gesture === 'UNKNOWN';
                     const wasGrabbing = lastGestureRefLeft.current === 'FIST' || lastGestureRefLeft.current === 'UNKNOWN';
                     
                     if (isGrabbing && !wasGrabbing) {
                         if (activeHand !== 'left') {
                             console.log("LEFT HAND GRABBED BALL (TRANSFER)");
                             setActiveHand('left');
                             setBallState('HELD');
                         }
                     }

                     // THROW LOGIC (Left Hand)
                     if (activeHand === 'left' && ballState === 'HELD') {
                         const peak = getPeakVelocity(historyRefLeft.current);
                         
                         if (gesture === 'OPEN') {
                              console.log("RELEASE TRIGGERED (Left) - HAND IS OPEN", { gesture });
                              executeThrow();
                              throwStartPosLeft.current = null;
                         }
                         else if (peak.speed > 2.0) {
                              executeThrow();
                              throwStartPosLeft.current = null;
                         }
                     }
                }
                
                // Calibration Logic (Resize) - STRICT CHECK
                // Only allow resizing if we are explicitly in CALIBRATION mode AND not locked
                const pinScaleLocked = useGameStore.getState().pinScaleLocked;
                if (gameStatus === 'CALIBRATION' && gesture === 'FIST' && !pinScaleLocked) {
                    const y = Math.max(0, Math.min(1, wrist.y));
                    const scale = 3.0 - (y * 2.5); 
                    const ballSize = 0.3 * scale;
                    updateSettings({ pinScale: scale, ballSize });
                }
                
                lastGestureRefLeft.current = gesture;
            }
        });
        
        // Global Checks (e.g. Double Fist Lock)
        
        // 1. AUTO UNLOCK / INSTANT START
        // If we somehow get stuck in LOCKED, force to HELD.
        if (gameStatus === 'PLAYING' && ballState === 'LOCKED') {
             console.log("AUTO UNLOCKING TO HELD");
             setBallState('HELD');
             if (!activeHand) setActiveHand('right');
        }

        // 2. LOCK CALIBRATION -> START GAME
        if (gameStatus === 'CALIBRATION') {
            if (rightHandData.gesture === 'FIST' && leftHandData.gesture === 'FIST') {
                console.log("LOCKING CALIBRATION - DOUBLE FIST");
                lockCalibration();
                
                // INSTANT GRAB:
                // 1. Set Ball to HELD immediately (skip LOCKED)
                // 2. Assign to RIGHT hand by default
                setBallState('HELD');
                setActiveHand('right');
            }
        }
    }
    
    updateHands(rightHandData, leftHandData);
  };

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1, overflow: 'hidden' }}>
      <video 
        ref={videoRef} 
        style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover',
            transform: 'scaleX(-1)' // Mirroring
        }} 
        playsInline
        muted
        autoPlay
      ></video>
    </div>
  );
};

export default HandTracker;
