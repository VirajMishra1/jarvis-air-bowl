import React, { useEffect, useRef } from 'react';
import { useSphere, useSpring } from '@react-three/cannon';
import useGameStore from '../store/gameStore';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const Ball = () => {
  const ballState = useGameStore(state => state.ballState);
  const gameStatus = useGameStore(state => state.gameStatus);
  const ballVelocity = useGameStore(state => state.ballVelocity);
  const ballSpin = useGameStore(state => state.ballSpin);
  const calibration = useGameStore(state => state.calibration);
  const gameSettings = useGameStore(state => state.gameSettings);
  
  const { camera } = useThree();
  const radius = gameSettings.ballSize;
  
  // 1. The Ball itself
  const [ref, api] = useSphere(() => ({
    mass: 15, // Significantly increased mass for better impact
    position: [0, 0.5, 4], 
    args: [0.3], 
    material: { friction: 0.3, restitution: 0.6 }, 
    allowSleep: false, // Keep awake for better collision detection
  }));

  // Hide ball if HIDDEN state (Calibration)
  // Fix: Check activeHand or position to ensure it's not culled.
  // Always show if not HIDDEN/CALIBRATION.
  const isVisible = ballState !== 'HIDDEN' && gameStatus !== 'CALIBRATION';

  // Helper to project screen coordinate to floor plane OR floating 3D position
  const getHandPosition3D = (normalizedX, normalizedY, handDepth = 0) => {
      // 1. Unproject to find direction vector from camera
      const x = (normalizedX * 2) - 1; 
      const y = -(normalizedY * 2) + 1;
      
      const vector = new THREE.Vector3(x, y, 0.5); // Z is arbitrary for direction
      vector.unproject(camera);
      const dir = vector.sub(camera.position).normalize();
      
      // 2. Decide distance.
      // If camera is at 0,0,0 and looking down -Z.
      // We want ball to be in front of camera.
      // Let's force a safe distance.
      
      const holdDistance = 1.0; // CLOSER: Was 1.5. Now much tighter control.
      
      const pos = camera.position.clone().add(dir.multiplyScalar(holdDistance));
      
      return pos;
  };

  // Helper to project screen coordinate to floor plane (Old Logic - for dropping)
  const getFloorPosition = (normalizedX, normalizedY) => {
      // ... same projection logic ...
      const x = (normalizedX * 2) - 1; 
      const y = -(normalizedY * 2) + 1;
      
      const vector = new THREE.Vector3(-x, y, 0.5);
      vector.unproject(camera);
      const dir = vector.sub(camera.position).normalize();
      const distance = 4;
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));
      
      // Inverse Transform
      pos.y -= calibration.height;
      
      const cos = Math.cos(-calibration.rotationX);
      const sin = Math.sin(-calibration.rotationX);
      const y_ = pos.y * cos - pos.z * sin;
      const z_ = pos.y * sin + pos.z * cos;
      pos.y = y_;
      pos.z = z_;
      
      pos.multiplyScalar(1 / calibration.scale);
      pos.y = Math.max(radius, pos.y); // Floor is radius
      
      return pos;
  };

  // Handle Throw (Transition Logic)
  useEffect(() => {
    if (ballState === 'THROWN') {
      api.wakeUp();
      // Apply the final "Throw Impulse"
      // Direct Velocity Transfer
      api.velocity.set(ballVelocity[0], ballVelocity[1], ballVelocity[2]);
      
      // Apply 3D Spin (Angular Velocity)
      if (Array.isArray(ballSpin)) {
          api.angularVelocity.set(ballSpin[0], ballSpin[1], ballSpin[2]);
      } else {
          // Fallback for old single-value spin (if any legacy code remains)
          api.angularVelocity.set(ballSpin, 0, 0);
      }
      
    } else if (ballState === 'HELD') {
      api.wakeUp(); 
      api.velocity.set(0,0,0);
      api.angularVelocity.set(0,0,0);
    }
  }, [ballState, ballVelocity, ballSpin, api]);

  // Material Ref for pulsing
  const matRef = useRef();
  const innerRef = useRef();
  const coreRef = useRef();

  // Update Hand Position every frame
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Rotate Inner Cores
    if (innerRef.current) {
        innerRef.current.rotation.x = t * 2;
        innerRef.current.rotation.y = t * 1.5;
    }
    if (coreRef.current) {
        coreRef.current.rotation.x = -t * 3;
        coreRef.current.rotation.z = t * 2;
    }

    // Pulse effect
    if (matRef.current) {
        // Faster pulse when thrown
        const speed = ballState === 'THROWN' ? 15 : 2;
        matRef.current.emissiveIntensity = 0.5 + Math.sin(t * speed) * 0.3;
    }

    // SAFETY: Prevent falling through floor
    const currentState = useGameStore.getState().ballState;

    if (currentState === 'THROWN') {
        // 1. Initial Launch Safety (First 500ms)
        // Force Y > radius + 0.1 to ensure it doesn't clip through floor immediately
        // HARD CLAMP for first few frames if needed, but velocity should handle it.
        
        // 2. Fall Safety (Reset if fell through)
        if (ref.current) {
            // Hard Floor Clamp for visual stability?
            // No, let physics handle bounces. Just check abyss.
            
            // ANTI-TUNNELING:
            // Floor surface is at Y=0. Ball radius is 0.3.
            // If ball center is < 0.25, it is sinking.
            // If ball center is < -1.0, it fell through the 2-unit thick floor.
            if (ref.current.position.y < 0.25 && ref.current.position.y > -5) {
                 // Push up gently to correct tunneling
                 api.applyForce([0, 100, 0], [0, 0, 0]); // Stronger correction
                 // Also reset velocity Y if it's plummeting
                 api.velocity.subscribe((v) => {
                     if (v[1] < -1) api.velocity.set(v[0], 0, v[2]);
                 })();
            }

            if (ref.current.position.y < -5) {
                console.log("BALL FELL THROUGH WORLD - RESETTING");
                api.position.set(0, 0.5, 0);
                api.velocity.set(0,0,0);
            }
        }
    }

    if (currentState === 'HELD' || currentState === 'LOCKED') {
        // Read transient state directly from store to avoid re-renders
        const { activeHand, rightHand, leftHand } = useGameStore.getState();
        
        let hand = null;
        if (activeHand === 'right') hand = rightHand;
        if (activeHand === 'left') hand = leftHand;

        // DIRECT CONTROL:
        // If LOCKED, keep at start.
        // If HELD and we have a hand, stick to it exactly.
        
        if (currentState === 'LOCKED') {
             api.position.set(0, 0.5, 4);
             api.velocity.set(0,0,0);
             api.angularVelocity.set(0,0,0);
        }
        else if (activeHand && hand && hand.present && currentState === 'HELD') {
            let x = hand.position.x;
            let y = hand.position.y;
            
            // Calculate Palm Center / Fingertip
            // MODIFIED: Use Index Finger Tip (Landmark 8) for "Fingertip" feel
            if (hand.landmarks && hand.landmarks[8]) {
                const p8 = hand.landmarks[8]; // Index Tip
                x = p8.x;
                y = p8.y;
            }
            else if (hand.landmarks && hand.landmarks[0] && hand.landmarks[9]) {
                const p0 = hand.landmarks[0];
                const p9 = hand.landmarks[9];
                x = (p0.x + p9.x) / 2;
                y = (p0.y + p9.y) / 2;
            }

            // USE NEW 3D HOLD LOGIC
            // Note: MediaPipe X is mirrored if using scaleX(-1), but here we get raw normalized coords [0,1].
            // Three.js world is not mirrored.
            // If the video is mirrored via CSS, visually left is right.
            // But the normalized coords are from the source image.
            // If we want it to match the visual mirrored video, we need to flip X?
            // Let's try direct first.
            
            // Actually, if we use getFloorPosition, we were flipping X in there: (normalizedX * 2) - 1 => -x.
            // Let's use the new function which respects camera unproject.
            
            // FLIP X because of CSS mirror
            const visualX = 1 - x; 
            
            const targetPos = getHandPosition3D(visualX, y);
            
            // PREVENT FLOOR CLIPPING
            // Clamp Y to be at least radius + 0.2 (Safety Margin)
            const minY = radius + 0.2;
            if (targetPos.y < minY) targetPos.y = minY;
            
            // DIRECT TELEPORT - No Physics Lag
            // LERP for elegance: Soften the movement slightly to reduce jitter
            // But keep it responsive. 0.8 blend factor.
            const currentPos = new THREE.Vector3(api.position.x, api.position.y, api.position.z); // This won't work, api doesn't expose current value like this directly in loop easily without subscription.
            // Just stick to direct set for now to ensure 1:1 mapping, as requested "closer to hand".
            
            api.position.set(targetPos.x, targetPos.y, targetPos.z);
            api.velocity.set(0,0,0); 
            api.angularVelocity.set(0,0,0);
        }
    }
  });

  return (
    <group ref={ref} visible={isVisible}>
        {/* Layer 1: Inner Wireframe Tech Core (Dodecahedron) */}
        <mesh ref={innerRef}>
            <dodecahedronGeometry args={[radius * 0.7, 0]} />
            <meshBasicMaterial color="#00ffff" wireframe wireframeLinewidth={5} />
        </mesh>

        {/* Layer 2: Solid Middle Core (Octahedron) - Force Depth */}
        <mesh ref={coreRef}>
             <octahedronGeometry args={[radius * 0.4, 0]} />
             <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Layer 3: Outer Faceted Glass Shell (Icosahedron) */}
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
                thickness={2.0}
                ior={2.5}
                clearcoat={1}
                flatShading={true} 
            />
        </mesh>
        
        {/* DEBUG FALLBACK: Giant Yellow Wireframe if invisible */}
        <mesh>
             <sphereGeometry args={[radius * 1.1, 8, 8]} />
             <meshBasicMaterial color="yellow" wireframe />
        </mesh>

        {/* Internal Light Source */}
        <pointLight color="#ff0000" intensity={5} distance={3} decay={2} />
    </group>
  );
};

export default Ball;
