import OriginalFirmwareTuner from "../../components/OriginalFirmwareTuner";
import type {OriginalContract} from "../../utils/originalTuner";
import { startVisiblePolling, readWasCancelled } from "../../utils/readPolling";
import PositionSpeedFields, {PositionSpeeds} from "../../components/PositionSpeedFields";
import useStm32Contract from "../../utils/useStm32Contract";
import Stm32PositionPolicy from "../../components/Stm32PositionPolicy";
import PositionPidTuner from "../../components/PositionPidTuner";
import type { PositionPidAction, PositionPidConfirmation } from "../../utils/positionPid";
import { sendWheelPid } from "../../utils/wheelPid";
import {sendPositionGoal} from "../../utils/stm32Contract";
import {
  TunerButton,
  Page,
  Hero,
  Title,
  Subtitle,
  ConnectionBadge,
  Warning,
  Tabs,
  TabButton,
  Panel,
  StopButton,
  SecondaryButton,
  Note,
  TabContent,
  PanelGrid,
  PanelCard,
  PrimaryButton,
  ErrorText,
  WheelButtons,
  WheelButton,
  AllWheelsButton,
  Fields,
  PresetControls,
  VelocityChartBody,
  Readings,
  WheelReading,
  PoseChartBody,
  ErrorChartBody,
  Reading,
  MapContainer,
  PoseMap,
} from "../../components/tuner/WheelTuner.styles";
import { useEffect, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  NumericField,
  assertCompleteNumbers,
} from "../../components/tuner/NumericField";

const API = process.env.NEXT_PUBLIC_ROBOT_API || "";
const wheelNames = ["FL", "FR", "RL", "RR"];
// Shared RobotTuner palette: warm canvas, blue panels, terminal-like controls.
const colors = ["#00d4aa", "#58a6ff", "#ff6b35", "#bc8cff"];

type Telemetry = {
  ms: number;
  mask: number;
  target_rpm: number;
  rpm: number[];
  raw_rpm?: number[];
  ticks: number[];
  pwm: number[];
};
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
type State = {
  firmware?: string;
  applied_position_pid?: Partial<Record<PositionPidAction, PositionPidConfirmation>>;
  connected: boolean;
  port?: string;
  error?: string;
  last_line?: string;
  telemetry?: Telemetry;
  pose?: Pose;
  pose_fresh?: boolean;
  telemetry_fresh?: boolean;
  telemetry_sequence?: number;
  pose_sequence?: number;
  pose_samples?: (Pose & { seq: number; t: number })[];
};
type Gains = { kp: number; ki: number; kd: number };
type Presets = {
  speeds: number[];
  presets: Record<string, Record<string, Gains>>;
};
type PoseSample = {
  t: number;
  x: number;
  y: number;
  yaw: number;
  goalX: number;
  goalY: number;
  goalYaw: number;
  errorX: number;
  errorY: number;
  errorYaw: number;
};

const wrapYaw = (value: number) => Math.atan2(Math.sin(value), Math.cos(value));

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
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export default function WheelTuner() {
  const {contract,error}=useStm32Contract();
  if (!contract) return <Page><Note>{error || "กำลังอ่านคำสั่งเฟิร์มแวร์…"}</Note></Page>;
  if (contract.protocol === "stm32_original_gvps") return <OriginalFirmwareTuner contract={contract as unknown as OriginalContract}/>;
  return <WheelTunerV27/>;
}

