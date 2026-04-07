import React from 'react';
import { useBox } from '@react-three/cannon';
import { useFrame } from '@react-three/fiber';

const Lane = () => {
  const [ref] = useBox(() => ({
    type: 'Static',
    position: [0, -1.0, -10], // Moved down to accommodate thickness
    args: [3, 2.0, 25], // THICK FLOOR: Height 2.0 instead of 0.2
    material: {
      friction: 0.1,
      restitution: 0.5,
    },
  }));

  // Tron Grid Animation
  const gridRef = React.useRef();
  useFrame((state) => {
      if (gridRef.current) {
          // Move grid backwards to simulate speed/flow
          gridRef.current.position.z = -10 + (state.clock.getElapsedTime() % 1) * 2;
      }
  });

  return (
    <group>
        {/* Physical Lane (Invisible or bedrock) */}
        <mesh ref={ref}>
            <boxGeometry args={[3, 2.0, 25]} />
            <meshStandardMaterial color="#050505" roughness={0.1} metalness={0.9} />
        </mesh>
        
        {/* Glowing Floor Reflection */}
        <mesh position={[0, 0.01, -10]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3, 25]} />
            <meshBasicMaterial color="#000000" opacity={0.8} transparent />
        </mesh>

        {/* Animated Tron Grid */}
        <gridHelper 
            ref={gridRef}
            position={[0, 0.02, -10]} 
            args={[3, 25]} 
            rotation={[0, 0, 0]}
        >
             <lineBasicMaterial attach="material" color="#00ffff" transparent opacity={0.2} />
        </gridHelper>
        
        {/* Neon Edges */}
        <mesh position={[-1.5, 0.05, -10]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 25, 8]} />
            <meshBasicMaterial color="#ff00ff" />
        </mesh>
        <mesh position={[1.5, 0.05, -10]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 25, 8]} />
            <meshBasicMaterial color="#ff00ff" />
        </mesh>
        
        {/* Center Line */}
        <mesh position={[0, 0.02, -10]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.05, 25]} />
            <meshBasicMaterial color="#00ffff" opacity={0.5} transparent />
        </mesh>
    </group>
  );
};

export default Lane;
