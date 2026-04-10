import { useEffect, useRef } from 'react';
import { Hands } from '@mediapipe/hands';
import { Pose } from '@mediapipe/pose';
import useGameStore, { BASE_LANE_SCALE, ballSizeFromLaneScale } from '../store/gameStore';
import { buildThrowProfile } from '../lib/bowlingPhysics';

const defaultHandData = {
  present: false,
  position: { x: 0, y: 0 },
  landmarks: [],
  speed: 0,
  gesture: 'OPEN',
  roll: 0,
};

const distance2D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const HandTracker = () => {
  const videoRef = useRef(null);
  const updateHands = useGameStore((state) => state.updateHands);
  const updatePose = useGameStore((state) => state.updatePose);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const throwBall = useGameStore((state) => state.throwBall);
  const completeCalibration = useGameStore((state) => state.completeCalibration);
  const setBallState = useGameStore((state) => state.setBallState);
  const setActiveHand = useGameStore((state) => state.setActiveHand);
  const setTrackingStatus = useGameStore((state) => state.setTrackingStatus);
  const setTrackingError = useGameStore((state) => state.setTrackingError);

  const historyRefRight = useRef([]);
  const historyRefLeft = useRef([]);
  const lastGestureRefRight = useRef('OPEN');
  const lastGestureRefLeft = useRef('OPEN');
  const releaseArmedRefRight = useRef(false);
  const releaseArmedRefLeft = useRef(false);
  const releaseArmedAtRefRight = useRef(0);
  const releaseArmedAtRefLeft = useRef(0);
  const armedThrowRefRight = useRef(null);
  const armedThrowRefLeft = useRef(null);
  const executeThrowRef = useRef(() => {});
  const handResultsRef = useRef(() => {});
  const poseResultsRef = useRef(() => {});
  const maxHistory = 8;

  const getReleaseMetrics = (history) => {
    let maxSpeed = 0;
    let peakVelocity = { x: 0, y: 0, z: 0 };
    let weighted = { x: 0, y: 0, z: 0 };
    let totalWeight = 0;

    for (let i = history.length - 1; i > 0; i -= 1) {
      const current = history[i];
      const previous = history[i - 1];
      const dt = (current.time - previous.time) / 1000;

      if (dt > 0 && dt < 0.1) {
        const vx = (current.x - previous.x) / dt;
        const vy = (current.y - previous.y) / dt;
        const vz = (current.z - previous.z) / dt;
        const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
        const weight = history.length - i + 1;

        weighted.x += vx * weight;
        weighted.y += vy * weight;
        weighted.z += vz * weight;
        totalWeight += weight;

        if (speed > maxSpeed) {
          maxSpeed = speed;
          peakVelocity = { x: vx, y: vy, z: vz };
        }
      }
    }

    const latest = history.at(-1);
    const indexKnuckle = latest?.landmarks?.[5];
    const pinkyKnuckle = latest?.landmarks?.[17];
    const roll =
      indexKnuckle && pinkyKnuckle
        ? Math.atan2(pinkyKnuckle.y - indexKnuckle.y, pinkyKnuckle.x - indexKnuckle.x)
        : 0;

    const averagedVelocity =
      totalWeight > 0
        ? {
            x: weighted.x / totalWeight,
            y: weighted.y / totalWeight,
            z: weighted.z / totalWeight,
          }
        : peakVelocity;

    return {
      speed: maxSpeed,
      roll,
      averagedVelocity,
      peakVelocity,
    };
  };

  const triggerThrow = (hand, release) => {
    const ballSize = useGameStore.getState().gameSettings.ballSize;
    const { vector, spin, launchPosition } = buildThrowProfile(hand.position, release, ballSize);
    throwBall(vector, spin, launchPosition);
    setActiveHand(null);
    releaseArmedRefRight.current = false;
    releaseArmedRefLeft.current = false;
    armedThrowRefRight.current = null;
    armedThrowRefLeft.current = null;
  };

  const executeThrow = () => {
    const state = useGameStore.getState();

    if (state.gameStatus !== 'PLAYING' || state.ballState !== 'HELD') {
      return;
    }

    const activeHand = state.activeHand;
    let release = {
      speed: 0,
      roll: 0,
      averagedVelocity: { x: 0, y: 0, z: 0 },
      peakVelocity: { x: 0, y: 0, z: 0 },
    };

    if (activeHand === 'right' && historyRefRight.current.length > 0) {
      release = armedThrowRefRight.current?.release || getReleaseMetrics(historyRefRight.current);
    } else if (activeHand === 'left' && historyRefLeft.current.length > 0) {
      release = armedThrowRefLeft.current?.release || getReleaseMetrics(historyRefLeft.current);
    }

    let hand = { position: { x: 0.5, y: 0.5 } };
    if (activeHand === 'right' && state.rightHand.present) {
      hand = {
        ...state.rightHand,
        position: armedThrowRefRight.current?.position || state.rightHand.position,
      };
    } else if (activeHand === 'left' && state.leftHand.present) {
      hand = {
        ...state.leftHand,
        position: armedThrowRefLeft.current?.position || state.leftHand.position,
      };
    }

    triggerThrow(hand, release);
  };

  useEffect(() => {
    let active = true;
    let frameId = 0;
    let processing = false;
    let stream;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      if (active) {
        handResultsRef.current(results);
      }
    });

    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results) => {
      if (active) {
        poseResultsRef.current(results);
      }
    });

    const startTracking = async () => {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
        setTrackingStatus('error');
        setTrackingError('Camera access is not available in this browser.');
        return;
      }

      try {
        setTrackingStatus('requesting_camera');
        setTrackingError('');

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setTrackingStatus('camera_ready');

        const processFrame = async () => {
          if (!active || !videoRef.current) {
            return;
          }

          if (processing || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            frameId = window.requestAnimationFrame(processFrame);
            return;
          }

          processing = true;

          try {
            await hands.send({ image: videoRef.current });
            await pose.send({ image: videoRef.current });
            setTrackingStatus('ready');
          } catch (error) {
            setTrackingStatus('error');
            setTrackingError(error.message || 'Tracking stopped unexpectedly.');
            return;
          } finally {
            processing = false;
          }

          frameId = window.requestAnimationFrame(processFrame);
        };

        frameId = window.requestAnimationFrame(processFrame);
      } catch (error) {
        setTrackingStatus('error');
        setTrackingError(
          error.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow access and refresh to play.'
            : error.message || 'Unable to start the camera feed.',
        );
      }
    };

    startTracking();

    return () => {
      active = false;
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      hands.close();
      pose.close();
    };
  }, [setTrackingError, setTrackingStatus]);

  const detectGesture = (landmarks) => {
    const wrist = landmarks[0];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    const handSize = dist(wrist, landmarks[9] || landmarks[5]) || 0.1;

    const dIndex = dist(wrist, indexTip) / handSize;
    const dMiddle = dist(wrist, middleTip) / handSize;
    const dRing = dist(wrist, ringTip) / handSize;
    const dPinky = dist(wrist, pinkyTip) / handSize;

    let openCount = 0;
    if (dIndex > 1) openCount += 1;
    if (dMiddle > 1) openCount += 1;
    if (dRing > 1) openCount += 1;
    if (dPinky > 1) openCount += 1;
    if (openCount >= 3) return 'OPEN';

    let closedCount = 0;
    if (dIndex < 0.9) closedCount += 1;
    if (dMiddle < 0.9) closedCount += 1;
    if (dRing < 0.9) closedCount += 1;
    if (dPinky < 0.9) closedCount += 1;
    if (closedCount >= 3) return 'FIST';

    return 'UNKNOWN';
  };

  const onPoseResults = (results) => {
    if (!results.poseLandmarks) {
      updatePose({
        rightShoulder: null,
        rightElbow: null,
        leftShoulder: null,
        leftElbow: null,
      });
      return;
    }

    const landmarks = results.poseLandmarks;
    updatePose({
      rightShoulder: landmarks[12],
      rightElbow: landmarks[14],
      leftShoulder: landmarks[11],
      leftElbow: landmarks[13],
    });
  };

  const calculateHandPhysics = (wrist, landmarks, historyRef) => {
    const now = Date.now();
    const history = historyRef.current;
    history.push({ x: wrist.x, y: wrist.y, z: wrist.z || 0, landmarks, time: now });
    if (history.length > maxHistory) history.shift();

    let speed = 0;
    if (history.length > 1) {
      const newest = history[history.length - 1];
      const previous = history[history.length - 2];
      const dt = (newest.time - previous.time) / 1000;

      if (dt > 0) {
        const dx = newest.x - previous.x;
        const dy = newest.y - previous.y;
        const dz = newest.z - previous.z;
        speed = Math.sqrt(dx * dx + dy * dy + dz * dz) / dt;
      }
    }

    return { speed };
  };

  const shouldArmRelease = (handData, release) => {
    const downwardSwing = release.averagedVelocity.y > 0.28 || release.peakVelocity.y > 0.48;
    const movingWithIntent = release.speed > 0.8;
    const releaseZone = handData.position.y > 0.34;
    return movingWithIntent && downwardSwing && releaseZone;
  };

  const shouldReleaseBall = (gesture, wasGrabbing, armedRef, armedAtRef, handData, release) => {
    const now = Date.now();
    const openRelease = gesture === 'OPEN' || (gesture === 'UNKNOWN' && wasGrabbing);
    const withinWindow = now - armedAtRef.current < 950;
    const strongFollowThrough =
      release.speed > 1.45 &&
      (release.peakVelocity.y > 0.62 || release.averagedVelocity.y > 0.34) &&
      handData.position.y > 0.42;

    if (armedRef.current && withinWindow) {
      const hasFollowThrough =
        release.speed > 0.55 ||
        release.peakVelocity.y > 0.35 ||
        release.averagedVelocity.y > 0.18 ||
        handData.position.y > 0.38;

      if (openRelease && hasFollowThrough) {
        armedRef.current = false;
        return true;
      }

      if (gesture !== 'FIST' && strongFollowThrough) {
        armedRef.current = false;
        return true;
      }
    }

    if (gesture === 'OPEN' && !wasGrabbing) {
      armedRef.current = false;
    }

    return false;
  };

  const assignHandsToSides = (detections, pose) => {
    if (detections.length === 0) {
      return { right: null, left: null };
    }

    const hasShoulders = pose.rightShoulder && pose.leftShoulder;

    if (detections.length === 1) {
      const [detection] = detections;

      if (hasShoulders) {
        const rightDistance = distance2D(detection.wrist, pose.rightShoulder);
        const leftDistance = distance2D(detection.wrist, pose.leftShoulder);
        return rightDistance <= leftDistance
          ? { right: detection, left: null }
          : { right: null, left: detection };
      }

      return detection.sourceLabel === 'Right'
        ? { right: detection, left: null }
        : { right: null, left: detection };
    }

    if (hasShoulders) {
      const [first, second] = detections;
      const firstRight = distance2D(first.wrist, pose.rightShoulder);
      const firstLeft = distance2D(first.wrist, pose.leftShoulder);
      const secondRight = distance2D(second.wrist, pose.rightShoulder);
      const secondLeft = distance2D(second.wrist, pose.leftShoulder);

      const directCost = firstRight + secondLeft;
      const swappedCost = firstLeft + secondRight;

      return directCost <= swappedCost
        ? { right: first, left: second }
        : { right: second, left: first };
    }

    const sorted = [...detections].sort((a, b) => a.wrist.x - b.wrist.x);
    return {
      right: sorted[0] || null,
      left: sorted[1] || null,
    };
  };

  const updateTrackedHand = ({
    side,
    handData,
    nextActiveHand,
    nextBallState,
    setNextActiveHand,
    setNextBallState,
    lastGestureRef,
    releaseArmedRef,
    releaseArmedAtRef,
    historyRef,
  }) => {
    if (!handData.present) {
      lastGestureRef.current = 'OPEN';
      releaseArmedRef.current = false;
      if (side === 'right') armedThrowRefRight.current = null;
      if (side === 'left') armedThrowRefLeft.current = null;
      return;
    }

    if (useGameStore.getState().gameStatus !== 'PLAYING') {
      lastGestureRef.current = handData.gesture;
      return;
    }

    const isGrabbing = handData.gesture === 'FIST' || handData.gesture === 'UNKNOWN';
    const wasGrabbing =
      lastGestureRef.current === 'FIST' || lastGestureRef.current === 'UNKNOWN';

    if (nextBallState === 'LOCKED' && isGrabbing && !nextActiveHand) {
      setNextActiveHand(side);
      setNextBallState('HELD');
      setActiveHand(side);
      setBallState('HELD');
      releaseArmedRef.current = false;
      if (side === 'right') armedThrowRefRight.current = null;
      if (side === 'left') armedThrowRefLeft.current = null;
    } else if (isGrabbing && !wasGrabbing && (!nextActiveHand || nextActiveHand === side)) {
      setNextActiveHand(side);
      setNextBallState('HELD');
      setActiveHand(side);
      setBallState('HELD');
      releaseArmedRef.current = false;
      if (side === 'right') armedThrowRefRight.current = null;
      if (side === 'left') armedThrowRefLeft.current = null;
    }

    if (useGameStore.getState().activeHand === side || nextActiveHand === side) {
      const release = getReleaseMetrics(historyRef.current);

      if ((useGameStore.getState().ballState === 'HELD' || nextBallState === 'HELD') && isGrabbing) {
        if (shouldArmRelease(handData, release)) {
          if (!releaseArmedRef.current) {
            releaseArmedRef.current = true;
            releaseArmedAtRef.current = Date.now();
            const snapshot = {
              position: { ...handData.position },
              release: {
                speed: release.speed,
                roll: release.roll,
                averagedVelocity: { ...release.averagedVelocity },
                peakVelocity: { ...release.peakVelocity },
              },
            };

            if (side === 'right') armedThrowRefRight.current = snapshot;
            if (side === 'left') armedThrowRefLeft.current = snapshot;
          }
        } else if (
          releaseArmedRef.current &&
          Date.now() - releaseArmedAtRef.current > 1100 &&
          isGrabbing
        ) {
          releaseArmedRef.current = false;
          if (side === 'right') armedThrowRefRight.current = null;
          if (side === 'left') armedThrowRefLeft.current = null;
        }
      }

      if (
        (useGameStore.getState().ballState === 'HELD' || nextBallState === 'HELD') &&
        shouldReleaseBall(
          handData.gesture,
          wasGrabbing,
          releaseArmedRef,
          releaseArmedAtRef,
          handData,
          release,
        )
      ) {
        executeThrow();
      }
    }

    lastGestureRef.current = handData.gesture;
  };

  const onHandResults = (results) => {
    const currentState = useGameStore.getState();
    const { activeHand, ballState, gameStatus, pose } = currentState;
    let nextActiveHand = activeHand;
    let nextBallState = ballState;

    let rightHandData = defaultHandData;
    let leftHandData = defaultHandData;
    const detections = [];

    if (results.multiHandLandmarks && results.multiHandedness) {
      results.multiHandedness.forEach((handedness, index) => {
        const landmarks = results.multiHandLandmarks[index];
        const label = handedness.label;
        const wrist = landmarks[0];
        const gesture = detectGesture(landmarks);

        detections.push({
          sourceLabel: label,
          wrist: { x: wrist.x, y: wrist.y },
          handData: {
            present: true,
            position: { x: wrist.x, y: wrist.y },
            landmarks,
            speed: 0,
            gesture,
            roll: 0,
          },
        });
      });

      const assignment = assignHandsToSides(detections, pose);

      if (assignment.right) {
        const { speed } = calculateHandPhysics(
          assignment.right.handData.landmarks[0],
          assignment.right.handData.landmarks,
          historyRefRight,
        );
        const release = getReleaseMetrics(historyRefRight.current);
        rightHandData = {
          ...assignment.right.handData,
          speed,
          roll: release.roll,
          release: armedThrowRefRight.current?.release || release,
          releasePosition: armedThrowRefRight.current?.position || null,
        };
      }

      if (assignment.left) {
        const { speed } = calculateHandPhysics(
          assignment.left.handData.landmarks[0],
          assignment.left.handData.landmarks,
          historyRefLeft,
        );
        const release = getReleaseMetrics(historyRefLeft.current);
        leftHandData = {
          ...assignment.left.handData,
          speed,
          roll: release.roll,
          release: armedThrowRefLeft.current?.release || release,
          releasePosition: armedThrowRefLeft.current?.position || null,
        };
      }

      updateTrackedHand({
        side: 'right',
        handData: rightHandData,
        nextActiveHand,
        nextBallState,
        setNextActiveHand: (value) => {
          nextActiveHand = value;
        },
        setNextBallState: (value) => {
          nextBallState = value;
        },
        lastGestureRef: lastGestureRefRight,
        releaseArmedRef: releaseArmedRefRight,
        releaseArmedAtRef: releaseArmedAtRefRight,
        historyRef: historyRefRight,
      });

      updateTrackedHand({
        side: 'left',
        handData: leftHandData,
        nextActiveHand,
        nextBallState,
        setNextActiveHand: (value) => {
          nextActiveHand = value;
        },
        setNextBallState: (value) => {
          nextBallState = value;
        },
        lastGestureRef: lastGestureRefLeft,
        releaseArmedRef: releaseArmedRefLeft,
        releaseArmedAtRef: releaseArmedAtRefLeft,
        historyRef: historyRefLeft,
      });

      const pinScaleLocked = useGameStore.getState().pinScaleLocked;
      if (gameStatus === 'CALIBRATION' && leftHandData.gesture === 'FIST' && !pinScaleLocked) {
        const y = Math.max(0, Math.min(1, leftHandData.position.y));
        const scale = Math.max(BASE_LANE_SCALE, 3 - y);
        updateSettings({ pinScale: scale, ballSize: ballSizeFromLaneScale(scale) });
      }

      if (
        gameStatus === 'CALIBRATION' &&
        rightHandData.gesture === 'FIST' &&
        leftHandData.gesture === 'FIST'
      ) {
        completeCalibration();
      }
    }

    if (gameStatus !== 'PLAYING' || nextBallState !== 'HELD') {
      releaseArmedRefRight.current = false;
      releaseArmedRefLeft.current = false;
      armedThrowRefRight.current = null;
      armedThrowRefLeft.current = null;
    }

    updateHands(rightHandData, leftHandData);
  };

  executeThrowRef.current = executeThrow;
  handResultsRef.current = onHandResults;
  poseResultsRef.current = onPoseResults;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        executeThrowRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="camera-layer">
      <video
        ref={videoRef}
        className="camera-layer__video"
        playsInline
        muted
        autoPlay
      />
    </div>
  );
};

export default HandTracker;
