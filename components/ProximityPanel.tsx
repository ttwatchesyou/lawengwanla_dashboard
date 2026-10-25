import { useEffect, useState } from "react";
import styled from "styled-components";
import { subscribeJson } from "../utils/readPolling";
import { parseTelemetrySnapshot, TelemetrySnapshot } from "../utils/sensorTelemetry";
import { PROXIMITY_PINS, proximityIndicators, ProximityState } from "../utils/proximityTelemetry";

const labels: Record<ProximityState, string> = { active: "ตรวจพบ", inactive: "ไม่พบ", unknown: "ไม่มีข้อมูล" };
const sensorNames = {
  2: "เซนเซอร์ซ้ายหุ่นยนต์ตรวจจับเชลล์",
  3: "เซนเซอร์ตรวจจับเครื่องพับ 2",
  4: "เซนเซอร์ขวาหุ่นยนต์ตรวจจับเชลล์",
  5: "เซนเซอร์ตรวจจับเครื่องพับ 3",
  6: "เซนเซอร์ตรวจจับเครื่องพับ 1",
} as const;
const sensorGroups = [
  { id: "shell", title: "ตรวจจับเชลล์", pins: [2, 4] },
  { id: "folding", title: "ตรวจจับเครื่องพับ", pins: [6, 3, 5] },
] as const;

export default function ProximityPanel() {
  const [sample, setSample] = useState<{ snapshot: TelemetrySnapshot; requestedAt: number } | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeJson<unknown>("/api/telemetry/topics/proximity", (value, stamp) => {
      setSample({ snapshot: parseTelemetrySnapshot(value), requestedAt: stamp.requestedAt });
      setNow(performance.now()); setError(false);
    }, () => setError(true), 100);
    const timer = setInterval(() => setNow(performance.now()), 100);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);
  const states = proximityIndicators(sample?.snapshot ?? null, sample ? Math.max(0, now - sample.requestedAt) : 0, error);
  const live = states.every(state => state !== "unknown");
  return <Panel aria-label="Proximity D2–D6">
    <Top><h2>Proximity · UNO R4</h2><Status $live={live}>{live ? "กำลังรับข้อมูล" : "ไม่มีข้อมูล / ขาดการเชื่อมต่อ"}</Status></Top>
    <Groups>{sensorGroups.map(group => <Group key={group.id} aria-labelledby={`proximity-${group.id}`}>
      <GroupTitle id={`proximity-${group.id}`}>{group.title}<span>{group.pins.length} เซนเซอร์</span></GroupTitle>
      <Grid $columns={group.pins.length}>{group.pins.map(pin => {
        const state = states[PROXIMITY_PINS.indexOf(pin)];
        return <Card key={pin} $state={state}>
          <Pin>{sensorNames[pin]}<small>D{pin}</small></Pin><Indicator><Dot $state={state} /><strong>{labels[state]}</strong></Indicator>
        </Card>;
      })}</Grid>
    </Group>)}</Groups>
    <Note>ตรวจพบเมื่อสัญญาณ LOW · กรองสัญญาณเด้ง 10 ms</Note>
  </Panel>;
}
const Panel = styled.section`background:#fff;border:1px solid #e1e6df;border-radius:18px;padding:22px;margin-bottom:20px;`;
const Top = styled.div`display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;h2{font-size:20px;margin:0;}`;
const Status = styled.span<{ $live: boolean }>`font-size:13px;color:${p => p.$live ? "#21724e" : "#8a6940"};`;
const Groups = styled.div`display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr);gap:18px;@media(max-width:1000px){grid-template-columns:1fr;}`;
const Group = styled.section`min-width:0;border:1px solid #e1e6df;border-radius:14px;padding:16px;`;
const GroupTitle = styled.h3`display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:16px;margin:0 0 14px;span{font-size:12px;font-weight:400;color:#697c86;}`;
const Grid = styled.div<{ $columns: number }>`display:grid;grid-template-columns:repeat(${p => p.$columns},minmax(0,1fr));gap:12px;@media(max-width:600px){grid-template-columns:1fr;}`;
const Card = styled.div<{ $state: ProximityState }>`display:flex;flex-direction:column;border:1px solid ${p => p.$state === "active" ? "#9acbad" : "#e1e6df"};background:${p => p.$state === "active" ? "#eef8f0" : "#f6f8f5"};border-radius:12px;padding:16px;`;
const Pin = styled.div`flex:1;font-size:16px;font-weight:700;line-height:1.6;overflow-wrap:anywhere;margin-bottom:14px;small{display:block;font-size:12px;font-weight:400;color:#697c86;margin-top:4px;}`;
const Indicator = styled.div`display:flex;align-items:center;gap:9px;font-size:16px;`;
const Dot = styled.span<{ $state: ProximityState }>`width:13px;height:13px;border-radius:50%;flex-shrink:0;background:${p => p.$state === "active" ? "#2b9651" : p.$state === "inactive" ? "#aab4ac" : "#d29e3d"};`;
const Note = styled.p`font-size:12px;color:#697c86;margin:14px 0 0;`;
