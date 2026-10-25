import { subscribeJson } from "../utils/readPolling";
import { useReadClock } from "../utils/useReadClock";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "antd";
import {
  AppstoreOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import styled from "styled-components";
import { cellLabel, MazeCell } from "../utils/mazeRoute";
import { RackSelection } from "../utils/rackMission";
import { WaypointSettingsMap } from "../utils/waypointSettings";
import { missionTasks } from "../utils/missionRetry";
import {
  MissionStatusPacket,
  missionReviewKey,
  missionStatusFresh,
  parseMissionStatus,
  retryFromMissionStatus,
} from "../utils/missionStatus";

const phases = {
  maze: "เขาวงกต",
  cabinet2: "ตู้สอง · วางบล็อก",
  folder: "เครื่องพับ",
  finished: "จบภารกิจ",
};
const runLabels = {
  idle: "รอเริ่ม",
  running: "กำลังทำงาน",
  paused: "พักแล้ว",
  retry_required: "ต้อง Retry",
  completed: "เสร็จสิ้น",
  faulted: "พบเหตุขัดข้อง",
};
const destinations: Record<string, string> = {
  start: "START นอกสนามซ้าย A6 → A8",
  checkpoint19: "ช่องลำดับ 19 → ปลายทาง",
  cabinet2: "ตู้สอง · วางเฉพาะลูกที่ค้าง",
  folder: "เครื่องพับ · ข้ามตู้สองที่เสร็จแล้ว",
  finished: "งานเสร็จแล้ว ไม่ต้องวิ่งซ้ำ",
};

export default function MissionRetryStatusPanel({
  route,
  selection,
  settings,
  ready,
}: {
  route: MazeCell[];
  selection: RackSelection;
  settings: WaypointSettingsMap;
  ready: boolean;
}) {
  const [packet, setPacket] = useState<MissionStatusPacket | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const now = useReadClock(200,false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<string | null>(null);
  useEffect(() => subscribeJson<any>("/api/maze/status",(data,stamp)=>{
    setPacket(parseMissionStatus(data));setReceivedAt(stamp.requestedAt);setError("");
  },error=>setError(error.message || "ยังเชื่อมต่อสถานะภารกิจ ROS2 ไม่ได้"),500),[]);
  const fresh = !error && missionStatusFresh(packet, receivedAt, now);
  const derived = useMemo(
    () => retryFromMissionStatus(route, selection, settings, packet, fresh),
    [route, selection, settings, packet, fresh]
  );
  const state = packet?.state,
    plan = derived.plan;
  const currentKey = missionReviewKey(state || null);
  const canReview = ready && fresh && !!plan && !derived.errors.length;
  const reviewValid = canReview && review === currentKey;
  // Any changed progress/plan/pose epoch invalidates an open review. Heartbeats do not.
  useEffect(() => {
    if (review && !reviewValid) setReview(null);
  }, [review, reviewValid]);
  const statusLabel = error
    ? "เชื่อมต่อไม่ได้"
    : !state
    ? "รอสถานะจากหุ่น"
    : !fresh
    ? "สถานะขาด / ค้าง"
    : runLabels[state.run_state];
  const tasks = missionTasks(selection);
  const download = () => {
    if (!reviewValid || !plan || !state) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              ...plan,
              observed_run_id: state.run_id,
              observed_pose_epoch: state.pose_epoch,
              observed_sequence: state.sequence,
            },
            null,
            2
          ),
        ],
        { type: "application/json" }
      )
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lawengwanla-retry-from-status.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Panel
      id="mission-retry"
      aria-labelledby="retry-live-title"
      data-status-fresh={fresh}
    >
      <Heading>
        <div>
          <h2 id="retry-live-title">เริ่มต่อจากสถานะภารกิจ</h2>
        </div>
        <Badge $fresh={fresh}>
          <i />
          {statusLabel}
        </Badge>
      </Heading>
      <Description>อ่านสถานะจากหุ่น · ยังไม่รองรับคำสั่งเริ่มต่อ</Description>
      <Tracks aria-label="สถานะภารกิจอัตโนมัติ">
        <Track>
          <NodeIndexOutlined />
          <div>
            <small>การเดิน</small>
            <b>{state ? `${state.highest_reached} / 37 ช่อง` : "—"}</b>
            <span>
              {state ? `${phases[state.phase]}${state.source === "wheel_feedback" ? " · พิกัดวัดจริง" : ""}` : "รอข้อมูลการเดิน"}
            </span>
          </div>
        </Track>
        {(["blocks", "sheet"] as const).map((track) => {
          const items = tasks.filter((task) => task.track === track),
            completed =
              state && plan
                ? items.filter((task) => state.tasks[task.id] === "completed")
                    .length
                : null;
          const Icon = track === "blocks" ? AppstoreOutlined : FileTextOutlined;
          return (
            <Track key={track}>
              <Icon />
              <div>
                <small>{track === "blocks" ? "บล็อกเหล็ก" : "แผ่นเหล็ก"}</small>
                <b>
                  {completed === null
                    ? "—"
                    : `${completed} / ${items.length} งาน`}
                </b>
                <span>
                  {state && plan
                    ? items.find((task) => state.tasks[task.id] !== "completed")
                        ?.label || "เสร็จครบแล้ว"
                    : "รอ ACK ชุดจับ"}
                </span>
              </div>
            </Track>
          );
        })}
      </Tracks>
      <Destination aria-live="polite">
        <small>
          จุดเริ่มต่อที่คำนวณจากสถานะ
          {!fresh && state ? " (ข้อมูลเก่า · ยังใช้ไม่ได้)" : ""}
        </small>
        <strong>
          {plan
            ? destinations[plan.destination]
            : "รอข้อมูลภารกิจ — ไม่เดาจุดเริ่มต่อ"}
        </strong>
        {plan?.destination === "checkpoint19" && route[18] && (
          <span>ช่อง 19 ของแผนนี้คือ {cellLabel(route[18])}</span>
        )}
        {state?.block_dropped && plan && (
          <span>
            พบบล็อกร่วง: เพิ่มขั้นจับบล็อกใหม่และรอยืนยัน ไม่ย้อนหยิบที่ตู้แรก
          </span>
        )}
      </Destination>
      <Footer>
        <div>
          <p role="status">
            {error ||
              packet?.error ||
              (!ready ? "เลือกแผนและชิ้นงานให้ครบก่อน" : derived.errors[0]) ||
              "สถานะพร้อมสำหรับตรวจแผน Retry"}
          </p>
          {state && plan && (
            <small>
              Run {state.run_id} · {fresh ? "ข้อมูลสด" : "ห้ามใช้สถานะเก่า"} ·{" "}
              {state.stopped ? "ยืนยันหยุดแล้ว" : "ยังไม่ยืนยันหยุด"}
            </small>
          )}
        </div>
        <Button disabled={!canReview} onClick={() => setReview(currentKey)}>
          <ReloadOutlined /> ตรวจแผน Retry
        </Button>
      </Footer>
      <Note>
        ถ้าแผนไม่ตรง ข้อมูลขาด หุ่นยังไม่หยุด หรืองานกำลังทำแต่ยังไม่ทราบผล
        จะล็อกการตรวจแผนไว้ · การยกหุ่นต้องยืนยันพิกัดใหม่ก่อนวิ่งจริง
      </Note>
      <Modal
        open={reviewValid}
        onCancel={() => setReview(null)}
        title="Retry จากสถานะภารกิจ · ยังไม่สั่งหุ่น"
        footer={null}
        centered
        zIndex={9600}
        width={600}
        maskClosable={false}
      >
        <ModalBody>
          <h3>{plan && destinations[plan.destination]}</h3>
          <p>
            อ่านจาก Run {state?.run_id} ไม่ได้ตั้งเงื่อนไขเอง
            งานที่ยืนยันเสร็จจะไม่เริ่มใหม่
          </p>
          {state?.block_dropped && (
            <p>
              เพิ่มแผนขอเปิดแม่เหล็กจับบล็อกทั้งหมด หลังตรวจความปลอดภัยและรอ ACK
              ว่าจับได้จริง ไม่เปิดแม่เหล็กจากหน้าต่างนี้
            </p>
          )}
          <h4>งานค้าง</h4>
          <ul>
            {plan?.pending_tasks.map((task) => (
              <li key={task.id}>{task.label}</li>
            ))}
          </ul>
          <p>
            ก่อนวิ่งจริงต้องยกเลิกเป้าหมายเก่า ยืนยันจุดวาง/ทิศ ปรับ map ↔ odom
            และรอ ACK จากตัวควบคุม
            {state?.localization_valid
              ? " (สถานะพิกัดล่าสุดใช้ได้ แต่การยกย้ายยังต้องยืนยันใหม่)"
              : " · สถานะยังไม่ยืนยันพิกัด"}
          </p>
          <p>
            ระบบยังไม่มีตัวรัน Retry จึงตรวจและส่งออกแผนได้เท่านั้น
            ไม่ส่งคำสั่งเคลื่อนที่
          </p>
        </ModalBody>
        <Actions>
          <Button onClick={() => setReview(null)}>ปิด</Button>
          <Button onClick={download} disabled={!reviewValid}>
            ดาวน์โหลดแผน
          </Button>
        </Actions>
      </Modal>
    </Panel>
  );
}

