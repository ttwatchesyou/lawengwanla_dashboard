import { KeyboardEvent } from "react";
import styled from "styled-components";
import { cellLabel, isExitCell, MazeCell } from "../utils/mazeRoute";
import { RACK_COLORS, RackSelection } from "../utils/rackMission";
import { scrollToPlannerSection } from "./PlannerNavigation";

type Props = { route: MazeCell[]; selection: RackSelection };
const toPoint = (cell: MazeCell) =>
  `${cell.col * 100 + 50},${(7 - cell.row) * 100 + 50}`;
const cabinetSlots = Array.from({ length: 9 }, (_, index) => ({
  row: 2 - Math.floor(index / 3),
  col: index % 3,
}));

export default function MazeStationOverview({ route, selection }: Props) {
  const onKey = (event: KeyboardEvent<SVGGElement>, section: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      scrollToPlannerSection(section);
    }
  };
  const end = route[route.length - 1];
  const finishY = end && isExitCell(end) ? (7 - end.row) * 100 + 50 : 750;
  // Keep the exit label out of the equipment models.
  const finishLabelX = finishY >= 425 && finishY <= 725 ? 668 : 835;
  const finishLabelY = finishLabelX === 668 ? finishY + 25 : finishY;
  return (
    <Overview aria-label="โมเดลตำแหน่งตู้และเครื่องพับ">
      <Canvas
        viewBox="-100 -175 1380 1060"
        role="img"
        aria-labelledby="station-map-title station-map-description"
      >
        <title id="station-map-title">
          ตู้หยิบเหนือ C8 ตู้วางและเครื่องพับทางขวา H3
        </title>
        <desc id="station-map-description">
          ตู้หยิบเหนือ C8 ตู้วางด้านขวา H3 โดยด้านเปิดหันลงตามแนวตัว H ด้านล่าง
          และเครื่องพับถัดจากตู้วาง ภาพเป็นโมเดลไม่ใช่สเกลขนาดจริง
        </desc>

        <rect
          x="0"
          y="0"
          width="800"
          height="800"
          rx="8"
          fill="#223965"
          stroke="#7a8db6"
          strokeWidth="4"
        />
        {Array.from({ length: 9 }, (_, index) => (
          <g key={index} stroke="#52688f" strokeWidth="2">
            <line x1={index * 100} y1="0" x2={index * 100} y2="800" />
            <line x1="0" y1={index * 100} x2="800" y2={index * 100} />
          </g>
        ))}
        {Array.from({ length: 8 }, (_, index) => (
          <g key={index} fill="#b8c7e6" fontSize="23" textAnchor="middle">
            <text x={index * 100 + 50} y="837">
              {"ABCDEFGH"[index]}
            </text>
            <text x="-27" y={index * 100 + 58}>
              {8 - index}
            </text>
          </g>
        ))}

        <rect
          x="200"
          y="0"
          width="100"
          height="100"
          fill="#98e8de"
          fillOpacity=".14"
          stroke="#98e8de"
          strokeWidth="4"
        />
        <rect
          x="700"
          y="500"
          width="100"
          height="100"
          fill="#ffdc7c"
          fillOpacity=".12"
          stroke="#ffdc7c"
          strokeWidth="4"
        />

        {route.length > 1 && (
          <polyline
            points={route.map(toPoint).join(" ")}
            fill="none"
            stroke="#ffdc7c"
            strokeWidth="7"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity=".8"
          />
        )}
        {route.map((cell, index) => (
          <g key={cellLabel(cell)}>
            <circle
              cx={cell.col * 100 + 50}
              cy={(7 - cell.row) * 100 + 50}
              r="19"
              fill={index === 0 ? "#98e8de" : "#1e3271"}
              stroke="#ffdc7c"
              strokeWidth="2"
            />
            <text
              x={cell.col * 100 + 50}
              y={(7 - cell.row) * 100 + 57}
              fill={index === 0 ? "#1e3271" : "#fff1b3"}
              fontSize="19"
              textAnchor="middle"
            >
              {index + 1}
            </text>
          </g>
        ))}
        <text x="208" y="25" fill="#98e8de" fontSize="21">
          C8
        </text>
        <text x="707" y="525" fill="#ffdc7c" fontSize="21">
          H3
        </text>

        <path
          d="M-65,250 V50 H0"
          fill="none"
          stroke="#98e8de"
          strokeWidth="3"
          strokeDasharray="9 6"
        />
        <rect
          x="-98"
          y="228"
          width="88"
          height="45"
          rx="6"
          fill="#182c50"
          stroke="#98e8de"
          strokeWidth="2"
        />
        <text x="-54" y="257" textAnchor="middle" fill="#98e8de" fontSize="18">
          START
        </text>
        <line
          x1="800"
          y1={finishY}
          x2={finishLabelX === 668 ? "800" : "835"}
          y2={finishY}
          stroke="#ffdc7c"
          strokeWidth="3"
        />
        <rect
          x={finishLabelX}
          y={finishLabelY - 23}
          width="118"
          height="46"
          rx="6"
          fill="#182c50"
          stroke="#ffdc7c"
          strokeWidth="2"
        />
        <text
          x={finishLabelX + 59}
          y={finishLabelY + 7}
          fill="#ffdc7c"
          fontSize="20"
          textAnchor="middle"
        >
          FINISH
        </text>

        <g
          role="button"
          tabIndex={0}
          aria-label="ตู้ที่ 1 เหนือ C8 เปิดชุดหยิบ"
          onClick={() => scrollToPlannerSection("rack-pick-controls")}
          onKeyDown={(event) => onKey(event, "rack-pick-controls")}
        >
          <text
            x="250"
            y="-145"
            fill="#98e8de"
            textAnchor="middle"
            fontSize="26"
            fontWeight="600"
          >
            ตู้ที่ 1 · จุดหยิบ
          </text>
          <rect
            x="192"
            y="-128"
            width="116"
            height="105"
            rx="4"
            fill="#7e8da8"
          />
          {cabinetSlots.map((slot) => {
            const order = selection.picks.findIndex(
              (cell) => cell.row === slot.row && cell.col === slot.col
            );
            return (
              <g key={`${slot.row}-${slot.col}`}>
                <rect
                  x={198 + slot.col * 36}
                  y={-122 + slot.row * 31}
                  width="32"
                  height="27"
                  fill={order >= 0 ? "#ffdc7c" : "#243655"}
                />
                <text
                  x={214 + slot.col * 36}
                  y={-103 + slot.row * 31}
                  textAnchor="middle"
                  fill="#1e3271"
                  fontSize="18"
                >
                  {order >= 0 ? order + 1 : ""}
                </text>
              </g>
            );
          })}
          {[1, 2, 3].map((plate) => (
            <path
              key={plate}
              d={`M${198 + (plate - 1) * 36},-23 h30 l4,12 h-38 z`}
              fill={selection.plate === plate ? "#ffdc7c" : "#becbdc"}
              stroke="#8898b2"
              strokeWidth="2"
            />
          ))}
          <line
            x1="250"
            y1="-6"
            x2="250"
            y2="0"
            stroke="#98e8de"
            strokeWidth="3"
            strokeDasharray="4 3"
          />
        </g>

        <g fill="none" stroke="#ffdc7c" strokeWidth="3">
          <line x1="800" y1="550" x2="870" y2="550" strokeDasharray="7 5" />
          <line x1="966" y1="550" x2="1044" y2="550" strokeDasharray="7 5" />
        </g>

        <g
          role="button"
          tabIndex={0}
          aria-label="ตู้ที่ 2 ขวา H3 ด้านเปิดหันลงตามแนวตัว H ด้านล่าง เปิดชุดวาง"
          data-front-facing="down"
          onClick={() => scrollToPlannerSection("rack-place-controls")}
          onKeyDown={(event) => onKey(event, "rack-place-controls")}
        >
          <text
            x="918"
            y="451"
            textAnchor="middle"
            fill="#ffdc7c"
            fontSize="25"
            fontWeight="600"
          >
            ตู้ที่ 2
          </text>
          <text
            x="918"
            y="480"
            textAnchor="middle"
            fill="#bdcce8"
            fontSize="21"
          >
            วางบล็อก
          </text>
          <rect x="870" y="495" width="96" height="110" rx="4" fill="#7e8da8" />
          {cabinetSlots.map((slot) => {
            const color = RACK_COLORS[slot.col];
            return (
              <rect
                key={`${slot.row}-${slot.col}`}
                x={876 + slot.col * 28}
                y={501 + (2 - slot.row) * 32}
                width="24"
                height="28"
                rx="2"
                fill={color.hex}
                fillOpacity={
                  !selection.color || selection.color === color.id ? 1 : 0.3
                }
              />
            );
          })}
          <rect x="870" y="495" width="96" height="7" fill="#40536b" />
          <path
            d="M870 605 H966 M911 611 L918 620 L925 611"
            fill="none"
            stroke="#ffdc7c"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <rect x="880" y="605" width="8" height="8" fill="#8e9db6" />
          <rect x="948" y="605" width="8" height="8" fill="#8e9db6" />
          <text
            x="918"
            y="637"
            textAnchor="middle"
            fill="#ffdc7c"
            fontSize="16"
          >
            ด้านเปิดหันลงตามแนว H
          </text>
        </g>

        <g
          role="img"
          aria-label={`เครื่องพับแผ่นเหล็ก ถัดจากตู้ที่ 2${
            selection.plate ? ` รับแผ่นที่ ${selection.plate}` : ""
          }`}
        >
          <text
            x="1107"
            y="451"
            fill="#98e8de"
            fontSize="25"
            textAnchor="middle"
            fontWeight="600"
          >
            เครื่องพับ
          </text>
          <text
            x="1107"
            y="480"
            fill="#bdcce8"
            fontSize="21"
            textAnchor="middle"
          >
            แผ่นเหล็ก
          </text>
          <rect
            x="1044"
            y="503"
            width="126"
            height="100"
            rx="6"
            fill="#566b83"
            stroke="#a8bfd0"
            strokeWidth="3"
          />
          <rect
            x="1056"
            y="518"
            width="102"
            height="15"
            rx="2"
            fill="#9ab4c6"
          />
          <rect x="1097" y="532" width="18" height="30" fill="#a9c5d7" />
          <path
            d="M1062 561 H1090 L1108 583 H1154"
            fill="none"
            stroke="#ffdc7c"
            strokeWidth="7"
            strokeLinejoin="round"
          />
          <rect x="1058" y="605" width="12" height="10" fill="#8e9db6" />
          <rect x="1144" y="605" width="12" height="10" fill="#8e9db6" />
          <text
            x="1107"
            y="651"
            fill="#ffdc7c"
            fontSize="22"
            textAnchor="middle"
          >
            {selection.plate ? `แผ่นที่ ${selection.plate}` : "รอเลือกแผ่น"}
          </text>
        </g>

        <text x="550" y="877" textAnchor="middle" fill="#afbfdd" fontSize="21">
          โมเดลตำแหน่งประกอบการวางแผน · ขนาดอุปกรณ์ไม่ใช่สเกลจริง
        </text>
      </Canvas>
      <StationLegend>
        <button
          type="button"
          onClick={() => scrollToPlannerSection("rack-pick-controls")}
        >
          <i>1</i>
          <span>
            <b>ตู้หยิบ · เหนือ C8</b>
            <small>เปิดชุดหยิบ ↗</small>
          </span>
        </button>
        <button
          type="button"
          onClick={() => scrollToPlannerSection("rack-place-controls")}
        >
          <i>2</i>
          <span>
            <b>ตู้วาง · ขวา H3</b>
            <small>เปิดชุดวาง ↗</small>
          </span>
        </button>
        <div>
          <i>3</i>
          <span>
            <b>เครื่องพับแผ่นเหล็ก</b>
            <small>ถัดจากตู้วาง</small>
          </span>
        </div>
      </StationLegend>
    </Overview>
  );
}

const Overview = styled.div`
  min-width: 0;
`;
const Canvas = styled.svg`
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  g[role="button"] {
    cursor: pointer;
  }
  g[role="button"]:focus-visible {
    outline: 3px solid #ffdc7c;
  }
  text {
    user-select: none;
  }
  @media (min-width: 741px) and (max-height: 740px) {
    max-height: calc(100dvh - 292px);
  }
`;
const StationLegend = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
  margin-top: 5px;
  > button,
  > div {
    min-width: 0;
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #586f9c;
    border-radius: 7px;
    background: #293f77;
    color: #f2e9c6;
    padding: 6px;
    text-align: left;
  }
  i {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 5px;
    background: #ffdc7c;
    color: #1e3271;
    font-size: 10px;
    font-style: normal;
    flex-shrink: 0;
  }
  b {
    display: block;
    font-size: 9px;
    font-weight: 500;
  }
  small {
    display: block;
    font-size: 8px;
    color: #c5d1ec;
    margin-top: 3px;
  }
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    > button,
    > div {
      min-height: 42px;
    }
  }
`;
