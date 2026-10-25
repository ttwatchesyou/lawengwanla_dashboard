import { subscribeJson } from "../../utils/readPolling";
import Head from "next/head";
import React, { useState, useEffect, useRef } from "react";
import styled, { keyframes, css } from "styled-components";
import {
  PlayCircleOutlined,
  RocketOutlined,
  CameraOutlined,
  CompassOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useTelemetry } from "../../hook/useTelemetry";

export const API_BASE = process.env.NEXT_PUBLIC_ROBOT_API ?? "";
export const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL;
const POLL_MS = 200;
const DETECT_POLL_MS = 500;
const MISSION_POLL_MS = 500;

const rectZones = [
  { name: "table A", x: -2.9, y: -3.7, w: -1.2, h: -0.6, color: "#FFFF00" },
  { name: "table B", x: -1.8, y: -3.7, w: 1.2, h: -0.6, color: "#f72525" },
  { name: "table C", x: -2.9, y: -1.5, w: -1.2, h: -0.6, color: "#FFFF00" },
  { name: "table D", x: -1.8, y: -1.5, w: 1.2, h: -0.6, color: "#f72525" },
  { name: "table E", x: -6.4, y: -1.5, w: 1.2, h: -0.6, color: "#277ff1" },
  { name: "table F", x: -6.4, y: -3.7, w: 1.2, h: -0.6, color: "#277ff1" },
  { name: "lift r", x: -1.1, y: -7.7, w: -1.0, h: -0.9, color: "#f72525" },
  { name: "lift b", x: -4.9, y: -7.7, w: -1.0, h: -0.9, color: "#277ff1" },
  { name: "start r", x: 0.4, y: 0.4, w: -0.8, h: -0.8, color: "#f72525" },
  { name: "start b", x: -6.6, y: 0.4, w: -0.8, h: -0.8, color: "#277ff1" },
  { name: "stage", x: 0.4, y: 0.4, w: -7.8, h: -9.0, color: "#fcfcfc" },
  { name: "mainstage", x: -1.1, y: -6.6, w: -4.8, h: -2.0, color: "#FFFF00" },
];

const C = {
  bg: "#0d1117",
  panel: "#1e3271",
  border: "#21262d",
  accent: "#00d4aa",
  accent2: "#ff6b35",
  accent3: "#58a6ff",
  text: "#ffdc7c",
  muted: "#ffdc7c80",
  success: "#3fb950",
  danger: "#f85149",
};

interface OdomState {
  x: number;
  y: number;
  yaw: number;
}
interface DetectEntry {
  ts: string;
  msg: string;
}
interface MissionStatus {
  mission_step: number;
  mission_total_steps: number;
  mission_running: boolean;
  team_color: "RED" | "BLUE" | "NONE";
  program_color: number;
  program_game: number;
  current_game: number;
  chair_count?: number;
}

const pulse = keyframes`0%,100%{opacity:1}50%{opacity:.35}`;
const fadeUp = keyframes`from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}`;
const scanPulse = keyframes`0%{box-shadow:0 0 0 0 rgba(0,212,170,0.4)}70%{box-shadow:0 0 0 8px rgba(0,212,170,0)}100%{box-shadow:0 0 0 0 rgba(0,212,170,0)}`;

// ── Components ─────────────────────────────────────────────────────────────

