import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { OrbitControls, Stars, Environment } from '@react-three/drei';
import Lane from './Lane';
import HoloLane from './HoloLane';
import Pins from './Pins';
import Ball from './Ball';
import Trajectory from './Trajectory';
import HandTracker from './HandTracker';
import HUD from './HUD';
import Calibration from './Calibration';
import Effects from './Effects';
import Particles from './Particles';
import useGameStore from '../store/gameStore';

const PhysicsWorld = () => {
    const { calibration } = useGameStore();
    
    // Apply calibration transform to the entire world
    return (
        <group 
            position={[0, calibration.height, 0]} 
            rotation={[calibration.rotationX, 0, 0]}
            scale={calibration.scale}
        >
            <Physics 
                gravity={[0, -12, 0]} // Slightly stronger gravity for "heavy" feel
                defaultContactMaterial={{ restitution: 0.3, friction: 0.1 }}
            >
              <HoloLane />
              <Pins />
              <Ball />
              <Trajectory />
              <Particles />
              {/* Shadow Plane for Realism - Make invisible but receive shadows */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                  <planeGeometry args={[100, 100]} />
                  <shadowMaterial transparent opacity={0.4} />
              </mesh>
            </Physics>
        </group>
    );
};

const GameScene = () => {
  return (
    <>
      <HandTracker />
      <HUD />
      <Calibration />
      <div style={{ width: '100vw', height: '100vh', background: 'transparent' }}>
        <Canvas 
            gl={{ alpha: true, antialias: true, stencil: false, depth: true }} 
            camera={{ position: [0, 0, 0], fov: 75 }} // Camera at origin (user eye/webcam)
            shadows
            dpr={[1, 2]}
        >
          {/* Transparent background for Mixed Reality */}
          
          <Suspense fallback={null}>
            {/* High Contrast Neon Lighting */}
            <ambientLight intensity={0.2} /> {/* Darker ambient for contrast */}
            
            {/* Key Light (Cyan) */}
            <pointLight position={[5, 2, 0]} intensity={100} color="#00ffff" distance={15} decay={2} />
            
            {/* Fill Light (Magenta) */}
            <pointLight position={[-5, 2, -10]} intensity={100} color="#ff00ff" distance={20} decay={2} />
            
            {/* Rim Light (White/Blue) */}
            <spotLight 
                position={[0, 10, -5]} 
                angle={0.5} 
                penumbra={1} 
                intensity={200} 
                color="#ffffff" 
                castShadow 
                shadow-bias={-0.0001}
            />

            {/* Minimal Stars for atmosphere, but sparse enough to see room */}
            <Stars radius={100} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />

            <PhysicsWorld />
            
            <Effects />
            <Environment preset="warehouse" />
          </Suspense>
        </Canvas>
      </div>
    </>
  );
};

export default GameScene;
