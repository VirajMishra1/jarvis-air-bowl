import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ParticleBurst = ({ position, color = '#ff0000', count = 20, onComplete }) => {
  const mesh = useRef();
  
  // Create random velocities
  const particles = useMemo(() => {
    const data = [];
    for(let i=0; i<count; i++) {
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      data.push({ 
        velocity, 
        position: new THREE.Vector3(0,0,0),
        scale: Math.random() * 0.5 + 0.2,
        life: 1.0
      });
    }
    return data;
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    
    let alive = false;
    
    particles.forEach((p, i) => {
      if (p.life > 0) {
        alive = true;
        p.life -= delta * 2; // Fade out speed
        p.position.addScaledVector(p.velocity, delta);
        p.velocity.y -= delta * 5; // Gravity
        
        dummy.position.copy(p.position);
        dummy.scale.setScalar(p.scale * p.life);
        dummy.rotation.x += delta * p.velocity.x;
        dummy.rotation.y += delta * p.velocity.z;
        dummy.updateMatrix();
        
        mesh.current.setMatrixAt(i, dummy.matrix);
      } else {
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          mesh.current.setMatrixAt(i, dummy.matrix);
      }
    });
    
    mesh.current.instanceMatrix.needsUpdate = true;
    
    if (!alive && onComplete) {
        onComplete();
    }
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} position={position}>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  );
};

const Particles = () => {
    const [bursts, setBursts] = useState([]);
    
    useEffect(() => {
        const handleExplosion = (e) => {
            const { position, color } = e.detail;
            const id = Date.now() + Math.random();
            setBursts(prev => [...prev, { id, position, color }]);
        };
        
        document.addEventListener('EXPLOSION', handleExplosion);
        return () => document.removeEventListener('EXPLOSION', handleExplosion);
    }, []);
    
    const removeBurst = (id) => {
        setBursts(prev => prev.filter(b => b.id !== id));
    };

    return (
        <group>
            {bursts.map(b => (
                <ParticleBurst 
                    key={b.id} 
                    position={b.position} 
                    color={b.color} 
                    onComplete={() => removeBurst(b.id)} 
                />
            ))}
        </group>
    );
};

export default Particles;
