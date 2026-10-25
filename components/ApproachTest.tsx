import { useState } from "react";
import Link from "next/link";
import styled from "styled-components";
import {
  ExecutionSettings,
  APPROACH_DEFAULT_SPEED_MPS,
  APPROACH_DEFAULT_TOLERANCE_M,
  validExecutionSettings,
} from "../utils/mainprogramSettings";
import { LiveOdometry } from "../utils/useLiveOdometry";
import useMotionUnlock from "../utils/useMotionUnlock";

export default function ApproachTest({
  live,
  settings,
  onEditSettings,
}: {
  live: LiveOdometry;
  settings: ExecutionSettings;
  onEditSettings: () => void;
}) {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const busy = ["RUN", "STOPPING"].includes(live.state.status);
  const [unlocked, setUnlocked, unlockAvailable] = useMotionUnlock(!!live.state.ready && live.fresh, pending || busy, JSON.stringify(settings));
  const speed = settings.approach_speed_mps ?? APPROACH_DEFAULT_SPEED_MPS;
  const tolerance = settings.approach_tolerance_m ?? APPROACH_DEFAULT_TOLERANCE_M;
  const reference = live.state.map_anchor;
  const isTest = live.state.plan_key === "approach-a6-a8";
  const measured =
    isTest &&
    reference &&
    live.raw &&
    reference.pose_epoch === live.state.pose_epoch
      ? (live.raw[0] - reference.odom_origin[0]) *
          Math.cos(reference.odom_origin[2]) +
        (live.raw[1] - reference.odom_origin[1]) *
          Math.sin(reference.odom_origin[2])
      : null;
  const command = async (stop = false) => {
    if (!stop && (!unlocked || pending || busy || !live.state.ready || !live.fresh || !validExecutionSettings(settings))) return;
    setUnlocked(false);
    if (pending && !stop) return;
    setPending(true);
    try {
      const response = await fetch(
        `/api/mainprogram/${stop ? "stop" : "approach"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ execution_settings: settings }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw Error(data.detail || "ส่งคำสั่งไม่ได้");
      setMessage(
        stop
          ? "ส่งคำสั่งหยุดแล้ว · รอการยืนยัน"
          : "ส่งคำสั่งทดสอบแล้ว · ดู RUN เพื่อยืนยัน"
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ส่งคำสั่งไม่ได้");
    } finally {
      setPending(false);
    }
  };
  return (
    <Panel aria-label="ทดสอบระยะ A6 ถึง A8">
      <header>
        <h2>ทดสอบก่อนเข้าสนาม</h2>
        <button type="button" onClick={onEditSettings}>
          ปรับระยะ
        </button>
      </header>
      <Measurements>
        <div>
          <span>ระยะ X</span>
          <b>
            {(2 + (settings.approach_offset_y_m ?? 0)).toFixed(2)}{" "}
            <small>ม.</small>
          </b>
        </div>
        <div>
          <span>ระยะ Y</span>
          <b>
            {(-(settings.approach_offset_x_m ?? 0)).toFixed(2)}{" "}
            <small>ม.</small>
          </b>
        </div>
        <div><span>ความเร็ว START</span><b>{speed.toFixed(2)} <small>m/s</small></b></div>
        <div><span>Tolerance START</span><b>{(tolerance * 100).toFixed(1)} <small>ซม.</small></b></div>
      </Measurements>
      <label>
        <input
          type="checkbox"
          checked={unlocked}
          disabled={pending || busy || !unlockAvailable || !validExecutionSettings(settings)}
          onChange={(event) => setUnlocked(event.target.checked)}
        />{" "}
        ปลดล็อกล้อสำหรับทดสอบครั้งถัดไป
      </label>
      <Actions>
        <button
          type="button"
          data-primary="true"
          disabled={
            !unlocked ||
            pending ||
            busy ||
            !validExecutionSettings(settings) ||
            !live.state.ready ||
            !live.fresh
          }
          onClick={() => void command()}
        >
          เริ่มทดสอบ A6 → A8
        </button>
        <button
          type="button"
          data-stop="true"
          onClick={() => void command(true)}
        >
          หยุด
        </button>
      </Actions>
      <p>สั่งล้อจริง · วางหุ่นที่ A6 หัวชี้ A8 · {speed} m/s · tolerance {(tolerance * 100).toFixed(1)} ซม.</p>
      {!live.state.ready && (
        <p>
          เปิด Mainprogram ที่ <Link href="/Service">Service</Link>{" "}
          แล้วรอข้อมูลพร้อม
        </p>
      )}
      {isTest && (
        <p role="status">
          {live.state.status} · ระยะจริง{" "}
          {measured === null ? "—" : measured.toFixed(3)} ม.
          {!live.fresh ? " · ข้อมูลค้าง" : ""} · {live.state.reason}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </Panel>
  );
}
const Panel = styled.section`
  padding: 22px;
  border: 1px solid #445c95;
  border-radius: 16px;
  background: #1e3271;
  color: #ffdc7c;
  display: flex;
  flex-direction: column;
  gap: 16px;
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  h2 {
    font-size: 16px;
    margin: 0;
    font-weight: 600;
  }
  button {
    min-height: 40px;
    border: 1px solid #566a9b;
    border-radius: 10px;
    padding: 8px 12px;
    background: #30467f;
    color: #e2e7f7;
    font-size: 12px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #e2e7f7;
  }
  input {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    accent-color: #ffdc7c;
  }
  p {
    font-size: 11px;
    line-height: 1.7;
    color: #b0c3df;
    margin: 0;
  }
  a {
    color: #ffdc7c;
    text-decoration: underline;
  }
`;
const Measurements = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  > div {
    background: #263b6b;
    border-radius: 10px;
    padding: 12px;
  }
  span {
    display: block;
    font-size: 11px;
    color: #b0c3df;
    margin-bottom: 4px;
  }
  b {
    font-size: 22px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  small {
    font-size: 11px;
    color: #b0c3df;
    font-weight: 400;
  }
`;
const Actions = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 64px;
  gap: 8px;
  margin-top: auto;
  button {
    min-height: 44px;
  }
  button[data-primary="true"] {
    background: #ffdc7c;
    border-color: #ffdc7c;
    color: #1e3271;
  }
  button[data-stop="true"] {
    background: #642332;
    color: #ffadb5;
    border-color: #925e7a;
  }
`;
