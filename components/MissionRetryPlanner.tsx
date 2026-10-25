import { ReactNode, useMemo, useState } from "react";
import { Modal } from "antd";
import styled from "styled-components";
import MissionRetryStatusPanel from "./MissionRetryStatusPanel";
import { cellLabel, MazeCell } from "../utils/mazeRoute";
import { RackSelection } from "../utils/rackMission";
import { WaypointSettingsMap } from "../utils/waypointSettings";
import {
  buildRetryPlan,
  emptyRetrySnapshot,
  missionPlanKey,
  missionTasks,
  RetryPhase,
  retryScenario,
} from "../utils/missionRetry";

type Props = {
  developerTools?: ReactNode;
  route: MazeCell[];
  selection: RackSelection;
  settings: WaypointSettingsMap;
  ready: boolean;
};
const phaseLabels: Record<RetryPhase, string> = {
  maze: "กำลังวิ่งเขาวงกต",
  cabinet2: "ภารกิจตู้สอง / วางบล็อก",
  folder: "ภารกิจเครื่องพับ",
  finished: "เสร็จทุกภารกิจ",
};
const destinations: Record<string, string> = {
  start: "START นอกสนามซ้าย A6 → A8",
  checkpoint19: "ช่องลำดับ 19 → ปลายทาง",
  cabinet2: "ตู้สอง · ทำเฉพาะการวางที่ยังค้าง",
  folder: "เครื่องพับ · ไม่ย้อนเข้าตู้สอง",
  finished: "เสร็จแล้ว · ไม่ต้องวิ่งใหม่",
};

export default function MissionRetryPlanner(props: Props) {
  const key = useMemo(
    () => missionPlanKey(props.route, props.selection, props.settings),
    [props.route, props.selection, props.settings]
  );
  // Changing any effective plan input remounts the sandbox: old checkpoint/task
  // statuses must never silently apply to a different mission.
  return (
    <>
      <MissionRetryStatusPanel key={key} {...props} />
      <DeveloperTools>
        <summary>สำหรับนักพัฒนา</summary>
        {props.developerTools}
        <RetrySandbox key={key} {...props} planKey={key} />
      </DeveloperTools>
    </>
  );
}

