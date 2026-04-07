import React, { useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import useGameStore from '../store/gameStore';
import * as THREE from 'three';

const Trajectory = () => {
  const { ballState, rightHand } = useGameStore();
  const lineRef = useRef();

  // Create geometry once
  const points = new Array(20).fill(0).map(() => new THREE.Vector3());
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  useFrame(() => {
    if (ballState === 'HELD' && rightHand.present && lineRef.current) {
        // Calculate guide line
        // Forward (Z) is dominant.
        // We match the physics logic in HandTracker:
        // sideForce = -peak.x * 15
        // forwardForce = ~30 to 80
        // Ratio side/forward ~ 15/50 ~ 0.3 * peak.x
        
        // Let's assume a standard forward throw
        const x = (rightHand.position.x * 2 - 1) * -1 * 2; // World X (approx)
        
        const start = new THREE.Vector3(x, 0.5, 4);
        
        // SYNC WITH HANDTRACKER PHYSICS:
        // 1. Replicate Force Calculation
        const handX = x;
        const aimX = -handX * 2.0; 
        
        // Assume stationary throw (aiming only) -> peak.x = 0
        const velocitySteer = 0; 
        const aimSteer = aimX * 2; 
        const sideForce = velocitySteer + aimSteer;
        
        // Assume average strong throw
        const forwardForce = 50; 
        
        // 2. Calculate Landing Spot
        // Velocity Ratio = Displacement Ratio
        // vx / vz = dx / dz
        // dx = dz * (vx / vz)
        const dz = -18 - 4; // -22
        const vz = -forwardForce;
        const vx = sideForce;
        
        const dx = dz * (vx / vz);
        const endX = start.x + dx;
        
        const end = new THREE.Vector3(endX, 0.1, -18);  
        
        // Simple straight line with curve
        const curve = new THREE.QuadraticBezierCurve3(
            start,
            new THREE.Vector3((start.x + end.x)/2, 2, (start.z + end.z)/2), // Control point (arc up)
            end
        );
        
        const points = curve.getPoints(20);
        lineRef.current.geometry.setFromPoints(points);
        lineRef.current.visible = true;
    } else {
        if (lineRef.current) lineRef.current.visible = false;
    }
  });

  return (
    <line ref={lineRef}>
      <bufferGeometry />
      <lineBasicMaterial color="#00ff00" opacity={0.5} transparent />
    </line>
  );
};

export default Trajectory;