function WheelTunerV27() {
  const {contract,error:contractError}=useStm32Contract();
  const [positionSpeeds,setPositionSpeeds]=useState<PositionSpeeds>({linear_mps:.3,angular_radps:1});
  const [state, setState] = useState<State>({ connected: false });
  const [mask, setMask] = useState(1);
  const [rpm, setRpm] = useState(NaN);
  const [kp, setKp] = useState(NaN);
  const [ki, setKi] = useState(NaN);
  const [kd, setKd] = useState(NaN);
  const [presetSpeed, setPresetSpeed] = useState(50);
  const [presets, setPresets] = useState<Presets | null>(null);
  const [pidSending, setPidSending] = useState(false);
  const [message, setMessage] = useState("Connect the STM32 tuner to begin.");
  const [history, setHistory] = useState<Record<string, number>[]>([]);
  const [poseHistory, setPoseHistory] = useState<PoseSample[]>([]);
  const poseCursor = useRef(0);
  const wheelCursor = useRef(0);
  const [activeTab, setActiveTab] = useState<"tuner" | "pose">("tuner");
  const wheelCommand = useRef(NaN);
  const driveCommand = useRef({ vx: NaN, vy: NaN, wz: NaN });
  const [running, setRunning] = useState(false);
  const [startUnlocked, setStartUnlocked] = useState(false);
  useEffect(()=>{if(!state.connected)setStartUnlocked(false);},[state.connected]);
  const startGeneration = useRef(0);
  const [driveActive, setDriveActive] = useState(false);
  const [vx, setVx] = useState(NaN);
  const [vy, setVy] = useState(NaN);
  const [wz, setWz] = useState(NaN);
  const [positionActive, setPositionActive] = useState(false);
  const [goalX, setGoalX] = useState(NaN);
  const [goalY, setGoalY] = useState(NaN);
  const [goalYaw, setGoalYaw] = useState(NaN);
  useEffect(() => {
    let alive = true;
    let pending = false;
    const poll = async (signal: AbortSignal) => {
      if (pending) return;
      pending = true;
      try {
        const next: State = await api(
          `/api/tuner/state?pose_after=${poseCursor.current}&telemetry_after=${wheelCursor.current}` , undefined, signal
        );
        if (!alive || signal.aborted) return;
        wheelCursor.current = next.telemetry_sequence ?? wheelCursor.current;
        setState(next);
        if (!next.connected) {
          setRunning(false);
          setDriveActive(false);
          setPositionActive(false);
        }
        if (next.telemetry) {
          const t = next.telemetry;
          setHistory((old) =>
            [
              ...old,
              {
                t: t.ms / 1000,
                target: t.target_rpm,
                fl: t.rpm[0],
                fr: t.rpm[1],
                rl: t.rpm[2],
                rr: t.rpm[3],
              },
            ].slice(-160)
          );
        }
        if (next.pose_samples) {
          const restarted = (next.pose_sequence ?? 0) < poseCursor.current;
          poseCursor.current = next.pose_sequence ?? poseCursor.current;
          const samples = next.pose_samples.map((pose) => ({
            t: pose.t,
            x: pose.x,
            y: pose.y,
            yaw: pose.yaw,
            goalX: pose.goal_x,
            goalY: pose.goal_y,
            goalYaw: pose.goal_yaw,
            errorX: pose.goal_x - pose.x,
            errorY: pose.goal_y - pose.y,
            errorYaw: wrapYaw(pose.goal_yaw - pose.yaw),
          }));
          setPoseHistory((old) => {
            let merged = restarted ? [] : [...old];
            for (const sample of samples) {
              if (merged.length && sample.t < merged[merged.length - 1].t)
                merged = [];
              merged.push(sample);
            }
            return merged.slice(-1200);
          });
        }
      } catch {
        if (!alive || readWasCancelled(signal)) return;
        setState((old) => ({ ...old, connected: false }));
        setRunning(false);
        setDriveActive(false);
        setPositionActive(false);
      } finally {
        pending = false;
      }
    };
    const reader = startVisiblePolling(poll, 200, { timeoutMs: 1800 });
    return () => { alive = false; reader.stop(); };
  }, []);

  useEffect(() => {
    api("/api/tuner/presets")
      .then(setPresets)
      .catch(() => undefined);
  }, []);

  // Firmware deliberately stops the motors if it has not received a command
  // within one second.  Keep a 300-ms target heartbeat only while RUNNING.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      api("/api/tuner/command", {
        action: "rpm",
        rpm: wheelCommand.current,
      }).catch(() => setRunning(false));
    }, 300);
    return () => window.clearInterval(id);
  }, [running]);

  // Cartesian-drive heartbeat for T:TWIST.  With wz=0 the STM32 latches the
  // current BNO08x heading and adds a yaw correction while translating.
  useEffect(() => {
    if (!driveActive) return;
    const id = window.setInterval(() => {
      api("/api/tuner/command", {
        action: "twist",
        ...driveCommand.current,
      }).catch(() => setDriveActive(false));
    }, 300);
    return () => window.clearInterval(id);
  }, [driveActive]);

  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    if (pidSending && action !== "stop") return;
    if (action === "stop") { startGeneration.current += 1; setStartUnlocked(false); }
    try {
      await api("/api/tuner/command", { action, ...extra });
      if (action === "rpm") wheelCommand.current = extra.rpm as number;
      setMessage(`✓ ${action.toUpperCase()} sent`);
    } catch (error) {
      setMessage(`✕ ${(error as Error).message}`);
    }
  };
  const select = (nextMask: number) => {
    if (pidSending) return;
    if (running) {
      setRunning(false);
      run("stop");
    }
    if (driveActive) {
      setDriveActive(false);
      run("stop");
    }
    if (positionActive) {
      setPositionActive(false);
      run("stop");
    }
    setMask(nextMask);
    if (state.connected) run("select", { mask: nextMask });
  };
  const connect = async () => {
    try {
      await api("/api/tuner/connect", {
        port: "auto",
        baud: 115200,
      });
      setMessage("Connected. Firmware must report T:READY.");
    } catch (error) {
      setMessage(`✕ ${(error as Error).message}`);
    }
  };
  const presetWheel = mask === 15 ? "ALL" : wheelNames[Math.log2(mask)] || "FL";
  const fresh = !!(state.connected && state.pose_fresh && state.telemetry_fresh);
  const wheelsIdle = fresh && !state.pose?.position_active &&
    !!state.telemetry && state.telemetry.pwm.every(value => Math.abs(value) <= .1) &&
    state.telemetry.rpm.every(value => Math.abs(value) < 5);
  const stopped = wheelsIdle && state.telemetry?.mask === 0;
  const sendPid = async () => {
    if (!wheelsIdle || pidSending || running || driveActive || positionActive) {
      setMessage("กด STOP และรอข้อมูลสดจากบอร์ดก่อนส่ง PID ล้อ"); return;
    }
    setPidSending(true);
    try {
      const result = await sendWheelPid(api, mask, { kp, ki, kd });
      setMessage(`บอร์ดยืนยัน PID ${presetWheel}: Kp ${kp} · Ki ${ki} · Kd ${kd} · ${result.ack}`);
    } catch (error) { setMessage(`✕ ${(error as Error).message}`); }
    finally { setPidSending(false); }
  };
  const applyPreset = async () => {
    if (pidSending) return;
    const gains = presets?.presets[presetWheel]?.[String(presetSpeed)];
    if (!gains) return;
    setKp(gains.kp);
    setKi(gains.ki);
    setKd(gains.kd);
    setRpm(presetSpeed);
    await run("select", { mask });
    await run("pid", gains);
    await run("rpm", { rpm: presetSpeed });
    setMessage(`✓ Applied ${presetWheel} preset at ${presetSpeed} RPM`);
  };
  const savePreset = async () => {
    try {
      const next = await api("/api/tuner/presets", {
        wheel: presetWheel,
        speed: presetSpeed,
        gains: { kp, ki, kd },
      });
      setPresets((old) =>
        old
          ? {
              ...old,
              presets: {
                ...old.presets,
                [presetWheel]: {
                  ...old.presets[presetWheel],
                  [String(presetSpeed)]: next.preset,
                },
              },
            }
          : old
      );
      setMessage(`✓ Saved ${presetWheel} preset at ${presetSpeed} RPM`);
    } catch (error) {
      setMessage(`✕ ${(error as Error).message}`);
    }
  };
  const startSelected = async () => {
    if (pidSending) return;
    if (!startUnlocked) { setMessage("ปลดล็อกล้อก่อนกดเริ่ม"); return; }
    setStartUnlocked(false);
    const generation = startGeneration.current;
    try {
      assertCompleteNumbers({ rpm, kp, ki, kd });
      wheelCommand.current = rpm;
      setDriveActive(false);
      setPositionActive(false);
      await api("/api/tuner/command", { action: "select", mask });
      await api("/api/tuner/command", { action: "pid", kp, ki, kd });
      if (generation !== startGeneration.current) return;
      if (generation !== startGeneration.current) { await run("stop"); return; }
      await api("/api/tuner/command", { action: "rpm", rpm });
      if (generation !== startGeneration.current) { await run("stop"); return; }
      await api("/api/tuner/command", { action: "start" });
      if (generation !== startGeneration.current) { await run("stop"); return; }
      setRunning(true);
      setMessage("✓ RUNNING — heartbeat active");
    } catch (error) {
      setRunning(false);
      setMessage(`✕ ${(error as Error).message}`);
    }
  };
  const startDrive = async () => {
    if (pidSending) return;
    if (!startUnlocked) { setMessage("ปลดล็อกล้อก่อนกดเริ่ม"); return; }
    setStartUnlocked(false);
    const generation = startGeneration.current;
    try {
      assertCompleteNumbers({ vx, vy, wz });
      driveCommand.current = { vx, vy, wz };
      setRunning(false);
      setPositionActive(false);
      await api("/api/tuner/command", { action: "yaw_hold", enabled: true });
      if (generation !== startGeneration.current) return;
      if (generation !== startGeneration.current) { await run("stop"); return; }
      await api("/api/tuner/command", { action: "twist", vx, vy, wz });
      if (generation !== startGeneration.current) { await run("stop"); return; }
      setDriveActive(true);
      setMessage(
        wz === 0
          ? "✓ DRIVE — yaw hold active"
          : "✓ DRIVE — commanded rotation active"
      );
    } catch (error) {
      setDriveActive(false);
      setMessage(`✕ ${(error as Error).message}`);
    }
  };
  const startGoal = async () => {
    if (pidSending) return;
    if (!startUnlocked) { setMessage("ปลดล็อกล้อก่อนกดเริ่ม"); return; }
    setStartUnlocked(false);
    const generation = startGeneration.current;
    try {
      assertCompleteNumbers({goalX,goalY,goalYaw});
      if(!contract)throw Error("รอข้อมูลคำสั่ง STM32 ก่อนส่งเป้า");
      if (!state.connected || !state.pose_fresh || !state.telemetry_fresh)
        throw new Error("Connect STM32 and wait for fresh telemetry before a position goal");
      if (
        ![goalX, goalY, goalYaw].every(Number.isFinite) ||
        Math.max(Math.abs(goalX), Math.abs(goalY)) > 0.4 ||
        Math.max(Math.abs(state.pose!.x), Math.abs(state.pose!.y)) > 0.45
      )
        throw new Error(
          "XY goal outside centered 1×1 m test bounds; reset pose only after physically centering the robot"
        );
      setRunning(false);setDriveActive(false);
      if (generation !== startGeneration.current) return;
      if (generation !== startGeneration.current) { await run("stop"); return; }
      await sendPositionGoal(api,{x:goalX,y:goalY,yaw:goalYaw,...positionSpeeds},contract);
      if (generation !== startGeneration.current) { await run("stop"); return; }
      setPositionActive(true);
      setMessage("✓ ส่ง X/Y/yaw แล้ว · STM32 รักษาเป้าเองจนกด STOP");
    } catch (error) {
      setPositionActive(false);
      setMessage(`✕ ${(error as Error).message}`);
    }
  };
  const resetPose = async () => {
    await run("pose_reset");
    setGoalX(0);
    setGoalY(0);
    setGoalYaw(0);
  };
  const stopAll = async () => {
    setRunning(false);
    setDriveActive(false);
    setPositionActive(false);
    await run("stop");
  };

  const telemetry = state.telemetry;
  return (
    <Page>
      <Hero>
        <div>
          <Title>Wheel PID Tuner</Title>
          <Subtitle>
            STM32F103 · USB-to-TTL · 600 ticks/rev · velocity PID
          </Subtitle>
        </div>
        <ConnectionBadge $connected={fresh}>
          {fresh ? "● STM32 LIVE" : state.connected ? "● DATA STALE" : "● DISCONNECTED"}
        </ConnectionBadge>
      </Hero>
      <Warning>
        <label><input type="checkbox" checked={startUnlocked} disabled={!state.connected}
          onChange={event=>setStartUnlocked(event.target.checked)} /> ปลดล็อกล้อสำหรับการเริ่มครั้งถัดไป</label><br />
        Safety: ทดสอบ RPM ทีละล้อให้ยกล้อพ้นพื้น · ทดสอบ XY
        ให้วางหุ่นกลางพื้นที่โล่งและเฝ้าหยุดฉุกเฉิน · ต้องหยุด{" "}
        Mainprogram ในหน้า Service ก่อน Connect · โหมด RPM/TWIST มี watchdog 1 วินาที · เป้า X/Y/yaw คงอยู่ในบอร์ดจนกด STOP
      </Warning>
      <Tabs>
        <TabButton
          $active={activeTab === "tuner"}
          onClick={() => setActiveTab("tuner")}
        >
          Wheel / Drive Tuner
        </TabButton>
        <TabButton
          $active={activeTab === "pose"}
          onClick={() => setActiveTab("pose")}
        >
          Pose / IMU Check
        </TabButton>
      </Tabs>
      <Panel>
        <StopButton onClick={stopAll}>STOP ALL</StopButton>
        <SecondaryButton onClick={connect} disabled={state.connected && fresh}>
          {state.connected && !fresh ? "Reconnect" : "Connect"}
        </SecondaryButton>
        <SecondaryButton onClick={() => setPoseHistory([])}>
          Clear graph
        </SecondaryButton>
        <Note role="status">{message}</Note>
        <Note>
          กราฟติดตามคำสั่งจากระบบจูนเดียวกัน ·
          ดูกราฟอย่างเดียวไม่สั่งให้หุ่นเคลื่อนที่
        </Note>
      </Panel>
      <Panel>
        <h2>ตั้งค่า PID X / Y / Yaw ตามสปีด · บอร์ดล้อ STM32</h2>
        <PositionSpeedFields value={positionSpeeds} onChange={setPositionSpeeds}/>
        <PositionPidTuner
          contract={contract} speeds={positionSpeeds} onSpeedsChange={setPositionSpeeds}
          connected={state.connected} fresh={fresh} stopped={stopped} firmware={state.firmware}
          applied={state.applied_position_pid} busy={running || driveActive || positionActive}
          onBusyChange={setPidSending} request={api} onMessage={setMessage}
        />
      </Panel>
      <YawFeedback samples={poseHistory} />
      <TabContent $active={activeTab === "tuner"}>
        <PanelGrid>
          <PanelCard>
            <h2>1. Connection</h2>
            <PrimaryButton onClick={connect} disabled={state.connected && fresh}>
              {state.connected && !fresh ? "Reconnect USB-to-TTL" : "Connect USB-to-TTL"}
            </PrimaryButton>
            <SecondaryButton
              onClick={() =>
                api("/api/tuner/disconnect").then(() =>
                  setMessage("Disconnected")
                )
              }
            >
              Disconnect
            </SecondaryButton>
            <Note>{message}</Note>
            {state.error && <ErrorText>{state.error}</ErrorText>}
          </PanelCard>
          <PanelCard>
            <h2>2. Select wheel</h2>
            <WheelButtons>
              {wheelNames.map((name, i) => (
                <WheelButton
                  key={name}
                  onClick={() => select(1 << i)}
                  $color={colors[i]}
                  $selected={mask === 1 << i}
                >
                  {name}
                </WheelButton>
              ))}
              <AllWheelsButton
                onClick={() => select(15)}
                $selected={mask === 15}
              >
                ALL 4
              </AllWheelsButton>
            </WheelButtons>
            <Note>เลือกทีละล้อเพื่อเช็กทิศ/encoder ก่อน แล้วค่อย ALL 4</Note>
          </PanelCard>
          <PanelCard>
            <h2>3. ตั้งค่า PID ความเร็วล้อ {presetWheel}</h2>
            <Fields>
              <Field label="Target RPM" value={rpm} set={setRpm} step={1} />
              <Field label="Kp" value={kp} set={setKp} step={0.01} />
              <Field label="Ki" value={ki} set={setKi} step={0.001} />
              <Field label="Kd" value={kd} set={setKd} step={0.01} />
            </Fields>
            <SecondaryButton onClick={() => run("select", { mask })}>
              Apply selection
            </SecondaryButton>
            <SecondaryButton onClick={sendPid} disabled={!wheelsIdle || pidSending || running || driveActive || positionActive}>
              {pidSending ? "กำลังส่ง PID…" : `ส่ง PID ${presetWheel} ไปบอร์ด`}
            </SecondaryButton>
            <Note>เลือกชุดล้อและส่ง Kp/Ki/Kd พร้อมรอ ACK · ปุ่มนี้ไม่ส่ง RPM หรือ START</Note>
            <SecondaryButton onClick={() => run("rpm", { rpm })}>
              Send target
            </SecondaryButton>
            <PrimaryButton onClick={startSelected} disabled={pidSending}>
              {running ? "RUNNING" : "Start selected"}
            </PrimaryButton>
            <StopButton onClick={stopAll}>STOP ALL</StopButton>
            <PresetControls>
              <b>Speed preset</b>
              <select
                value={presetSpeed}
                onChange={(e) => setPresetSpeed(Number(e.target.value))}
              >
                {[50, 100, 150, 200, 250, 300, 350, 400].map((speed) => (
                  <option key={speed} value={speed}>
                    {speed} RPM
                  </option>
                ))}
              </select>
              <SecondaryButton onClick={applyPreset} disabled={pidSending}>
                Apply {presetWheel}
              </SecondaryButton>
              <SecondaryButton onClick={savePreset}>
                Save current
              </SecondaryButton>
            </PresetControls>
          </PanelCard>
          <PanelCard>
            <h2>4. Omni drive + IMU yaw hold</h2>
            <Fields>
              <Field
                label="vx forward (m/s)"
                value={vx}
                set={setVx}
                step={0.01}
              />
              <Field label="vy left (m/s)" value={vy} set={setVy} step={0.01} />
              <Field
                label="wz CCW (rad/s)"
                value={wz}
                set={setWz}
                step={0.05}
              />
            </Fields>
            <PrimaryButton onClick={startDrive} disabled={pidSending}>
              {driveActive ? "DRIVING" : "Drive with yaw hold"}
            </PrimaryButton>
            <StopButton onClick={stopAll}>STOP ALL</StopButton>
            <Note>
              Set wz=0 to hold the current heading. Use wz only for a deliberate
              rotation; releasing it latches the new heading.
            </Note>
          </PanelCard>
          <PanelCard>
            <h2>5. XY position + yaw control</h2>
            <Fields>
              <Field
                label="Goal X forward (m)"
                value={goalX}
                set={setGoalX}
                step={0.01}
              />
              <Field
                label="Goal Y left (m)"
                value={goalY}
                set={setGoalY}
                step={0.01}
              />
              <Field
                label="Goal yaw (rad)"
                value={goalYaw}
                set={setGoalYaw}
                step={0.05}
              />
            </Fields>
            <Stm32PositionPolicy contract={contract} error={contractError}/>
            <SecondaryButton onClick={resetPose}>
              Reset X/Y (คง yaw จาก IMU)
            </SecondaryButton>
            <PrimaryButton onClick={startGoal} disabled={pidSending || !contract || !state.connected || !state.pose_fresh || !state.telemetry_fresh}>
              {positionActive ? "GOAL ACTIVE" : "Go to target"}
            </PrimaryButton>
            <StopButton onClick={stopAll}>STOP ALL</StopButton>
            <Note>
              Pose: X {state.pose?.x?.toFixed(3) ?? "0.000"} m · Y{" "}
              {state.pose?.y?.toFixed(3) ?? "0.000"} m · yaw{" "}
              {state.pose?.yaw?.toFixed(3) ?? "0.000"} rad · IMU{" "}
              {state.pose?.imu_ok ? "READY" : "NOT FOUND"}
            </Note>
          </PanelCard>
        </PanelGrid>
        <Panel>
          <h2>Velocity feedback (Kalman-filtered RPM)</h2>
          <VelocityChartBody>
            <ResponsiveContainer>
              <LineChart data={history}>
                <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#ffffff"
                  dot={false}
                  name="Target"
                />
                {wheelNames.map((n, i) => (
                  <Line
                    key={n}
                    type="monotone"
                    dataKey={n.toLowerCase()}
                    stroke={colors[i]}
                    dot={false}
                    name={n}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </VelocityChartBody>
        </Panel>
        <Readings>
          {wheelNames.map((name, i) => (
            <WheelReading key={name} $color={colors[i]}>
              <b>{name}</b>
              <strong>{telemetry?.rpm?.[i]?.toFixed(1) ?? "0.0"} RPM</strong>
              <span>Target: {telemetry?.target_rpm?.toFixed(1) ?? "0.0"}</span>
              <span>Encoder: {telemetry?.ticks?.[i] ?? 0}</span>
              <span>PWM: {telemetry?.pwm?.[i]?.toFixed(0) ?? 0}</span>
            </WheelReading>
          ))}
        </Readings>
      </TabContent>
      <TabContent $active={activeTab === "pose"}>
        <PoseDiagnostics pose={state.pose} samples={poseHistory} />
      </TabContent>
    </Page>
  );
}

function YawFeedback({ samples }: { samples: PoseSample[] }) {
  const data = samples.map((s) => ({
    t: s.t,
    actual: (s.yaw * 180) / Math.PI,
    target: (s.goalYaw * 180) / Math.PI,
    error: (s.errorYaw * 180) / Math.PI,
  }));
  const latest = data[data.length - 1];
  return (
    <Panel>
      <h2>Yaw tuning — Target / Actual (°)</h2>
      <Note>
        Target {latest?.target.toFixed(2) ?? "—"}° · Actual{" "}
        {latest?.actual.toFixed(2) ?? "—"}° · Error{" "}
        {latest?.error.toFixed(2) ?? "—"}°
      </Note>
      <PoseChartBody>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v) => `${Number(v).toFixed(1)}s`}
            />
            <YAxis unit="°" />
            <Tooltip />
            <Line
              type="stepAfter"
              dataKey="target"
              stroke="#ffffff"
              dot={false}
              isAnimationActive={false}
              name="Target (°)"
            />
            <Line
              type="linear"
              dataKey="actual"
              stroke="#00d4aa"
              dot={false}
              isAnimationActive={false}
              name="Actual yaw (°)"
            />
          </LineChart>
        </ResponsiveContainer>
      </PoseChartBody>
      <ErrorChartBody>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v) => `${Number(v).toFixed(1)}s`}
            />
            <YAxis unit="°" />
            <Tooltip />
            <Line
              type="linear"
              dataKey="error"
              stroke="#ff6b35"
              dot={false}
              isAnimationActive={false}
              name="Yaw error (°)"
            />
          </LineChart>
        </ResponsiveContainer>
      </ErrorChartBody>
      <Note>
        White = target · Green = IMU yaw · Orange = error ·
        แสดงตัวอย่างจากบอร์ดโดยไม่ทำ smoothing เพิ่ม
      </Note>
    </Panel>
  );
}

