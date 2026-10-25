"use client";

// Preserved reference for the former ROS-only tuning screen. Not routed.

import Head from "next/dist/shared/lib/head";
import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes, css } from "styled-components";

export const API_BASE = process.env.NEXT_PUBLIC_ROBOT_API || "";
const TELEMETRY_INTERVAL_MS = 100;

interface OdomState {
  x: number;
  y: number;
  yaw: number;
}
interface LogEntry {
  ts: string;
  msg: string;
  color: string;
}
interface SliderCfg {
  label: string;
  default: number;
  lo: number;
  hi: number;
  resolution: number;
}

async function apiPost(
  path: string,
  body: Record<string, unknown>
): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch {
    return false;
  }
}

function SliderRow({
  label,
  value,
  lo,
  hi,
  resolution,
  accent,
  onChange,
}: {
  label: string;
  value: number;
  lo: number;
  hi: number;
  resolution: number;
  accent: string;
  onChange: (v: number) => void;
}) {
  const dec =
    resolution < 0.01 ? 4 : resolution < 0.1 ? 3 : resolution < 1 ? 2 : 1;
  return (
    <SliderRowWrap>
      <SliderLabel>{label}</SliderLabel>
      <SliderTrack
        type="range"
        min={lo}
        max={hi}
        step={resolution}
        value={value}
        $accent={accent}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <NumberInput
        type="number"
        min={lo}
        max={hi}
        step={resolution}
        value={value.toFixed(dec)}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(Math.min(hi, Math.max(lo, v)));
        }}
      />
    </SliderRowWrap>
  );
}

function ProfilePanel({
  title,
  accent,
  rows,
  onSend,
}: {
  title: string;
  accent: string;
  rows: SliderCfg[];
  onSend: (...vals: number[]) => Promise<void>;
}) {
  const [values, setValues] = useState(rows.map((r) => r.default));
  const [busy, setBusy] = useState(false);
  const update = (i: number, v: number) =>
    setValues((p) => {
      const n = [...p];
      n[i] = v;
      return n;
    });
  const handle = async () => {
    setBusy(true);
    await onSend(...values);
    setBusy(false);
  };
  return (
    <>
      <Head>
        <title>Mechatronics and Robotics</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="/logo/MechaLogo.png" rel="icon" />
        <meta property="og:title" content="Mechatronics and Robotics" />
      </Head>
      <Panel>
        <PanelTitle>{title}</PanelTitle>
        <PanelBody>
          {rows.map((r, i) => (
            <SliderRow
              key={r.label}
              label={r.label}
              value={values[i]}
              lo={r.lo}
              hi={r.hi}
              resolution={r.resolution}
              accent={accent}
              onChange={(v) => update(i, v)}
            />
          ))}
        </PanelBody>
        <SendBtn $accent={accent} disabled={busy} onClick={handle}>
          {busy ? "…" : "⟳ SEND"}
        </SendBtn>
        <div style={{ clear: "both" }} />
      </Panel>
    </>
  );
}
function OdomCanvas({
  odom,
  trail,
  goal,
}: {
  odom: OdomState;
  trail: { x: number; y: number }[];
  goal: { x: number; y: number } | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const SCALE = 60;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = c.clientWidth || 300,
      H = c.clientHeight || 300;
    c.width = W;
    c.height = H;
    const cx = W / 2,
      cy = H / 2;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    for (let i = -10; i <= 10; i++) {
      const px = cx + i * SCALE,
        py = cy + i * SCALE;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(W, py);
      ctx.stroke();
    }
    ctx.strokeStyle = C.muted;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(W, cy);
    ctx.stroke();
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        ctx.strokeStyle = i === trail.length - 1 ? C.accent : C.muted + "66";
        ctx.lineWidth = i === trail.length - 1 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx + trail[i - 1].x * SCALE, cy - trail[i - 1].y * SCALE);
        ctx.lineTo(cx + trail[i].x * SCALE, cy - trail[i].y * SCALE);
        ctx.stroke();
      }
    }
    if (goal) {
      const gx = cx + goal.x * SCALE,
        gy = cy - goal.y * SCALE;
      ctx.strokeStyle = C.accent2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx - 8, gy);
      ctx.lineTo(gx + 8, gy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx, gy - 8);
      ctx.lineTo(gx, gy + 8);
      ctx.stroke();
    }
    const px = cx + odom.x * SCALE,
      py2 = cy - odom.y * SCALE;
    const ex = px + 14 * Math.cos(odom.yaw),
      ey = py2 - 14 * Math.sin(odom.yaw);
    ctx.fillStyle = C.accent;
    ctx.strokeStyle = C.bg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const ang = Math.atan2(ey - py2, ex - px);
    ctx.strokeStyle = C.bg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py2);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = C.bg;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 6 * Math.cos(ang - 0.4), ey - 6 * Math.sin(ang - 0.4));
    ctx.lineTo(ex - 6 * Math.cos(ang + 0.4), ey - 6 * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
  }, [odom, trail, goal]);
  return <OdomCanvasEl ref={ref} />;
}

// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export function LegacyRobotTuner() {
  const [rosStatus, setRosStatus] = useState<"offline" | "online">("offline");
  const rosColor = rosStatus === "online" ? C.success : C.danger;
  const rosLabel = rosStatus === "online" ? "● ROS ONLINE" : "● ROS OFFLINE";
  const [odom, setOdom] = useState<OdomState>({ x: 0, y: 0, yaw: 0 });
  const [vel, setVel] = useState({ lx: 0, ly: 0, az: 0 });
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const [goal, setGoal] = useState<{ x: number; y: number } | null>(null);
  const [gX, setGX] = useState("0.0");
  const [gY, setGY] = useState("0.0");
  const [gTheta, setGTheta] = useState("0.0");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string, color: string = C.text) => {
    const ts = new Date().toTimeString().slice(0, 8);
    setLogs((p) => [...p.slice(-300), { ts, msg, color }]);
    setTimeout(() => {
      if (logRef.current)
        logRef.current.scrollTop = logRef.current.scrollHeight;
    }, 30);
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/telemetry`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        setRosStatus("online");
        setOdom({ x: d.pose_x ?? 0, y: d.pose_y ?? 0, yaw: d.yaw ?? 0 });
        setVel({
          lx: d.linear_x ?? 0,
          ly: d.linear_y ?? 0,
          az: d.angular_z ?? 0,
        });
        setTrail((p) => {
          const n = [...p, { x: d.pose_x ?? 0, y: d.pose_y ?? 0 }];
          return n.length > 600 ? n.slice(-600) : n;
        });
      } catch {
        setRosStatus("offline");
      }
    };
    const id = setInterval(() => {
      if (alive) poll();
    }, TELEMETRY_INTERVAL_MS);
    poll();
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const post = useCallback(
    async (
      path: string,
      body: Record<string, unknown>,
      logMsg: string,
      color: string
    ) => {
      const ok = await apiPost(path, body);
      addLog(ok ? logMsg : `❌ ${path} failed`, ok ? color : C.danger);
    },
    [addLog]
  );

  const sendGoal = async () => {
    const x = parseFloat(gX),
      y = parseFloat(gY),
      theta = parseFloat(gTheta);
    if ([x, y, theta].some(isNaN)) {
      addLog("ค่า X/Y/θ ต้องเป็นตัวเลข", C.danger);
      return;
    }
    setGoal({ x, y });
    await post(
      "/api/cmd/goal",
      { x, y, theta },
      `GOAL → X:${x.toFixed(3)}  Y:${y.toFixed(3)}  θ:${theta.toFixed(3)}`,
      C.accent
    );
  };

  const sendStop = () =>
    post(
      "/api/cmd/stop",
      {
        x: parseFloat(gX) || 0,
        y: parseFloat(gY) || 0,
        theta: parseFloat(gTheta) || 0,
      },
      "STOP",
      C.warning
    );

  const resetOdom = async () => {
    await post("/api/cmd/reset_odom", {}, "Odometry reset", C.warning);
    setTrail([]);
    setOdom({ x: 0, y: 0, yaw: 0 });
  };

  const sendMaxSpeed = async (speed: number) =>
    post(
      "/api/cmd/max_speed",
      { speed },
      `MAX SPEED → ${speed.toFixed(3)} m/s`,
      C.accent3
    );

  const sendPosPID = async (kp: number, ki: number, kd: number) =>
    post(
      "/api/cmd/pos_pid",
      { kp, ki, kd },
      `POS PID → Kp:${kp.toFixed(3)}  Ki:${ki.toFixed(4)}  Kd:${kd.toFixed(3)}`,
      C.accent
    );

  const sendYaw = async (max_rpm: number, brake_rad: number, fine_kp: number) =>
    post(
      "/api/cmd/yaw_profile",
      { max_rpm, brake_rad, fine_kp },
      `YAW → rpm:${max_rpm.toFixed(0)}  brake:${brake_rad.toFixed(
        3
      )}rad  kp:${fine_kp.toFixed(0)}`,
      C.accent2
    );

  const sendTrap = async (accel: number, decel: number, min_v: number) =>
    post(
      "/api/cmd/trap_profile",
      { accel, decel, min_v },
      `TRAP → accel:${accel.toFixed(1)}  decel:${decel.toFixed(
        1
      )}  min_v:${min_v.toFixed(2)}`,
      C.accent4
    );

  const applyPreset = (x: number, y: number, theta: number) => {
    setGX(String(x));
    setGY(String(y));
    setGTheta(String(Math.round(theta * 1e5) / 1e5));
  };

  const yawDeg = ((odom.yaw * 180) / Math.PI + 360) % 360;

  return (
    <Root>
      <StatusContainer>
        <RosStatus $color={rosColor}>{rosLabel}</RosStatus>
      </StatusContainer>
      <MainLayout>
        <LeftCol>
          <Panel>
            <PanelTitle>POSITION COMMAND</PanelTitle>
            <PanelBody>
              <GoalGrid>
                <GoalLabel>Target X (m)</GoalLabel>
                <GoalInput value={gX} onChange={(e) => setGX(e.target.value)} />
                <GoalLabel>Target Y (m)</GoalLabel>
                <GoalInput value={gY} onChange={(e) => setGY(e.target.value)} />
                <GoalLabel>Yaw θ (rad)</GoalLabel>
                <GoalInput
                  value={gTheta}
                  onChange={(e) => setGTheta(e.target.value)}
                />
              </GoalGrid>
              <PresetRow>
                <MutedSmall>PRESETS:</MutedSmall>
                {[
                  { label: "Home", x: 0, y: 0, t: 0 },
                  { label: "+1m X", x: 1, y: 0, t: 0 },
                  { label: "+1m Y", x: 0, y: 1, t: 0 },
                  { label: "90°", x: 0, y: 0, t: 1.5708 },
                  { label: "180°", x: 0, y: 0, t: 3.14159 },
                ].map((p) => (
                  <PresetBtn
                    key={p.label}
                    onClick={() => applyPreset(p.x, p.y, p.t)}
                  >
                    {p.label}
                  </PresetBtn>
                ))}
              </PresetRow>
            </PanelBody>
            <BtnRow>
              <ActionBtn $accent={C.accent} onClick={sendGoal}>
                ▶ SEND GOAL
              </ActionBtn>
              <ActionBtn $accent={C.danger} onClick={sendStop}>
                ⏹ STOP
              </ActionBtn>
              <ActionBtn $accent={C.warning} onClick={resetOdom}>
                ↺ RESET ODOM
              </ActionBtn>
            </BtnRow>
          </Panel>
          <ProfilePanel
            title="MAX SPEED  (output_limit)"
            accent={C.accent3}
            rows={[
              {
                label: "Max Speed XY (m/s)",
                default: 0.6,
                lo: 0.05,
                hi: 2.0,
                resolution: 0.05,
              },
            ]}
            onSend={async (s) => {
              await sendMaxSpeed(s);
            }}
          />
          <ProfilePanel
            title="TRAPEZOIDAL XY PROFILE  (accel / decel / min_v)"
            accent={C.accent4}
            rows={[
              {
                label: "Accel  (m/s²)",
                default: 1.5,
                lo: 0.2,
                hi: 5.0,
                resolution: 0.1,
              },
              {
                label: "Decel  (m/s²) ← จูน",
                default: 2.5,
                lo: 0.2,
                hi: 8.0,
                resolution: 0.1,
              },
              {
                label: "Min Speed  (m/s)",
                default: 0.05,
                lo: 0.01,
                hi: 0.3,
                resolution: 0.01,
              },
            ]}
            onSend={async (a, d, m) => {
              await sendTrap(a, d, m);
            }}
          />
          <Hint>💡 DECEL = v² ÷ (2 × ระยะไถล) เช่น 1.2²÷(2×0.25) = 2.88</Hint>
          <ProfilePanel
            title="POSITION PID  (fine correction zone)"
            accent={C.accent}
            rows={[
              {
                label: "Kp  (fine correction)",
                default: 1.48,
                lo: 0,
                hi: 20.0,
                resolution: 0.01,
              },
              {
                label: "Ki",
                default: 0.0052,
                lo: 0,
                hi: 0.5,
                resolution: 0.001,
              },
              { label: "Kd", default: 0.121, lo: 0, hi: 5.0, resolution: 0.01 },
            ]}
            onSend={async (kp, ki, kd) => {
              await sendPosPID(kp, ki, kd);
            }}
          />
          <ProfilePanel
            title="YAW PROFILE  (max_rpm / brake_rad / fine_kp)"
            accent={C.accent2}
            rows={[
              {
                label: "Yaw Max RPM",
                default: 160,
                lo: 20,
                hi: 400,
                resolution: 5,
              },
              {
                label: "Yaw Brake (rad)",
                default: 0.5,
                lo: 0.05,
                hi: 2.0,
                resolution: 0.05,
              },
              {
                label: "Yaw Fine Kp",
                default: 180,
                lo: 10,
                hi: 400,
                resolution: 5,
              },
            ]}
            onSend={async (rpm, brake, kp) => {
              await sendYaw(rpm, brake, kp);
            }}
          />
        </LeftCol>
        <RightCol>
          <OdomPanel>
            <PanelTitle>ODOMETRY MAP</PanelTitle>
            <OdomCanvas odom={odom} trail={trail} goal={goal} />
            <OdomInfo>
              X:{odom.x >= 0 ? "+" : ""}
              {odom.x.toFixed(3)}
              {"  "}
              Y:{odom.y >= 0 ? "+" : ""}
              {odom.y.toFixed(3)}
              {"  "}
              θ:{yawDeg.toFixed(1)}°
            </OdomInfo>
            <VelStrip>
              <MutedSmall>VEL:</MutedSmall>
              <VelVal $color={C.accent3}>Vx {vel.lx.toFixed(2)} m/s</VelVal>
              <VelVal $color={C.accent3}>Vy {vel.ly.toFixed(2)} m/s</VelVal>
              <VelVal $color={C.accent2}>ω {vel.az.toFixed(2)} rad/s</VelVal>
            </VelStrip>
          </OdomPanel>

          <ClearBtn onClick={() => setTrail([])}>🗑 CLEAR TRAIL</ClearBtn>

          <LogPanel>
            <PanelTitle>LOG</PanelTitle>
            <LogScroll ref={logRef}>
              {logs.map((l, i) => (
                <LogLine key={i} $color={l.color}>
                  [{l.ts}] {l.msg}
                </LogLine>
              ))}
            </LogScroll>
          </LogPanel>
        </RightCol>
      </MainLayout>
    </Root>
  );
}

const StatusContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const C = {
  bg: "#0d1117",
  panel: "#1e3271",
  border: "#21262d",
  accent: "#00d4aa",
  accent2: "#ff6b35",
  accent3: "#58a6ff",
  accent4: "#bc8cff",
  text: "#ffdc7c",
  muted: "#ffdc7c",
  success: "#3fb950",
  warning: "#d29922",
  danger: "#f85149",
  inputBg: "#0d1117",
  sliderBg: "#21262d",
};

const pulse = keyframes`
0%{opacity:1}
50%{opacity:.4}
100%{opacity:1}`;

const fadeIn = keyframes`
from{opacity:0;
transform:translateY(4px)}to{opacity:1;
transform:translateY(0)}`;

const Root = styled.div`
  margin-top: 80px;
  padding: 24px;
  min-height: 100vh;
  background-color: #fffbde;
  display: flex;
  flex-direction: column;
`;
// const TitleBar = styled.header`
//   display: flex;
//   align-items: center;
//   background: ${C.panel};
//   border-bottom: 1px solid ${C.border};
//   padding: 0 20px;
//   height: 48px;
//   flex-shrink: 0;
//   gap: 12px;
//   position: sticky;
//   top: 0;
//   z-index: 100;
// `;
// const TitleAccent = styled.span`
//   font-size: 15px;
//   font-weight: 700;
//   color: ${C.accent};
//   letter-spacing: 1px;
// `;
// const TitleNormal = styled.span`
//   font-size: 15px;
//   color: ${C.text};
//   letter-spacing: 1px;
// `;
const RosStatus = styled.span<{ $color: string }>`
  margin-left: auto;
  font-size: 10px;
  color: ${(p) => p.$color};
  display: flex;
  align-items: center;
  gap: 5px;
  animation: ${(p) =>
    p.$color === C.success
      ? css`
          ${pulse} 3s ease-in-out infinite
        `
      : "none"};
`;
const MainLayout = styled.main`
  display: flex;
  flex: 1;
  overflow: hidden;
  @media (max-width: 900px) {
    flex-direction: column;
    overflow: auto;
  }
`;
const LeftCol = styled.div`
  width: 440px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 16px 8px 16px 16px;
  border-right: 1px solid ${C.border};
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${C.border};
    border-radius: 2px;
  }
  @media (max-width: 900px) {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid ${C.border};
  }
`;
const RightCol = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  min-width: 0;
`;
const Panel = styled.div`
  background: ${C.panel};
  border: 1px solid ${C.border};
  border-radius: 8px;
  margin-bottom: 10px;
  animation: ${fadeIn} 0.3s ease;
  overflow: hidden;
`;
const PanelTitle = styled.div`
  font-size: 10px;
  color: ${C.muted};
  padding: 8px 12px 6px;
  border-bottom: 1px solid ${C.border};
  letter-spacing: 1.5px;
`;
const PanelBody = styled.div`
  padding: 10px 12px;
`;
const SliderRowWrap = styled.div`
  display: grid;
  grid-template-columns: 145px 1fr 80px;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;
const SliderLabel = styled.span`
  font-size: 9px;
  color: ${C.muted};
  letter-spacing: 0.5px;
`;
const SliderTrack = styled.input<{ $accent: string }>`
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: ${C.sliderBg};
  outline: none;
  cursor: pointer;
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${(p) => p.$accent};
    cursor: pointer;
    box-shadow: 0 0 6px ${(p) => p.$accent}88;
    transition: transform 0.1s;
  }
  &::-webkit-slider-thumb:active {
    transform: scale(1.3);
  }
  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${(p) => p.$accent};
    border: none;
  }
`;
const NumberInput = styled.input`
  width: 100%;
  background: ${C.inputBg};
  border: 1px solid ${C.border};
  border-radius: 4px;
  color: ${C.text};
  font-family: "Consolas", monospace;
  font-size: 11px;
  padding: 4px 6px;
  text-align: right;
  outline: none;
  &:focus {
    border-color: ${C.accent};
  }
`;
const SendBtn = styled.button<{ $accent: string }>`
  background: ${(p) => p.$accent};
  color: ${C.bg};
  border: none;
  border-radius: 5px;
  font-family: "Consolas", monospace;
  font-size: 10px;
  font-weight: 700;
  padding: 7px 16px;
  cursor: pointer;
  letter-spacing: 1px;
  float: right;
  margin: 6px 12px 10px 0;
  transition: opacity 0.15s, transform 0.1s;
  &:hover {
    opacity: 0.85;
  }
  &:active {
    transform: scale(0.96);
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;
const ActionBtn = styled.button<{ $accent: string }>`
  background: ${(p) => p.$accent};
  color: ${C.bg};
  border: none;
  border-radius: 5px;
  font-family: "Consolas", monospace;
  font-size: 10px;
  font-weight: 700;
  padding: 8px 12px;
  cursor: pointer;
  letter-spacing: 0.5px;
  transition: opacity 0.15s, transform 0.1s;
  &:hover {
    opacity: 0.85;
  }
  &:active {
    transform: scale(0.96);
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;
const PresetBtn = styled.button`
  background: ${C.border};
  color: ${C.text};
  border: none;
  border-radius: 4px;
  font-family: "Consolas", monospace;
  font-size: 8px;
  padding: 4px 8px;
  cursor: pointer;
  transition: background 0.15s;
  &:hover {
    background: ${C.muted};
  }
`;
const BtnRow = styled.div`
  display: flex;
  gap: 8px;
  padding: 6px 12px 10px;
  flex-wrap: wrap;
`;
const GoalGrid = styled.div`
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 6px;
  align-items: center;
  padding: 0 0 8px;
`;
const GoalLabel = styled.span`
  font-size: 9px;
  color: ${C.muted};
`;
const GoalInput = styled.input`
  background: ${C.inputBg};
  border: 1px solid ${C.border};
  border-radius: 4px;
  color: ${C.text};
  font-family: "Consolas", monospace;
  font-size: 11px;
  padding: 5px 8px;
  outline: none;
  width: 100%;
  &:focus {
    border-color: ${C.accent};
  }
`;
const PresetRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  flex-wrap: wrap;
`;
const MutedSmall = styled.span`
  font-size: 8px;
  color: ${C.muted};
  letter-spacing: 1px;
`;
const Hint = styled.div`
  font-size: 8px;
  color: ${C.muted};
  padding: 0 16px 8px;
`;
const OdomPanel = styled(Panel)`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;
const OdomCanvasEl = styled.canvas`
  display: block;
  flex: 1;
  background: ${C.bg};
  width: 100%;
`;
const OdomInfo = styled.div`
  padding: 6px 12px 8px;
  font-size: 9px;
  color: ${C.accent};
  border-top: 1px solid ${C.border};
`;
const ClearBtn = styled.button`
  background: ${C.border};
  color: ${C.text};
  border: none;
  border-radius: 4px;
  font-family: "Consolas", monospace;
  font-size: 9px;
  padding: 5px 12px;
  cursor: pointer;
  margin: 0 0 8px;
  transition: background 0.15s;
  &:hover {
    background: ${C.muted};
    color: ${C.bg};
  }
`;
const LogPanel = styled(Panel)`
  flex-shrink: 0;
  height: 180px;
  display: flex;
  flex-direction: column;
`;
const LogScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 6px 10px;
  font-size: 9px;
  line-height: 1.7;
  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: ${C.border};
  }
`;
const LogLine = styled.div<{ $color: string }>`
  color: ${(p) => p.$color};
`;

// Velocity readout strip
const VelStrip = styled.div`
  display: flex;
  gap: 16px;
  padding: 6px 12px 8px;
  font-size: 9px;
  border-top: 1px solid ${C.border};
`;
const VelVal = styled.span<{ $color: string }>`
  color: ${(p) => p.$color};
`;
