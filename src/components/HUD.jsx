import React, { useEffect, useState } from 'react';
import useGameStore from '../store/gameStore';
import HandOverlay from './HandOverlay';

const HUD = () => {
  const rightHand = useGameStore(state => state.rightHand);
  const leftHand = useGameStore(state => state.leftHand);
  const score = useGameStore(state => state.score);
  const gameStatus = useGameStore(state => state.gameStatus);
  const ballState = useGameStore(state => state.ballState);
  const pinsKnocked = useGameStore(state => state.pinsKnocked);
  const pose = useGameStore(state => state.pose);
  
  const activeHand = useGameStore(state => state.activeHand);
  const ballVelocity = useGameStore(state => state.ballVelocity);
  
  const [scorePulse, setScorePulse] = useState(false);

  useEffect(() => {
      setScorePulse(true);
      const t = setTimeout(() => setScorePulse(false), 200);
      return () => clearTimeout(t);
  }, [score]);

  const styles = {
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      fontFamily: '"Orbitron", sans-serif',
      color: '#ff0000',
      textShadow: '0 0 10px #ff0000',
      zIndex: 10,
      background: 'radial-gradient(circle, transparent 60%, rgba(50, 0, 0, 0.4) 100%)',
    },
    corner: {
        position: 'absolute',
        width: '100px',
        height: '100px',
        borderColor: '#ff0000',
        borderStyle: 'solid',
        opacity: 0.6
    },
    reticle: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '60px',
        height: '60px',
        border: '2px solid',
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        transition: 'all 0.1s',
        boxShadow: '0 0 10px currentColor'
    },
    status: {
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '2rem',
        fontWeight: 'bold',
        letterSpacing: '5px',
        textAlign: 'center'
    },
    debugPanel: {
        position: 'absolute',
        top: '100px',
        left: '20px',
        color: '#00ff00',
        fontFamily: 'monospace',
        fontSize: '12px',
        background: 'rgba(0,0,0,0.8)',
        padding: '10px',
        border: '1px solid #00ff00',
        pointerEvents: 'none'
    },
    dataPanel: {
        position: 'absolute',
        bottom: '50px',
        left: '50px',
        fontSize: '1rem',
        textAlign: 'left',
        lineHeight: '1.5',
        borderLeft: '2px solid #ff0000',
        paddingLeft: '10px',
        background: 'rgba(0,0,0,0.5)'
    },
    scorePanel: {
        position: 'absolute',
        top: '50px',
        right: '50px',
        fontSize: '3rem',
        fontWeight: 'bold',
        textAlign: 'right',
        transition: 'transform 0.1s',
        transform: scorePulse ? 'scale(1.2)' : 'scale(1)',
        color: scorePulse ? '#ffffff' : '#ff0000'
    },
    pins: {
        position: 'absolute',
        top: '60%',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '2rem',
        color: '#ff0000'
    }
  };

  const getStatusText = () => {
      if (!rightHand.present && !leftHand.present) {
          return 'NO HANDS DETECTED - PLEASE WAVE';
      }
      if (gameStatus === 'CALIBRATION') {
          return 'RESIZE (LEFT HAND) | LOCK (BOTH FISTS)';
      }
      if (gameStatus === 'PLAYING') {
          if (ballState === 'LOCKED') return 'RELEASE HANDS TO START';
          if (ballState === 'HELD') return 'AIMING... RELEASE TO THROW';
          if (ballState === 'THROWN') return 'BALL IN PLAY';
          return 'PINCH OR FIST TO GRAB BALL';
      }
      return gameStatus;
  }

  const drawArm = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const toScreen = (pt) => ({ x: (1 - pt.x) * width, y: pt.y * height });

      const renderLimb = (shoulder, elbow, wrist, color) => {
          if (!shoulder || !elbow || !wrist) return null;
          const s = toScreen(shoulder);
          const e = toScreen(elbow);
          const w = toScreen(wrist);

          return (
              <g>
                  {/* Glowing Connection Lines */}
                  <path d={`M ${s.x} ${s.y} L ${e.x} ${e.y} L ${w.x} ${w.y}`} 
                        stroke={color} strokeWidth="4" fill="none" filter="url(#glow)" opacity="0.8" />
                  
                  {/* Tech Joint Circles */}
                  <circle cx={s.x} cy={s.y} r={6} stroke={color} strokeWidth="2" fill="none" filter="url(#glow)" />
                  <circle cx={e.x} cy={e.y} r={6} stroke={color} strokeWidth="2" fill="none" filter="url(#glow)" />
                  
                  {/* Wrist Interface */}
                  <circle cx={w.x} cy={w.y} r={12} stroke={color} strokeWidth="2" fill="rgba(0,0,0,0.5)" filter="url(#glow)" />
                  <circle cx={w.x} cy={w.y} r={4} fill={color} filter="url(#glow)" />
                  
                  {/* Data Ring around Wrist */}
                  <circle cx={w.x} cy={w.y} r={20} stroke={color} strokeWidth="1" strokeDasharray="5,5" fill="none" opacity="0.5">
                      <animateTransform attributeName="transform" type="rotate" from={`0 ${w.x} ${w.y}`} to={`360 ${w.x} ${w.y}`} dur="3s" repeatCount="indefinite" />
                  </circle>
              </g>
          );
      };

      return (
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5 }}>
              <defs>
                  <filter id="glow">
                      <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                      <feMerge>
                          <feMergeNode in="coloredBlur"/>
                          <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                  </filter>
              </defs>
              {/* Right Arm (Ball) */}
              {renderLimb(pose.rightShoulder, pose.rightElbow, rightHand.position, "#ff0000")}
              {/* Left Arm (Scale) */}
              {renderLimb(pose.leftShoulder, pose.leftElbow, leftHand.position, "#ff0000")}
          </svg>
      );
  };

  return (
    <div style={styles.overlay}>
      <HandOverlay />
      {drawArm()}
      
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');
          @keyframes scan {
              0% { top: 0%; opacity: 0; }
              50% { opacity: 0.5; }
              100% { top: 100%; opacity: 0; }
          }
          .scanline {
              position: absolute;
              left: 0;
              width: 100%;
              height: 4px;
              background: #ff0000;
              opacity: 0.3;
              animation: scan 4s linear infinite;
              pointer-events: none;
              box-shadow: 0 0 10px #ff0000;
          }
        `}
      </style>
      
      <div className="scanline"></div>
      
      {/* Tech Corners */}
      <div style={{ ...styles.corner, top: 20, left: 20, borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 0, borderBottomWidth: 0 }}></div>
      <div style={{ ...styles.corner, top: 20, right: 20, borderTopWidth: 2, borderRightWidth: 2, borderLeftWidth: 0, borderBottomWidth: 0 }}></div>
      <div style={{ ...styles.corner, bottom: 20, left: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderRightWidth: 0, borderTopWidth: 0 }}></div>
      <div style={{ ...styles.corner, bottom: 20, right: 20, borderBottomWidth: 2, borderRightWidth: 2, borderLeftWidth: 0, borderTopWidth: 0 }}></div>

      {/* Reticle - Only show if Right Hand is present */}
      {rightHand.present && (
        <div style={{
            ...styles.reticle,
            borderColor: rightHand.gesture === 'FIST' ? '#ff0000' : '#00ffff',
            boxShadow: `0 0 15px ${rightHand.gesture === 'FIST' ? '#ff0000' : '#00ffff'}`,
            left: `${(1 - rightHand.position.x) * 100}%`,
            top: `${rightHand.position.y * 100}%`,
            transform: 'translate(-50%, -50%)'
        }}>
            <div style={{ 
                position: 'absolute', top: '50%', left: '50%', 
                width: '6px', height: '6px', 
                background: rightHand.gesture === 'FIST' ? '#ffffff' : '#ff0000', 
                transform: 'translate(-50%, -50%)', borderRadius: '50%' 
            }}></div>
        </div>
      )}

      <div style={styles.status}>
        {getStatusText()}
      </div>

      <div style={styles.debugPanel}>
        <div style={{borderBottom: '1px solid #00ff00', marginBottom: '5px', fontWeight: 'bold'}}>DEBUG MODE</div>
        <div>BALL STATE: <span style={{color: 'white'}}>{ballState}</span></div>
        <div>ACTIVE HAND: <span style={{color: 'white'}}>{activeHand || 'NONE'}</span></div>
        <div style={{marginTop: '5px'}}>RIGHT HAND:</div>
        <div style={{paddingLeft: '10px'}}>
             GESTURE: <span style={{color: rightHand.gesture === 'OPEN' ? '#00ff00' : 'white'}}>{rightHand.gesture}</span><br/>
             SPEED: <span style={{color: (rightHand.speed || 0) > 0.5 ? '#00ff00' : 'white'}}>{(rightHand.speed || 0).toFixed(2)}</span> / 0.5<br/>
             <span style={{color: '#ffff00'}}>FIST→OPEN to Throw</span>
        </div>
        <div style={{marginTop: '5px'}}>LEFT HAND:</div>
        <div style={{paddingLeft: '10px'}}>
             GESTURE: <span style={{color: leftHand.gesture === 'OPEN' ? '#00ff00' : 'white'}}>{leftHand.gesture}</span><br/>
             SPEED: <span style={{color: (leftHand.speed || 0) > 0.5 ? '#00ff00' : 'white'}}>{(leftHand.speed || 0).toFixed(2)}</span><br/>
             <span style={{color: '#ffff00'}}>FIST→OPEN to Throw</span>
        </div>
        <div style={{marginTop: '10px', color: 'yellow'}}>
             [SPACE] to Force Throw
        </div>
      </div>

      <div style={styles.dataPanel}>
        <div>SYSTEM: ONLINE</div>
        <div>ARM SPEED: {(rightHand.speed || 0).toFixed(2)} m/s</div>
        <div>BALL STATE: {ballState}</div>
        <div>ACTIVE HAND: {activeHand || 'NONE'}</div>
        <div>GESTURE R: {rightHand.gesture}</div>
        <div>GESTURE L: {leftHand.gesture}</div>
        {ballState === 'HELD' && (
            <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                color: '#00ff00', fontSize: '2rem', fontWeight: 'bold', textShadow: '0 0 10px #00ff00'
            }}>
                READY TO THROW
            </div>
        )}
        {gameStatus === 'CALIBRATION' && <div style={{color: '#ff0000', fontWeight: 'bold'}}>STEP 2: MAKE 2 FISTS TO LOCK</div>}
        <div style={{marginTop: '5px', fontSize: '0.8rem', color: '#aaaaaa'}}>
            THROW DEBUG: Swing Open Hand Fast!
        </div>
        <button 
            style={{
                pointerEvents: 'auto',
                marginTop: '10px',
                background: 'rgba(255, 0, 0, 0.8)',
                color: 'white',
                border: '2px solid white',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 0 10px red'
            }}
            onClick={() => useGameStore.getState().setBallState('HELD')}
        >
            FORCE RESET / UNLOCK
        </button>
      </div>

      <div style={styles.scorePanel}>
        {score}
      </div>
      
      {gameStatus === 'FINISHED' && (
          <div style={styles.pins}>
              PINS DESTROYED: {pinsKnocked}/10
          </div>
      )}
    </div>
  );
};

export default HUD;