function Field({
  label,
  value,
  set,
  step,
}: {
  label: string;
  value: number;
  set: (v: number) => void;
  step: number;
}) {
  return <NumericField label={label} value={value} onChange={set} />;
}

function PoseDiagnostics({
  pose,
  samples,
}: {
  pose?: Pose;
  samples: PoseSample[];
}) {
  const latest = samples[samples.length - 1];
  const extent = Math.max(
    0.2,
    ...samples.flatMap((s) => [
      Math.abs(s.x),
      Math.abs(s.y),
      Math.abs(s.goalX),
      Math.abs(s.goalY),
    ])
  );
  const scale = 130 / extent;
  const toX = (x: number) => 160 + x * scale;
  const toY = (y: number) => 160 - y * scale;
  const path = samples.map((s) => `${toX(s.x)},${toY(s.y)}`).join(" ");
  const headingX = latest ? toX(latest.x) + Math.cos(latest.yaw) * 22 : 160;
  const headingY = latest ? toY(latest.y) - Math.sin(latest.yaw) * 22 : 160;
  return (
    <>
      <Readings>
        <Reading>
          <b>IMU / yaw</b>
          <strong>{pose?.yaw?.toFixed(3) ?? "0.000"} rad</strong>
          <span>{pose?.imu_ok ? "IMU READY" : "IMU NOT FOUND"}</span>
        </Reading>
        <Reading>
          <b>Pose X / Y</b>
          <strong>
            {pose?.x?.toFixed(3) ?? "0.000"} / {pose?.y?.toFixed(3) ?? "0.000"}{" "}
            m
          </strong>
          <span>
            Goal: {pose?.goal_x?.toFixed(3) ?? "0.000"},{" "}
            {pose?.goal_y?.toFixed(3) ?? "0.000"}
          </span>
        </Reading>
        <Reading>
          <b>Current error</b>
          <strong>
            {latest
              ? `${latest.errorX.toFixed(3)}, ${latest.errorY.toFixed(3)} m`
              : "No pose data"}
          </strong>
          <span>Yaw: {latest?.errorYaw.toFixed(3) ?? "0.000"} rad</span>
        </Reading>
      </Readings>
      <PanelGrid>
        <PanelCard>
          <h2>Position / heading error</h2>
          <MapContainer>
            <ResponsiveContainer>
              <LineChart data={samples}>
                <XAxis dataKey="t" tickFormatter={(v) => `${v}s`} />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="errorX"
                  stroke="#00d4aa"
                  dot={false}
                  name="X error (m)"
                />
                <Line
                  type="monotone"
                  dataKey="errorY"
                  stroke="#58a6ff"
                  dot={false}
                  name="Y error (m)"
                />
                <Line
                  type="monotone"
                  dataKey="errorYaw"
                  stroke="#ff6b35"
                  dot={false}
                  name="Yaw error (rad)"
                />
              </LineChart>
            </ResponsiveContainer>
          </MapContainer>
        </PanelCard>
        <PanelCard>
          <h2>XY map — world coordinates</h2>
          <PoseMap viewBox="0 0 320 320">
            <line
              x1="0"
              y1="160"
              x2="320"
              y2="160"
              stroke="#5c6fbb"
              strokeWidth="1"
            />
            <line
              x1="160"
              y1="0"
              x2="160"
              y2="320"
              stroke="#5c6fbb"
              strokeWidth="1"
            />
            <text x="302" y="154" fill="#ffdc7c" fontSize="11">
              +X
            </text>
            <text x="164" y="14" fill="#ffdc7c" fontSize="11">
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
            {latest && (
              <>
                <circle
                  cx={toX(latest.goalX)}
                  cy={toY(latest.goalY)}
                  r="7"
                  fill="none"
                  stroke="#ffdc7c"
                  strokeWidth="3"
                />
                <circle
                  cx={toX(latest.x)}
                  cy={toY(latest.y)}
                  r="7"
                  fill="#f85149"
                />
                <line
                  x1={toX(latest.x)}
                  y1={toY(latest.y)}
                  x2={headingX}
                  y2={headingY}
                  stroke="#ffffff"
                  strokeWidth="3"
                />
              </>
            )}
            <text x="8" y="306" fill="#ffdc7c" fontSize="11">
              scale ±{extent.toFixed(2)} m
            </text>
          </PoseMap>
          <Note>
            Blue = path · Red = robot · White = yaw · Yellow ring = goal
          </Note>
        </PanelCard>
      </PanelGrid>
    </>
  );
}
