import useGameStore from '../store/gameStore';

const viewbox = 100;

const HandOverlay = () => {
  const rightHand = useGameStore((state) => state.rightHand);
  const leftHand = useGameStore((state) => state.leftHand);

  const toScreen = (point) => ({
    x: (1 - point.x) * viewbox,
    y: point.y * viewbox,
  });

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
  ];

  const renderHand = (hand, color, tipColor) => {
    if (!hand.present || !hand.landmarks || hand.landmarks.length === 0) return null;

    return (
      <g>
        {connections.map(([start, end], index) => {
          const from = toScreen(hand.landmarks[start]);
          const to = toScreen(hand.landmarks[end]);
          return (
            <line
              key={`bone-${index}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={color}
              strokeWidth="0.45"
              opacity="0.75"
            />
          );
        })}

        {hand.landmarks.map((point, index) => {
          const screenPoint = toScreen(point);
          return (
            <circle
              key={`joint-${index}`}
              cx={screenPoint.x}
              cy={screenPoint.y}
              r={index === 8 ? 0.8 : 0.45}
              fill={index === 8 ? tipColor : color}
              stroke="#08111d"
              strokeWidth="0.15"
            />
          );
        })}
      </g>
    );
  };

  return (
    <svg className="hand-overlay" viewBox={`0 0 ${viewbox} ${viewbox}`} preserveAspectRatio="none">
      {renderHand(rightHand, '#ff6b4a', '#ffffff')}
      {renderHand(leftHand, '#25e7ff', '#ffffff')}
    </svg>
  );
};

export default HandOverlay;