function OdomCanvas({ odom, trail, savedTrail, mode }: any) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState({
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
  });
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) =>
    setViewState((prev) => ({
      ...prev,
      scale: Math.max(0.1, Math.min(prev.scale - e.deltaY * 0.001, 5.0)),
    }));
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setViewState((prev) => ({
      ...prev,
      offsetX: prev.offsetX + (e.clientX - lastPos.current.x),
      offsetY: prev.offsetY + (e.clientY - lastPos.current.y),
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseUp = () => (isDragging.current = false);

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    setViewState((prev) => ({
      ...prev,
      offsetX: prev.offsetX + (e.touches[0].clientX - lastPos.current.x),
      offsetY: prev.offsetY + (e.touches[0].clientY - lastPos.current.y),
    }));
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = () => (isDragging.current = false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const W = c.clientWidth || 300,
      H = c.clientHeight || 300;
    c.width = W;
    c.height = H;

    const VIEW_RANGE_METERS = 8;
    const BASE_SCALE = Math.min(W, H) / VIEW_RANGE_METERS;
    const SCALE = BASE_SCALE * viewState.scale;
    const cx = W / 2 - odom.x * SCALE + viewState.offsetX;
    const cy = H / 2 + odom.y * SCALE + viewState.offsetY;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    const gridStep = 1;
    const startX = Math.floor((0 - cx) / SCALE),
      endX = Math.ceil((W - cx) / SCALE);
    const startY = Math.floor((cy - H) / SCALE),
      endY = Math.ceil(cy / SCALE);

    for (let gx = startX; gx <= endX; gx += gridStep) {
      const px = cx + gx * SCALE;
      ctx.strokeStyle = gx === 0 ? "#ffffff44" : C.border;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
    }
    for (let gy = startY; gy <= endY; gy += gridStep) {
      const py = cy - gy * SCALE;
      ctx.strokeStyle = gy === 0 ? "#ffffff44" : C.border;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(W, py);
      ctx.stroke();
    }

    rectZones.forEach((zone: any) => {
      const finalColor = zone.color || C.accent;
      const zx = cx + zone.x * SCALE,
        zy = cy - zone.y * SCALE,
        zw = zone.w * SCALE,
        zh = zone.h * SCALE;
      ctx.fillStyle = finalColor + "22";
      ctx.strokeStyle = finalColor;
      ctx.lineWidth = 2;
      ctx.fillRect(zx, zy - zh, zw, zh);
      ctx.strokeRect(zx, zy - zh, zw, zh);
    });

    if (savedTrail && savedTrail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = C.accent2;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.setLineDash([6, 6]);
      savedTrail.forEach((point: any, index: number) => {
        let mapX = mode === 2 ? -point.x - 7 : point.x;
        let mapY = mode === 2 ? -point.y : point.y;
        const tx = cx + mapX * SCALE,
          ty = cy - mapY * SCALE;
        index === 0 ? ctx.moveTo(tx, ty) : ctx.lineTo(tx, ty);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (trail && trail.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "#00ffee";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      trail.forEach((point: any, index: number) => {
        let mapX = mode === 2 ? -point.x - 7 : point.x;
        let mapY = mode === 2 ? -point.y : point.y;
        const tx = cx + mapX * SCALE,
          ty = cy - mapY * SCALE;
        index === 0 ? ctx.moveTo(tx, ty) : ctx.lineTo(tx, ty);
      });
      ctx.stroke();
    }

    let mapX = mode === 2 ? -odom.x - 7 : odom.x;
    let mapY = mode === 2 ? -odom.y : odom.y;
    const px2 = cx + mapX * SCALE,
      py2 = cy - mapY * SCALE;

    ctx.save();
    ctx.translate(px2, py2);
    let rotationAngle = mode === 2 ? -odom.yaw + Math.PI : odom.yaw;
    ctx.rotate(-rotationAngle);

    const rectW = 0.51 * SCALE,
      rectH = 0.52 * SCALE;
    ctx.fillStyle = "#FF69B4";
    ctx.fillRect(-rectW / 2, -rectH / 2, rectW, rectH);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1;
    ctx.strokeRect(-rectW / 2, -rectH / 2, rectW, rectH);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(rectH * 0.8, 0);
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(rectH * 0.8, 0);
    ctx.lineTo(rectH * 0.8 - 7, -5);
    ctx.lineTo(rectH * 0.8 - 7, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [odom, trail, savedTrail, mode, viewState]);

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: "350px",
        overflow: "hidden",
      }}
    >
      <OdomCanvasEl
        ref={ref}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: isDragging.current ? "grabbing" : "grab",
          touchAction: "none",
        }}
      />
      <ResetViewBtn
        onClick={() => setViewState({ scale: 1, offsetX: 0, offsetY: 0 })}
      >
        ⌖ RESET
      </ResetViewBtn>
    </div>
  );
}

function SensorStatusCard({ sensorsData }: { sensorsData: Record<string, number> }) {
  const SENSOR_CONFIG: Record<string, { label: string; activeValue: number }> = {
    LimitBoxBUp: { label: "กล่อง บน", activeValue: 0 },       
    LimitBoxBDw: { label: "กล่อง ล่าง", activeValue: 0 },
    LimitBoxBOut: { label: "กล่อง ออก", activeValue: 0 },
    LimitBoxBIn: { label: "กล่อง เข้า", activeValue: 0 },
    SW_1: { label: "สวิตช์ 1", activeValue: 0 },                   
    bottleL_B_DW: { label: "ขวดซ้าย ล่าง", activeValue: 0 },
    bottleR_B_DW: { label: "ขวดขวา ล่าง", activeValue: 0 },
    bottleL_Check: { label: "ขวดขึ้นซ้าย", activeValue: 0 }, 
    bottleR_Check: { label: "ขวดขึ้นขวา", activeValue: 0 }, 
    SensorCheckBoxUp: { label: "เซนเซอร์กล่อง", activeValue: 0 },
  };

  return (
   <Card>
      <CardHeader>HARDWARE SENSORS</CardHeader>
      <div style={{ padding: "14px" }}>
        <SensorMiniGrid>
          {Object.keys(SENSOR_CONFIG).map((key) => {
            const config = SENSOR_CONFIG[key];
            const isActive = sensorsData[key] === config.activeValue;
            
            return (
              <SensorIndicator key={key} $active={isActive}>
                <IndicatorDot $active={isActive} />
                <IndicatorLabel>{config.label}</IndicatorLabel>
              </SensorIndicator>
            );
          })}
        </SensorMiniGrid>
      </div>
    </Card>
  );
}

function MissionStatusCard({ mission }: { mission: MissionStatus | null }) {
  const colorLabel = mission?.team_color ?? "NONE";
  const stepNow = mission?.mission_step ?? 0;
  const totalSteps = mission?.mission_total_steps ?? 0;
  const isRunning = mission?.mission_running ?? false;
  const gameNum = mission?.current_game ?? 0;
  const chairCount = mission?.chair_count ?? 0;
  const progress =
    totalSteps > 0 ? Math.min((stepNow) * 100, 100) : 0;

  const [latest, setLatest] = useState<string>("");

  useEffect(() => subscribeJson<any>(`${API_BASE}/api/detected_objects`,
    data=>setLatest(data.latest??""),()=>{},DETECT_POLL_MS),[]);

  const colorize = (msg: string): string => {
    if (!msg) return C.muted;
    const lower = msg.toLowerCase();
    if (
      lower.includes("person") ||
      lower.includes("human") ||
      lower.includes("face")
    )
      return "#ff6b35";
    if (
      lower.includes("none") ||
      lower.includes("no object") ||
      msg.trim() === ""
    )
      return C.muted;
    if (
      lower.includes("bottle") ||
      lower.includes("cup") ||
      lower.includes("box")
    )
      return "#58a6ff";
    return C.accent;
  };

  return (
    <Card>
      <MCardHeader>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RocketOutlined /> MISSION STATUS
        </span>
        <MHeaderRight>
          {isRunning ? (
            <RunBadge>● RUNNING</RunBadge>
          ) : (
            <IdleBadge>○ IDLE</IdleBadge>
          )}
        </MHeaderRight>
      </MCardHeader>

      <MInfoRow>
        <MInfoBox>
          <MInfoLabel>TEAM</MInfoLabel>
          <MInfoValue
            $color={
              colorLabel === "RED"
                ? C.accent2
                : colorLabel === "BLUE"
                ? C.accent3
                : C.muted
            }
          >
            {colorLabel}
          </MInfoValue>
        </MInfoBox>
        <MInfoDivider />
        <MInfoBox>
          <MInfoLabel>GAME</MInfoLabel>
          <MInfoValue $color={gameNum > 0 ? C.text : C.muted}>
            {gameNum > 0 ? `G${gameNum}` : "—"}
          </MInfoValue>
        </MInfoBox>
        <MInfoDivider />
        <MInfoBox>
          <MInfoLabel>STEP</MInfoLabel>
          <MInfoValue $color={isRunning ? C.accent : C.muted}>
            {stepNow}
          </MInfoValue>
        </MInfoBox>
        <MInfoDivider />
        <MInfoBox>
          <MInfoLabel>CHAIRS</MInfoLabel>
          <MInfoValue $color={chairCount > 0 ? C.accent : C.muted}>
            {chairCount > 0 ? chairCount : "0"}
          </MInfoValue>
        </MInfoBox>
      </MInfoRow>

      {totalSteps > 0 && (
        <ProgressWrap>
          <ProgressBar style={{ width: `${progress}%` }} $running={isRunning} />
          <ProgressLabel>{progress.toFixed(0)}%</ProgressLabel>
        </ProgressWrap>
      )}

      {totalSteps > 0 && (
        <StepBubbleRow>
          {Array.from({ length: Math.min(totalSteps, 20) }, (_, i) => (
            <StepBubble
              key={i}
              $done={i < stepNow}
              $current={i === stepNow - 1}
              title={`Step ${i + 1}`}
            />
          ))}
          {totalSteps > 20 && <StepMore>+{totalSteps - 20}</StepMore>}
        </StepBubbleRow>
      )}

      <LatestWrap>
        <LatestLabel>LATEST DETECTED OBJECT</LatestLabel>
        <LatestValue $color={colorize(latest)}>{latest || "—"}</LatestValue>
      </LatestWrap>
    </Card>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────

export default function TelemetryDashboard() {
  const [activeMode, setActiveMode] = useState(1);
  const [data, setData] = useState<any>(null);
  const [ros, setRos] = useState<"online" | "offline">("offline");
  const [odom, setOdom] = useState<OdomState>({ x: 0, y: 0, yaw: 0 });
  const { telemetry } = useTelemetry(300);
  const sensorsData = telemetry?.arduino_sensors ?? {};

  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const [savedTrails, setSavedTrails] = useState<
    { name: string; data: { x: number; y: number }[] }[]
  >([]);
  const [activeLogIndex, setActiveLogIndex] = useState<number | null>(null);

  const [selectedColor, setSelectedColor] = useState<0 | 1 | null>(null);
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const [mission, setMission] = useState<MissionStatus | null>(null);

  const [isResetting, setIsResetting] = useState(false);
  const prevStepRef = useRef<number>(0);

  async function post(path: string, body: Record<string, unknown> = {}) {
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

  const onSelectColor = (color: 0 | 1) => {
    setSelectedColor(color);
    setActiveMode(color === 0 ? 1 : 2);
    post("/api/cmd/program_color", { color });
  };
  const onSelectGame = (game: number) => {
    setSelectedGame(game);
    post("/api/cmd/program_game", { game });
  };
  const onStart = () => post("/api/cmd/program_command", { command: 1 });

  const onResetController = async () => {
    if (
      !window.confirm("คุณแน่ใจหรือไม่ที่จะ Restart ระบบ SudSakhon Controller?")
    )
      return;
    setIsResetting(true);
    await post("/api/restart", { service: "sudsakhon_main.service" });
    setTimeout(() => setIsResetting(false), 2000);
  };

  useEffect(() => subscribeJson<MissionStatus>(`${API_BASE}/api/mission/status`,d=>{
          setMission(d);
          if (
            d.mission_step === d.mission_total_steps &&
            d.mission_total_steps > 0 &&
            prevStepRef.current !== d.mission_step
          ) {
            setSelectedColor(null);
            setSelectedGame(null);
            setActiveMode(1);
          }
          prevStepRef.current = d.mission_step;
  },()=>{},MISSION_POLL_MS),[]);

  useEffect(() => subscribeJson<any>(`${API_BASE}/api/telemetry`,d=>{
    setData(d);setRos("online");
    const point={x:d.pose_x??0,y:d.pose_y??0};setOdom({...point,yaw:d.yaw??0});
    setTrail(old=>{
      const last=old[old.length-1];
      return last && last.x===point.x && last.y===point.y?old:[...old,point].slice(-5000);
    });
  },()=>setRos("offline"),POLL_MS),[]);

  const handleSaveTrail = () => {
    if (trail.length === 0) return;
    setSavedTrails((prev) => [
      ...prev,
      {
        name: `Run ${new Date().toLocaleTimeString("th-TH")}`,
        data: [...trail],
      },
    ]);
  };

  const handleDeleteLog = (idx: number) => {
    setSavedTrails((prev) => prev.filter((_, i) => i !== idx));
    if (activeLogIndex === idx) setActiveLogIndex(null);
    else if (activeLogIndex !== null && activeLogIndex > idx)
      setActiveLogIndex(activeLogIndex - 1);
  };

  const yawDeg = ((odom.yaw * 180) / Math.PI + 360) % 360;
  const activeSavedTrailData =
    activeLogIndex !== null ? savedTrails[activeLogIndex].data : null;

  return (
    <>
      <Head>
        <title>Mechatronics and Robotics</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="/logo/MechaLogo.png" rel="icon" />
      </Head>
      <Root>
        <StatusBar>
          <STitle>● ROBOT TELEMETRY DASHBOARD</STitle>
          <RosStatus $online={ros === "online"}>
            {ros === "online" ? "● ROS ONLINE" : "● ROS OFFLINE"}
          </RosStatus>
        </StatusBar>

        <MainGrid>
          {/* 📍 LEFT COLUMN : Map & Settings */}
          <Column>
            <Card>
              <CardHeader>
                <HeaderLeft>
                  <CompassOutlined /> ODOMETRY MAP
                </HeaderLeft>
                <ClearBtn onClick={() => setTrail([])}>🗑 CLEAR TRAIL</ClearBtn>
              </CardHeader>
              <OdomCanvas
                odom={odom}
                trail={trail}
                savedTrail={activeSavedTrailData}
                mode={activeMode}
              />
              <OdomFooter>
                <OC>
                  X: {odom.x >= 0 ? "+" : ""}
                  {odom.x.toFixed(3)}
                </OC>
                <OC>
                  Y: {odom.y >= 0 ? "+" : ""}
                  {odom.y.toFixed(3)}
                </OC>
                <OC>θ: {yawDeg.toFixed(1)}°</OC>
              </OdomFooter>

              <SectionDivider>MAP LOGS</SectionDivider>
              <div style={{ padding: "8px 14px 14px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginBottom: 8,
                  }}
                >
                  <ActionBtn
                    style={{
                      height: "26px",
                      width: "auto",
                      padding: "0 12px",
                      fontSize: "10px",
                    }}
                    onClick={handleSaveTrail}
                  >
                    💾 SAVE CURRENT
                  </ActionBtn>
                </div>
                {savedTrails.length === 0 && (
                  <LogEmpty>No saved trails.</LogEmpty>
                )}
                {savedTrails.map((st, i) => (
                  <TrailLogBox key={i}>
                    <span>
                      {st.name}{" "}
                      <span style={{ color: C.muted }}>
                        ({st.data.length} pts)
                      </span>
                    </span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <ClearBtn
                        style={{
                          background:
                            activeLogIndex === i ? C.accent : "transparent",
                          color: activeLogIndex === i ? C.bg : C.text,
                          border: `1px solid ${C.accent}`,
                        }}
                        onClick={() =>
                          setActiveLogIndex(activeLogIndex === i ? null : i)
                        }
                      >
                        {activeLogIndex === i ? "HIDE" : "VIEW"}
                      </ClearBtn>
                      <ClearBtn
                        style={{
                          color: C.danger,
                          border: `1px solid ${C.danger}44`,
                        }}
                        onClick={() => handleDeleteLog(i)}
                      >
                        DELETE
                      </ClearBtn>
                    </div>
                  </TrailLogBox>
                ))}
              </div>
            </Card>

            {/* 📍 ย้าย MISSION SETTINGS มาไว้ฝั่งซ้าย */}
            <Card>
              <CardHeader>
                <SettingOutlined /> MISSION SETTINGS
              </CardHeader>
              <MissionBody>
                <SectionLabel>TEAM COLOR</SectionLabel>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  <ToggleBtn
                    $active={selectedColor === 0}
                    $variant="red"
                    onClick={() => onSelectColor(0)}
                  >
                    RED
                  </ToggleBtn>
                  <ToggleBtn
                    $active={selectedColor === 1}
                    $variant="blue"
                    onClick={() => onSelectColor(1)}
                  >
                    BLUE
                  </ToggleBtn>
                </div>

                <SectionLabel style={{ marginTop: 14 }}>GAME MODE</SectionLabel>
                <GameGrid>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((g) => (
                    <GameBtn
                      key={g}
                      $active={selectedGame === g}
                      onClick={() => onSelectGame(g)}
                    >
                      G{g}
                    </GameBtn>
                  ))}
                </GameGrid>

                <ActionRowGrid style={{ marginTop: 14 }}>
                  <ActionBtn onClick={onStart}>
                    <PlayCircleOutlined /> START MISSION
                  </ActionBtn>
                  <ResetCtrlBtn
                    onClick={onResetController}
                    disabled={isResetting}
                  >
                    {isResetting ? "🔄 RESTARTING..." : "↻ RESTART CONTROLLER"}
                  </ResetCtrlBtn>
                </ActionRowGrid>
              </MissionBody>
            </Card>
          </Column>

          {/* 📍 RIGHT COLUMN : Vision, Sensors & Mission Control */}
          <Column>
            <Card>
              <CardHeader>
                <span>
                  <CameraOutlined /> AI VISION
                </span>
                <span
                  style={{
                    color: C.accent3,
                    fontSize: "0.6rem",
                    letterSpacing: 1,
                  }}
                >
                  YOLO / FACE
                </span>
              </CardHeader>
              <StreamWrap>
                <img src={STREAM_URL} alt="live" />
              </StreamWrap>
            </Card>

            {/* 📍 ย้าย HARDWARE SENSORS มาไว้ฝั่งขวา */}
            <SensorStatusCard sensorsData={sensorsData} />

            <MissionStatusCard mission={mission} />
          </Column>
        </MainGrid>

        {!data && <Loader>INITIALIZING TELEMETRY…</Loader>}
      </Root>
    </>
  );
}

// ── Styled Components ──────────────────────────────────────────────────────

const Root = styled.div`
  min-height: 100vh;
  background: #fffbde;
  padding: 16px;
  margin-top: 80px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
  font-family: "Consolas", "Courier New", monospace;
`;
const StatusBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${C.panel};
  border-radius: 12px;
  padding: 10px 20px;
  border: 1px solid ${C.border};
`;
const STitle = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: ${C.text};
  letter-spacing: 2px;
`;
const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  flex: 1;
  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;
const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;
const Card = styled.div`
  background: ${C.panel};
  border-radius: 12px;
  border: 1px solid ${C.border};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ${fadeUp} 0.3s ease;
`;
const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.8px;
  color: ${C.text};
  border-bottom: 1px solid ${C.border};
  background: rgba(0, 0, 0, 0.15);
`;
const SectionDivider = styled.div`
  padding: 8px 16px;
  font-size: 10px;
  font-weight: bold;
  color: ${C.text};
  background: rgba(0, 0, 0, 0.1);
  border-top: 1px solid ${C.border};
  border-bottom: 1px solid ${C.border};
`;
const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
const StreamWrap = styled.div`
  aspect-ratio: 16 / 9;
  background: #000;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;
const OdomCanvasEl = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
  background: ${C.bg};
`;
const ResetViewBtn = styled.button`
  position: absolute;
  bottom: 15px;
  right: 15px;
  background: ${C.bg};
  color: ${C.accent};
  border: 1px solid ${C.accent};
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  z-index: 5;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
  transition: all 0.2s;
  &:hover {
    background: ${C.accent};
    color: ${C.bg};
  }
`;
const OdomFooter = styled.div`
  display: flex;
  gap: 20px;
  padding: 10px 16px;
  border-top: 1px solid ${C.border};
`;
const OC = styled.span`
  font-size: 16px;
  font-weight: bold;
  color: ${C.accent};
`;
const ClearBtn = styled.button`
  background: transparent;
  color: ${C.text};
  border: 1px solid ${C.border};
  border-radius: 4px;
  font-family: "Consolas", monospace;
  font-size: 9px;
  font-weight: 700;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover {
    background: ${C.muted};
    color: ${C.bg};
  }
`;
const TrailLogBox = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px dashed ${C.border};
  font-size: 12px;
  color: ${C.text};
  &:last-child {
    border-bottom: none;
  }
`;
const MissionBody = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
const SectionLabel = styled.div`
  color: rgba(255, 220, 124, 0.6);
  font-size: 0.7rem;
  letter-spacing: 1px;
  margin-bottom: 4px;
`;
const ToggleBtn = styled.button<{ $active: boolean; $variant: "red" | "blue" }>`
  height: 48px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: bold;
  color: white;
  border: 2px solid ${(p) => (p.$active ? "#ffdc7c" : "transparent")};
  box-shadow: ${(p) => (p.$active ? "0 0 12px rgba(255,220,124,0.4)" : "none")};
  background: ${(p) =>
    p.$variant === "red"
      ? p.$active
        ? "#ff4d4f"
        : "#4a1b1b"
      : p.$active
      ? "#1677ff"
      : "#1b2a4a"};
  transition: all 0.15s;
`;
const GameGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
`;
const GameBtn = styled.button<{ $active: boolean }>`
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  background: ${(p) => (p.$active ? "#ffdc7c" : "rgba(255,255,255,0.05)")};
  color: ${(p) => (p.$active ? "#1e3271" : "#ffdc7c")};
  border: 1px solid ${(p) => (p.$active ? "#ffdc7c" : "rgba(255,220,124,0.2)")};
  transition: all 0.15s;
  &:hover {
    border-color: #ffdc7c;
  }
`;
const ActionRowGrid = styled.div`
  display: flex;
  grid-template-columns: 1fr;
  gap: 10px;
`;
const ActionBtn = styled.button<{ $danger?: boolean }>`
  height: 48px;
  font-weight: bold;
  border-radius: 10px;
  width: 100%;
  cursor: pointer;
  border: none;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: ${(p) => (p.$danger ? "#ff4d4f" : "#1677ff")};
  color: white;
  transition: opacity 0.15s;
  &:hover {
    opacity: 0.85;
  }
`;
const ResetCtrlBtn = styled(ActionBtn)`
  background: #f87171;
  border: 1px solid #f87171;
  color: #ffffff;
  &:hover {
    background: rgba(248, 113, 113, 0.1);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
const SensorMiniGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
`;
const SensorIndicator = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${(p) =>
    p.$active ? "rgba(74, 222, 128, 0.15)" : "rgba(255, 255, 255, 0.03)"};
  border: 1px solid
    ${(p) => (p.$active ? "#4ade80" : "rgba(255, 255, 255, 0.05)")};
`;
const IndicatorDot = styled.div<{ $active: boolean }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => (p.$active ? "#4ade80" : "#555")};
  box-shadow: ${(p) => (p.$active ? "0 0 8px #4ade80" : "none")};
`;
const IndicatorLabel = styled.span`
  font-size: 11px;
  color: #fff;
  white-space: nowrap;
`;
const RosStatus = styled.span<{ $online: boolean }>`
  font-size: 11px;
  font-weight: bold;
  letter-spacing: 1px;
  color: ${(p) => (p.$online ? C.success : C.danger)};
  ${(p) =>
    p.$online &&
    css`
      animation: ${pulse} 3s ease-in-out infinite;
    `}
`;
const Loader = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fffbdecc;
  font-weight: 700;
  font-size: 1.2rem;
  letter-spacing: 2px;
  color: ${C.panel};
  z-index: 999;
`;
const LatestWrap = styled.div`
  padding: 12px 16px;
  border-top: 1px solid ${C.border};
  background: rgba(0, 0, 0, 0.1);
`;
const LatestLabel = styled.div`
  font-size: 8px;
  font-weight: bold;
  letter-spacing: 1.5px;
  color: ${C.muted};
  margin-bottom: 4px;
`;
const LatestValue = styled.div<{ $color: string }>`
  font-size: 1.2rem;
  font-weight: 700;
  color: ${(p) => p.$color};
`;
const LogEmpty = styled.div`
  font-size: 10px;
  color: ${C.muted};
  padding: 12px 0;
  text-align: center;
`;
const MCardHeader = styled(CardHeader)``;
const MHeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;
const RunBadge = styled.span`
  font-size: 9px;
  font-weight: bold;
  color: ${C.success};
  animation: ${pulse} 2s infinite;
`;
const IdleBadge = styled.span`
  font-size: 9px;
  font-weight: bold;
  color: ${C.muted};
`;
const MInfoRow = styled.div`
  display: flex;
  padding: 16px;
  border-bottom: 1px solid ${C.border};
`;
const MInfoBox = styled.div`
  flex: 1;
  text-align: center;
`;
const MInfoLabel = styled.div`
  font-size: 8px;
  font-weight: bold;
  color: ${C.muted};
  letter-spacing: 1.5px;
  margin-bottom: 6px;
`;
const MInfoValue = styled.div<{ $color: string }>`
  font-size: 20px;
  font-weight: 700;
  color: ${(p) => p.$color};
`;
const MInfoDivider = styled.div`
  width: 1px;
  height: 40px;
  background: ${C.border};
`;
const ProgressWrap = styled.div`
  position: relative;
  margin: 24px 16px;
  height: 8px;
  background: ${C.border};
  border-radius: 4px;
`;
const ProgressBar = styled.div<{ $running: boolean }>`
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
  background: ${(p) => (p.$running ? C.accent : C.muted)};
  ${(p) =>
    p.$running &&
    css`
      animation: ${scanPulse} 2s infinite;
    `}
`;
const ProgressLabel = styled.div`
  position: absolute;
  right: 0;
  top: -18px;
  font-size: 9px;
  font-weight: bold;
  color: ${C.muted};
`;
const StepBubbleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 16px 16px;
`;
const StepBubble = styled.div<{ $done: boolean; $current: boolean }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${(p) =>
    p.$current ? C.accent : p.$done ? C.accent + "88" : C.border};
  border: 1px solid ${(p) => (p.$current ? C.accent : "transparent")};
  ${(p) =>
    p.$current &&
    css`
      animation: ${scanPulse} 1.5s infinite;
    `}
`;
const StepMore = styled.span`
  font-size: 9px;
  font-weight: bold;
  color: ${C.muted};
  line-height: 12px;
`;
