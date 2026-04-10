import { useEffect, useRef } from 'react';
import { useSphere } from '@react-three/cannon';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { LANE_START_Z, laneRestY } from '../lib/bowlingPhysics';

const Ball = () => {
  const ballState = useGameStore((state) => state.ballState);
  const gameStatus = useGameStore((state) => state.gameStatus);
  const ballPosition = useGameStore((state) => state.ballPosition);
  const ballVelocity = useGameStore((state) => state.ballVelocity);
  const ballSpin = useGameStore((state) => state.ballSpin);
  const gameSettings = useGameStore((state) => state.gameSettings);

  const { camera } = useThree();
  const radius = gameSettings.ballSize;
  const [ref, api] = useSphere(() => ({
    mass: 13.5,
    position: [0, laneRestY(radius), LANE_START_Z],
    args: [radius],
    material: { friction: 0.5, restitution: 0.015 },
    linearDamping: 0.22,
    angularDamping: 0.28,
    allowSleep: false,
  }));

  const matRef = useRef();
  const innerRef = useRef();
  const coreRef = useRef();
  const smoothedTargetRef = useRef(new THREE.Vector3(0, laneRestY(radius), LANE_START_Z));
  const velocityRef = useRef([0, 0, 0]);
  const angularVelocityRef = useRef([0, 0, 0]);
  const isVisible = gameStatus === 'CALIBRATION' || ballState !== 'HIDDEN';

  const getHandPosition3D = (normalizedX, normalizedY) => {
    const x = normalizedX * 2 - 1;
    const y = -(normalizedY * 2) + 1;
    const vector = new THREE.Vector3(x, y, 0.5);
    vector.unproject(camera);
    const direction = vector.sub(camera.position).normalize();
    return camera.position.clone().add(direction.multiplyScalar(1.1));
  };

  useEffect(() => {
    const unsubscribeVelocity = api.velocity.subscribe((value) => {
      velocityRef.current = value;
    });
    const unsubscribeAngularVelocity = api.angularVelocity.subscribe((value) => {
      angularVelocityRef.current = value;
    });

    return () => {
      unsubscribeVelocity();
      unsubscribeAngularVelocity();
    };
  }, [api]);

  useEffect(() => {
    if (ballState === 'THROWN') {
      api.wakeUp();
      api.position.set(ballPosition[0], ballPosition[1], ballPosition[2]);
      api.velocity.set(ballVelocity[0], ballVelocity[1], ballVelocity[2]);

      if (Array.isArray(ballSpin)) {
        api.angularVelocity.set(ballSpin[0], ballSpin[1], ballSpin[2]);
      } else {
        api.angularVelocity.set(ballSpin, 0, 0);
      }
    } else if (ballState === 'HELD') {
      api.wakeUp();
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);
    }
  }, [api, ballPosition, ballSpin, ballState, ballVelocity]);

  const placeBallOnLane = (floatOffset = 0) => {
    const y = laneRestY(radius) + floatOffset;
    smoothedTargetRef.current.set(0, y, LANE_START_Z);
    api.position.set(0, y, LANE_START_Z);
    api.velocity.set(0, 0, 0);
    api.angularVelocity.set(0, 0, 0);
  };

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    if (innerRef.current) {
      innerRef.current.rotation.x = elapsed * 2;
      innerRef.current.rotation.y = elapsed * 1.5;
    }

    if (coreRef.current) {
      coreRef.current.rotation.x = -elapsed * 3;
      coreRef.current.rotation.z = elapsed * 2;
    }

    if (matRef.current) {
      const speed = ballState === 'THROWN' ? 15 : 2;
      matRef.current.emissiveIntensity = 0.5 + Math.sin(elapsed * speed) * 0.3;
    }

    const currentState = useGameStore.getState().ballState;

    if (gameStatus === 'CALIBRATION') {
      placeBallOnLane(Math.sin(elapsed * 1.8) * 0.03);
      return;
    }

    if (currentState === 'THROWN' && ref.current) {
      if (ref.current.position.y < -5) {
        placeBallOnLane();
      } else {
        const forwardSpeed = Math.max(0, -velocityRef.current[2]);
        const hookSpin = angularVelocityRef.current[1];
        const contactBlend = THREE.MathUtils.clamp(
          1 - Math.abs(ref.current.position.y - laneRestY(radius)) / 0.35,
          0,
          1,
        );

        if (forwardSpeed > 10 && Math.abs(hookSpin) > 0.15 && ref.current.position.z < -3) {
          const hookForce = THREE.MathUtils.clamp(hookSpin * forwardSpeed * 0.018, -3.2, 3.2);
          api.applyForce([hookForce * contactBlend, 0, 0], [0, 0, 0]);
        }
      }
    }

    if (currentState === 'HELD' || currentState === 'LOCKED') {
      const { activeHand, rightHand, leftHand } = useGameStore.getState();

      let hand = null;
      if (activeHand === 'right') hand = rightHand;
      if (activeHand === 'left') hand = leftHand;

      if (currentState === 'LOCKED') {
        placeBallOnLane();
      } else if (activeHand && hand?.present) {
        let x = hand.position.x;
        let y = hand.position.y;

        if (hand.landmarks?.[8]) {
          x = hand.landmarks[8].x;
          y = hand.landmarks[8].y;
        } else if (hand.landmarks?.[0] && hand.landmarks?.[9]) {
          x = (hand.landmarks[0].x + hand.landmarks[9].x) / 2;
          y = (hand.landmarks[0].y + hand.landmarks[9].y) / 2;
        }

        const targetPos = getHandPosition3D(1 - x, y);
        targetPos.y = Math.max(radius + 0.15, targetPos.y);
        if (smoothedTargetRef.current.distanceToSquared(targetPos) > 0.6) {
          smoothedTargetRef.current.copy(targetPos);
        } else {
          smoothedTargetRef.current.lerp(targetPos, 0.38);
        }

        api.position.set(
          smoothedTargetRef.current.x,
          smoothedTargetRef.current.y,
          smoothedTargetRef.current.z,
        );
        api.velocity.set(0, 0, 0);
        api.angularVelocity.set(0, 0, 0);
      } else {
        placeBallOnLane();
      }
    }
  });

  return (
    <group ref={ref} visible={isVisible}>
      <mesh ref={innerRef}>
        <dodecahedronGeometry args={[radius * 0.7, 0]} />
        <meshBasicMaterial color="#00ffff" wireframe wireframeLinewidth={5} />
      </mesh>

      <mesh ref={coreRef}>
        <octahedronGeometry args={[radius * 0.4, 0]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      <mesh castShadow receiveShadow>
        <icosahedronGeometry args={[radius * 1.05, 1]} />
        <meshPhysicalMaterial
          ref={matRef}
          color="#ff0000"
          emissive="#ff0000"
          emissiveIntensity={0.8}
          roughness={0.1}
          metalness={0.9}
          transmission={0.2}
          thickness={2}
          ior={2.5}
          clearcoat={1}
          clearcoatRoughness={0.05}
          transparent
          opacity={0.95}
        />
      </mesh>
    </group>
  );
};

export default Ball;
