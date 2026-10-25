import OriginalFirmwareTuner from "./OriginalFirmwareTuner";
import type {OriginalContract} from "../utils/originalTuner";
import { startVisiblePolling, readWasCancelled } from "../utils/readPolling";
import PositionSpeedFields, {PositionSpeeds} from "./PositionSpeedFields";
import useStm32Contract from "../utils/useStm32Contract";
import Stm32PositionPolicy from "./Stm32PositionPolicy";
import PositionPidTuner from "./PositionPidTuner";
import Link from "next/link";
import type { PositionPidAction, PositionPidConfirmation } from "../utils/positionPid";
import {sendPositionGoal} from "../utils/stm32Contract";
import {
  TunerLayout,
  TunerControls,
  TunerReadout,
  GraphWorkspace,
  GraphWorkspaceHeader,
  GraphWorkspaceTitle,
  GraphWorkspaceSubtitle,
  GraphWorkspaceActions,
  GraphStats,
  GraphStat,
  GraphGrid,
  GraphWorkspaceFooter,
  TunerButton,
  ChartPanel,
  ChartTitleRow,
  ChartHeading,
  FocusButton,
  ChartLegend,
  LegendItem,
  LegendSwatch,
  ChartBody,
  Panel,
  PanelHeading,
  PoseMap as MapSvg,
  Note,
  Page,
  PageHeader,
  GraphViewButton,
  ConnectionBadge,
  GoalFields,
  InlineNote,
  PresetButton,
  Actions,
  GoButton,
  StopButton,
  ResetButton,
  ActionButton,
  ArmLabel,
  HoldButton,
  SendButton,
  OdometryText,
  LogEntries,
  WheelRowControls,
  WheelFilterButton,
  NoiseChartBody,
  CanvasNote,
  CloseGraphButton,
  WheelSelectButton,
} from "./tuner/RobotTuner.styles";

