import styled from "styled-components";
import { MazeTurbo } from "../utils/useMazeTurbo";

export default function MazeTurboControls({ turbo }: { turbo: MazeTurbo }) {
  const { simulation, plan } = turbo;
  const xs = plan.points.map((p) => p.x),
    ys = plan.points.map((p) => p.y);
  const minX = Math.min(0, ...xs) - 0.5,
    minY = Math.min(0, ...ys) - 0.5;
  const width = Math.max(1, ...xs) - minX + 0.5,
    height = Math.max(1, ...ys) - minY + 0.5;
  return (
    <Panel aria-label="เสียงเทอร์โบและจำลองเส้นทาง">
      <h2>TURBO SOUND</h2>
      <p>
        K24 Turbo + HKS · โทนเครื่องสังเคราะห์ตามเสียงอ้างอิง ·{" "}
        <a
          href="/audio/k24-hks-v1/CREDITS.txt"
          target="_blank"
          rel="noreferrer"
        >
          แหล่งเสียงและเครดิต
        </a>
      </p>
      <p>
        เสียงเร่งตามความเร็ว · ผ่อนก่อนถึงจุดหยุด ·
        เล่นผ่านลำโพงหรือหูฟังของเครื่องที่เปิดหน้านี้
      </p>
      <Row>
        <button
          type="button"
          aria-pressed={turbo.enabled}
          onClick={turbo.toggle}
        >
          {turbo.enabled ? "🔊 เสียงเปิด" : "🔇 เสียงปิด"}
        </button>
        <label>
          ความดัง {Math.round(turbo.volume * 100)}%
          <input
            type="range"
            aria-label="ความดังเสียงเทอร์โบ"
            min="0"
            max="1"
            step="0.01"
            value={turbo.volume}
            onChange={(e) => turbo.changeVolume(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          disabled={
            turbo.busy || turbo.playing || !plan.valid || !plan.duration
          }
          onClick={turbo.startSimulation}
        >
          ▶ จำลองเส้นทาง + เสียง
        </button>
        <button
          type="button"
          disabled={turbo.time === null}
          onClick={turbo.stop}
        >
          หยุดจำลอง
        </button>
      </Row>
      {simulation && (
        <>
          <p role="status">
            SIMULATION · {simulation.label} · {turbo.time?.toFixed(1)} /{" "}
            {plan.duration.toFixed(1)} วินาที
          </p>
          <svg
            viewBox={`${minX} ${minY} ${width} ${height}`}
            role="img"
            aria-label="ตำแหน่งหุ่นจำลองตามเส้นทาง"
            style={{
              width: "100%",
              height: 240,
              background: "#14213a",
              borderRadius: 10,
            }}
          >
            <g transform={`translate(0 ${minY * 2 + height}) scale(1 -1)`}>
              <polyline
                points={plan.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#ffdc7c"
                strokeWidth=".045"
              />
              {plan.points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r=".06" fill="#98e8de">
                  <title>{p.label}</title>
                </circle>
              ))}
              <circle
                cx={simulation.pose.x}
                cy={simulation.pose.y}
                r=".2"
                fill="#66ddff"
                stroke="white"
                strokeWidth=".04"
              />
            </g>
          </svg>
        </>
      )}
      {turbo.error && <p role="alert">{turbo.error}</p>}
    </Panel>
  );
}
const Panel = styled.section`
  padding: 18px;
  margin: 14px 0;
  border: 1px solid #526b94;
  border-radius: 16px;
  background: #1e3271;
  color: #e4edfa;
  h2 {
    font-size: 16px;
    color: #ffdc7c;
    margin: 0;
  }
  p {
    font-size: 12px;
    line-height: 1.7;
    margin: 8px 0;
  }
  a {
    color: #98e8de;
    text-decoration: underline;
  }
  button {
    min-height: 44px;
    padding: 8px 14px;
    border-radius: 9px;
    border: 1px solid #7084ac;
    background: #304977;
    color: #ffdc7c;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid #ffdc7c;
    outline-offset: 3px;
  }
`;
const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
  }
  input {
    width: 120px;
    accent-color: #ffdc7c;
  }
`;
