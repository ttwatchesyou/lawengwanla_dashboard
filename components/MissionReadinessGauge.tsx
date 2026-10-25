import { ReactNode, useEffect, useRef, useState } from "react";
import { Tooltip } from "antd";
import {
  AppstoreOutlined,
  BgColorsOutlined,
  FileTextOutlined,
  FlagOutlined,
  NodeIndexOutlined,
  SlidersOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import styled from "styled-components";
import { MissionCheck } from "../utils/missionReadiness";
import { scrollToPlannerSection } from "./PlannerNavigation";

const icons: Record<string, typeof FlagOutlined> = {
  "waypoint-settings": SlidersOutlined,
  route: NodeIndexOutlined,
  exit: FlagOutlined,
  picks: AppstoreOutlined,
  color: BgColorsOutlined,
  plate: FileTextOutlined,
};

function Indicator({
  check,
  loaded,
  onNavigate,
}: {
  check: MissionCheck;
  loaded: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);
  const passed = loaded && check.passed;
  const Icon = icons[check.id] || QuestionCircleOutlined;
  return (
    <Tooltip
      title={
        <Tip>
          <b>
            {!loaded ? "กำลังโหลด" : passed ? "✓ ผ่าน" : "○ ยังไม่ผ่าน"} ·{" "}
            {check.label}
          </b>
          <span>{check.detail}</span>
          <small>กดเพื่อไปส่วนตั้งค่านี้</small>
        </Tip>
      }
      trigger={["hover", "focus"]}
      open={open}
      onOpenChange={setOpen}
      placement="top"
      zIndex={9500}
    >
      <Lamp
        type="button"
        $on={passed}
        data-check-id={check.id}
        data-passed={passed}
        aria-label={`${
          !loaded ? "กำลังโหลด" : passed ? "ผ่าน" : "ยังไม่ผ่าน"
        }: ${check.label}`}
        onPointerDown={(event) => {
          held.current = false;
          if (event.pointerType !== "touch") return;
          cancel();
          timer.current = setTimeout(() => {
            held.current = true;
            setOpen(true);
          }, 500);
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onContextMenu={(event) => event.preventDefault()}
        onClick={() => {
          cancel();
          if (held.current) {
            held.current = false;
            return;
          }
          setOpen(false);
          onNavigate?.();
          scrollToPlannerSection(check.section);
        }}
      >
        <Icon aria-hidden="true" />
        <StatusMark $on={passed} aria-hidden="true">
          {passed ? "✓" : "−"}
        </StatusMark>
      </Lamp>
    </Tooltip>
  );
}

export default function MissionReadinessGauge({
  checks,
  loaded,
  compact = false,
  action,
  onGaugeClick,
  onNavigate,
}: {
  checks: MissionCheck[];
  loaded: boolean;
  compact?: boolean;
  action?: ReactNode;
  onGaugeClick?: () => void;
  onNavigate?: () => void;
}) {
  const count = loaded ? checks.filter((check) => check.passed).length : 0;
  const progress = checks.length ? (count / checks.length) * 100 : 0;
  const dial = (
    <Dial
      role="progressbar"
      aria-label="ความพร้อมภารกิจ"
      aria-valuemin={0}
      aria-valuemax={checks.length}
      aria-valuenow={count}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r="43"
          fill="none"
          stroke="#283954"
          strokeWidth="5"
        />
        <circle
          cx="50"
          cy="50"
          r="43"
          fill="none"
          stroke={count === checks.length ? "#98e8de" : "#ffdc7c"}
          strokeWidth="5"
          pathLength="100"
          strokeDasharray={`${progress} 100`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <strong>
        {count}
        <small>/{checks.length}</small>
      </strong>
      <span>{count === checks.length ? "READY" : "CHECK"}</span>
    </Dial>
  );
  return (
    <div>
      <Cluster $compact={compact}>
        {action ||
          (onGaugeClick ? (
            <DialButton
              type="button"
              onClick={onGaugeClick}
              aria-label="ดูเงื่อนไขภารกิจที่ยังไม่ครบ"
            >
              {dial}
            </DialButton>
          ) : (
            dial
          ))}
        <Lights aria-label="ไฟตรวจเงื่อนไขภารกิจ">
          {checks.map((check) => (
            <Indicator
              key={check.id}
              check={check}
              loaded={loaded}
              onNavigate={onNavigate}
            />
          ))}
        </Lights>
      </Cluster>
      {!compact && (
        <Hint>
          ไฟมืด = ยังไม่ครบ · ไฟติด ✓ = ผ่านแล้ว · กดไอคอนเพื่อไปตั้งค่า ·
          วางเมาส์ / โฟกัส / แตะค้างเพื่อดูคำอธิบาย
        </Hint>
      )}
    </div>
  );
}

const Cluster = styled.div<{ $compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: 26px;
  padding: 18px 22px;
  border-radius: 15px;
  background: linear-gradient(145deg, #14223f, #101c34);
  border: 1px solid #465474;
  box-shadow: inset 0 3px 12px #050b1a80;
  @media (max-width: 650px) {
    gap: ${(p) => (p.$compact ? "12px" : "15px")};
    padding: ${(p) => (p.$compact ? "8px" : "15px")};
    flex-direction: ${(p) => (p.$compact ? "row" : "column")};
  }
  ${(p) =>
    p.$compact &&
    `
    flex-direction: row;
    padding: 8px;
    gap: 12px;
    border-radius: 16px;
    ${Dial} { width: 72px; height: 72px; }
    ${Dial} strong { font-size: 21px; }
    ${Dial} span { font-size: 8px; letter-spacing: 1px; }
    ${Lights} { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
    ${Lamp} { min-height: 44px; font-size: 21px !important; border-radius: 8px; }
    ${StatusMark} { bottom: 2px; right: 4px; font-size: 9px; }
  `}
`;
const DialButton = styled.button`
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  touch-action: manipulation;
  &:focus-visible {
    outline: 3px solid #ffdc7c;
    outline-offset: 3px;
  }
`;
const Dial = styled.div`
  position: relative;
  width: 96px;
  height: 96px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  strong {
    font-size: 25px;
    line-height: 1.1;
    color: #f4e4aa;
    small {
      font-size: 12px;
      color: #9aabc8;
    }
  }
  span {
    font-size: 9px;
    letter-spacing: 2px;
    color: #9aabc8;
    margin-top: 5px;
  }
  @media (prefers-reduced-motion: no-preference) {
    circle {
      transition: stroke-dasharray 0.25s;
    }
  }
`;
const Lights = styled.div`
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  flex: 1;
  min-width: 0;
  width: 100%;
  @media (max-width: 650px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }
`;
const Lamp = styled.button<{ $on: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 76px;
  min-width: 0;
  border-radius: 13px;
  border: 1px solid ${(p) => (p.$on ? "#69bdb1" : "#39465e")};
  background: ${(p) =>
    p.$on
      ? "radial-gradient(ellipse at center,#275a60 0%,#192d44 75%)"
      : "linear-gradient(#1e2a40,#182339)"};
  color: ${(p) => (p.$on ? "#affff0" : "#78869f")};
  box-shadow: ${(p) =>
    p.$on
      ? "0 0 16px #6cf3c822,inset 0 0 14px #6cf3c811"
      : "inset 0 2px 8px #08122588"};
  font-size: 30px !important;
  cursor: pointer;
  touch-action: manipulation;
  > .anticon {
    opacity: ${(p) => (p.$on ? 1 : 0.55)};
    filter: ${(p) => (p.$on ? "drop-shadow(0 0 6px #66efcaaa)" : "none")};
  }
  &:hover {
    border-color: #b7cfdf;
  }
  &:focus-visible {
    outline: 3px solid #ffdc7c;
    outline-offset: 3px;
  }
`;
const StatusMark = styled.span<{ $on: boolean }>`
  position: absolute;
  right: 7px;
  bottom: 5px;
  font-size: 11px;
  color: ${(p) => (p.$on ? "#affff0" : "#78869f")};
`;
const Tip = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 270px;
  font-size: 12px;
  line-height: 1.7;
  small {
    color: #ffdc7c;
  }
`;
const Hint = styled.p`
  font-size: 10px;
  line-height: 1.8;
  color: #bdc9e7;
  margin: 10px 0 0;
`;