import React, { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { NumericField, assertCompleteNumbers } from "./tuner/NumericField";

const API = process.env.NEXT_PUBLIC_ROBOT_API || "";
const wheelColors = ["#00d4aa", "#58a6ff", "#ff6b35", "#bc8cff"];
const wheelNames = ["FL", "FR", "RL", "RR"];

type Pose = {
  x: number;
  y: number;
  yaw: number;
  goal_x: number;
  goal_y: number;
  goal_yaw: number;
  position_active: boolean;
  imu_ok: boolean;
};
type Telemetry = {
  ms: number;
  mask: number;
  target_rpm: number;
  target_rpm_each?: number[];
  rpm: number[];
  raw_rpm?: number[];
  ticks: number[];
  pwm: number[];
};
type PoseRow = Pose & { seq: number; t: number };
type WheelRow = Telemetry & { seq: number; t: number };
type TunerState = {
  firmware?: string;
  applied_position_pid?: Partial<Record<PositionPidAction, PositionPidConfirmation>>;
  connected: boolean;
  error?: string;
  pose?: Pose;
  telemetry?: Telemetry;
  pose_fresh?: boolean;
  telemetry_fresh?: boolean;
  pose_sequence?: number;
  telemetry_sequence?: number;
  pose_samples?: PoseRow[];
  telemetry_samples?: WheelRow[];
};
type Goal = {x:number;y:number;yaw:number};

async function api(path: string, body?: Record<string, unknown>, signal?: AbortSignal) {
  if (body) assertCompleteNumbers(body);
  const response = await fetch(
    `${API}${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { signal, cache: "no-store" }
  );
  const result = await response.json();
  if (!response.ok || result.status === "error")
    throw new Error(result.detail || `${path}: HTTP ${response.status}`);
  return result;
}

function wrapYaw(value: number) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}
function number(value: number, decimals = 3) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "—";
}

function Field({
  label,
  value,
  onChange,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
}) {
  return <NumericField label={label} value={value} onChange={onChange} />;
}

function Graph({
  title,
  rows,
  lines,
  unit = "",
  full = false,
  onFocus,
}: {
  title: string;
  rows: Record<string, number>[];
  lines: { key: string; name: string; color: string; dashed?: boolean }[];
  unit?: string;
  full?: boolean;
  onFocus?: () => void;
}) {
  return (
    <ChartPanel $full={full}>
      <ChartTitleRow $full={full}>
        <ChartHeading $full={full}>{title}</ChartHeading>
        {onFocus && (
          <FocusButton
            htmlType="button"
            onClick={onFocus}
            title="ขยายหรือย่อกราฟ"
          >
            ⤢
          </FocusButton>
        )}
      </ChartTitleRow>
      {full && (
        <ChartLegend>
          {lines.map((line) => (
            <LegendItem key={line.key}>
              <LegendSwatch $color={line.color} />
              {line.name}
            </LegendItem>
          ))}
        </ChartLegend>
      )}
      <ChartBody $full={full}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid
              stroke="#455987"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => `${Number(value).toFixed(1)}s`}
              stroke="#bdc9e4"
            />
            <YAxis
              unit={unit}
              stroke="#bdc9e4"
              tick={{ fontSize: 10 }}
              width={full ? 56 : 60}
            />
            <Tooltip />
            {lines.map((line) => (
              <Line
                key={line.key}
                type="linear"
                dataKey={line.key}
                name={line.name}
                stroke={line.color}
                strokeDasharray={line.dashed ? "5 4" : undefined}
                dot={false}
                isAnimationActive={false}
                strokeWidth={line.dashed ? 1.5 : 2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartBody>
    </ChartPanel>
  );
}

function PoseMap({
  samples,
  pose,
  goal,
}: {
  samples: PoseRow[];
  pose?: Pose;
  goal: Goal | null;
}) {
  const ext = Math.max(
    1,
    ...samples.flatMap((row) => [Math.abs(row.x), Math.abs(row.y)]),
    Math.abs(pose?.x || 0),
    Math.abs(pose?.y || 0),
    Math.abs(goal?.x || 0),
    Math.abs(goal?.y || 0)
  );
  const scale = 135 / ext;
  const px = (x: number) => 160 + x * scale;
  const py = (y: number) => 160 - y * scale;
  const path = samples.map((row) => `${px(row.x)},${py(row.y)}`).join(" ");
  return (
    <Panel>
      <PanelHeading>ODOMETRY MAP</PanelHeading>
      <MapSvg viewBox="0 0 320 320">
        <line x1="0" y1="160" x2="320" y2="160" stroke="#5c6fbb" />
        <line x1="160" y1="0" x2="160" y2="320" stroke="#5c6fbb" />
        <text x="296" y="153" fill="#ffdc7c" fontSize="11">
          +X
        </text>
        <text x="166" y="16" fill="#ffdc7c" fontSize="11">
          +Y
        </text>
        {path && (
          <polyline
            points={path}
            fill="none"
            stroke="#58a6ff"
            strokeWidth="2"
          />
        )}
        {goal && Number.isFinite(goal.x) && Number.isFinite(goal.y) && (
          <circle
            cx={px(goal.x)}
            cy={py(goal.y)}
            r="8"
            fill="none"
            stroke="#ffdc7c"
            strokeWidth="3"
          />
        )}
        {pose && (
          <>
            <circle cx={px(pose.x)} cy={py(pose.y)} r="7" fill="#f85149" />
            <line
              x1={px(pose.x)}
              y1={py(pose.y)}
              x2={px(pose.x) + Math.cos(pose.yaw) * 23}
              y2={py(pose.y) - Math.sin(pose.yaw) * 23}
              stroke="#ffffff"
              strokeWidth="3"
            />
          </>
        )}
        <text x="8" y="307" fill="#ffdc7c" fontSize="11">
          scale ±{ext.toFixed(1)} m
        </text>
      </MapSvg>
      <Note>Blue = path · Red = robot · White = yaw · Yellow = goal</Note>
    </Panel>
  );
}

export default function RobotTunerSTM() {
  const {contract,error}=useStm32Contract();
  if (!contract) return <Page><Panel><PanelHeading>STM32 TUNER</PanelHeading><Note>{error || "กำลังอ่านคำสั่งจากเฟิร์มแวร์…"}</Note></Panel></Page>;
  if (contract.protocol === "stm32_original_gvps") return <OriginalFirmwareTuner contract={contract as unknown as OriginalContract}/>;
  return <V27RobotTunerSTM/>;
}

function V27RobotTunerSTM() {
  const {contract,error:contractError}=useStm32Contract();
  const [positionSpeeds,setPositionSpeeds]=useState<PositionSpeeds>({linear_mps:.3,angular_radps:1});
  const [state, setState] = useState<TunerState>({ connected: false });
  const [message, setMessage] = useState("เชื่อมต่อ STM32 ก่อนเริ่มจูน");
  const [logs, setLogs] = useState<{ time: string; text: string }[]>([]);
  const [poseRows, setPoseRows] = useState<PoseRow[]>([]);
  const [wheelRows, setWheelRows] = useState<WheelRow[]>([]);
  const [selectedWheel, setSelectedWheel] = useState(0);
  const poseCursor = useRef(0);
  const wheelCursor = useRef(0);
  const [goal, setGoal] = useState<Goal>({ x: NaN, y: NaN, yaw: NaN });
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [goalSending, setGoalSending] = useState(false);
  const [pidSending, setPidSending] = useState(false);
  const [goalUnlocked, setGoalUnlocked] = useState(false);
  const activeGoalRef = useRef<Goal | null>(null);
  const goalPending = useRef<Promise<unknown> | null>(null);
  const goalGeneration = useRef(0);
  const retargeting = useRef(false);
  const [directSpeed, setDirectSpeed] = useState(NaN);
  const [graphView, setGraphView] = useState(false);
  const [focusedGraph, setFocusedGraph] = useState<string | null>(null);
  const [directArmed, setDirectArmed] = useState(false);
  const [directRunning, setDirectRunning] = useState(false);
  const directHeld = useRef(false);
  const directPending = useRef<Promise<unknown> | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    setLogs((old) => [
      ...old.slice(-99),
      {
        time: new Date().toLocaleTimeString("th-TH", { hour12: false }),
        text: message,
      },
    ]);
  }, [message]);

  useEffect(() => {
    if (!graphView) return;
    document.body.classList.add("tuner-graph-open");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (focusedGraph) setFocusedGraph(null);
      else setGraphView(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("tuner-graph-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [graphView, focusedGraph]);

  useEffect(() => {
    let alive = true;
    let pending = false;
    const poll = async (signal: AbortSignal) => {
      if (pending) return;
      pending = true;
      try {
        const next: TunerState = await api(
          `/api/tuner/state?pose_after=${poseCursor.current}&telemetry_after=${wheelCursor.current}`, undefined, signal
        );
        if (!alive || signal.aborted) return;
        setState(next);
        const poseRestarted = (next.pose_sequence ?? 0) < poseCursor.current;
        const wheelRestarted =
          (next.telemetry_sequence ?? 0) < wheelCursor.current;
        poseCursor.current = next.pose_sequence ?? poseCursor.current;
        wheelCursor.current = next.telemetry_sequence ?? wheelCursor.current;
        if (next.pose_samples?.length)
          setPoseRows((old) =>
            [...(poseRestarted ? [] : old), ...next.pose_samples!].slice(-800)
          );
        if (next.telemetry_samples?.length)
          setWheelRows((old) =>
            [...(wheelRestarted ? [] : old), ...next.telemetry_samples!].slice(
              -800
            )
          );
      } catch (error) {
        if (alive && !readWasCancelled(signal)) {
          setState({ connected: false });
          setMessage(`ข้อมูลบอร์ดอ่านไม่ได้: ${(error as Error).message}`);
        }
      } finally {
        pending = false;
      }
    };
    const reader = startVisiblePolling(poll, 200, { timeoutMs: 1800 });
    return () => {
      alive = false;
      reader.stop();
    };
  }, []);

  const fresh = !!(
    state.connected &&
    state.pose_fresh &&
    state.telemetry_fresh
  );
  useEffect(() => {
    if (!fresh) { setGoalUnlocked(false); setDirectArmed(false); }
  }, [fresh]);
  const stopped =
    fresh &&
    state.telemetry?.mask === 0 &&
    state.telemetry.pwm.every((value) => Math.abs(value) < 0.1) &&
    !state.pose?.position_active;
  const send = async (action: string, values: Record<string, unknown> = {}) =>
    api("/api/tuner/command", { action, ...values });
  const stop = async (reason?: string) => {
    setGoalUnlocked(false);
    goalGeneration.current += 1;
    activeGoalRef.current = null;
    retargeting.current = true;
    setActiveGoal(null);
    setGoalSending(false);
    directHeld.current = false;
    setDirectRunning(false);
    setDirectArmed(false);
    const pending = [goalPending.current, directPending.current].filter(
      Boolean
    ) as Promise<unknown>[];
    let stopError: Error | null = null;
    try {
      await send("stop");
    } catch (error) {
      stopError = error as Error;
    }
    if (pending.length) {
      await Promise.allSettled(pending);
      try {
        await send("stop");
        stopError = null;
      } catch (error) {
        stopError = error as Error;
      }
    }
    retargeting.current = false;
    if (stopError)
      setMessage(`STOP ส่งไม่สำเร็จ: ${stopError.message} · ใช้หยุดฉุกเฉิน`);
    else setMessage(reason || "STOP ส่งแล้ว · ตรวจ PWM=0 และหุ่นหยุดจริง");
  };
  const connect = async () => {
    try {
      await api("/api/tuner/connect", {
        port: "auto",
        baud: 115200,
      });
      setMessage("เชื่อมต่อแล้ว รอข้อมูลสดจาก STM32");
    } catch (error) {
      setMessage(`เชื่อมต่อไม่สำเร็จ: ${(error as Error).message}`);
    }
  };
  const start = async () => {
    const updating = !!state.pose?.position_active;
    if (!updating && !goalUnlocked) return;
    if (!contract || goalSending || !fresh || (!stopped && !updating)) {
      setMessage(
        "ต้องมีข้อมูลสดและหุ่นหยุดอยู่ หรือมี GOAL ที่กำลังทำงาน ก่อนส่งเป้าหมาย"
      );
      return;
    }
    const distance = state.pose
      ? Math.hypot(goal.x - state.pose.x, goal.y - state.pose.y)
      : NaN;
    if (![goal.x, goal.y, goal.yaw, distance].every(Number.isFinite)) {
      setMessage("พิกัดเป้าหมายต้องเป็นตัวเลขที่ถูกต้อง");
      return;
    }
    if (
      !window.confirm(
        `ยืนยัน${
          updating ? "เปลี่ยน GOAL ระหว่างวิ่ง" : "ส่ง GOAL"
        } และพื้นที่โล่งตลอดเส้นทาง ${number(
          distance,
          2
        )} ม. พร้อมคนเฝ้าหยุดฉุกเฉิน?\nเป้าหมาย X=${goal.x}, Y=${goal.y}, yaw=${
          goal.yaw
        }\nความเร็ววิ่ง ${positionSpeeds.linear_mps} m/s · หมุน ${positionSpeeds.angular_radps} rad/s · คงตำแหน่งจนกด STOP`
      )
    )
      return;
    const generation = goalGeneration.current;
    setGoalUnlocked(false);
    const nextGoal = { ...goal, ...positionSpeeds };
    retargeting.current = true;
    setGoalSending(true);
    try {
      if (updating) {
        if (goalPending.current) await goalPending.current;
      } else {
        activeGoalRef.current = null;
        setActiveGoal(null);
      }
      if (generation !== goalGeneration.current) return;
      // Target and speed caps are sent atomically; no heartbeat or PID preamble.
      const request = sendPositionGoal(api,nextGoal,contract);
      goalPending.current = request;
      try {
        await request;
      } finally {
        if (goalPending.current === request) goalPending.current = null;
      }
      if (generation !== goalGeneration.current) return;
      activeGoalRef.current = nextGoal;
      setActiveGoal(nextGoal);
      setMessage(
        updating
          ? "อัปเดต GOAL แล้ว · หุ่นกำลังไปตำแหน่งใหม่"
          : "ส่งเป้าหมายแล้ว · กราฟด้านล่างแสดงค่าจริงจาก STM32"
      );
    } catch (error) {
      if (generation === goalGeneration.current) {
        setMessage(`ส่งเป้าหมายไม่สำเร็จ: ${(error as Error).message}`);
        await stop();
      }
    } finally {
      if (generation === goalGeneration.current) {
        retargeting.current = false;
        setGoalSending(false);
      }
    }
  };
  const resetPose = async () => {
    if (
      !stopped ||
      !window.confirm(
        "หุ่นอยู่ที่จุดอ้างอิงจริงแล้วหรือยัง? Reset จะล้าง X/Y แต่ไม่เปลี่ยน yaw ของ IMU"
      )
    )
      return;
    try {
      await send("pose_reset");
      setPoseRows([]);
      setWheelRows([]);
      setMessage("Reset X/Y แล้ว · yaw ยังเป็นค่าจาก IMU");
    } catch (error) {
      setMessage(`Reset ไม่สำเร็จ: ${(error as Error).message}`);
    }
  };

  const directPulse = async () => {
    if (!directHeld.current || directPending.current) return;
    if (!Number.isFinite(directSpeed) || directSpeed <= 0 || directSpeed > 3) {
      void stop("ค่ากำลังขับไม่ครบ · ส่ง STOP");
      return;
    }
    const request = send("open_loop", { speed: directSpeed });
    directPending.current = request;
    try {
      await request;
    } catch (error) {
      directHeld.current = false;
      setDirectRunning(false);
      setDirectArmed(false);
      setMessage(
        `ทดสอบ PWM ล้มเหลว: ${
          (error as Error).message
        } · ใช้หยุดฉุกเฉินหากหุ่นไม่หยุด`
      );
    } finally {
      directPending.current = null;
      if (!directHeld.current) {
        try {
          await send("stop");
        } catch {
          setMessage("ส่ง STOP ไม่สำเร็จ · ใช้หยุดฉุกเฉิน");
        }
      }
    }
  };
  useEffect(() => {
    if (!directRunning) return;
    const timer = window.setInterval(() => {
      if (!fresh) {
        void stop();
        return;
      }
      void directPulse();
    }, 120);
    const onBlur = () => {
      void stop();
    };
    window.addEventListener("blur", onBlur);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("blur", onBlur);
    };
  }, [directRunning, directSpeed, fresh]);
  const startDirect = async () => {
    if (
      !directArmed ||
      !stopped ||
      activeGoal ||
      !Number.isFinite(directSpeed) ||
      directSpeed <= 0 ||
      directSpeed > 3
    ) {
      setMessage("เปิด ARM และตรวจข้อมูลสด/PWM=0 ก่อนกดค้างทดสอบกำลังขับ");
      return;
    }
    directHeld.current = true;
    const generation = goalGeneration.current;
    try {
      if (!directHeld.current || generation !== goalGeneration.current) {
        await send("stop");
        return;
      }
    } catch (error) {
      await stop(`ปลดล็อกไม่สำเร็จ: ${(error as Error).message}`);
      return;
    }
    setDirectRunning(true);
    setMessage(
      `กำลังทดสอบ PWM ${Math.round(
        (directSpeed / 3) * 255
      )}/255 · ปล่อยปุ่มเพื่อ STOP`
    );
    void directPulse();
  };

  const poseGraph = poseRows.map((row) => ({
    t: row.t,
    x: row.x,
    y: row.y,
    goalX: row.goal_x,
    goalY: row.goal_y,
    errorX: row.goal_x - row.x,
    errorY: row.goal_y - row.y,
    yaw: (row.yaw * 180) / Math.PI,
    goalYaw: (row.goal_yaw * 180) / Math.PI,
    errorYaw: (wrapYaw(row.goal_yaw - row.yaw) * 180) / Math.PI,
  }));
  const wheelGraph = wheelRows.map((row) => ({
    t: row.t,
    fl: row.rpm[0],
    fr: row.rpm[1],
    rl: row.rpm[2],
    rr: row.rpm[3],
    flTarget: row.target_rpm_each?.[0] ?? NaN,
    frTarget: row.target_rpm_each?.[1] ?? NaN,
    rlTarget: row.target_rpm_each?.[2] ?? NaN,
    rrTarget: row.target_rpm_each?.[3] ?? NaN,
    filtered: row.rpm[selectedWheel],
    raw: row.raw_rpm?.[selectedWheel] ?? row.rpm[selectedWheel],
    flPwm: row.pwm[0],
    frPwm: row.pwm[1],
    rlPwm: row.pwm[2],
    rrPwm: row.pwm[3],
  }));
  const graphCards: {
    id: string;
    title: string;
    rows: Record<string, number>[];
    lines: { key: string; name: string; color: string; dashed?: boolean }[];
    unit?: string;
  }[] = [
    {
      id: "position",
      title: "X / Y · GOAL vs ACTUAL",
      rows: poseGraph,
      unit: "m",
      lines: [
        { key: "goalX", name: "Goal X", color: "#ffffff", dashed: true },
        { key: "x", name: "Actual X", color: "#00d4aa" },
        { key: "goalY", name: "Goal Y", color: "#ffdc7c", dashed: true },
        { key: "y", name: "Actual Y", color: "#58a6ff" },
      ],
    },
    {
      id: "error",
      title: "POSITION ERROR · X / Y",
      rows: poseGraph,
      unit: "m",
      lines: [
        { key: "errorX", name: "X error", color: "#00d4aa" },
        { key: "errorY", name: "Y error", color: "#58a6ff" },
      ],
    },
    {
      id: "yaw",
      title: "YAW · GOAL / ACTUAL / ERROR",
      rows: poseGraph,
      unit: "°",
      lines: [
        { key: "goalYaw", name: "Goal yaw", color: "#ffffff", dashed: true },
        { key: "yaw", name: "Actual yaw", color: "#ff6b35" },
        { key: "errorYaw", name: "Yaw error", color: "#bc8cff" },
      ],
    },
    {
      id: "rpm",
      title: "WHEEL SPEED · RPM",
      rows: wheelGraph,
      unit: "rpm",
      lines: wheelNames.flatMap((name, index) => [
        { key: name.toLowerCase(), name, color: wheelColors[index] },
        {
          key: `${name.toLowerCase()}Target`,
          name: `${name} target`,
          color: wheelColors[index],
          dashed: true,
        },
      ]),
    },
    {
      id: "encoder",
      title: `ENCODER · ${wheelNames[selectedWheel]} RAW / FILTERED`,
      rows: wheelGraph,
      unit: "rpm",
      lines: [
        { key: "raw", name: "Raw", color: "#ff6b35" },
        { key: "filtered", name: "Filtered", color: "#00d4aa" },
      ],
    },
    {
      id: "pwm",
      title: "MOTOR OUTPUT · PWM",
      rows: wheelGraph,
      lines: wheelNames.map((name, index) => ({
        key: `${name.toLowerCase()}Pwm`,
        name,
        color: wheelColors[index],
      })),
    },
  ];
  const position = state.pose;
  const telemetry = state.telemetry;
  return (
    <Page>
      <PageHeader>
        <Link href="/WheelTuner">ตั้งค่า PID ล้อ FL / FR / RL / RR</Link>
        <GraphViewButton
          htmlType="button"
          disabled={directRunning}
          onClick={() => {
            setFocusedGraph(null);
            setGraphView(true);
          }}
        >
          ▦ ดูกราฟเต็มหน้า
        </GraphViewButton>
        <ConnectionBadge $fresh={fresh}>
          {fresh
            ? "● STM32 LIVE"
            : state.connected
            ? "● DATA STALE"
            : "● STM32 OFFLINE"}
        </ConnectionBadge>
      </PageHeader>
      <TunerLayout>
        <TunerControls>
          <Panel>
            <PanelHeading>STM32 CONNECTION</PanelHeading>
            <ActionButton onClick={connect} disabled={state.connected && fresh}>
              {state.connected && !fresh ? "RECONNECT STM32" : "CONNECT STM32"}
            </ActionButton>
            <Note>{message}</Note>
            <Note>
              ข้อมูลค้างจะปิดการส่งเป้าใหม่ ส่วนบอร์ดยังคงเป้าเดิม · PWM 15 kHz
            </Note>
          </Panel>
          <Panel>
            <PanelHeading>POSITION SPEED & STM32 CONTROL</PanelHeading>
            <PositionSpeedFields value={positionSpeeds} onChange={setPositionSpeeds}/>
            <details><summary>ค่าเริ่มต้นและข้อมูล Controller</summary><Stm32PositionPolicy contract={contract} error={contractError}/></details>
          </Panel>
          <PositionPidTuner
            contract={contract} speeds={positionSpeeds} onSpeedsChange={setPositionSpeeds}
            connected={state.connected} fresh={fresh} stopped={stopped} firmware={state.firmware}
            applied={state.applied_position_pid} busy={goalSending || directRunning}
            onBusyChange={setPidSending} request={api} onMessage={setMessage}
          />
          <Panel>
            <PanelHeading>POSITION COMMAND</PanelHeading>
            <GoalFields>
              <Field
                label="Goal X (m)"
                value={goal.x}
                onChange={(x) => setGoal((old) => ({ ...old, x }))}
              />
              <Field
                label="Goal Y (m)"
                value={goal.y}
                onChange={(y) => setGoal((old) => ({ ...old, y }))}
              />
              <Field
                label="Goal yaw (rad)"
                value={goal.yaw}
                onChange={(yaw) => setGoal((old) => ({ ...old, yaw }))}
              />
            </GoalFields>
            <div>
              <InlineNote>PRESETS: </InlineNote>
              <PresetButton onClick={() => setGoal({ x: 0, y: 0, yaw: 0 })}>
                Home
              </PresetButton>{" "}
              <PresetButton onClick={() => setGoal({ x: 1, y: 0, yaw: 0 })}>
                +1m X
              </PresetButton>{" "}
              <PresetButton onClick={() => setGoal({ x: 0, y: 1, yaw: 0 })}>
                +1m Y
              </PresetButton>{" "}
              <PresetButton
                onClick={() => setGoal((old) => ({ ...old, yaw: 1.5708 }))}
              >
                90°
              </PresetButton>{" "}
              <PresetButton
                onClick={() => setGoal((old) => ({ ...old, yaw: 3.14159 }))}
              >
                180°
              </PresetButton>
            </div>
            <label><input type="checkbox" checked={goalUnlocked} disabled={!stopped || goalSending}
              onChange={event => setGoalUnlocked(event.target.checked)} /> ปลดล็อกล้อสำหรับ GOAL ครั้งถัดไป</label>
            <Actions>
              <GoButton
                onClick={start}
                disabled={
                  !contract || !fresh ||
                  (!stopped && !state.pose?.position_active) ||
                  goalSending
                  || pidSending
                  || (!state.pose?.position_active && !goalUnlocked)
                }
              >
                {goalSending
                  ? "กำลังส่ง…"
                  : state.pose?.position_active
                  ? "↻ UPDATE GOAL"
                  : "▶ SEND GOAL"}
              </GoButton>
              <StopButton
                onClick={() => {
                  void stop();
                }}
              >
                ⏹ STOP
              </StopButton>
              <ResetButton onClick={resetPose} disabled={!stopped}>
                ↺ RESET ODOM
              </ResetButton>
            </Actions>
            <Note>
              แก้ X/Y/yaw แล้วกด UPDATE GOAL · STM32 ควบคุมและรักษาตำแหน่งเองจนกด STOP
            </Note>
          </Panel>
          <Panel>
            <PanelHeading>DIRECT MOTOR POWER TEST</PanelHeading>
            <Field
              label="Power request (0–3)"
              value={directSpeed}
              onChange={setDirectSpeed}
              step={0.1}
            />
            <Note>
              3 = PWM 255/255; 1.5 = PWM 128/255 · เดินหน้าอย่างเดียว
              ไม่ใช่ความเร็วจริง และไม่มีการหยุดตามระยะ
            </Note>
            <ArmLabel>
              <input
                type="checkbox"
                checked={directArmed}
                disabled={!stopped || directRunning || pidSending}
                onChange={(event) => setDirectArmed(event.target.checked)}
              />{" "}
              ARM เมื่อพื้นที่โล่งและเฝ้าหยุดฉุกเฉิน
            </ArmLabel>
            <HoldButton
              disabled={pidSending || !directArmed || (!stopped && !directRunning)}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                startDirect();
              }}
              onPointerUp={() => {
                void stop();
              }}
              onPointerCancel={() => {
                void stop();
              }}
              onLostPointerCapture={() => {
                if (directHeld.current) void stop();
              }}
            >
              {directRunning ? "ปล่อยเพื่อ STOP" : "กดค้างเพื่อทดสอบ PWM"}
            </HoldButton>
            <Note>
              เมื่อปล่อยปุ่ม/สลับหน้าต่าง/ข้อมูลค้าง จะส่ง STOP; STM32
              ตัดเองถ้าไม่ได้รับคำสั่งเกิน 400 ms
            </Note>
          </Panel>
        </TunerControls>
        <TunerReadout>
          <PoseMap
            samples={poseRows}
            pose={position}
            goal={activeGoal || goal}
          />
          <Panel>
            <PanelHeading>ODOMETRY</PanelHeading>
            <OdometryText>
              X {number(position?.x ?? NaN)} m　 Y {number(position?.y ?? NaN)}{" "}
              m　 θ {number(((position?.yaw ?? NaN) * 180) / Math.PI, 1)}°
            </OdometryText>
            <Note>
              Yaw:{" "}
              {position?.imu_ok
                ? "IMU เท่านั้น"
                : "IMU ไม่พร้อม · หยุดการวิ่งอัตโนมัติ"}{" "}
              · PWM{" "}
              {telemetry?.pwm?.map((v) => number(v, 0)).join(" / ") ?? "—"}
            </Note>
            <GraphViewButton
              disabled={directRunning}
              onClick={() => {
                setFocusedGraph(null);
                setGraphView(true);
              }}
            >
              ▦ ดูกราฟเต็มหน้า
            </GraphViewButton>{" "}
            <PresetButton
              onClick={() => {
                setPoseRows([]);
                setWheelRows([]);
              }}
            >
              🗑 CLEAR TRAIL / GRAPHS
            </PresetButton>
          </Panel>
          <Panel>
            <PanelHeading>LOG</PanelHeading>
            <LogEntries>
              {logs.map((entry, index) => (
                <div key={index}>
                  [{entry.time}] {entry.text}
                </div>
              ))}
            </LogEntries>
          </Panel>
          {!graphView && (
            <>
              <Graph
                title="X / Y — target vs actual (m)"
                rows={poseGraph}
                lines={[
                  {
                    key: "goalX",
                    name: "Goal X",
                    color: "#ffffff",
                    dashed: true,
                  },
                  { key: "x", name: "Actual X", color: "#00d4aa" },
                  {
                    key: "goalY",
                    name: "Goal Y",
                    color: "#ffdc7c",
                    dashed: true,
                  },
                  { key: "y", name: "Actual Y", color: "#58a6ff" },
                ]}
                unit="m"
              />
              <Graph
                title="X / Y position error (m)"
                rows={poseGraph}
                lines={[
                  { key: "errorX", name: "X error", color: "#00d4aa" },
                  { key: "errorY", name: "Y error", color: "#58a6ff" },
                ]}
                unit="m"
              />
              <Graph
                title="Yaw — target / actual / error (°)"
                rows={poseGraph}
                lines={[
                  {
                    key: "goalYaw",
                    name: "Goal",
                    color: "#ffffff",
                    dashed: true,
                  },
                  { key: "yaw", name: "Actual", color: "#ff6b35" },
                  { key: "errorYaw", name: "Error", color: "#bc8cff" },
                ]}
                unit="°"
              />
              <Graph
                title="Wheel target / feedback (RPM)"
                rows={wheelGraph}
                lines={wheelNames.flatMap((name, index) => [
                  { key: name.toLowerCase(), name, color: wheelColors[index] },
                  {
                    key: `${name.toLowerCase()}Target`,
                    name: `${name} target`,
                    color: wheelColors[index],
                    dashed: true,
                  },
                ])}
                unit="rpm"
              />
              <Panel>
                <WheelRowControls>
                  <PanelHeading>Encoder noise — raw vs filtered</PanelHeading>
                  {wheelNames.map((name, index) => (
                    <WheelFilterButton
                      key={name}
                      $color={wheelColors[index]}
                      $selected={selectedWheel === index}
                      onClick={() => setSelectedWheel(index)}
                    >
                      {name}
                    </WheelFilterButton>
                  ))}
                </WheelRowControls>
                <NoiseChartBody>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={wheelGraph}>
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(value) =>
                          `${Number(value).toFixed(1)}s`
                        }
                        stroke="#a6b3d1"
                      />
                      <YAxis unit="rpm" stroke="#a6b3d1" />
                      <Tooltip />
                      <Line
                        type="linear"
                        dataKey="raw"
                        name="Raw encoder RPM"
                        stroke="#ff6b35"
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="linear"
                        dataKey="filtered"
                        name="STM32 filtered RPM"
                        stroke="#00d4aa"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </NoiseChartBody>
              </Panel>
              <Graph
                title="Motor output (PWM / 255)"
                rows={wheelGraph}
                lines={wheelNames.map((name, index) => ({
                  key: `${name.toLowerCase()}Pwm`,
                  name: `${name} PWM`,
                  color: wheelColors[index],
                }))}
              />
              <CanvasNote>
                กราฟ RPM เป็นค่าจาก STM32 · โหมด XY ยังไม่มี target RPM แยกล้อ ·
                กราฟไม่ได้บันทึกเป็น preset
              </CanvasNote>
            </>
          )}
        </TunerReadout>
      </TunerLayout>
      {graphView && (
        <GraphWorkspace
          role="dialog"
          aria-label="Robot Tuner graph workspace"
          aria-modal="true"
        >
          <GraphWorkspaceHeader>
            <div>
              <GraphWorkspaceTitle>
                ROBOT TUNER <span>· LIVE GRAPHS</span>
              </GraphWorkspaceTitle>
              <GraphWorkspaceSubtitle>
                กราฟจาก STM32 ในหน้าเดียว · กด ⤢ เพื่อขยาย · Esc เพื่อกลับ
              </GraphWorkspaceSubtitle>
            </div>
            <GraphWorkspaceActions>
              <ConnectionBadge $fresh={fresh}>
                {fresh
                  ? "● LIVE"
                  : state.connected
                  ? "● DATA STALE"
                  : "● OFFLINE"}
              </ConnectionBadge>
              <StopButton
                htmlType="button"
                onClick={() => {
                  void stop();
                }}
              >
                ⏹ STOP
              </StopButton>
              <CloseGraphButton
                htmlType="button"
                onClick={() => {
                  if (focusedGraph) setFocusedGraph(null);
                  else setGraphView(false);
                }}
              >
                {focusedGraph ? "กลับทุกกราฟ" : "กลับหน้าจูน"}
              </CloseGraphButton>
            </GraphWorkspaceActions>
          </GraphWorkspaceHeader>
          <GraphStats>
            <GraphStat>
              <span>X POSITION</span>
              <strong>{number(position?.x ?? NaN)} m</strong>
            </GraphStat>
            <GraphStat>
              <span>Y POSITION</span>
              <strong>{number(position?.y ?? NaN)} m</strong>
            </GraphStat>
            <GraphStat>
              <span>YAW</span>
              <strong>
                {number(((position?.yaw ?? NaN) * 180) / Math.PI, 1)}°
              </strong>
            </GraphStat>
            <GraphStat>
              <span>RPM · FL/FR/RL/RR</span>
              <strong>
                {telemetry?.rpm?.map((v) => number(v, 0)).join(" / ") ?? "—"}
              </strong>
            </GraphStat>
            <GraphStat>
              <span>PWM · FL/FR/RL/RR</span>
              <strong>
                {telemetry?.pwm?.map((v) => number(v, 0)).join(" / ") ?? "—"}
              </strong>
            </GraphStat>
          </GraphStats>
          <GraphGrid $focused={!!focusedGraph}>
            {graphCards
              .filter((card) => !focusedGraph || card.id === focusedGraph)
              .map((card) => (
                <Graph
                  key={card.id}
                  {...card}
                  full
                  onFocus={() =>
                    setFocusedGraph((old) => (old === card.id ? null : card.id))
                  }
                />
              ))}
          </GraphGrid>
          <GraphWorkspaceFooter>
            <span>
              ช่วงข้อมูลล่าสุด: ตำแหน่ง {poseRows.length} จุด · ล้อ{" "}
              {wheelRows.length} จุด
            </span>
            <div>
              ENCODER:{" "}
              {wheelNames.map((name, index) => (
                <WheelSelectButton
                  key={name}
                  htmlType="button"
                  $color={wheelColors[index]}
                  $selected={selectedWheel === index}
                  onClick={() => setSelectedWheel(index)}
                >
                  {name}
                </WheelSelectButton>
              ))}
            </div>
            <span>
              เส้นประ RPM = เป้าหมายล้อจากเฟิร์มแวร์ v6 · เส้นทึบ = วัดจริง ·
              GOAL รักษา X/Y/yaw จนกด STOP
            </span>
          </GraphWorkspaceFooter>
        </GraphWorkspace>
      )}
    </Page>
  );
}
