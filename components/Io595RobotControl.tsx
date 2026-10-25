import { useEffect, useState } from "react";
import styled from "styled-components";
import { Io595Packet, LIMIT_INPUTS, NANO_INPUTS } from "../utils/io595";
import { SLIDER_FLOORS, SLIDER_WIRING, FRONT_WIRING, SliderFloor, SliderTarget, sliderError, sliderState } from "../utils/io595Slider";
import useIo595Sliders from "../utils/useIo595Sliders";
import Io595Panel from "./Io595Panel";

const targetText: Record<SliderTarget, string> = { left: "ซ้าย", center: "กลาง", right: "ขวา" };
const motionText: Record<string, string> = { zero: "กำลังหาศูนย์ทางซ้าย", left: "กำลังไปซ้าย", right: "กำลังไปขวา", center_home: "กำลังไปซ้ายเพื่อหาจุดกลาง", center_left: "กำลังหาอินดักทีฟทางซ้าย", center_right: "กำลังหาอินดักทีฟทางขวา" };
const sensorText = (level: number | undefined) => level === 0 ? "ตรวจพบ" : level === 1 ? "ยังไม่พบ" : "รอข้อมูล";
const pinText = (floor: SliderFloor, target: SliderTarget) => {
  const wiring = SLIDER_WIRING[floor];
  return target === "center" ? wiring.center === null ? "ยังไม่กำหนดขากลางใน STM32" : `I${wiring.center + 1} · ${NANO_INPUTS[wiring.center]}` : `L${wiring[target] + 1} · ${LIMIT_INPUTS[wiring[target]]}`;
};
const inputLevel = (packet: Io595Packet | null, floor: SliderFloor, target: SliderTarget) => {
  const wiring = SLIDER_WIRING[floor];
  if (target === "center") {
    if (wiring.center === null || !sliderState(packet, floor)?.center_configured) return undefined;
    return packet?.nano_levels[wiring.center];
  }
  return packet?.limit_levels[wiring[target]];
};

