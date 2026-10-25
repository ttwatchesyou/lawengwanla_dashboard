import styled from "styled-components";
import { GripperPositions } from "../utils/useGripperSimulation";

export type LimitState = "active" | "inactive" | "unknown";
export const LIMIT_SWITCHES = [
  { name: "ชั้น 3 · สุดซ้าย", pin: "PA11", group: "ชุดซ้าย–ขวา" },
  { name: "ชั้น 2 · สุดซ้าย", pin: "PA12", group: "ชุดซ้าย–ขวา" },
  { name: "ชั้น 1 · สุดซ้าย", pin: "PA8", group: "ชุดซ้าย–ขวา" },
  { name: "ชั้น 3 · สุดขวา", pin: "PB3", group: "ชุดซ้าย–ขวา" },
  { name: "ชั้น 2 · สุดขวา", pin: "PB4", group: "ชุดซ้าย–ขวา" },
  { name: "ชั้น 1 · สุดขวา", pin: "PB5", group: "ชุดซ้าย–ขวา" },
  { name: "ชุดขึ้นลง · ขาลง", pin: "PB6", group: "ชุดขึ้น–ลง" },
  { name: "ชุดเข้าออก · ขาเข้า", pin: "PB7", group: "ชุดเข้า–ออก" },
  { name: "ชุดเข้าออก · ขาออก", pin: "PB8", group: "ชุดเข้า–ออก" },
  { name: "ชุดขึ้นลง · ขาขึ้น", pin: "PB9", group: "ชุดขึ้น–ลง" },
] as const;

export const INDUCTIVE_SENSORS = [
  { name: "ชั้น 1 · ตรงกลาง", pin: "D2", floor: 1 },
  { name: "ชั้น 2 · ตรงกลาง", pin: "D3", floor: 2 },
  { name: "ชั้น 3 · ตรงกลาง", pin: "A4", floor: 3 },
  { name: "ชุดจับบนชุดเลื่อนด้านหน้า · ซ้าย–ขวา", pin: "A5", floor: null },
] as const;
export const inductiveStateText = (state: LimitState) => state === "active" ? "พบโลหะ" : state === "inactive" ? "ไม่พบโลหะ" : "รอข้อมูล";
export const limitStateText = (state: LimitState) => state === "active" ? "ชนลิมิต" : state === "inactive" ? "ไม่ชน" : "รอข้อมูล";
const color = (state: LimitState) => state === "active" ? "#38e5ae" : state === "inactive" ? "#6d8097" : "#f4bd60";
const points = [
  { index: 0, x: 87, y: 115 }, { index: 3, x: 327, y: 115 },
  { index: 1, x: 87, y: 210 }, { index: 4, x: 327, y: 210 },
  { index: 2, x: 87, y: 305 }, { index: 5, x: 327, y: 305 },
  { index: 9, x: 530, y: 99 }, { index: 6, x: 530, y: 316 },
  { index: 7, x: 564, y: 207 }, { index: 8, x: 676, y: 207 },
];

