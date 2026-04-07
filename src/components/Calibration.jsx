import React, { useEffect } from 'react';
import useGameStore from '../store/gameStore';

const Calibration = () => {
  const { calibration, setCalibration } = useGameStore();

  const handleKeyDown = (e) => {
    if (!calibration.active) return;
    
    const step = 0.05;
    const rotStep = 0.02;
    
    switch(e.key) {
        case 'ArrowUp':
            setCalibration({ rotationX: calibration.rotationX - rotStep });
            break;
        case 'ArrowDown':
            setCalibration({ rotationX: calibration.rotationX + rotStep });
            break;
        case 'w':
            setCalibration({ height: calibration.height + step });
            break;
        case 's':
            setCalibration({ height: calibration.height - step });
            break;
        case 'Enter':
            setCalibration({ active: false });
            break;
        default:
            break;
    }
  };

  useEffect(() => {
    // Only bind listeners if active
    if (!calibration.active) return;
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calibration]);

  if (!calibration.active) return null;

  return (
    <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 20,
        pointerEvents: 'none' // Allow clicks to pass through if needed, but we capture keys
    }}>
        {/* Scanning Beam */}
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '10px',
            background: 'linear-gradient(to bottom, #00ffff, transparent)',
            boxShadow: '0 0 20px #00ffff',
            animation: 'scanBeam 3s ease-in-out infinite',
            opacity: 0.5
        }}></div>
        <style>{`
            @keyframes scanBeam {
                0% { top: 0%; }
                50% { top: 100%; }
                100% { top: 0%; }
            }
        `}</style>

        {/* Center UI */}
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#00ffff',
            fontFamily: 'Orbitron',
            textAlign: 'center',
            background: 'rgba(0, 10, 20, 0.8)',
            padding: '30px',
            border: '1px solid #00ffff',
            boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)',
            backdropFilter: 'blur(5px)'
        }}>
            <h2 style={{ margin: '0 0 10px 0', letterSpacing: '2px' }}>SPATIAL SCAN ACTIVE</h2>
            <div style={{ height: '2px', background: '#00ffff', margin: '10px auto', width: '50%' }}></div>
            <p style={{ fontSize: '0.9rem', color: '#aaffff' }}>ALIGN GRID WITH PHYSICAL FLOOR</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px', textAlign: 'left' }}>
                <div>
                    <strong style={{ color: '#fff' }}>TILT</strong><br/>
                    <span style={{ fontSize: '0.8rem' }}>ARROW UP / DOWN</span>
                </div>
                <div>
                    <strong style={{ color: '#fff' }}>HEIGHT</strong><br/>
                    <span style={{ fontSize: '0.8rem' }}>W / S</span>
                </div>
            </div>
            
            <div style={{ marginTop: '20px', fontSize: '1.2rem', animation: 'pulse 1s infinite' }}>
                PRESS [ENTER] TO INITIALIZE
            </div>
        </div>
        <style>{`
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
        `}</style>
    </div>
  );
};

export default Calibration;