export default function Io595RobotControl() {
  const { packet, live, ready, sending, error, move, moveFront, stop, canMove, canMoveFront } = useIo595Sliders();
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [lastPosition, setLastPosition] = useState<Record<SliderFloor, string>>({ 1: "unknown", 2: "unknown", 3: "unknown" });
  // Remember confirmed positions only; movement does not pretend a sensor fired.
  useEffect(() => {
    setLastPosition(previous => {
      const next = { ...previous };
      let changed = false;
      for (const floor of SLIDER_FLOORS) {
        const axis = sliderState(packet, floor);
        if (axis && !axis.error && ["left", "center", "right"].includes(axis.position) && axis.position !== previous[floor]) {
          next[floor] = axis.position; changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [packet]);

  return <>
    <Panel id="io595" aria-label="โมเดลหุ่นยนต์และควบคุมชุดจับ">
      <Header><div><Eyebrow>ROBOT · SENSOR CONTROL</Eyebrow><h2>ชุดจับและตำแหน่งเซนเซอร์</h2><p>กดลิมิตซ้าย–ขวา หรืออินดักทีฟตรงกลางบนโมเดล เพื่อสั่งไปจุดนั้น</p></div>
        <Connection $live={ready} role="status">{ready ? "เชื่อมต่อ · พร้อมสั่งงาน" : live ? "เชื่อมต่อ · รอพร้อมสั่งงาน" : "รอเชื่อมต่อบอร์ด"}</Connection>
      </Header>
      <Workspace>
        <Model>
          <svg viewBox="0 0 430 440" role="group" aria-label="โมเดลหุ่นด้านหน้า กดซ้าย กลาง ขวาของแต่ละชั้นเพื่อสั่งชุดจับ">
            <defs>
              <linearGradient id="slider-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#46617d"/><stop offset="1" stopColor="#20374e"/></linearGradient>
              <linearGradient id="slider-base" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#42628a"/><stop offset="1" stopColor="#223a58"/></linearGradient>
              <pattern id="slider-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#59728f" opacity=".3"/></pattern>
            </defs>
            <rect width="430" height="440" fill="url(#slider-grid)"/>
            <text x="207" y="29" textAnchor="middle" className="title">มุมด้านหน้า · ชุดจับ 3 ชั้น</text>
            <text x="87" y="57" textAnchor="middle" className="caption">ซ้าย</text><text x="327" y="57" textAnchor="middle" className="caption">ขวา</text>
            <ellipse cx="207" cy="416" rx="153" ry="10" fill="#071322" opacity=".55"/>
            <rect x="64" y="90" width="22" height="286" rx="6" fill="url(#slider-metal)" stroke="#6d85a0"/>
            <rect x="328" y="90" width="22" height="286" rx="6" fill="url(#slider-metal)" stroke="#6d85a0"/>
            <path d="M88 96H326M88 366H326" stroke="#5a728b" strokeWidth="9"/>
            {SLIDER_FLOORS.map((floor, index) => {
              const y = 125 + index * 105;
              const axis = sliderState(packet, floor);
              const position = axis?.position;
              const confirmed = position !== undefined && position !== "unknown" && !axis?.error;
              const shown = confirmed ? position : lastPosition[floor];
              const x = shown === "left" ? 117 : shown === "right" ? 297 : 207;
              const moving = axis?.active === true;
              return <g key={floor}>
                <rect x="91" y={y-10} width="232" height="20" rx="5" fill="#182e43" stroke="#56748d"/>
                <path d={`M106 ${y}H308`} stroke="#7792ab" strokeWidth="3"/>
                <g data-testid={`gripper-floor-${floor}`} data-position={position ?? "unknown"} data-moving={moving}
                  style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform .6s ease" }} opacity={live ? 1 : .4}>
                  <title>{confirmed ? `ชุดจับชั้น ${floor} · ${targetText[position as SliderTarget]}` : `ชุดจับชั้น ${floor} · ${moving ? "กำลังเคลื่อนที่ ยังไม่ถึงเซนเซอร์" : "ยังไม่ทราบตำแหน่ง"}`}</title>
                  <rect x="-27" y="-24" width="54" height="48" rx="8" fill="url(#slider-metal)" stroke={moving ? "#f4bd60" : "#87a0b9"} strokeWidth="2"/>
                  <path d="M-14-12H14M-14 12H14" stroke="#adc5d6" strokeWidth="3"/>
                  <text x="0" y="4" textAnchor="middle" className="gripper-label">{!confirmed && !moving ? "?" : "ชุดจับ"}</text>
                </g>
                <path d={`M350 ${y}H358`} stroke="#8ca2b7" strokeWidth="3"/>
                <rect x="358" y={y-14} width="30" height="28" rx="5" fill="#1c334c" stroke={moving ? "#f4bd60" : "#708aa5"}/>
                <text x="373" y={y+4} textAnchor="middle" className="caption">M{floor}</text>
                <text x="32" y={y+4} textAnchor="middle" className="floor-label">ชั้น {floor}</text>
                {(["left", "center", "right"] as const).map(target => {
                  const center = target === "center";
                  const markerX = target === "left" ? 87 : target === "right" ? 327 : 207;
                  const markerY = center ? y - 38 : y;
                  const disabled = !canMove(floor, target);
                  const active = inputLevel(packet, floor, target) === 0;
                  const unconfigured = center && (!axis?.center_configured || SLIDER_WIRING[floor].center === null);
                  const label = `ชั้น ${floor} ไป${targetText[target]}`;
                  return <g key={target} role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} aria-label={label}
                    data-testid={`slider-${floor}-${target}`} data-active={active} className="sensor-button"
                    onClick={() => { if (!disabled) void move(floor, target); }}
                    onKeyDown={event => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); void move(floor, target); } }}>
                    <title>{`${label} · ${pinText(floor, target)} · ${unconfigured ? "ยังไม่ได้เปิดใช้เซนเซอร์กลาง" : sensorText(inputLevel(packet, floor, target))}`}</title>
                    {center && <path d={`M${markerX} ${markerY+16}V${y-24}`} stroke="#8299ad" strokeDasharray="2 2"/>}
                    <rect x={markerX-25} y={markerY-25} width="50" height="50" fill="transparent"/>
                    <rect className="sensor-face" x={markerX-19} y={markerY-18} width="38" height="36" rx={center ? 7 : 18}
                      fill={active ? "#38e5ae" : "#182d42"} stroke={unconfigured ? "#657080" : active ? "#38e5ae" : "#9fb1c3"} strokeWidth="2" strokeDasharray={unconfigured ? "3 3" : undefined}/>
                    <text x={markerX} y={markerY+4} textAnchor="middle" fill={active ? "#103b32" : unconfigured ? "#83909b" : "#e5edf5"} className="sensor-label">{center ? "กลาง" : target === "left" ? "←" : "→"}</text>
                    <text x={markerX} y={markerY+(center ? -25 : 35)} textAnchor="middle" className="pin-label">{center ? SLIDER_WIRING[floor].center === null ? "ยังไม่กำหนด" : `I${SLIDER_WIRING[floor].center!+1}${unconfigured ? " · รอตั้งค่า" : ""}` : `L${SLIDER_WIRING[floor][target]+1}`}</text>
                  </g>;
                })}
              </g>;
            })}
            <rect x="55" y="376" width="303" height="30" rx="10" fill="url(#slider-base)" stroke="#6385aa"/>
            <rect x="76" y="400" width="48" height="20" rx="7" fill="#0b1727" stroke="#4e6580"/>
            <rect x="290" y="400" width="48" height="20" rx="7" fill="#0b1727" stroke="#4e6580"/>
            <text x="207" y="396" textAnchor="middle" className="brand">LAWENGWANLA</text>
          </svg>
          <Legend><span><i/>เซนเซอร์ตรวจพบ</span><span>ตำแหน่งยืนยันเมื่อถึงเซนเซอร์</span></Legend>
        </Model>
        <Controls>
          {SLIDER_FLOORS.map(floor => {
            const axis = sliderState(packet, floor);
            const status = !axis ? "รอข้อมูล" : axis.error ? sliderError(axis.error) : axis.active ? motionText[axis.state] ?? "กำลังเคลื่อนที่" : axis.position === "unknown" ? "ยังไม่ทราบตำแหน่ง" : `อยู่${targetText[axis.position as SliderTarget]}`;
            return <FloorCard key={floor} $fault={!!axis?.error}>
              <FloorTop><h3>ชุดจับชั้น {floor}</h3><span role="status">{sending === floor ? "กำลังส่งคำสั่ง…" : status}</span></FloorTop>
              <Targets>{(["left", "center", "right"] as const).map(target => {
                const unconfigured = target === "center" && (!axis?.center_configured || SLIDER_WIRING[floor].center === null);
                const level = inputLevel(packet, floor, target);
                return <TargetButton key={target} type="button" disabled={!canMove(floor, target)} $active={level === 0}
                  aria-label={`สั่งชุดจับชั้น ${floor} ไป${targetText[target]}`} onClick={() => void move(floor, target)}>
                  <strong>{target === "left" ? "← " : ""}{targetText[target]}{target === "right" ? " →" : ""}</strong>
                  <small>{unconfigured ? "ยังไม่เปิดใช้" : sensorText(level)}</small>
                </TargetButton>;
              })}</Targets>
              {axis && !axis.center_configured && <Hint>กลางชั้น {floor} รอเปิดใช้เซนเซอร์ในบอร์ด</Hint>}
            </FloorCard>;
          })}
          <StopButton type="button" onClick={() => void stop()}>■ หยุดชุดจับทั้งหมด</StopButton>
          <Hint>กดครั้งเดียว วิ่งจนถึงเซนเซอร์จุดหมาย · ออกจากหน้านี้จะสั่งหยุด</Hint>
          {error && <Error role="alert">{error}</Error>}
        </Controls>
      </Workspace>
      <FrontPanel aria-label="ชุดเลื่อนเข้าออก MD10C">
        <FrontDrawing>
          <svg viewBox="0 0 480 145" role="group" aria-label="โมเดลชุดเลื่อนเข้าออก กดลิมิตเข้า L7 หรือออก L6">
            <rect x="85" y="65" width="310" height="20" rx="7" fill="#20374e" stroke="#7792ab"/>
            <path d="M100 75H380" stroke="#adc5d6" strokeWidth="3"/>
            <g transform={`translate(${packet?.front?.position === "in" ? 130 : packet?.front?.position === "out" ? 350 : 240},75)`} data-testid="front-gripper" data-position={packet?.front?.position ?? "unknown"}>
              <rect x="-26" y="-22" width="52" height="44" rx="7" fill="#46617d" stroke={packet?.front?.active ? "#f4bd60" : "#adc5d6"}/>
              <path d="M-12-12V9H12V-12" fill="none" stroke="#d9e8f2" strokeWidth="3"/>
            </g>
            {(["in", "out"] as const).map(target => {
              const x = target === "in" ? 85 : 395;
              const limit = target === "in" ? FRONT_WIRING.inLimit : FRONT_WIRING.outLimit;
              const active = packet?.limit_levels[limit] === 0;
              return <g key={target} role="button" tabIndex={canMoveFront ? 0 : -1} aria-disabled={!canMoveFront}
                data-testid={`front-${target}`} data-active={active} aria-label={target === "in" ? "เลื่อนเข้า" : "เลื่อนออก"}
                onClick={() => { if (canMoveFront) void moveFront(target); }}
                onKeyDown={event => { if (canMoveFront && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); void moveFront(target); } }}>
                <circle cx={x} cy="75" r="28" fill="transparent"/>
                <circle className="front-marker" cx={x} cy="75" r="19" fill={active ? "#38e5ae" : "#182d42"} stroke={active ? "#38e5ae" : "#adc5d6"} strokeWidth="2"/>
                <text x={x} y="80" textAnchor="middle" fill={active ? "#103b32" : "#e6eef5"}>{target === "in" ? "←" : "→"}</text>
                <text x={x} y="35" textAnchor="middle" fill="#e6eef5">{target === "in" ? "เข้า · L7 / PA7" : "ออก · L6 / PA6"}</text>
                <text x={x} y="120" textAnchor="middle" fill="#a7b9cb">{sensorText(packet?.limit_levels[limit])}</text>
              </g>;
            })}
          </svg>
        </FrontDrawing>
        <div><FloorTop><h3>ชุดเลื่อนเข้า–ออก</h3><span role="status">{sending === "front" ? "กำลังส่งคำสั่ง…" : !packet?.front ? "รอเฟิร์มแวร์ไดรเวอร์" : packet.front.error ? packet.front.error === "both_limits" ? "ลิมิตเข้าและออกทำงานพร้อมกัน" : sliderError(packet.front.error) : packet.front.active ? packet.front.state === "out" ? "กำลังเลื่อนออก" : "กำลังเลื่อนเข้า" : packet.front.position === "in" ? "อยู่ขาเข้า" : packet.front.position === "out" ? "อยู่ขาออก" : "ยังไม่ทราบตำแหน่ง"}</span></FloorTop>
          <FrontTargets>{(["in", "out"] as const).map(target => <TargetButton key={target} type="button" disabled={!canMoveFront}
            $active={packet?.limit_levels[target === "in" ? FRONT_WIRING.inLimit : FRONT_WIRING.outLimit] === 0}
            aria-label={target === "in" ? "สั่งชุดเลื่อนเข้า" : "สั่งชุดเลื่อนออก"} onClick={() => void moveFront(target)}>
            <strong>{target === "in" ? "← เข้า" : "ออก →"}</strong><small>{target === "in" ? "หยุดที่ L7" : "หยุดที่ L6"}</small>
          </TargetButton>)}</FrontTargets>
          <Hint>MD10C · PWM 70% · หยุดเมื่อถึงลิมิต · ไม่มีตำแหน่งกลาง</Hint>
        </div>
      </FrontPanel>
      <Io595Panel unmappedOnly />
      <DeveloperButton type="button" aria-expanded={developerOpen} aria-controls="sensor-developer-panel" onClick={() => setDeveloperOpen(open => !open)}>
        สำหรับนักพัฒนา · ขาเซนเซอร์และรีเลย์ทั้งหมด <span>{developerOpen ? "−" : "+"}</span>
      </DeveloperButton>
      {developerOpen && <div id="sensor-developer-panel"><Io595Panel /></div>}
    </Panel>
  </>;
}