export default function LimitRobotDiagram({ states, selected, onSelect, inductiveStates, inductivePins, selectedInductive, onSelectInductive, grippers, ignoredLimits = [] }: {
  states: LimitState[]; selected: number | null; onSelect: (index: number) => void;
  inductiveStates: LimitState[]; selectedInductive: number | null; onSelectInductive: (index: number) => void;
  inductivePins: string[];
  grippers: GripperPositions;
  ignoredLimits?: number[];
}) {
  return <Drawing>
    <svg viewBox="0 0 760 410" role="group" aria-label="แผนภาพเซนเซอร์หุ่นยนต์ กดลิมิตซ้ายขวาหรือ I1 ถึง I3 เพื่อสั่งชุดจับจริง">
      <defs>
        <linearGradient id="limit-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#46617d"/><stop offset="1" stopColor="#20374e"/></linearGradient>
        <linearGradient id="limit-base" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#42628a"/><stop offset="1" stopColor="#223a58"/></linearGradient>
        <pattern id="limit-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#59728f" opacity=".3"/></pattern>
      </defs>
      <rect width="760" height="410" fill="url(#limit-grid)"/>
      <text x="207" y="30" textAnchor="middle" className="view-title">มุมด้านหน้า</text>
      <text x="610" y="30" textAnchor="middle" className="view-title">ชุดขึ้นลง / เข้าออก</text>
      <text x="87" y="66" textAnchor="middle" className="caption">ซ้าย</text><text x="327" y="66" textAnchor="middle" className="caption">ขวา</text>
      <path d="M430 55V375" stroke="#3b526b" strokeDasharray="4 7"/>
      <ellipse cx="207" cy="386" rx="153" ry="10" fill="#071322" opacity=".55"/>
      <rect x="64" y="79" width="22" height="263" rx="6" fill="url(#limit-metal)" stroke="#6d85a0"/>
      <rect x="328" y="79" width="22" height="263" rx="6" fill="url(#limit-metal)" stroke="#6d85a0"/>
      <path d="M88 91H326M88 333H326" stroke="#5a728b" strokeWidth="9"/>
      {([{ floor: 3, y: 115 }, { floor: 2, y: 210 }, { floor: 1, y: 305 }] as const).map(({ floor, y }) => <g key={floor}>
        <rect x="91" y={y-10} width="232" height="20" rx="5" fill="#182e43" stroke="#56748d"/>
        <path d={`M106 ${y}H308`} stroke="#7792ab" strokeWidth="3"/>
        <g data-testid={`gripper-floor-${floor}`} data-position={grippers[floor].position}
          data-target={grippers[floor].target} data-moving={grippers[floor].moving}
          transform={`translate(${117 + 180 * grippers[floor].position}, ${y})`}>
          <title>ชุดจับชั้น {floor} · ตำแหน่งจากเซนเซอร์และค่าประมาณระหว่างจุด</title>
          <rect x="-27" y="-24" width="54" height="48" rx="8" fill="url(#limit-metal)" stroke={grippers[floor].moving ? "#f4bd60" : "#87a0b9"} strokeWidth="2"/>
          <path d="M-14-12H14M-14 12H14" stroke="#adc5d6" strokeWidth="3"/>
          <text x="0" y="4" textAnchor="middle" className="gripper-label">ชุดจับ</text>
        </g>
        <g data-testid={`motor-floor-${floor}`}>
          <path d={`M350 ${y}H358`} stroke="#8ca2b7" strokeWidth="3"/>
          <rect x="358" y={y-14} width="30" height="28" rx="5" fill="#1c334c" stroke={grippers[floor].moving ? "#f4bd60" : "#708aa5"}/>
          <text x="373" y={y+4} textAnchor="middle" className="motor-label">M{floor}</text>
        </g>
        <text x="133" y={y+45} textAnchor="middle" className="floor-label">ชั้น {floor}</text>
      </g>)}
      <rect x="55" y="342" width="303" height="30" rx="10" fill="url(#limit-base)" stroke="#6385aa"/>
      <rect x="76" y="365" width="48" height="20" rx="7" fill="#0b1727" stroke="#4e6580"/>
      <rect x="290" y="365" width="48" height="20" rx="7" fill="#0b1727" stroke="#4e6580"/>
      <text x="207" y="361" textAnchor="middle" className="brand">LAWENGWANLA</text>
      <rect x="506" y="75" width="30" height="266" rx="8" fill="url(#limit-metal)" stroke="#6d85a0"/>
      <path d="M521 119V294" stroke="#9ab0c5" strokeWidth="4" strokeDasharray="3 6"/>
      <path d="M485 125V287m-5-155 5-7 5 7m-10 148 5 7 5-7" fill="none" stroke="#6d8ba6"/>
      <text x="474" y="207" textAnchor="middle" className="caption" transform="rotate(-90 474 207)">ขึ้น–ลง</text>
      <rect x="516" y="180" width="168" height="54" rx="8" fill="url(#limit-metal)" stroke="#87a0b9"/>
      <path d="M550 196H669M550 219H669" stroke="#adc0ce" strokeWidth="3"/>
      <g transform={`translate(${548 + 104 * grippers.front.position}, 207)`} data-testid="gripper-front" data-position={grippers.front.position}>
        <rect x="-16" y="-15" width="32" height="30" rx="5" fill="#29475e" stroke={grippers.front.moving ? "#f4bd60" : "#a5bdc9"}/>
        <path d="M-8-8V7H8V-8" fill="none" stroke="#c7d9e2" strokeWidth="3"/>
      </g>
      <path d="M581 157H660m-72-5-7 5 7 5m65-10 7 5-7 5" fill="none" stroke="#6d8ba6"/>
      <text x="567" y="253" textAnchor="middle" className="caption">เข้า</text><text x="676" y="253" textAnchor="middle" className="caption">ออก</text>
      <text x="573" y="95" className="caption">ขึ้น</text><text x="573" y="320" className="caption">ลง</text>
      <rect x="493" y="342" width="211" height="30" rx="10" fill="url(#limit-base)" stroke="#6385aa"/>
      {INDUCTIVE_SENSORS.map((sensor, index) => {
        const x = sensor.floor === null ? 600 : 207;
        const y = sensor.floor === null ? 207 : ({1: 305, 2: 210, 3: 115}[sensor.floor] - 38);
        const state = inductiveStates[index] ?? "unknown";
        return <g key={sensor.pin} role="button" tabIndex={0} aria-pressed={selectedInductive === index}
          aria-label={`อินดักทีฟ ${index+1} ${sensor.name} ${inductivePins[index]} ${inductiveStateText(state)}`}
          data-testid={`inductive-marker-${index+1}`} data-state={state} className="inductive-point"
          onClick={() => onSelectInductive(index)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectInductive(index); } }}>
          <title>อินดักทีฟ {index+1} · {sensor.name} · {inductivePins[index]} · {inductiveStateText(state)}</title>
          <path d={`M${x} ${y+15}V${y+24}`} stroke="#8299ad" strokeDasharray="2 2"/>
          <rect x={x-23} y={y-23} width="46" height="46" rx="8" fill="transparent"/>
          {selectedInductive === index && <rect x={x-20} y={y-20} width="40" height="40" rx="8" fill="none" stroke="#fff8dc" strokeWidth="1.5" strokeDasharray="3 3"/>}
          <rect x={x-15} y={y-15} width="30" height="30" rx="6" fill={state === "active" ? "#38e5ae" : "#182d42"} stroke={color(state)} strokeWidth="2"/>
          <text x={x} y={y+5} textAnchor="middle" fill={state === "active" ? "#103b32" : color(state)} className="point-number">I{index+1}</text>
        </g>;
      })}
      {points.map(({ index, x, y }) => {
        if (ignoredLimits.includes(index + 1)) return null;
        const state = states[index] ?? "unknown";
        const label = LIMIT_SWITCHES[index];
        return <g key={index} role="button" tabIndex={0} aria-pressed={selected === index}
          aria-label={`ลิมิต ${index+1} ${label.name} ${label.pin} ${limitStateText(state)}`}
          data-testid={`limit-${index+1}`} data-state={state} className="limit-point"
          onClick={() => onSelect(index)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(index); } }}>
          <title>{label.name} · {label.pin} · {limitStateText(state)}</title>
          <circle cx={x} cy={y} r="25" fill="transparent"/>
          <circle cx={x} cy={y} r="22" fill={color(state)} opacity={state === "active" ? ".17" : ".04"}/>
          {selected === index && <circle cx={x} cy={y} r="22" fill="none" stroke="#fff8dc" strokeWidth="1.5" strokeDasharray="3 3"/>}
          <circle cx={x} cy={y} r="16" fill={state === "active" ? "#38e5ae" : "#182d42"} stroke={color(state)} strokeWidth="2"/>
          <text x={x} y={y+5} textAnchor="middle" fill={state === "active" ? "#103b32" : color(state)} className="point-number">{index+1}</text>
        </g>;
      })}
    </svg>
  </Drawing>;
}

