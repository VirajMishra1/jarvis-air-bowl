import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { Environment, Stars } from '@react-three/drei';
import HoloLane from './HoloLane';
import Pins from './Pins';
import Ball from './Ball';
import Trajectory from './Trajectory';
import HUD from './HUD';
import Calibration from './Calibration';
import Effects from './Effects';
import Particles from './Particles';
import HandTracker from './HandTracker';
import useGameStore from '../store/gameStore';

const PhysicsWorld = () => {
  const calibration = useGameStore((state) => state.calibration);
  const ballSize = useGameStore((state) => state.gameSettings.ballSize);

  return (
    <group
      position={[0, calibration.height, 0]}
      rotation={[calibration.rotationX, 0, 0]}
      scale={calibration.scale}
    >
      <Physics
        gravity={[0, -12, 0]}
        defaultContactMaterial={{ restitution: 0.02, friction: 0.28 }}
      >
        <HoloLane />
        <Pins />
        <Ball key={`ball-${ballSize}`} />
        <Trajectory />
        <Particles />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <shadowMaterial transparent opacity={0.25} />
        </mesh>
      </Physics>
    </group>
  );
};

const GameScene = () => {
  return (
    <div className="scene-shell">
      <div className="scene-shell__backdrop" />
      <HandTracker />
      <HUD />
      <Calibration />
      <div className="scene-shell__canvas">
        <Canvas
          gl={{ alpha: true, antialias: true, stencil: false, depth: true }}
          camera={{ position: [0, 0, 0.01], fov: 75 }}
          shadows
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.2} />
            <pointLight position={[5, 2, 0]} intensity={100} color="#00ffff" distance={15} decay={2} />
            <pointLight position={[-5, 2, -10]} intensity={100} color="#ff00ff" distance={20} decay={2} />
            <spotLight
              position={[0, 10, -5]}
              angle={0.5}
              penumbra={1}
              intensity={200}
              color="#ffffff"
              castShadow
              shadow-bias={-0.0001}
            />
            <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
            <PhysicsWorld />
            <Effects />
            <Environment preset="warehouse" />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
};

export default GameScene;
