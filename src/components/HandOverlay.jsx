import React from 'react';
import useGameStore from '../store/gameStore';

const HandOverlay = () => {
  const { rightHand, leftHand } = useGameStore();
  const width = window.innerWidth;
  const height = window.innerHeight;

  const toScreen = (pt) => {
      // Mirror X logic: Visual Left = Logical Right (due to scaleX(-1) on video)
      return {
          x: (1 - pt.x) * width,
          y: pt.y * height
      };
  };
  
  const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [0, 9], [9, 10], [10, 11], [11, 12], // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
  ];

  const renderHand = (hand, color, tipColor) => {
      if (!hand.present || !hand.landmarks || hand.landmarks.length === 0) return null;
      
      return (
          <g>
             {/* Draw Bones */}
            {connections.map(([start, end], i) => {
                const p1 = toScreen(hand.landmarks[start]);
                const p2 = toScreen(hand.landmarks[end]);
                return (
                    <line 
                        key={`bone-${i}`}
                        x1={p1.x} y1={p1.y}
                        x2={p2.x} y2={p2.y}
                        stroke={color}
                        strokeWidth="2"
                        opacity="0.6"
                    />
                );
            })}

            {/* Draw Joints */}
            {hand.landmarks.map((pt, i) => {
                const p = toScreen(pt);
                return (
                    <circle 
                        key={`joint-${i}`}
                        cx={p.x} cy={p.y}
                        r={i === 8 ? 6 : 3} // Highlight Index Tip
                        fill={i === 8 ? tipColor : color}
                        stroke="#000"
                        strokeWidth="1"
                    />
                );
            })}
          </g>
      );
  };

  return (
    <svg 
        style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 5 // Below HUD, above Video
        }}
    >
        {renderHand(rightHand, "#ff0000", "#ffffff")}
        {renderHand(leftHand, "#ff0000", "#ffffff")}
    </svg>
  );
};

export default HandOverlay;
