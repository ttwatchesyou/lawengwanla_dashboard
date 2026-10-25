import { subscribeJson } from "../utils/readPolling";
import { useReadClock } from "../utils/useReadClock";
import useStm32Contract from "../utils/useStm32Contract";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "antd";
import styled from "styled-components";
import RobotTopView from "./RobotTopView";
import RobotWallPreview from "./RobotWallPreview";
import { CELL_METERS, isCell, MazeCell } from "../utils/mazeRoute";
import { makeSimulationPlan, sampleSimulation } from "../utils/robotSimulation";
import {
  buildPreviewWalls,
  PREVIEW_TOF_RANGE_M,
  previewWallReadings,
} from "../utils/mazeWalls";
import {
  settingsForCell,
  WaypointSettingsMap,
} from "../utils/waypointSettings";
import {
  defaultTofConfig,
  parseTofPacket,
  restoreTofConfig,
  TOF_CONFIG_KEY,
  TOF_DIRECTIONS,
  TOF_SENSOR_COUNT,
  TofConfig,
  TofPacket,
  tofReadings,
  tofCentimeters,
  validTofConfig,
} from "../utils/tofTelemetry";

type Props = {
  route: MazeCell[];
  simulation: ReturnType<typeof sampleSimulation> | null;
  settings: WaypointSettingsMap;
};
export default function RobotProximityPanel({
  simulation,
  settings,
  route,
}: Props) {
  const [mode, setMode] = useState<"live" | "simulation">("live");
  const [config, setConfig] = useState<TofConfig>(defaultTofConfig);
  const [draft, setDraft] = useState<TofConfig>(defaultTofConfig);
  const [configOpen, setConfigOpen] = useState(false);
  const [packet, setPacket] = useState<TofPacket | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const now = useReadClock(200,true);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TOF_CONFIG_KEY);
      if (saved) setConfig(restoreTofConfig(JSON.parse(saved)));
    } catch {
      setStorageError(true);
    }
  }, []);
  useEffect(() => subscribeJson<any>("/api/maze/tof",(data,stamp)=>{
    setPacket(parseTofPacket(data));setReceivedAt(stamp.wallRequestedAt);setError("");
  },error=>setError(error.message || "ยังเชื่อมต่อ ToF API ไม่ได้"),300),[]);
  const fresh =
    !!packet?.fresh &&
    !error &&
    packet.publisher_count !== 0 &&
    packet.age_ms !== null &&
    packet.age_ms + Math.max(0, now - receivedAt) < 1000;
  const configured = validTofConfig(config),
    readings = tofReadings(packet, config, fresh);
  const validReadings = readings.filter((r) => r.meters !== null);
  const nearest = validReadings.length
    ? Math.min(...validReadings.map((r) => r.meters!))
    : null;
  const nearNames = readings
    .filter(
      (r) =>
        r.meters !== null && nearest !== null && r.meters <= nearest + 0.005
    )
    .map((r) => r.label)
    .join(" / ");
  const status = error
    ? "API ออฟไลน์"
    : !packet || packet.sequence === 0
    ? "รอข้อมูล ToF"
    : !fresh
    ? "ข้อมูลขาด / ค้าง"
    : packet.raw_values.length !== TOF_SENSOR_COUNT
    ? "จำนวนข้อมูลไม่ตรงกับ ToF 4 ตัว"
    : !configured
    ? config.unit
      ? "รอยืนยันลำดับเซนเซอร์"
      : "รอยืนยันหน่วย / ตำแหน่ง"
    : "LIVE · ToF";
  const plan = useMemo(
    () => makeSimulationPlan(route, settings),
    [route, settings]
  );
  const walls = useMemo(() => buildPreviewWalls(route), [route]);
  const pose = simulation?.pose ?? plan.initial;
  const cell = pose
    ? {
        col: Math.floor(pose.x / CELL_METERS),
        row: Math.floor(pose.y / CELL_METERS),
      }
    : null;
  const inCell = cell && isCell(cell);
  const simulatedReadings = useMemo(
    () => previewWallReadings(walls, pose),
    [walls, pose]
  );
  const distances = simulatedReadings
    .filter((r) => r.distance_m !== null)
    .map((r) => r.distance_m!);
  const nearestPreview = distances.length ? Math.min(...distances) : null;
  const { contract } = useStm32Contract();
  const tolerance =
    mode === "live"
      ? contract?.position?.position_tolerance_m ?? 0.01
      : inCell
      ? settingsForCell(settings, cell).position_tolerance_m
      : 0.02;
  const saveConfig = () => {
    if (!validTofConfig(draft)) return;
    setConfig({ ...draft, mapping: { ...draft.mapping } });
    try {
      localStorage.setItem(TOF_CONFIG_KEY, JSON.stringify(draft));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    setConfigOpen(false);
  };
  return (
    <Panel id="maze-proximity" aria-label="ระยะรอบหุ่นยนต์และ ToF">
      <Header>
        <div>
          <h2>ระยะรอบหุ่น · ToF</h2>
          <small>
            {mode === "live" ? status : "SIMULATION · ไม่ใช่ค่าจริง"}
          </small>
        </div>
        <button
          type="button"
          aria-label="ตั้งค่าหน่วยและตำแหน่ง ToF"
          onClick={() => {
            setDraft({ ...config, mapping: { ...config.mapping } });
            setConfigOpen(true);
          }}
        >
          ตั้งค่า
        </button>
      </Header>
      <Modes>
        <button
          type="button"
          aria-pressed={mode === "live"}
          onClick={() => setMode("live")}
        >
          ToF จริง
        </button>
        <button
          type="button"
          aria-pressed={mode === "simulation"}
          onClick={() => setMode("simulation")}
        >
          กำแพงจำลอง
        </button>
      </Modes>
      <Body>
        <svg
          viewBox="0 0 300 235"
          role="img"
          aria-label={
            mode === "live"
              ? "มุมบนหุ่น แสดงรังสีระยะที่อ่านจาก ToF"
              : "มุมบนหุ่นหัวคงที่ แสดงกำแพงและช่องเปิดตามเส้นทางอ้างอิง"
          }
        >
          {mode === "live" ? (
            <>
              <rect
                x="30"
                y="18"
                width="240"
                height="210"
                rx="12"
                fill="#182c4c"
              />
              <text
                x="150"
                y="31"
                textAnchor="middle"
                fill="#9ce6da"
                fontSize="12"
              >
                หน้า
              </text>
              {readings.map((r) => {
                if (r.meters === null) return null;
                const length = Math.min(1000, r.meters * 125),
                  [x, y] = r.point,
                  [dx, dy] = r.vector,
                  ex = x + dx * length,
                  ey = y + dy * length,
                  color =
                    r.meters < 0.1
                      ? "#f28791"
                      : r.meters < 0.2
                      ? "#ffdc7c"
                      : "#98e8de";
                return (
                  <g key={r.id} stroke={color} fill="none">
                    <path
                      d={`M${x},${y} L${ex},${ey}`}
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                    <path
                      d={dx ? `M${ex},${ey - 12} v24` : `M${ex - 12},${ey} h24`}
                      strokeWidth="4"
                    />
                  </g>
                );
              })}
              <g transform="translate(150 125) scale(1.25)">
                <rect
                  x="-34"
                  y="-34"
                  width="68"
                  height="68"
                  fill="none"
                  stroke="#ffdc7c"
                  strokeDasharray="3 2"
                />
                <RobotTopView />
              </g>
              {readings.map((r) => (
                <circle
                  key={r.id}
                  data-sensor={r.id}
                  cx={r.point[0]}
                  cy={r.point[1]}
                  r="3"
                  fill={r.meters !== null ? "#98e8de" : "#718bad"}
                >
                  <title>{`ToF ${r.label} · กึ่งกลางด้านใกล้พื้น`}</title>
                </circle>
              ))}
              <g fill="#aabfda" fontSize="11">
                <text x="150" y="195" textAnchor="middle">
                  หลัง
                </text>
                <text x="88" y="129" textAnchor="end">
                  ซ้าย
                </text>
                <text x="212" y="129">
                  ขวา
                </text>
              </g>
              {!fresh && (
                <text
                  x="150"
                  y="215"
                  textAnchor="middle"
                  fill="#c5cfe1"
                  fontSize="11"
                >
                  ยังไม่มีค่าระยะสด
                </text>
              )}
            </>
          ) : (
            <RobotWallPreview
              pose={pose}
              walls={walls}
              readings={simulatedReadings}
              tolerance={tolerance}
            />
          )}
        </svg>
        <Readings
          aria-label={
            mode === "live"
              ? "ค่าระยะ ToF แต่ละด้าน"
              : "ระยะกำแพงจำลองรอบตัวหุ่น"
          }
        >
          {mode === "live"
            ? configured
              ? readings.map((r) => (
                  <div key={r.id} data-direction={r.id}>
                    <span>{r.label}</span>
                    <b
                      style={{
                        color:
                          r.meters !== null && r.meters < 0.1
                            ? "#f28791"
                            : "#e4edf8",
                      }}
                    >
                      {r.meters !== null
                        ? `${(r.meters * 100).toFixed(1)} ซม.`
                        : r.channel === null
                        ? "ยังไม่ผูกช่อง"
                        : fresh && r.raw !== null && r.raw <= 0
                        ? "ไม่ถูกต้อง"
                        : "—"}
                    </b>
                  </div>
                ))
              : Array.from(
                  { length: TOF_SENSOR_COUNT },
                  (_, i) => packet?.raw_values[i] ?? null
                ).map((raw, i) => {
                  const cm =
                    fresh && packet?.raw_values.length === TOF_SENSOR_COUNT
                      ? tofCentimeters(raw, config.unit)
                      : null;
                  return (
                    <div key={i}>
                      <span>ช่อง #{i + 1}</span>
                      <b>
                        {cm !== null ? `${cm.toFixed(1)} ซม.` : "—"}
                        {cm !== null && (
                          <small>
                            {raw}{" "}
                            {config.unit === "mm"
                              ? "มม."
                              : config.unit === "cm"
                              ? "ซม."
                              : "ม."}
                          </small>
                        )}
                      </b>
                    </div>
                  );
                })
            : simulatedReadings.map((reading) => (
                <div
                  key={reading.id}
                  data-preview-direction={reading.id}
                  data-wall-state={
                    reading.distance_m === null ? "open" : "wall"
                  }
                >
                  <span>{reading.label}</span>
                  <b>
                    {reading.distance_m === null
                      ? `ไม่พบ ≤${PREVIEW_TOF_RANGE_M} ม.`
                      : `${(reading.distance_m * 100).toFixed(1)} ซม.`}
                  </b>
                </div>
              ))}
        </Readings>
      </Body>
      <Nearest>
        {mode === "live"
          ? nearest === null
            ? "ด้านที่ใกล้สุด: ยังไม่มีข้อมูลที่ยืนยันได้"
            : `ใกล้สุด: ${nearNames} · ${(nearest * 100).toFixed(1)} ซม.`
          : nearestPreview === null
          ? "ช่องเปิด: ไม่พบกำแพงในระยะพรีวิว"
          : `กำแพงอ้างอิงใกล้สุด: ${simulatedReadings
              .filter(
                (r) =>
                  r.distance_m !== null &&
                  r.distance_m <= nearestPreview + 0.005
              )
              .map((r) => r.label)
              .join(" / ")} · ${(nearestPreview * 100).toFixed(1)} ซม.`}
      </Nearest>
      <MeasurementDetails>
        <summary>รายละเอียดการวัด</summary>
        <Note>
          {mode === "live"
            ? "ToF 4 ด้าน กึ่งกลางใกล้พื้น · ระยะจากหน้าเซนเซอร์ ไม่ใช่ขอบตัวถัง · ภาพไม่ใช่สเกลจริง · แดง <10 ซม. แจ้งเตือนเท่านั้น · ช่องจริงยังไม่ผูก Localization"
            : "กำแพงพรีวิวอนุมานจากทางเดิน ไม่ใช่ผังจริง · จำลองอ่านไม่เกิน 2 ม. · ช่องเปิดไม่มีเส้นกำแพง · ยังไม่ตรวจการชน"}
        </Note>
      </MeasurementDetails>
      {storageError && (
        <Note role="alert">บันทึกการตั้งค่า ToF ในเครื่องไม่ได้</Note>
      )}
      <Modal
        open={configOpen}
        onCancel={() => setConfigOpen(false)}
        footer={null}
        centered
        width={560}
        zIndex={9600}
        title="ยืนยันการติดตั้ง ToF ก่อนแสดงระยะตามด้าน"
      >
        <Config>
          <p>
            ToF 4 ตัว: หน้า หลัง ซ้าย ขวา ติดกึ่งกลางแต่ละด้านใกล้พื้น
            หน่วยจากบอร์ดเป็นมิลลิเมตร แสดงเซนติเมตรโดยหาร 10
            ลำดับข้อมูลยังไม่ยืนยัน กรุณาเลือกให้ตรงกับบอร์ด ไม่ใช้การตั้งค่า 5
            ตัวเดิม
          </p>
          <label>
            หน่วยจากบอร์ด
            <select
              aria-label="หน่วยข้อมูล ToF"
              value={draft.unit ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  unit: (e.target.value || null) as TofConfig["unit"],
                  confirmed: false,
                })
              }
            >
              <option value="">กรุณาเลือกหน่วย</option>
              <option value="mm">มิลลิเมตร (mm)</option>
              <option value="cm">เซนติเมตร (cm)</option>
              <option value="m">เมตร (m)</option>
            </select>
          </label>
          <ConfigGrid>
            {TOF_DIRECTIONS.map((direction) => (
              <label key={direction.id}>
                {direction.label}
                <select
                  aria-label={`ช่องเซนเซอร์${direction.label}`}
                  value={draft.mapping[direction.id] ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      confirmed: false,
                      mapping: {
                        ...draft.mapping,
                        [direction.id]:
                          e.target.value === "" ? null : Number(e.target.value),
                      },
                    })
                  }
                >
                  <option value="">ยังไม่ระบุช่องข้อมูล</option>
                  {Array.from({ length: TOF_SENSOR_COUNT }, (_, i) => (
                    <option key={i} value={i}>
                      ToF #{i + 1}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </ConfigGrid>
          <label>
            <input
              type="checkbox"
              checked={draft.confirmed}
              onChange={(e) =>
                setDraft({ ...draft, confirmed: e.target.checked })
              }
            />{" "}
            ยืนยันหน่วยและตำแหน่งเซนเซอร์ที่ติดตั้งจริงแล้ว
          </label>
          <p>
            ค่าต้องเป็นระยะมากกว่า 0 ช่องเซนเซอร์ต้องไม่ซ้ำกัน หากข้อมูลขาดเกิน
            1 วินาที จะเลิกแสดงเป็นค่าปัจจุบัน
          </p>
          <button
            type="button"
            disabled={!validTofConfig(draft)}
            onClick={saveConfig}
          >
            บันทึกการแสดงผล ToF
          </button>
        </Config>
      </Modal>
    </Panel>
  );
}

const Panel = styled.section`
  background: #1e3271;
  border: 1px solid #40588a;
  border-radius: 16px;
  padding: 22px;
  scroll-margin-top: 92px;
  color: #e4eafa;
  min-width: 0;
`;
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  h2 {
    font-size: 16px;
    color: #ffdc7c;
    margin: 0;
  }
  small {
    display: block;
    color: #aac2df;
    font-size: 11px;
    margin-top: 4px;
  }
  button {
    font-size: 10px !important;
    color: #e7dfa9;
    background: #304977;
    border: 1px solid #7084ac;
    border-radius: 6px;
    min-height: 36px;
    padding: 6px 10px;
    flex-shrink: 0;
    white-space: nowrap;
  }
`;
const Modes = styled.div`
  display: flex;
  gap: 4px;
  margin: 9px 0 3px;
  button {
    flex: 1;
    min-height: 30px;
    border: 1px solid #7084ac;
    border-radius: 6px;
    background: #2c4272;
    color: #b1c4e4;
    font-size: 10px !important;
  }
  button[aria-pressed="true"] {
    background: #ffdc7c;
    color: #1e3271;
    border-color: #ffdc7c;
  }
`;
const Body = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(105px, 1fr);
  gap: 5px;
  align-items: center;
  svg {
    display: block;
    width: 100%;
    max-height: 170px;
    overflow: hidden;
  }
`;
const Readings = styled.div`
  min-width: 0;
  > div {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    padding: 4px 0;
    border-bottom: 1px solid #52638d66;
    font-size: 10px;
  }
  span {
    color: #b1c4e4;
  }
  b {
    font-weight: 500;
    white-space: nowrap;
    text-align: right;
    small {
      display: block;
      font-size: 8px;
      line-height: 1.3;
      color: #aac2df;
    }
  }
  p {
    font-size: 10px;
    color: #b1c4e4;
  }
`;
const Nearest = styled.p`
  font-size: 10px;
  color: #ffdc7c;
  margin: 3px 0;
`;
const Note = styled.p`
  font-size: 9px;
  line-height: 1.55;
  color: #aac2df;
  margin: 4px 0 0;
`;
const Config = styled.div`
  color: #1e3271;
  font-size: 12px;
  max-height: calc(100dvh - 160px);
  overflow-y: auto;
  p {
    font-size: 11px;
    line-height: 1.6;
  }
  label {
    display: block;
    margin-bottom: 9px;
  }
  select {
    display: block;
    min-height: 36px;
    width: 100%;
    margin-top: 4px;
    border: 1px solid #a1b1cc;
    border-radius: 5px;
    background: #fff;
    color: #1e3271;
  }
  input {
    margin-right: 7px;
  }
  button {
    min-height: 40px;
    width: 100%;
    border: 0;
    border-radius: 6px;
    background: #1e3271;
    color: #fff;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.4;
  }
`;
const ConfigGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 12px;
`;

const MeasurementDetails = styled.details`
  margin-top: 12px;
  border-top: 1px solid #52638d66;
  padding-top: 10px;
  summary {
    cursor: pointer;
    font-size: 11px;
    color: #b0c3df;
  }
`;
