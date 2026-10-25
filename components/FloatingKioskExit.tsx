import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

const HOLD_MS = 2500;

export default function FloatingKioskExit() {
  const [isKiosk, setIsKiosk] = useState(false);
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const enabled = new URLSearchParams(window.location.search).get("kiosk") === "1";
    if (enabled) window.sessionStorage.setItem("lawengwanla-kiosk", "1");
    setIsKiosk(enabled || window.sessionStorage.getItem("lawengwanla-kiosk") === "1");
  }, []);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  const exitKiosk = async () => {
    clearTimer();
    if (!window.confirm("ออกจากโหมดแสดงผลและกลับสู่เดสก์ท็อป?")) return;

    const response = await fetch("/api/kiosk/exit", { method: "POST" });
    if (!response.ok) {
      window.alert("ไม่สามารถออกจากโหมดแสดงผลได้");
    }
  };

  const beginHold = () => {
    if (timer.current) return;
    setHolding(true);
    timer.current = setTimeout(exitKiosk, HOLD_MS);
  };

  if (!isKiosk) return null;

  return (
    <ExitButton
      aria-label="ออกจากโหมดแสดงผล"
      title="แตะค้าง 2.5 วินาทีเพื่อออกจากโหมดแสดงผล"
      $holding={holding}
      onPointerDown={beginHold}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
    >
      {holding ? "..." : "×"}
    </ExitButton>
  );
}

const ExitButton = styled.button<{ $holding: boolean }>`
  position: fixed;
  z-index: 10000;
  left: 14px;
  bottom: 14px;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 50%;
  color: #ffffff;
  background: ${({ $holding }) => ($holding ? "#b91c1c" : "rgba(31, 41, 55, 0.58)")};
  font-size: 29px;
  line-height: 1;
  opacity: 0.35;
  touch-action: none;

  &:active,
  &:hover {
    opacity: 1;
  }
`;
