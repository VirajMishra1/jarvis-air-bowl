import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useCylinder } from '@react-three/cannon';
import * as THREE from 'three';
import useGameStore from '../store/gameStore';

// Individual Pin Component
const EventPin = ({ position, scale = 1.0 }) => {
  const [ref, api] = useCylinder(() => ({
    mass: 2.0 * scale, 
    position,
    args: [0.12 * scale, 0.12 * scale, 0.52 * scale, 8], 
    material: { friction: 0.1, restitution: 0.1 },
    allowSleep: true,
    sleepSpeedLimit: 0.5,
    sleepTimeLimit: 1,
    onCollide: (e) => {
        // Trigger explosion on impact
        if (e.contact.impactVelocity > 1.5) {
             const { contactPoint } = e.contact;
             // Dispatch event for Particles.jsx
             document.dispatchEvent(new CustomEvent('EXPLOSION', { 
                 detail: { 
                     position: [contactPoint[0], contactPoint[1], contactPoint[2]],
                     color: '#00ffff'
                 } 
             }));
        }
    }
  }));

  const rotation = useRef([0, 0, 0, 1]);
  useEffect(() => api.quaternion.subscribe(q => rotation.current = q), [api]);

  useEffect(() => {
    const handler = () => {
      // Check tilt: Transform (0,1,0) by Q.
      const q = rotation.current;
      const qx = q[0], qy = q[1], qz = q[2], qw = q[3]; // Cannon quaternions are [x, y, z, w]
      
      // y component of the rotated up vector
      // Formula for transforming vector (0,1,0) by quaternion:
      // vy = 1 - 2(x^2 + z^2)
      const upY = 1 - 2 * (qx * qx + qz * qz);
      
      // If upY < cos(45deg) = 0.707, then it's tipped > 45 deg.
      // If upY is negative, it's upside down.
      // We count it as DOWN if it's tipped more than 45 degrees OR if it fell off the lane (y < -0.5)
      
      // We need position to check if it fell off
      // Since we don't track position here easily without subscription, let's rely on tilt.
      // But a pin standing upright on the floor below the lane should count as down?
      // For now, tilt check is robust enough for "knocked over".
      
      const isDown = upY < 0.707;
      
      console.log(`Pin Check: upY=${upY.toFixed(2)}, isDown=${isDown}`);
      
      document.dispatchEvent(new CustomEvent('PIN_RESULT', { detail: { isDown } }));
    };

    document.addEventListener('CHECK_PINS', handler);
    return () => document.removeEventListener('CHECK_PINS', handler);
  }, []);

  // Pin Shape Generator
  const pinGeometry = useMemo(() => {
      const points = [];
      // Approximate Bowling Pin Profile
      points.push(new THREE.Vector2(0, 0)); // Bottom Center
      points.push(new THREE.Vector2(0.06 * scale, 0)); // Base Radius
      points.push(new THREE.Vector2(0.08 * scale, 0.1 * scale)); // Widest bottom
      points.push(new THREE.Vector2(0.04 * scale, 0.25 * scale)); // Neck
      points.push(new THREE.Vector2(0.05 * scale, 0.35 * scale)); // Head bottom
      points.push(new THREE.Vector2(0.02 * scale, 0.4 * scale)); // Head top
      points.push(new THREE.Vector2(0, 0.4 * scale)); // Top Center
      
      const geo = new THREE.LatheGeometry(points, 16);
      geo.center(); // Center the geometry for physics
      return geo;
  }, [scale]); // Re-create if scale changes

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
      {/* Wireframe overlay for Tech look */}
      <lineSegments>
          <wireframeGeometry args={[pinGeometry]} />
          <lineBasicMaterial color="#ffffff" opacity={0.5} transparent linewidth={2} />
      </lineSegments>
    </mesh>
  );
};

// Manager to handle scoring logic
const ScoreManager = ({ onScore }) => {
  const gameStatus = useGameStore(state => state.gameStatus);

  // Trigger check after 5 seconds
  useEffect(() => {
    if (gameStatus === 'THROWN') {
      const timer = setTimeout(() => {
        document.dispatchEvent(new CustomEvent('CHECK_PINS'));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [gameStatus]);

  // Aggregate results
  useEffect(() => {
    let results = [];
    
    const resultHandler = (e) => {
      const isDown = e.detail.isDown;
      results.push(isDown);
      
      if (results.length === 10) {
        const score = results.filter(r => r).length;
        onScore(score);
        results = []; // Reset for safety
      }
    };

    const checkHandler = () => {
      results = [];
    };

    document.addEventListener('CHECK_PINS', checkHandler);
    document.addEventListener('PIN_RESULT', resultHandler);

    return () => {
      document.removeEventListener('CHECK_PINS', checkHandler);
      document.removeEventListener('PIN_RESULT', resultHandler);
    };
  }, [onScore]);

  return null;
};

// Main Pins Container
const Pins = () => {
  const startZ = -18;
  const { gameSettings, roundId } = useGameStore();
  const scale = gameSettings.pinScale;
  
  const spacingX = 0.4 * scale; 
  const spacingZ = 0.4 * scale;

  const positions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < 4; i++) { 
      for (let j = 0; j <= i; j++) {
        const x = (j - i / 2) * spacingX;
        const z = startZ - (i * spacingZ);
        
        // Grounding Logic:
        // Height of pin is 0.52 * scale.
        // Center is at height/2.
        const y = (0.52 * scale) / 2;
        
        pos.push([x, y, z]);
      }
    }
    return pos;
  }, [spacingX, spacingZ, scale]); // Ensure scale is dependency

  const setScore = useGameStore(state => state.setScore);
  const nextRound = useGameStore(state => state.nextRound);

  const handleScore = (count) => {
    setScore(count);
    // Auto reset after 3 seconds
    setTimeout(() => {
        nextRound();
    }, 3000);
  };
  
  return (
    <group key={roundId}>
      {positions.map((pos, i) => (
        <EventPin key={`${i}-${scale}-${roundId}`} position={pos} scale={scale} />
      ))}
      <ScoreManager onScore={handleScore} />
    </group>
  );
};

export default Pins;
