// The open picking face is the front; the amber control panel is at the rear.
// Coordinates are centimetres; physical body footprint = 66 × 66 cm.
export default function RobotTopView() {
  return (
    <g aria-hidden="true">
      <rect
        x="-33"
        y="-33"
        width="66"
        height="66"
        rx="3"
        fill="#17283f"
        stroke="#b7c8d1"
        strokeWidth="2"
      />
      {[-28, 28].flatMap((x) =>
        [-22, 22].map((y) => (
          <g key={`${x},${y}`}>
            <rect
              x={x - 5}
              y={y - 9}
              width="10"
              height="18"
              rx="3"
              fill="#0f1725"
              stroke="#708395"
            />
            {[-5, 0, 5].map((offset) => (
              <path
                key={offset}
                d={`M${x - 4},${y + offset + 3} l8,-6`}
                stroke="#b7c3ca"
                strokeWidth="2"
              />
            ))}
          </g>
        ))
      )}
      <rect
        x="-24"
        y="-25"
        width="48"
        height="46"
        fill="#4a6175"
        fillOpacity=".65"
      />
      {[-22, 0, 22].map((y) => (
        <rect key={y} x="-27" y={y} width="54" height="3" fill="#b9cbd5" />
      ))}
      <rect x="-28" y="21" width="56" height="8" fill="#b88039" />
      <rect x="-7" y="22" width="16" height="6" fill="#4a9cb4" />
      <circle cx="-20" cy="25" r="2" fill="#ee5966" />
      <path
        d="M-11,-28 v-5 h8 v10 M11,-28 v-5 h-8 v10"
        stroke="#d6e1e7"
        fill="none"
        strokeWidth="2"
      />
      <path
        d="M0,-35 v-10 m-5,6 5,-6 5,6"
        fill="none"
        stroke="#98e8de"
        strokeWidth="3"
      />
    </g>
  );
}
