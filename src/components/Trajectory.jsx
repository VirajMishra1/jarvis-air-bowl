import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';
import { buildTrajectorySamples } from '../lib/bowlingPhysics';

const Trajectory = () => {
  const ballState = useGameStore((state) => state.ballState);
  const rightHand = useGameStore((state) => state.rightHand);
  const leftHand = useGameStore((state) => state.leftHand);
  const activeHand = useGameStore((state) => state.activeHand);
  const ballSize = useGameStore((state) => state.gameSettings.ballSize);
  const lineRef = useRef();
  const glowRef = useRef();

  const geometry = useMemo(() => {
    const points = new Array(24).fill(0).map(() => new THREE.Vector3());
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  useFrame(() => {
    const hand = activeHand === 'left' ? leftHand : rightHand;

    if (ballState === 'HELD' && hand.present && lineRef.current) {
      const previewPosition = hand.releasePosition || hand.position;
      const points = buildTrajectorySamples(
        previewPosition,
        hand.release || {
          speed: Math.max(hand.speed || 0, 1),
          roll: hand.roll || 0,
          averagedVelocity: { x: 0, y: 0.2, z: 0.1 },
          peakVelocity: { x: 0, y: 0.35, z: 0.15 },
        },
        ballSize,
        24,
      ).map(([x, y, z]) => new THREE.Vector3(x, y, z));

      lineRef.current.geometry.setFromPoints(points);
      lineRef.current.visible = true;

      if (glowRef.current) {
        glowRef.current.geometry.setFromPoints(points);
        glowRef.current.visible = true;
      }
    } else if (lineRef.current) {
      lineRef.current.visible = false;
      if (glowRef.current) {
        glowRef.current.visible = false;
      }
    }
  });

  return (
    <group>
      <line ref={glowRef}>
        <primitive object={geometry.clone()} attach="geometry" />
        <lineBasicMaterial color="#25e7ff" opacity={0.22} transparent linewidth={6} />
      </line>
      <line ref={lineRef}>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial color="#77fff1" opacity={0.88} transparent />
      </line>
    </group>
  );
};

export default Trajectory;
