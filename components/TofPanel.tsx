import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { subscribeJson } from "../utils/readPolling";
import { parseTelemetrySnapshot, parseTofReadings, tofAdcToCentimeters, TOF_MOUNTING_OFFSETS_CM, TelemetrySnapshot } from "../utils/sensorTelemetry";

import { TofDisplayFilter } from "../utils/tofDisplayFilter";

const channels = [
  { label: "หน้า", direction: "front", pin: "A2", offsetCm: TOF_MOUNTING_OFFSETS_CM.front },
  { label: "หลัง", direction: "rear", pin: "A3", offsetCm: TOF_MOUNTING_OFFSETS_CM.rear },
  { label: "ซ้าย", direction: "left", pin: "A0", offsetCm: TOF_MOUNTING_OFFSETS_CM.left },
  { label: "ขวา", direction: "right", pin: "A1", offsetCm: TOF_MOUNTING_OFFSETS_CM.right },
];

export default function TofPanel() {
  const [sample, setSample] = useState<{ snapshot: TelemetrySnapshot; requestedAt: number } | null>(null);
  const filter = useRef(new TofDisplayFilter());
  const [filteredDistances, setFilteredDistances] = useState<number[] | null>(null);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeJson<unknown>("/api/telemetry/topics/r4", (value, stamp) => {
      const snapshot = parseTelemetrySnapshot(value);
      const readings = parseTofReadings(snapshot, performance.now() - stamp.requestedAt);
      if (readings) {
        const packet = snapshot.data as { host_epoch: string; sequence: number };
        setFilteredDistances(filter.current.sample(
          readings.map(reading => tofAdcToCentimeters(reading.adcRaw, reading.direction)!),
          packet.host_epoch, packet.sequence, stamp.requestedAt));
      } else {
        filter.current.reset();
        setFilteredDistances(null);
      }
      setSample({ snapshot, requestedAt: stamp.requestedAt });
      setNow(performance.now());
      setError(false);
    }, () => { setError(true); filter.current.reset(); setFilteredDistances(null); }, 200);
    const timer = setInterval(() => setNow(performance.now()), 200);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);
  const readings = parseTofReadings(sample?.snapshot ?? null, sample ? Math.max(0, now - sample.requestedAt) : 0, error);
  // Account for each sensor's mounting position after filtering its distance.
  const distances = readings && filteredDistances
    ? filteredDistances.map((distance, index) => distance + channels[index].offsetCm)
    : null;
  return <Panel aria-label="เซนเซอร์ ToF 4 ทิศ">
    <Top><h2>ToF · UNO R4</h2><Status $live={!!readings}>{readings ? "กำลังรับข้อมูล" : "ไม่มีข้อมูล / ขาดการเชื่อมต่อ"}</Status></Top>
    <Grid>{channels.map((channel, index) => <Card key={channel.direction}>
      <Label>{channel.label} <small>{channel.direction} · {channel.pin} · +{channel.offsetCm.toFixed(2)} cm</small></Label>
      <Value>{distances?.[index]?.toFixed(1) ?? "—"}<small> cm</small></Value>
    </Card>)}</Grid>
    <Note>ระยะประมาณ · กรอง Median 5 ค่า + EMA · หน้าใช้สูตรเฉพาะจากขอบรถช่วง 50–100 cm · หลังใช้สูตรเฉพาะช่วง 20.5–50 cm · ซ้ายใช้สูตร A0 · ขวาชดเชยจากจุด 30 cm ชั่วคราว ระยะอื่นยังไม่ยืนยัน · นอกช่วงสอบเทียบเป็นค่าประมาณ</Note>
  </Panel>;
}
const Panel = styled.section`background:#fff;border:1px solid #e1e6df;border-radius:18px;padding:22px;margin-bottom:20px;`;
const Top = styled.div`display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;h2{font-size:20px;margin:0;}`;
const Status = styled.span<{ $live: boolean }>`font-size:13px;color:${p => p.$live ? "#21724e" : "#8a6940"};`;
const Grid = styled.div`display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;@media(max-width:700px){grid-template-columns:repeat(2,minmax(0,1fr));}`;
const Card = styled.div`background:#f6f8f5;border-radius:12px;padding:16px;`;
const Label = styled.div`font-weight:600;small{display:block;font-size:12px;font-weight:400;color:#697c86;margin-top:4px;}`;
const Value = styled.div`font-size:30px;font-weight:700;margin:12px 0;small{font-size:12px;font-weight:400;color:#697c86;}`;
const Note = styled.p`font-size:12px;color:#697c86;margin:14px 0 0;`;
