import { useEffect, useMemo, useRef } from 'react';
import { useCylinder } from '@react-three/cannon';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';

const EventPin = ({ pinId, position, scale = 1 }) => {
  const [ref, api] = useCylinder(() => ({
    mass: 2 * scale,
    position,
    args: [0.12 * scale, 0.12 * scale, 0.52 * scale, 8],
    material: { friction: 0.1, restitution: 0.1 },
    allowSleep: true,
    sleepSpeedLimit: 0.5,
    sleepTimeLimit: 1,
    onCollide: (event) => {
      if (event.contact.impactVelocity > 1.5) {
        const { contactPoint } = event.contact;
        document.dispatchEvent(
          new CustomEvent('EXPLOSION', {
            detail: {
              position: [contactPoint[0], contactPoint[1], contactPoint[2]],
              color: '#00ffff',
            },
          }),
        );
      }
    },
  }));

  const rotation = useRef([0, 0, 0, 1]);
  const currentPosition = useRef(position);
  const velocity = useRef([0, 0, 0]);
  const angularVelocity = useRef([0, 0, 0]);

  useEffect(() => {
    const unsubscribeQuaternion = api.quaternion.subscribe((q) => (rotation.current = q));
    const unsubscribePosition = api.position.subscribe((nextPosition) => (currentPosition.current = nextPosition));
    const unsubscribeVelocity = api.velocity.subscribe((nextVelocity) => (velocity.current = nextVelocity));
    const unsubscribeAngularVelocity = api.angularVelocity.subscribe(
      (nextAngularVelocity) => (angularVelocity.current = nextAngularVelocity),
    );

    return () => {
      unsubscribeQuaternion();
      unsubscribePosition();
      unsubscribeVelocity();
      unsubscribeAngularVelocity();
    };
  }, [api]);

  useEffect(() => {
    const handler = () => {
      const [qx, , qz] = rotation.current;
      const upY = 1 - 2 * (qx * qx + qz * qz);
      const [x, y, z] = currentPosition.current;
      const lateralOffset = Math.hypot(x - position[0], z - position[2]);
      const linearSpeed = Math.hypot(...velocity.current);
      const spinSpeed = Math.hypot(...angularVelocity.current);
      const hasDropped = y < position[1] * 0.72;
      const hasSlidAndLeaning = lateralOffset > 0.28 * scale && upY < 0.93;
      const isDown = upY < 0.82 || hasDropped || hasSlidAndLeaning;
      const settled = linearSpeed < 0.16 && spinSpeed < 0.35;

      document.dispatchEvent(
        new CustomEvent('PIN_RESULT', {
          detail: { pinId, isDown, settled },
        }),
      );
    };

    document.addEventListener('CHECK_PINS', handler);
    return () => document.removeEventListener('CHECK_PINS', handler);
  }, [pinId, position, scale]);

  const pinGeometry = useMemo(() => {
    const points = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.06 * scale, 0),
      new THREE.Vector2(0.08 * scale, 0.1 * scale),
      new THREE.Vector2(0.04 * scale, 0.25 * scale),
      new THREE.Vector2(0.05 * scale, 0.35 * scale),
      new THREE.Vector2(0.02 * scale, 0.4 * scale),
      new THREE.Vector2(0, 0.4 * scale),
    ];

    const geometry = new THREE.LatheGeometry(points, 16);
    geometry.center();
    return geometry;
  }, [scale]);

  return (
    <mesh ref={ref} castShadow receiveShadow geometry={pinGeometry}>
      <meshPhysicalMaterial
        color="#ff0000"
        emissive="#440000"
        emissiveIntensity={0.2}
        roughness={0.1}
        metalness={0.9}
        clearcoat={1}
        clearcoatRoughness={0.1}
      />
      <lineSegments>
        <wireframeGeometry args={[pinGeometry]} />
        <lineBasicMaterial color="#ffffff" opacity={0.5} transparent linewidth={2} />
      </lineSegments>
    </mesh>
  );
};

const ScoreManager = ({ visiblePinIds, onScore }) => {
  const gameStatus = useGameStore((state) => state.gameStatus);

  useEffect(() => {
    if (gameStatus !== 'THROWN') {
      return undefined;
    }

    if (visiblePinIds.length === 0) {
      onScore([]);
      return undefined;
    }

    const visiblePinSet = new Set(visiblePinIds);
    let currentResults = new Map();
    let attempts = 0;
    let initialTimer = 0;
    let nextTimer = 0;
    let finished = false;

    const dispatchCheck = () => {
      if (finished) {
        return;
      }
      currentResults = new Map();
      document.dispatchEvent(new CustomEvent('CHECK_PINS'));
    };

    const finalizeRoll = () => {
      if (finished) {
        return;
      }

      finished = true;
      if (nextTimer) {
        window.clearTimeout(nextTimer);
      }

      const knockedPinIds = [...currentResults.values()]
        .filter((entry) => entry.isDown)
        .map((entry) => entry.pinId);

      onScore(knockedPinIds);
    };

    const resultHandler = (event) => {
      const { pinId } = event.detail;
      if (!visiblePinSet.has(pinId) || finished) {
        return;
      }

      currentResults.set(pinId, event.detail);

      if (currentResults.size !== visiblePinIds.length) {
        return;
      }

      attempts += 1;
      const results = [...currentResults.values()];
      const everyoneSettled = results.every((entry) => entry.settled);

      if (everyoneSettled || attempts >= 6) {
        finalizeRoll();
        return;
      }

      nextTimer = window.setTimeout(dispatchCheck, 220);
    };

    document.addEventListener('PIN_RESULT', resultHandler);
    initialTimer = window.setTimeout(dispatchCheck, 3200);

    return () => {
      finished = true;
      if (initialTimer) {
        window.clearTimeout(initialTimer);
      }
      if (nextTimer) {
        window.clearTimeout(nextTimer);
      }
      document.removeEventListener('PIN_RESULT', resultHandler);
    };
  }, [gameStatus, onScore, visiblePinIds]);

  return null;
};

const Pins = () => {
  const scale = useGameStore((state) => state.gameSettings.pinScale);
  const standingPinIds = useGameStore((state) => state.standingPinIds);
  const pinRackId = useGameStore((state) => state.pinRackId);
  const recordRoll = useGameStore((state) => state.recordRoll);

  const startZ = -18;
  const spacingX = 0.4 * scale;
  const spacingZ = 0.4 * scale;

  const pins = useMemo(() => {
    const values = [];
    let pinId = 0;

    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column <= row; column += 1) {
        const x = (column - row / 2) * spacingX;
        const z = startZ - row * spacingZ;
        const y = (0.52 * scale) / 2;

        values.push({ pinId, position: [x, y, z] });
        pinId += 1;
      }
    }

    return values;
  }, [scale, spacingX, spacingZ, startZ]);

  const standingPinSet = useMemo(() => new Set(standingPinIds), [standingPinIds]);
  const visiblePins = useMemo(
    () => pins.filter((pin) => standingPinSet.has(pin.pinId)),
    [pins, standingPinSet],
  );

  return (
    <group key={`${pinRackId}-${scale}`}>
      {visiblePins.map((pin) => (
        <EventPin
          key={`${pin.pinId}-${pinRackId}-${scale}`}
          pinId={pin.pinId}
          position={pin.position}
          scale={scale}
        />
      ))}
      <ScoreManager visiblePinIds={visiblePins.map((pin) => pin.pinId)} onScore={recordRoll} />
    </group>
  );
};

export default Pins;