const Panel = styled.section`scroll-margin-top:90px;background:#fffef8;border:1px solid #d9dfd6;border-radius:20px;padding:24px;color:#203651;@media(max-width:600px){padding:16px}`;
const Header = styled.header`display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px;h2{margin:6px 0 8px;font-size:24px}p{margin:0;color:#6b7e85;font-size:13px;line-height:1.7}`;
const Eyebrow = styled.small`font-size:10px;letter-spacing:1.7px;color:#7b8c8b`;
const Connection = styled.span<{$live:boolean}>`white-space:nowrap;padding:10px 14px;border-radius:20px;background:${p=>p.$live?"#e3f3e8":"#f1eadd"};color:${p=>p.$live?"#246448":"#826a39"};font-size:12px`;
const Workspace = styled.div`display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.9fr);gap:24px;align-items:start;@media(max-width:850px){grid-template-columns:minmax(0,1fr);gap:18px}`;
const Model = styled.div`overflow:hidden;border-radius:16px;background:#112235;border:1px solid #294158;svg{display:block;width:100%;max-height:620px}svg text{font-family:inherit;user-select:none}.title{fill:#f6f4e8;font-size:14px;font-weight:600}.caption{fill:#a7b9cb;font-size:12px}.floor-label{fill:#bdcfdd;font-size:11px}.gripper-label{fill:#e6eef5;font-size:10px}.brand{fill:#b7cbe0;font-size:10px;font-weight:700;letter-spacing:3px}.pin-label{fill:#a7b9cb;font-size:10px}.sensor-label{font-size:11px;font-weight:700}.sensor-button{cursor:pointer;outline:none}.sensor-button[aria-disabled=true]{cursor:default}.sensor-button:not([aria-disabled=true]):hover .sensor-face,.sensor-button:focus-visible .sensor-face{stroke:#fff8dc;stroke-width:4}@media(prefers-reduced-motion:reduce){g{transition:none!important}}`;
const Legend = styled.div`display:flex;justify-content:center;gap:14px;flex-wrap:wrap;padding:12px;color:#a7b9cb;font-size:10px;border-top:1px solid #294158;span{display:flex;align-items:center;gap:6px}i{width:7px;height:7px;border-radius:50%;background:#38e5ae}`;
const Controls = styled.div`display:flex;flex-direction:column;gap:14px`;
const FloorCard = styled.section<{$fault:boolean}>`padding:17px;border:1px solid ${p=>p.$fault?"#dfb5a8":"#dce3db"};border-radius:14px;background:#f7f8f1`;
const FloorTop = styled.div`display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:14px;h3{font-size:17px;margin:0}span{font-size:12px;color:#6c7e85;line-height:1.6}`;
const Targets = styled.div`display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px`;
const TargetButton = styled.button<{$active:boolean}>`min-height:72px;padding:12px 5px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;border:1px solid ${p=>p.$active?"#58a884":"#d3dcd4"};border-radius:10px;background:${p=>p.$active?"#dff2e5":"#fffef9"};color:#24445a;font:inherit;cursor:pointer;touch-action:manipulation;strong{font-size:17px}small{font-size:10px;color:#6a817b}&:hover:not(:disabled){border-color:#397b65;box-shadow:0 2px 8px #24445a12}&:focus-visible{outline:3px solid #397b65;outline-offset:3px}&:disabled{cursor:default;opacity:.45}`;
const StopButton = styled.button`width:100%;min-height:60px;border:1px solid #d5a399;border-radius:12px;background:#fbe9e1;color:#993e34;font:inherit;font-size:18px;font-weight:700;cursor:pointer;touch-action:manipulation;&:focus-visible{outline:3px solid #993e34;outline-offset:3px}`;
const Hint = styled.p`margin:6px 0 0;font-size:11px;color:#788984;line-height:1.7`;
const Error = styled.p`margin:0;padding:12px;border-radius:10px;background:#fae9e1;color:#993e34;font-size:12px;line-height:1.7`;
const DeveloperButton = styled.button`display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;margin:24px 0 12px;padding:17px 0 0;border:0;border-top:1px solid #e0e5dc;background:transparent;color:#72837f;text-align:left;font:inherit;font-size:12px;cursor:pointer;span{font-size:20px}&:focus-visible{outline:2px solid #397b65;outline-offset:4px}`;
const FrontPanel = styled.section`display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.9fr);gap:24px;align-items:center;margin-top:24px;padding-top:24px;border-top:1px solid #e0e5dc;@media(max-width:850px){grid-template-columns:minmax(0,1fr);gap:16px}`;
const FrontDrawing = styled.div`border-radius:14px;background:#112235;svg{display:block;width:100%;height:auto}text{font:12px inherit}g[role=button]{cursor:pointer;outline:none}g[aria-disabled=true]{cursor:default}g[role=button]:not([aria-disabled=true]):hover .front-marker,g[role=button]:focus-visible .front-marker{stroke:#fff8dc;stroke-width:4}`;
const FrontTargets = styled.div`display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px`;