function RetrySandbox({
  route,
  selection,
  settings,
  ready,
  planKey,
}: Props & { planKey: string }) {
  const tasks = useMemo(() => missionTasks(selection), [selection]);
  const [snapshot, setSnapshot] = useState(() => emptyRetrySnapshot(planKey));
  const [dropped, setDropped] = useState(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const plan = useMemo(
    () => buildRetryPlan(route, selection, settings, snapshot, dropped),
    [route, selection, settings, snapshot, dropped]
  );
  const changeStatus = (id: string, status: string) =>
    setSnapshot((previous) => ({
      ...previous,
      completed: [
        ...previous.completed.filter((item) => item !== id),
        ...(status === "done" ? [id] : []),
      ],
      uncertain: [
        ...previous.uncertain.filter((item) => item !== id),
        ...(status === "uncertain" ? [id] : []),
      ],
    }));
  const scenario = (kind: "before19" | "after19" | "folder") => {
    setSnapshot(retryScenario(planKey, tasks, kind));
    setDropped(kind !== "folder");
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lawengwanla-retry-SANDBOX.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Panel id="retry-sandbox-panel" aria-labelledby="retry-sandbox-title">
      <Heading>
        <div>
          <small>RETRY · INDEPENDENT MISSION TRACKS</small>
          <h2 id="retry-sandbox-title">ทดลองกติกา Retry ด้วยข้อมูลสมมติ</h2>
        </div>
        <Badge>ทดสอบกติกาเท่านั้น</Badge>
      </Heading>
      <Notice role="note">
        ยังไม่มี ACK ความคืบหน้าจาก ROS2 · ค่าด้านล่างเป็นสถานการณ์จำลอง
        ไม่ได้สั่งหุ่นหรือเปิดแม่เหล็ก และไม่ใช่ความคืบหน้าจริง
        ข้อมูลทดสอบจะรีเซ็ตเมื่อเปลี่ยนแผนหรือรีเฟรช
      </Notice>
      <Summary>
        <div>
          <b>วิ่งไม่ถึง 19</b>
          <span>กลับ START · คงงานบล็อกและแผ่นที่ทำเสร็จ</span>
        </div>
        <div>
          <b>ไปถึง 19 แล้ว</b>
          <span>
            กลับช่องที่ 19 ของเส้นทางนี้ (
            {route[18] ? cellLabel(route[18]) : "—"}) ไม่ผูกกับพิกัดช่องตายตัว
          </span>
        </div>
        <div>
          <b>ถึงช่วงทำงานปลายทาง</b>
          <span>เริ่มตู้ที่มีงานค้าง · ไม่ย้อนตู้ที่ยืนยันเสร็จแล้ว</span>
        </div>
      </Summary>
      <Button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="retry-sandbox"
      >
        {expanded ? "ซ่อนตัวทดลอง Retry ▴" : "ทดลองกติกา Retry ▾"}
      </Button>
      {expanded && (
        <div id="retry-sandbox">
          <Examples aria-label="สถานการณ์ retry ตัวอย่าง">
            <Button disabled={!ready} onClick={() => scenario("before19")}>
              ตัวอย่าง: บล็อกร่วงก่อน 19
            </Button>
            <Button disabled={!ready} onClick={() => scenario("after19")}>
              ตัวอย่าง: บล็อกร่วงหลัง 19
            </Button>
            <Button disabled={!ready} onClick={() => scenario("folder")}>
              ตัวอย่าง: Retry ที่เครื่องพับ
            </Button>
          </Examples>
          {!ready && (
            <Notice>
              เลือกเส้นทาง บล็อก สี แผ่นเหล็ก และค่าการวิ่งให้ครบที่ “ตรวจ /
              เริ่ม” ก่อนดูแผน Retry
            </Notice>
          )}
          <Fields>
            <Field>
              ลำดับสูงสุดที่ไปถึงแล้ว (ACK จำลอง)
              <select
                aria-label="ลำดับสูงสุดที่ไปถึง ACK จำลอง"
                value={snapshot.highest_reached}
                onChange={(e) =>
                  setSnapshot({
                    ...snapshot,
                    highest_reached: Number(e.target.value),
                  })
                }
              >
                <option value={0}>0 · ยังไม่เข้าช่องแรก</option>
                {route.map((cell, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1} · {cellLabel(cell)}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              ช่วงภารกิจที่หยุด (จำลอง)
              <select
                aria-label="ช่วงภารกิจที่หยุด จำลอง"
                value={snapshot.phase}
                onChange={(e) =>
                  setSnapshot({
                    ...snapshot,
                    phase: e.target.value as RetryPhase,
                  })
                }
              >
                {Object.entries(phaseLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </Fields>
          <Drop>
            <input
              type="checkbox"
              checked={dropped}
              onChange={(e) => setDropped(e.target.checked)}
            />{" "}
            บล็อกร่วง · ใส่ขั้นขอเปิดแม่เหล็กจับบล็อกทั้งหมด +
            รอยืนยันจับได้จริงในแผน (ไม่เปิดตอนนี้)
          </Drop>
          <Notice>
            สถานะงานเป็นข้อมูลทดสอบ: ถ้าคำสั่งกำลังทำงานหรือขาด ACK ให้เลือก
            “ค้าง / ไม่ทราบผล” ไม่ใช่ “ยังไม่เริ่ม” เพื่อป้องกันการสั่งกลไกซ้ำ
          </Notice>
          <Tracks>
            {(["blocks", "sheet"] as const).map((track) => (
              <Track key={track}>
                <h3>
                  {track === "blocks"
                    ? "บล็อกเหล็ก · หยิบ → ถอย → จัด → วาง"
                    : "แผ่นเหล็ก · หยิบ → ใส่ → พับ → รับ"}
                </h3>
                {tasks
                  .filter((task) => task.track === track)
                  .map((task) => (
                    <TaskRow key={task.id}>
                      <span>{task.label}</span>
                      <select
                        aria-label={`สถานะจำลอง ${task.label}`}
                        value={
                          snapshot.uncertain.includes(task.id)
                            ? "uncertain"
                            : snapshot.completed.includes(task.id)
                            ? "done"
                            : "pending"
                        }
                        onChange={(e) => changeStatus(task.id, e.target.value)}
                      >
                        <option value="pending">ยังไม่เริ่ม</option>
                        <option value="done">ยืนยันเสร็จ (จำลอง)</option>
                        <option value="uncertain">ค้าง / ไม่ทราบผล</option>
                      </select>
                    </TaskRow>
                  ))}
              </Track>
            ))}
          </Tracks>
          <Result aria-live="polite">
            <b>จุดเริ่มต่อที่เสนอ: {destinations[plan.destination]}</b>
            <span>
              {plan.skip_cabinet1
                ? "ข้ามงานตู้แรกที่เสร็จแล้ว"
                : "ยังมีงานตู้แรกค้าง (การจับบล็อกซ้ำไม่แทนการหยิบแผ่นเหล็ก)"}{" "}
              ·{" "}
              {plan.skip_cabinet2
                ? "ข้ามตู้สองที่วางครบแล้ว"
                : "เก็บการวางแต่ละลูกแยกกัน"}
            </span>
          </Result>
          {!!plan.errors.length && (
            <Issues role="alert">
              <b>ยังสรุปแผนไม่ได้</b>
              <ul>
                {plan.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </Issues>
          )}
          <Button
            $primary
            disabled={!ready || !!plan.errors.length}
            onClick={() => setOpen(true)}
          >
            ดูแผน Retry จำลอง (ไม่สั่งงานจริง)
          </Button>
        </div>
      )}
      <details>
        <summary>ทำไมต้องยืนยันพิกัดใหม่ก่อน Retry?</summary>
        <p>
          อุ้มหุ่นย้ายที่แล้ว odom อาจไม่รู้ว่าถูกย้าย
          ต้องหยุดและยกเลิกเป้าหมายเก่า ยืนยันจุดวางจริงกับทิศหัว แล้วปรับ map →
          odom ให้พิกัดตรงกัน รีเซ็ต PID/ความเร็วค้าง และรอ ACK
          พร้อมก่อนปล่อยวิ่งต่อ ไม่ใช่ส่งพิกัด world ไปเทียบกับ odom 0,0 โดยตรง
        </p>
        <p>
          ช่อง 19 เป็นเพียงจุดอ้างอิงในแผน
          ไม่ใช่หลักฐานว่าหุ่นวางตรงศูนย์ช่องจริง · ToF
          ต้องมีการจับคู่ด้านและข้อมูลสด การอ่านกำแพง 4
          ด้านเพียงอย่างเดียวอาจระบุช่องในเขาวงกตซ้ำ ๆ ไม่ได้
        </p>
      </details>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        centered
        zIndex={9600}
        width={620}
        title="แผน Retry จำลอง · ยังส่งไปหุ่นไม่ได้"
        footer={null}
        maskClosable={false}
      >
        <ModalContent>
          <p>
            <b>{destinations[plan.destination]}</b>
          </p>
          <ol>
            <li>
              หยุดหุ่น รอ ACK นิ่ง ยกเลิกเป้าหมายเก่า และตรวจงานที่ไม่ทราบผล
            </li>
            <li>
              วางหุ่นที่จุดเริ่มต่อ ยืนยันทิศและพิกัดจริง ปรับ map ↔ odom
              และรีเซ็ตตัวควบคุม
            </li>
            {dropped && (
              <li>
                ขอเปิดแม่เหล็กจับบล็อกทั้งหมดหลังยืนยันความปลอดภัย รอ ACK
                ว่าจับได้ และตรวจ/จัดบล็อกใหม่ · ไม่หยิบจากตู้แรกซ้ำ
              </li>
            )}
            <li>
              {plan.movement.route_sequences.length
                ? `วิ่งลำดับ ${plan.movement.route_sequences[0]}–37 โดยคงหัวเดิม (ช่อง 19 เป็น anchor เมื่อเริ่มที่ checkpoint)`
                : "กลับเข้าภารกิจสถานีที่ค้าง ไม่วนเขาวงกตใหม่"}
            </li>
            <li>
              ทำเฉพาะงานค้างด้านล่าง โดยตรวจ interlock ของฐานเคลื่อนที่และชุดจับ
            </li>
          </ol>
          <h4>งานที่ยังไม่ยืนยันเสร็จ</h4>
          <p>
            รายการต่อไปนี้แยกตามชุดงาน ไม่ได้หมายถึงให้ทำทุกอย่างพร้อมกัน
            ตัวรันต้องประสานตำแหน่งตู้และทรัพยากรที่ใช้ร่วมกัน
          </p>
          {plan.pending_tasks.length ? (
            <ul>
              {plan.pending_tasks.map((task) => (
                <li key={task.id}>{task.label}</li>
              ))}
            </ul>
          ) : (
            <p>ไม่มีงานค้าง · ไม่สั่งซ้ำ</p>
          )}
          <p>
            งานที่ ACK ว่าเสร็จจะไม่ถูกย้อนเริ่มใหม่ ·
            งานที่ค้าง/ไม่ทราบผลต้องตรวจอุปกรณ์จริงก่อนลองซ้ำ
          </p>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setOpen(false)}>ปิด</Button>
          <Button $primary onClick={download}>
            ดาวน์โหลด JSON ทดสอบ
          </Button>
        </ModalActions>
      </Modal>
    </Panel>
  );
}

const Panel = styled.section`
  scroll-margin-top: 92px;
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #445c95;
  border-radius: 15px;
  background: #1e3271;
  color: #e5edff;
  details {
    margin-top: 14px;
    font-size: 12px;
    line-height: 1.8;
  }
  summary {
    color: #ffdc7c;
    cursor: pointer;
    min-height: 40px;
    padding: 8px 0;
  }
  details p {
    color: #c4cfe9;
    margin: 8px 0;
  }
  select {
    background: #30467f;
    color: #f2f5ff;
    border: 1px solid #7182ae;
    border-radius: 7px;
    min-height: 44px;
    padding: 5px 8px;
    font-size: 12px;
    width: 100%;
    min-width: 0;
  }
  @media (max-width: 480px) {
    padding: 14px;
  }
`;
const DeveloperTools = styled.details`
  margin-top: 20px;
  border: 1px solid #445c95;
  border-radius: 16px;
  background: #1e3271;
  padding: 0 20px 20px;
  &:not([open]) {
    padding-bottom: 0;
  }
  > summary {
    min-height: 56px;
    padding: 18px 0;
    color: #ffdc7c;
    font-size: 13px;
    cursor: pointer;
  }
  > p {
    margin: 12px 0 0;
  }
`;
const Heading = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  small {
    font-size: 9px;
    letter-spacing: 1px;
    color: #adbfe9;
  }
  h2 {
    font-size: 19px;
    margin: 5px 0 0;
    color: #ffdc7c;
  }
  @media (max-width: 480px) {
    h2 {
      font-size: 17px;
    }
  }
`;
const Badge = styled.span`
  border: 1px solid #7c7f9a;
  border-radius: 16px;
  padding: 7px 10px;
  color: #ffdc7c;
  font-size: 11px;
  white-space: nowrap;
`;
const Notice = styled.p`
  font-size: 12px;
  line-height: 1.8;
  color: #ffddaa;
  background: #37446d;
  padding: 10px 12px;
  border-radius: 8px;
  margin: 13px 0;
`;
const Summary = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 0;
  div {
    background: #293e74;
    padding: 12px;
    border: 1px solid #4e6496;
    border-radius: 9px;
  }
  b {
    display: block;
    color: #98e8de;
    font-size: 12px;
    margin-bottom: 6px;
  }
  span {
    font-size: 11px;
    color: #d0daf0;
    line-height: 1.7;
  }
  @media (max-width: 650px) {
    grid-template-columns: 1fr;
  }
`;
const Button = styled.button.attrs({ type: "button" })<{ $primary?: boolean }>`
  min-height: 44px;
  border: 1px solid #6377a5;
  border-radius: 8px;
  background: ${(p) => (p.$primary ? "#ffdc7c" : "#30467f")};
  color: ${(p) => (p.$primary ? "#1e3271" : "#e5edff")};
  padding: 9px 12px;
  font-size: 12px !important;
  cursor: pointer;
  touch-action: manipulation;
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  &:focus-visible {
    outline: 3px solid #45a9a9;
    outline-offset: 2px;
  }
`;
const Examples = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 14px 0;
  button {
    flex: 1;
    min-width: 150px;
  }
`;
const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 650px) {
    grid-template-columns: 1fr;
  }
`;
const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
`;
const Drop = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  line-height: 1.8;
  min-height: 48px;
  margin: 12px 0;
  input {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    accent-color: #ffdc7c;
  }
`;
const Tracks = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
`;
const Track = styled.div`
  padding: 12px;
  background: #293e74;
  border: 1px solid #4e6496;
  border-radius: 10px;
  h3 {
    color: #ffdc7c;
    font-size: 13px;
    margin: 0 0 8px;
  }
`;
const TaskRow = styled.label`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  line-height: 1.7;
  padding: 6px 0;
  border-bottom: 1px solid #42598e;
  &:last-child {
    border: 0;
  }
  @media (max-width: 480px) {
    grid-template-columns: minmax(0, 1fr) 125px;
  }
`;
const Result = styled.div`
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 12px;
  line-height: 1.8;
  padding: 12px;
  background: #274b6c;
  border-radius: 8px;
  margin: 14px 0;
  b {
    color: #98e8de;
  }
`;
const Issues = styled.div`
  font-size: 12px;
  line-height: 1.8;
  color: #ffd2c9;
  padding: 12px;
  background: #503e59;
  border: 1px solid #a26c83;
  border-radius: 8px;
  margin-bottom: 12px;
  ul {
    margin: 6px 0 0;
    padding-left: 20px;
  }
`;
const ModalContent = styled.div`
  max-height: calc(100dvh - 240px);
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.8;
  padding-right: 8px;
  ol,
  ul {
    padding-left: 22px;
  }
  h4 {
    margin: 12px 0 4px;
  }
  p {
    margin-bottom: 8px;
  }
`;
const ModalActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
`;
