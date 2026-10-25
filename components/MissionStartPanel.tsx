import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "antd";
import styled from "styled-components";
import { MissionCheck } from "../utils/missionReadiness";
import { OPEN_MISSION_CHECK_EVENT } from "../utils/plannerEvents";
import MissionReadinessGauge from "./MissionReadinessGauge";
import { scrollToPlannerSection } from "./PlannerNavigation";
import useMotionUnlock from "../utils/useMotionUnlock";

type Props = {
  inline?: boolean;
  onStartAttempt?: () => void;
  checks: MissionCheck[];
  loaded: boolean;
  payload: () => unknown;
  unlockKey?: string;
  motionBusy?: boolean;
};

export default function MissionStartPanel({
  checks,
  onStartAttempt,
  loaded,
  payload,
  unlockKey = "mission",
  motionBusy = false,
  inline = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState("");
  const [smallScreen, setSmallScreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pending = useRef(false);
  const count = loaded ? checks.filter((item) => item.passed).length : 0;
  const canStart = loaded && checks.length > 0 && count === checks.length;
  const canUnlock = loaded && checks.filter(check => check.id !== "mainprogram-ready").every(check => check.passed);
  const [unlocked, setUnlocked, unlockAvailable] = useMotionUnlock(canStart, starting || motionBusy, unlockKey);
  const minimized = smallScreen && !expanded;

  useEffect(() => {
    const query = window.matchMedia("(max-width: 740px), (max-height: 740px)");
    const update = () => {
      setSmallScreen(query.matches);
      setExpanded(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!smallScreen || !expanded) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest("#mission-review, .ant-tooltip")
      )
        setExpanded(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [smallScreen, expanded]);

  useEffect(() => {
    setMounted(true);
    const openDetails = () => setDetailsOpen(true);
    window.addEventListener(OPEN_MISSION_CHECK_EVENT, openDetails);
    return () =>
      window.removeEventListener(OPEN_MISSION_CHECK_EVENT, openDetails);
  }, []);

  const start = async () => {
    if (!canStart || !unlocked || pending.current) return;
    onStartAttempt?.();
    setUnlocked(false);
    pending.current = true;
    setStarting(true);
    setResult("");
    try {
      const response = await fetch("/api/maze/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.detail || "ไม่สามารถเริ่มภารกิจได้");
      setResult(data.detail || "ระบบรับคำสั่งแล้ว");
    } catch (error) {
      setResult(
        error instanceof Error
          ? error.message
          : "เชื่อมต่อระบบเริ่มภารกิจไม่ได้"
      );
    } finally {
      pending.current = false;
      setStarting(false);
    }
  };

  if (!mounted) return null;
  // Portal avoids ancestor scrolling/transform containers changing the fixed HUD.
  const content = (
    <>
      {inline ? (
        <InlinePanel
          id="mission-review"
          aria-label="เริ่มภารกิจ"
          data-ready={canStart}
        >
          <header>
            <h2>เริ่มภารกิจ</h2>
            <span>
              {count} / {checks.length} พร้อม
            </span>
          </header>
          <InlineProgress
            role="progressbar"
            aria-label="ความพร้อมภารกิจ"
            aria-valuemin={0}
            aria-valuemax={checks.length}
            aria-valuenow={count}
          >
            <i
              style={{
                width: `${checks.length ? (count / checks.length) * 100 : 0}%`,
              }}
            />
          </InlineProgress>
          <button type="button" onClick={() => setDetailsOpen(true)}>
            ตรวจสอบความพร้อม
          </button>
          <label>
            <input
              type="checkbox"
              checked={unlocked}
              disabled={!canUnlock || !unlockAvailable || starting}
              onChange={(event) => setUnlocked(event.target.checked)}
            />{" "}
            ปลดล็อกล้อสำหรับเริ่มครั้งถัดไป
          </label>
          <button
            type="button"
            data-primary="true"
            aria-label="เริ่มภารกิจ"
            disabled={!canStart || !unlocked || starting}
            onClick={start}
          >
            {starting ? "กำลังส่งคำสั่ง…" : "เริ่มภารกิจ"}
          </button>
          <p>สั่งล้อจริงตามเส้นทาง · งานหยิบ–วางยังไม่ทำงานอัตโนมัติ</p>
        </InlinePanel>
      ) : (
        <FloatingPanel
          id="mission-review"
          aria-label="Mission Check ลอย"
          $minimized={minimized}
          data-ready={canStart}
          data-minimized={minimized}
        >
          <label
            style={{ display: "block", padding: "8px 10px", fontSize: 12 }}
          >
            <input
              type="checkbox"
              checked={unlocked}
              disabled={!canUnlock || !unlockAvailable || starting}
              onChange={(event) => setUnlocked(event.target.checked)}
            />{" "}
            ปลดล็อกล้อสำหรับ START ครั้งถัดไป
          </label>
          {minimized ? (
            <MiniRow>
                <MiniStartButton
                  type="button"
                  disabled={!canStart || starting || !unlocked}
                  onClick={start}
                  aria-label="เริ่มภารกิจ"
                >
                  <b>{starting ? "รอระบบ…" : "▶ START"}</b>
                  <small>
                    {count}/{checks.length} พร้อม
                  </small>
                </MiniStartButton>
              <ExpandButton
                type="button"
                aria-label="ขยาย Mission Check"
                aria-expanded={false}
                onClick={() => setExpanded(true)}
              >
                ⌃
              </ExpandButton>
            </MiniRow>
          ) : (
            <>
              <Heading>
                <span id="mission-review-title">MISSION CHECK</span>
                <DetailsButton
                  type="button"
                  aria-label="ดูรายละเอียดความพร้อมภารกิจ"
                  onClick={() => setDetailsOpen(true)}
                >
                  ⓘ {count}/{checks.length}
                </DetailsButton>
                {smallScreen && (
                  <ExpandButton
                    type="button"
                    aria-label="ย่อ Mission Check"
                    aria-expanded={true}
                    onClick={() => setExpanded(false)}
                  >
                    −
                  </ExpandButton>
                )}
              </Heading>
              <MissionReadinessGauge
                checks={checks}
                loaded={loaded}
                compact
                onNavigate={() => setExpanded(false)}
                onGaugeClick={() => setDetailsOpen(true)}
                action={
                    <StartButton
                      type="button"
                      disabled={!canStart || starting || !unlocked}
                      onClick={start}
                      aria-label="เริ่มภารกิจ"
                    >
                      <span aria-hidden="true">{starting ? "…" : "▶"}</span>
                      <b>{starting ? "รอระบบ" : "START"}</b>
                      <small>
                        {count}/{checks.length} พร้อม
                      </small>
                    </StartButton>
                }
              />
              <Status role="status" aria-live="polite">
                {canStart
                  ? "พร้อมสั่งวิ่งสนามจริงผ่าน ROS2"
                  : "แตะไฟไปตั้งค่า · แตะค้างดูคำอธิบาย"}
              </Status>
            </>
          )}
          <ScreenReaderStatus role="status" aria-live="polite">
            {count}/{checks.length} เงื่อนไข
            {canStart ? " พร้อมเริ่มภารกิจ" : " ยังไม่พร้อม"}
          </ScreenReaderStatus>
        </FloatingPanel>
      )}
      <Modal
        open={detailsOpen}
        onCancel={() => setDetailsOpen(false)}
        centered
        zIndex={9600}
        width={540}
        title={`ความพร้อมภารกิจ · ${count}/${checks.length}`}
        footer={null}
        maskClosable={false}
      >
        <DetailsContent>
          <p>เลือกรายการเพื่อไปตั้งค่า</p>
          <CheckList>
            {checks.map((check) => (
              <CheckButton
                type="button"
                key={check.id}
                $passed={loaded && check.passed}
                onClick={() => {
                  setDetailsOpen(false);
                  scrollToPlannerSection(check.section);
                }}
              >
                <strong aria-hidden="true">
                  {loaded && check.passed ? "✓" : "○"}
                </strong>
                <span>
                  <b>{check.label}</b>
                  <small>{check.detail}</small>
                </span>
                <span aria-hidden="true">↗</span>
              </CheckButton>
            ))}
          </CheckList>
          <Notice>
            กด START จะสั่งล้อจริงตามเส้นทางและระยะที่ตั้งไว้ ·
            งานหยิบ–วางยังไม่ทำงานอัตโนมัติ
          </Notice>
        </DetailsContent>
        <ModalButton type="button" onClick={() => setDetailsOpen(false)}>
          ปิดรายละเอียด
        </ModalButton>
      </Modal>
      <Modal
        open={!!result}
        onCancel={() => setResult("")}
        centered
        zIndex={9700}
        width={520}
        title="สถานะเริ่มภารกิจ"
        footer={null}
        maskClosable={false}
      >
        <Result role="alert">{result}</Result>
        <ModalButton type="button" onClick={() => setResult("")}>
          รับทราบ
        </ModalButton>
      </Modal>
    </>
  );
  return inline ? content : createPortal(content, document.body);
}

const FloatingPanel = styled.aside<{ $minimized: boolean }>`
  position: fixed;
  z-index: 9100;
  right: 14px;
  bottom: calc(104px + env(safe-area-inset-bottom, 0px));
  width: ${(p) => p.$minimized ? "156px" : "316px"};
  max-width: calc(100vw - 24px);
  padding: 6px;
  border: 1px solid #657caa;
  border-radius: 21px;
  background: #14213af5;
  box-shadow: 0 10px 32px #08112455;
  backdrop-filter: blur(10px);
  color: #e5edff;
  button {
    font-family: inherit;
    touch-action: manipulation;
  }
  button:focus-visible {
    outline: 3px solid #ffdc7c;
    outline-offset: 2px;
  }
  @media (min-width: 741px) and (max-width: 1279px) and (max-height: 740px) {
    right: 110px;
    bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  }
`;
const MiniRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
`;
const ExpandButton = styled.button`
  min-width: 44px;
  min-height: 48px;
  flex-shrink: 0;
  border: 1px solid #526b94;
  border-radius: 12px;
  background: #263d64;
  color: #dce8fa;
  font-size: 23px;
  cursor: pointer;
`;
const MiniStartButton = styled.button`
  min-width: 92px;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 3px;
  border: 1px solid #ffe69f;
  border-radius: 15px;
  background: linear-gradient(145deg, #ffe69b, #ffce5a);
  color: #1e3271;
  cursor: pointer;
  b {
    font-size: 16px;
  }
  small {
    font-size: 9px;
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;
const ScreenReaderStatus = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;
const Heading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 7px 3px;
  > span {
    font-size: 8px;
    letter-spacing: 1.5px;
    color: #aebed8;
  }
`;
const DetailsButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 2px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #c7d7ee;
  font-size: 10px;
  cursor: pointer;
`;
const StartButton = styled.button`
  width: 92px;
  min-width: 92px;
  min-height: 92px;
  border: 1px solid #ffe69f;
  border-radius: 22px;
  background: linear-gradient(145deg, #ffe69b, #ffce5a);
  box-shadow: 0 0 18px #ffdc7c35, inset 0 1px 0 #fff4cf;
  color: #1e3271;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  span {
    font-size: 23px;
    line-height: 1;
  }
  b {
    font-size: 19px;
    letter-spacing: 0.6px;
    line-height: 1.2;
  }
  small {
    font-size: 9px;
  }
  &:hover:not(:disabled) {
    background: #ffe8a5;
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;
const Status = styled.p`
  margin: 5px 0 0;
  padding: 0 7px 2px;
  font-size: 8px;
  color: #c0d0e9;
  line-height: 1.6;
`;
const DetailsContent = styled.div`
  max-height: calc(100dvh - 230px);
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.8;
`;
const CheckList = styled.div`
  display: grid;
  gap: 7px;
  margin: 10px 0;
`;
const CheckButton = styled.button<{ $passed: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 54px;
  padding: 9px;
  text-align: left;
  border: 1px solid ${(p) => (p.$passed ? "#69a99e" : "#b1bacb")};
  background: ${(p) => (p.$passed ? "#edf8f5" : "#f3f5f9")};
  border-radius: 8px;
  color: #1e3271;
  cursor: pointer;
  touch-action: manipulation;
  strong {
    font-size: 20px;
  }
  > span:nth-child(2) {
    flex: 1;
  }
  b {
    font-size: 12px;
    display: block;
  }
  small {
    display: block;
    font-size: 10px;
    color: #52627f;
  }
`;
const Notice = styled.p`
  background: #fff4cf;
  border: 1px solid #d5bd76;
  color: #62532c;
  border-radius: 8px;
  padding: 10px;
  margin: 10px 0;
  font-size: 11px;
`;
const Result = styled.p`
  color: #57364c;
  background: #fff0f4;
  border: 1px solid #d6a3b4;
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
  line-height: 1.8;
`;
const ModalButton = styled.button`
  min-height: 44px;
  border: 1px solid #536991;
  border-radius: 8px;
  padding: 9px 18px;
  background: #1e3271;
  color: #ffdc7c;
  cursor: pointer;
  touch-action: manipulation;
  margin-top: 10px;
`;

const InlinePanel = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
  border: 1px solid #445c95;
  border-radius: 16px;
  background: #1e3271;
  color: #ffdc7c;
  scroll-margin-top: 100px;
  header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
  }
  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
  header span {
    color: #b0c3df;
    font-size: 12px;
    white-space: nowrap;
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
    accent-color: #ffdc7c;
    flex-shrink: 0;
  }
  button {
    min-height: 44px;
    padding: 10px 14px;
    border: 1px solid #566a9b;
    border-radius: 10px;
    color: #e2e7f7;
    background: #30467f;
    font-size: 13px;
  }
  button[data-primary="true"] {
    margin-top: auto;
    background: #ffdc7c;
    color: #1e3271;
    border-color: #ffdc7c;
  }
  p {
    margin: 0;
    font-size: 11px;
    line-height: 1.7;
    color: #b0c3df;
  }
`;
const InlineProgress = styled.div`
  height: 6px;
  border-radius: 4px;
  background: #364960;
  overflow: hidden;
  i {
    display: block;
    height: 100%;
    background: #ffdc7c;
    border-radius: inherit;
    transition: width 0.2s;
  }
`;
