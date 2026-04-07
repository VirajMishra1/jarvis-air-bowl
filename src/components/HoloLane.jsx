import React, { useMemo, useRef } from 'react';
import { useBox } from '@react-three/cannon';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const HoloBlock = ({ position, args, index }) => {
  const [ref] = useBox(() => ({
    type: 'Static',
    position,
    args,
    material: { friction: 0.1, restitution: 0.5 },
  }));

  const material = useRef();

  useFrame(({ clock }) => {
    if (material.current) {
        // Pulsing effect based on Z position and Time
        const t = clock.getElapsedTime();
        const z = position[2];
        const intensity = (Math.sin(t * 3 + z * 0.5) + 1) * 0.5; // Faster pulse
        material.current.emissiveIntensity = 0.2 + intensity * 2.0;
    }
  });

  return (
    <mesh ref={ref}>
      <boxGeometry args={args} />
      <meshStandardMaterial 
        ref={material}
        color="#110000" 
        emissive="#ff0000"
        emissiveIntensity={1}
        transparent
        opacity={0.8}
        roughness={0.2}
        metalness={0.8}
      />
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...args)]} />
        <lineBasicMaterial color="#ff0000" linewidth={1} opacity={0.5} transparent />
      </lineSegments>
    </mesh>
  );
};

const HoloLane = () => {
  const segments = 20; // More segments for smoother wave
  const length = 30; 
  const segmentLength = length / segments;
  const width = 3;
  const thickness = 0.2;
  const startZ = 2; 
  
  const blocks = useMemo(() => {
    const b = [];
    for (let i = 0; i < segments; i++) {
        const z = startZ - (i * segmentLength) - (segmentLength/2);
        const gap = 0.05; 
        const len = segmentLength - gap;
        
        b.push({
            position: [0, -0.1, z],
            args: [width, thickness, len]
        });
    }
    return b;
  }, []);

  return (
    <group>
      {blocks.map((block, i) => (
        <HoloBlock key={i} index={i} position={block.position} args={block.args} />
      ))}
      
      {/* Neon Rails */}
      <mesh position={[-width/2 - 0.1, 0, -13]}>
          <boxGeometry args={[0.1, 0.1, 30]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={5} />
      </mesh>
      <mesh position={[width/2 + 0.1, 0, -13]}>
          <boxGeometry args={[0.1, 0.1, 30]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={5} />
      </mesh>
      
      {/* Floor Reflection Plane underneath - Remove or make transparent */}
       <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, -13]}>
          <planeGeometry args={[20, 40]} />
          <meshStandardMaterial color="#000000" roughness={0.05} metalness={0.9} transparent opacity={0.2} />
      </mesh>
    </group>
  );
};

export default HoloLane;