const Panel = styled.section`
  scroll-margin-top: 92px;
  margin-top: 20px;
  padding: 24px;
  border: 1px solid #445c95;
  border-radius: 16px;
  background: #1e3271;
  color: #e5edff;
  @media (max-width: 480px) {
    padding: 14px;
  }
`;
const Heading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  small {
    font-size: 9px;
    letter-spacing: 1px;
    color: #adbfe9;
  }
  h2 {
    font-size: 20px;
    color: #ffdc7c;
    margin: 5px 0 0;
  }
`;
const Badge = styled.span<{ $fresh: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid #6374a3;
  border-radius: 18px;
  font-size: 11px;
  color: ${(p) => (p.$fresh ? "#98e8de" : "#bdc9e7")};
  i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }
`;
const Description = styled.p`
  font-size: 12px;
  line-height: 1.8;
  color: #bdc9e7;
  margin: 12px 0;
`;
const Tracks = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  @media (max-width: 650px) {
    grid-template-columns: 1fr;
  }
`;
const Track = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #263b6b;
  border: 1px solid #445c95;
  border-radius: 10px;
  min-width: 0;
  > .anticon {
    font-size: 25px;
    color: #98e8de;
  }
  div {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  small,
  span {
    font-size: 10px;
    color: #bdc9e7;
    line-height: 1.7;
  }
  b {
    font-size: 17px;
    color: #f9e4a4;
  }
`;
const Destination = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 14px 16px;
  background: #142744;
  border: 1px solid #445c95;
  border-radius: 10px;
  margin: 12px 0;
  small {
    font-size: 10px;
    color: #bdc9e7;
  }
  strong {
    font-size: 16px;
    color: #ffdc7c;
  }
  span {
    font-size: 11px;
    color: #bdc9e7;
    line-height: 1.8;
  }
`;
const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  div {
    flex: 1;
    min-width: 180px;
  }
  p {
    font-size: 11px;
    color: #ffdfbd;
    line-height: 1.7;
    margin: 0 0 5px;
  }
  small {
    font-size: 10px;
    color: #bdc9e7;
    overflow-wrap: anywhere;
  }
`;
const Button = styled.button.attrs({ type: "button" })`
  min-height: 46px;
  padding: 10px 16px;
  background: #ffdc7c;
  color: #1e3271;
  border: 1px solid #1e3271;
  border-radius: 8px;
  font-size: 12px !important;
  cursor: pointer;
  touch-action: manipulation;
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  &:focus-visible {
    outline: 3px solid #45a9a9;
    outline-offset: 3px;
  }
`;
const Note = styled.p`
  font-size: 10px;
  color: #bdc9e7;
  line-height: 1.8;
  margin: 12px 0 0;
`;
const ModalBody = styled.div`
  font-size: 12px;
  line-height: 1.9;
  max-height: calc(100dvh - 240px);
  overflow: auto;
  h3 {
    color: #1e3271;
    font-size: 17px;
  }
  p {
    margin: 8px 0;
  }
  ul {
    padding-left: 20px;
  }
`;
const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
`;
