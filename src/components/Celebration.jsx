import { useEffect, useMemo, useRef } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { AdditiveBlending, DoubleSide, MathUtils } from 'three';
import { useFrame } from '@react-three/fiber';
import useGameStore from '../store/gameStore';

const CELEBRATION_DURATION_MS = 1800;

const themeMap = {
  strike: {
    primary: '#25e7ff',
    secondary: '#77fff1',
    accent: '#ff6b4a',
  },
  spare: {
    primary: '#b8ff4f',
    secondary: '#25e7ff',
    accent: '#f4fbff',
  },
};

const Celebration = () => {
  const celebration = useGameStore((state) => state.celebration);
  const dismissCelebration = useGameStore((state) => state.dismissCelebration);

  const rootRef = useRef();
  const panelRef = useRef();
  const flareRef = useRef();
  const ringRefs = useRef([]);
  const beamRefs = useRef([]);
  const startAtRef = useRef(0);

  const theme = themeMap[celebration.type] || themeMap.strike;
  const ringConfig = useMemo(
    () => [
      { radius: 1.3, tube: 0.028, speed: 0.65, offset: 0 },
      { radius: 1.75, tube: 0.024, speed: -0.45, offset: 0.18 },
      { radius: 2.2, tube: 0.018, speed: 0.3, offset: 0.34 },
    ],
    [],
  );

  useEffect(() => {
    if (!celebration.active) {
      return undefined;
    }

    startAtRef.current = performance.now();
    const timer = window.setTimeout(() => dismissCelebration(), CELEBRATION_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [celebration.active, celebration.nonce, dismissCelebration]);

  useFrame(({ clock }) => {
    if (!celebration.active || !rootRef.current) {
      return;
    }

    const elapsedMs = performance.now() - startAtRef.current;
    const progress = MathUtils.clamp(elapsedMs / CELEBRATION_DURATION_MS, 0, 1);
    const intro = MathUtils.smoothstep(progress, 0, 0.16);
    const outro = 1 - MathUtils.smoothstep(progress, 0.72, 1);
    const alpha = intro * outro;
    const pulse = 1 + Math.sin(clock.elapsedTime * 8) * 0.035;

    rootRef.current.position.set(0, 1.7 + intro * 0.4, -9.2);
    rootRef.current.scale.setScalar((0.82 + intro * 0.34) * pulse);

    if (panelRef.current?.material) {
      panelRef.current.material.opacity = 0.08 + alpha * 0.18;
    }

    if (flareRef.current?.material) {
      flareRef.current.material.opacity = alpha * 0.28;
      flareRef.current.rotation.z = clock.elapsedTime * 0.55;
      flareRef.current.scale.setScalar(0.95 + intro * 0.45);
    }

    ringRefs.current.forEach((ring, index) => {
      if (!ring?.material) {
        return;
      }

      const config = ringConfig[index];
      ring.rotation.z = clock.elapsedTime * config.speed;
      ring.scale.setScalar(1 + intro * (0.12 + index * 0.08));
      ring.material.opacity = alpha * (0.32 - index * 0.06);
    });

    beamRefs.current.forEach((beam, index) => {
      if (!beam?.material) {
        return;
      }

      beam.position.y = -0.18 + index * 0.18 + Math.sin(clock.elapsedTime * 4 + index) * 0.03;
      beam.material.opacity = alpha * (0.26 - index * 0.03);
      beam.scale.x = 1 + intro * 0.22;
    });
  });

  if (!celebration.active) {
    return null;
  }

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <group ref={rootRef}>
        <mesh ref={flareRef}>
          <ringGeometry args={[1.45, 2.45, 72]} />
          <meshBasicMaterial
            color={theme.accent}
            transparent
            opacity={0.28}
            blending={AdditiveBlending}
            side={DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <mesh ref={panelRef} position={[0, 0.02, -0.02]}>
          <planeGeometry args={[6.2, 2.15]} />
          <meshBasicMaterial
            color={theme.primary}
            transparent
            opacity={0.18}
            blending={AdditiveBlending}
            side={DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        {ringConfig.map((config, index) => (
          <mesh
            key={`ring-${config.radius}`}
            ref={(node) => {
              ringRefs.current[index] = node;
            }}
            position={[0, 0, 0.04 + index * 0.02]}
          >
            <torusGeometry args={[config.radius, config.tube, 12, 64]} />
            <meshBasicMaterial
              color={index === 1 ? theme.accent : theme.secondary}
              transparent
              opacity={0.22}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}

        {[-1, 1].map((direction, index) => (
          <mesh
            key={`beam-${direction}`}
            ref={(node) => {
              beamRefs.current[index] = node;
            }}
            position={[0, -0.12 + index * 0.18, 0.08]}
            rotation={[0, 0, direction * 0.09]}
          >
            <planeGeometry args={[4.8, 0.06]} />
            <meshBasicMaterial
              color={theme.secondary}
              transparent
              opacity={0.2}
              blending={AdditiveBlending}
              side={DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}

        <Text
          position={[0, 0.1, 0.18]}
          fontSize={0.92}
          letterSpacing={0.09}
          color={theme.primary}
          outlineWidth={0.035}
          outlineColor={theme.accent}
          anchorX="center"
          anchorY="middle"
          material-toneMapped={false}
        >
          {celebration.label}
        </Text>

        <Text
          position={[0, -0.58, 0.18]}
          fontSize={0.26}
          letterSpacing={0.18}
          color={theme.secondary}
          anchorX="center"
          anchorY="middle"
          material-toneMapped={false}
        >
          {`FRAME ${celebration.frame}`}
        </Text>
      </group>
    </Billboard>
  );
};

export default Celebration;