const Drawing = styled.div`
  width:100%;min-width:0;
  svg{display:block;width:100%;height:auto;max-height:380px}
  text{font-family:inherit;user-select:none}
  .view-title{fill:#f6f4e8;font-size:15px;font-weight:600}
  .caption{fill:#a7b9cb;font-size:12px}
  .floor-label{fill:#a7b9cb;font-size:11px}
  .brand{fill:#b7cbe0;font-size:10px;font-weight:700;letter-spacing:3px}
  .point-number{font-size:13px;font-weight:700}
  .gripper-label{fill:#e6eef5;font-size:10px}
  .motor-label{fill:#b2c7d9;font-size:10px}
  .limit-point,.inductive-point{cursor:pointer;outline:none}
  .inductive-point:focus-visible rect:last-of-type,.inductive-point:hover rect:last-of-type{stroke:#fff8dc;stroke-width:3}
  .limit-point:focus-visible circle:last-of-type{stroke:white;stroke-width:4}
  .limit-point:hover circle:last-of-type{stroke:#fff8dc;stroke-width:3}
  @media(prefers-reduced-motion:no-preference){.limit-point circle{transition:fill .16s,stroke .16s}}
  @media(min-width:761px) and (max-height:720px){svg{max-height:290px}}
  @media(max-width:600px){overflow-x:auto;svg{min-width:600px;max-height:none}}
`;
