import { createDemandRenderer } from "../utils/demandRenderer";
import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import {
  CELL_METERS,
  GRID_SIZE,
  MazeCell,
  cellKey,
  cellLabel,
} from "../utils/mazeRoute";
import {
  settingsForCell,
  WaypointSettingsMap,
} from "../utils/waypointSettings";
import { RackSelection } from "../utils/rackMission";
import { cabinetGeometry } from "../utils/mazeEquipment";
import { LiveOdometry } from "../utils/useLiveOdometry";
import { RobotPose } from "../utils/robotSimulation";
import { buildPreviewWalls } from "../utils/mazeWalls";
import {
  box,
  placeRobot,
  robotGeometry,
  Scene,
  Vec3,
} from "../utils/robotScene";

type Props = {
  route: MazeCell[];
  selection: RackSelection;
  live: LiveOdometry;
  cellMeters?: number;
  settings?: WaypointSettingsMap;
  onEditStart?: () => void;
  onEditCell?: (index: number) => void;
  startPoint?: { x: number; y: number };
};
const emptyScene = (): Scene => ({ faces: [], labels: [] });

function fieldGeometry(
  route: MazeCell[],
  selection: RackSelection,
  cellMeters: number,
  settings: WaypointSettingsMap,
  startPoint: { x: number; y: number }
): Scene {
  const side = GRID_SIZE * cellMeters;
  const scene = emptyScene();
  box(
    scene,
    -0.184,
    -0.184,
    -0.08,
    side + 0.368,
    side + 0.368,
    0.06,
    "#637387"
  );
  scene.faces.forEach((face) => {
    face.layer = -3;
  });
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 8; col++)
      box(
        scene,
        col * cellMeters,
        row * cellMeters,
        -0.02,
        cellMeters - 0.012,
        cellMeters - 0.012,
        0.02,
        (row + col) % 2 ? "#293e61" : "#304a70"
      );
  scene.faces.slice(6).forEach((face) => {
    face.layer = -2;
  });
  const groundCount = scene.faces.length;
  route.forEach((cell, i) => {
    const x = (cell.col + 0.5) * cellMeters,
      y = (cell.row + 0.5) * cellMeters;
    scene.labels.push({
      point: [x, y, 0.025],
      text: String(i + 1),
      color: i === 0 ? "#98e8de" : "#ffe3a0",
    });
    if (settingsForCell(settings, cell).stop_here)
      box(
        scene,
        x - cellMeters * 0.2,
        y - cellMeters * 0.2,
        0.012,
        cellMeters * 0.4,
        cellMeters * 0.4,
        0.025,
        "#b93f58"
      );
    if (i) {
      const prev = route[i - 1],
        px = (prev.col + 0.5) * cellMeters,
        py = (prev.row + 0.5) * cellMeters;
      box(
        scene,
        Math.min(x, px) - 0.018,
        Math.min(y, py) - 0.018,
        0.008,
        Math.abs(x - px) + 0.036,
        Math.abs(y - py) + 0.036,
        0.008,
        "#dfb956"
      );
    }
  });
  scene.faces.slice(groundCount).forEach((face) => {
    face.layer = -1;
  });
  for (let i = 0; i < 8; i++) {
    scene.labels.push({
      point: [(i + 0.5) * cellMeters, -0.3, 0],
      text: "ABCDEFGH"[i],
      color: "#aabfd9",
    });
    scene.labels.push({
      point: [-0.28, (i + 0.5) * cellMeters, 0],
      text: String(i + 1),
      color: "#aabfd9",
    });
  }
  for (const wall of buildPreviewWalls(route).map((w) => ({
    ...w,
    from: {
      x: (w.from.x * cellMeters) / CELL_METERS,
      y: (w.from.y * cellMeters) / CELL_METERS,
    },
    to: {
      x: (w.to.x * cellMeters) / CELL_METERS,
      y: (w.to.y * cellMeters) / CELL_METERS,
    },
  })))
    box(
      scene,
      Math.min(wall.from.x, wall.to.x) - 0.009,
      Math.min(wall.from.y, wall.to.y) - 0.009,
      0.018,
      Math.abs(wall.to.x - wall.from.x) + 0.018,
      Math.abs(wall.to.y - wall.from.y) + 0.018,
      0.035,
      "#91a7b8"
    );
  for (const cabinet of [
    cabinetGeometry(2.5 * cellMeters, side + 0.36, true, selection),
    cabinetGeometry(side + 0.5, 2.5 * cellMeters, false, selection),
  ]) {
    scene.faces.push(...cabinet.faces);
    scene.labels.push(...cabinet.labels);
  }
  const machineX = side + 0.25 + 0.5 + 0.25;
  box(scene, machineX, 2.5 * cellMeters - 0.28, 0, 0.58, 0.56, 0.13, "#839aaa");
  for (const x of [machineX, machineX + 0.52])
    box(scene, x, 2.5 * cellMeters - 0.28, 0.13, 0.06, 0.56, 0.65, "#587586");
  box(
    scene,
    machineX,
    2.5 * cellMeters - 0.28,
    0.72,
    0.58,
    0.56,
    0.13,
    "#8ba3af"
  );
  box(
    scene,
    machineX + 0.08,
    2.5 * cellMeters - 0.3,
    0.4,
    0.42,
    0.61,
    0.018,
    "#dfbd69"
  );
  box(
    scene,
    machineX + 0.22,
    2.5 * cellMeters - 0.16,
    0.52,
    0.12,
    0.32,
    0.2,
    "#bcccd3"
  );
  scene.labels.push({
    point: [machineX + 0.29, 2.5 * cellMeters, 1.1],
    text: "เครื่องพับ",
    color: "#98e8de",
  });
  scene.labels.push({
    point: [startPoint.x, startPoint.y, 0.05],
    text: "START",
    color: "#98e8de",
  });
  return scene;
}

export default function RobotScene3D({
  route,
  selection,
  live,
  cellMeters = CELL_METERS,
  settings = {},
  onEditStart,
  onEditCell,
  startPoint,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<() => void>(()=>{});
  const renderer = useRef<ReturnType<typeof createDemandRenderer> | null>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const stopRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [detail, setDetail] = useState(false);
  const [yaw, setYaw] = useState(-0.65);
  const [elevation, setElevation] = useState(0.68);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const fieldCellMeters = live.anchor?.cell_m ?? cellMeters;
  const startX = startPoint?.x ?? -0.6,
    startY = startPoint?.y ?? 5.5 * fieldCellMeters;
  const stops = useMemo(
    () =>
      route.flatMap((cell, index) =>
        settingsForCell(settings, cell).stop_here ? [{ cell, index }] : []
      ),
    [route, settings]
  );
  const field = useMemo(
    () =>
      fieldGeometry(route, selection, fieldCellMeters, settings, {
        x: startX,
        y: startY,
      }),
    [route, selection, fieldCellMeters, settings, startX, startY]
  );
  const model = useMemo(() => robotGeometry(0), []);
  const pose = live.pose;
  // Visual precision only; raw odometry/control values are not quantized.
  const poseX = pose?.x.toFixed(3), poseY = pose?.y.toFixed(3), poseHeading = pose?.heading.toFixed(3);
  const canEditStart = !!onEditStart;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect(),
        ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (
        canvas.width !== Math.round(rect.width * ratio) ||
        canvas.height !== Math.round(rect.height * ratio)
      ) {
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const width = rect.width,
        height = rect.height;
      const background = ctx.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, "#14213d");
      background.addColorStop(1, "#233b5e");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      const shownPose: RobotPose = pose
        ? detail
          ? { ...pose, x: 0, y: 0 }
          : pose
        : { x: 0, y: 0, heading: 0 };
      const robot = pose ? placeRobot(model, shownPose) : emptyScene();
      const faces = detail ? robot.faces : [...field.faces, ...robot.faces];
      const reference = detail ? model.faces : field.faces;
      const c = Math.cos(yaw),
        s = Math.sin(yaw),
        se = Math.sin(elevation),
        ce = Math.cos(elevation);
      const raw = ([x, y, z]: Vec3) => ({
        x: x * c - y * s,
        y: -(x * s + y * c) * se - z * ce,
        depth: (x * s + y * c) * ce - z * se,
      });
      // Fit to geometry bounds, so rotation and portrait screens never clip the model.
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      reference.forEach((f) =>
        f.points.forEach((p) => {
          const q = raw(p);
          minX = Math.min(minX, q.x);
          maxX = Math.max(maxX, q.x);
          minY = Math.min(minY, q.y);
          maxY = Math.max(maxY, q.y);
        })
      );
      if (!detail && pose) {
        for (const p of [
          [shownPose.x, shownPose.y, 1] as Vec3,
          ...live.trace.map((p) => [p.x, p.y, 0.05] as Vec3),
        ]) {
          const q = raw(p);
          minX = Math.min(minX, q.x);
          maxX = Math.max(maxX, q.x);
          minY = Math.min(minY, q.y);
          maxY = Math.max(maxY, q.y);
        }
      }
      if (!detail) {
        minX -= 0.7;
        maxX += 0.3;
        minY -= 0.2;
        maxY += 0.3;
      }
      const scale =
        Math.min((width - 36) / (maxX - minX), (height - 34) / (maxY - minY)) *
        zoom;
      const project = (p: Vec3) => {
        const q = raw(p);
        return {
          x: width / 2 + (q.x - (minX + maxX) / 2) * scale,
          y: height / 2 + (q.y - (minY + maxY) / 2) * scale,
          depth: q.depth,
        };
      };
      const marker = (element: HTMLButtonElement | null, point: Vec3) => {
        if (!element) return;
        const p = project(point);
        element.style.left = `${p.x}px`;
        element.style.top = `${p.y}px`;
        element.style.visibility = detail ? "hidden" : "visible";
      };
      marker(startRef.current, [startX, startY, 0.05]);
      for (const stop of stops)
        marker(stopRefs.current[cellKey(stop.cell)], [
          (stop.cell.col + 0.5) * fieldCellMeters,
          (stop.cell.row + 0.5) * fieldCellMeters,
          0.1,
        ]);
      const projected = faces.map((face) => ({
        face,
        points: face.points.map(project),
      }));
      projected.sort(
        (a, b) =>
          (a.face.layer ?? 0) - (b.face.layer ?? 0) ||
          b.points.reduce((n, p) => n + p.depth, 0) / b.points.length -
            a.points.reduce((n, p) => n + p.depth, 0) / a.points.length
      );
      projected.forEach(({ face, points }) => {
        ctx.beginPath();
        points.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)
        );
        ctx.closePath();
        ctx.globalAlpha = face.alpha ?? 1;
        ctx.fillStyle = face.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(10,20,33,.28)";
        ctx.lineWidth = detail ? 0.65 : 0.3;
        if (!face.noEdge) ctx.stroke();
      });
      if (!detail) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        field.labels.forEach((label) => {
          if (label.text === "START" && onEditStart) return;
          if (
            /^\d+$/.test(label.text) &&
            Math.hypot(
              label.point[0] - shownPose.x,
              label.point[1] - shownPose.y
            ) < 0.5
          )
            return;
          const p = project(label.point);
          ctx.font = `${label.text.length > 3 ? 10 : 9}px sans-serif`;
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#14213d";
          ctx.strokeText(label.text, p.x, p.y);
          ctx.fillStyle = label.color;
          ctx.fillText(label.text, p.x, p.y);
        });
      }
      if (!detail && live.trace.length > 1) {
        ctx.beginPath();
        live.trace.forEach((p, i) => {
          const q = project([p.x, p.y, 0.045]);
          if (i) ctx.lineTo(q.x, q.y);
          else ctx.moveTo(q.x, q.y);
        });
        ctx.strokeStyle = "#ff77b7";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (pose) {
        const frontBase = project([shownPose.x, shownPose.y, 1.05]);
        const frontTip = project([
          shownPose.x + Math.cos(shownPose.heading) * 0.5,
          shownPose.y + Math.sin(shownPose.heading) * 0.5,
          1.05,
        ]);
        ctx.beginPath();
        ctx.moveTo(frontBase.x, frontBase.y);
        ctx.lineTo(frontTip.x, frontTip.y);
        ctx.strokeStyle = "#98e8de";
        ctx.lineWidth = 2;
        ctx.stroke();
        const arrowAngle = Math.atan2(
          frontTip.y - frontBase.y,
          frontTip.x - frontBase.x
        );
        ctx.beginPath();
        ctx.moveTo(frontTip.x, frontTip.y);
        ctx.lineTo(
          frontTip.x - Math.cos(arrowAngle - 0.5) * 6,
          frontTip.y - Math.sin(arrowAngle - 0.5) * 6
        );
        ctx.lineTo(
          frontTip.x - Math.cos(arrowAngle + 0.5) * 6,
          frontTip.y - Math.sin(arrowAngle + 0.5) * 6
        );
        ctx.closePath();
        ctx.fillStyle = "#98e8de";
        ctx.fill();
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("หน้า", frontTip.x, frontTip.y - 8);
      } else {
        ctx.fillStyle = "#ffdc7c";
        ctx.font = "16px sans-serif";
        ctx.fillText("รอ odometry จริง · เปิด Mainprogram", 20, 40);
      }
      ctx.font = "10px sans-serif";
      ctx.fillStyle = "#9fb5d1";
      ctx.textAlign = "left";
      ctx.fillText("ลากเพื่อหมุนมุมมอง", 10, height - 12);
      if (detail) {
        ctx.fillStyle = "#ffdc7c";
        ctx.textAlign = "right";
        ctx.fillText("66 × 66 × 100 cm", width - 10, height - 12);
      }
    };
    drawRef.current = draw;
    renderer.current?.invalidate();
  }, [
    field,
    model,
    poseX, poseY, poseHeading,
    live.trace,
    detail,
    yaw,
    elevation,
    zoom,
    stops,
    startX,
    startY,
    fieldCellMeters,
    canEditStart,
  ]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const painter=createDemandRenderer(()=>drawRef.current(),20);
    renderer.current=painter;
    const resize=new ResizeObserver(()=>painter.invalidate());resize.observe(canvas);
    const intersection=typeof IntersectionObserver === "undefined"?null:new IntersectionObserver(entries=>{
      painter.setVisible(entries.some(entry=>entry.isIntersecting));
    });
    intersection?.observe(canvas);painter.invalidate();
    return ()=>{painter.stop();resize.disconnect();intersection?.disconnect();renderer.current=null;};
  },[]);

  return (
    <Simulator
      aria-label="หุ่นยนต์สามมิติตาม odometry จริง"
      data-testid="live-robot-scene"
      data-frame={live.frame}
      data-fresh={live.fresh}
      data-x={pose?.x ?? ""}
      data-y={pose?.y ?? ""}
      data-heading={pose?.heading ?? ""}
      data-trace-count={live.trace.length}
    >
      <Topbar>
        <div>
          <b>{live.fresh ? "ตำแหน่งปัจจุบัน" : "รอข้อมูลตำแหน่ง"}</b>
        </div>
        <button
          type="button"
          aria-pressed={detail}
          onClick={() => {
            setDetail(!detail);
            setZoom(1);
            setElevation(detail ? 0.68 : 0.36);
          }}
        >
          {detail ? "กลับไปสนาม" : "ดูตัวหุ่น 3D"}
        </button>
      </Topbar>
      <Viewport>
        {onEditStart && (
          <MapStartButton
            ref={startRef}
            type="button"
            aria-label="START บนแผนที่: ปรับระยะก่อนเข้าสนาม"
            onClick={onEditStart}
          >
            START<small>ปรับระยะ</small>
          </MapStartButton>
        )}
        {stops.map(({ cell, index }) => (
          <MapStopCard
            key={cellKey(cell)}
            ref={(element) => {
              stopRefs.current[cellKey(cell)] = element;
            }}
            type="button"
            data-testid={`map-stop-${cellLabel(cell)}`}
            aria-label={`จุดหยุด ${cellLabel(cell)}: แก้ไขค่ารายช่อง`}
            onClick={() => onEditCell?.(index)}
          >
            <i /> STOP {cellLabel(cell)}
            <small>
              {index === stops[0].index ? "จบที่ช่องนี้" : "จุดหยุดที่ตั้งไว้"}
            </small>
          </MapStopCard>
        ))}
        <canvas
          ref={canvasRef}
          aria-label="โมเดลสามมิติหุ่นยนต์โครงอะลูมิเนียม ล้อแมคคานัม และชุดหยิบสามชั้น"
          onPointerDown={(event) => {
            drag.current = { x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const dx = event.clientX - drag.current.x,
              dy = event.clientY - drag.current.y;
            drag.current = { x: event.clientX, y: event.clientY };
            setYaw((value) => value + dx * 0.009);
            setElevation((value) =>
              Math.min(1.45, Math.max(0.22, value + dy * 0.006))
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          เบราว์เซอร์นี้ต้องรองรับ Canvas เพื่อแสดงโมเดลหุ่นยนต์
        </canvas>
        <CameraTools>
          <button
            type="button"
            aria-label="ซูมเข้าโมเดล"
            onClick={() => setZoom((v) => Math.min(2.5, v + 0.2))}
          >
            ＋
          </button>
          <button
            type="button"
            aria-label="ซูมออกโมเดล"
            onClick={() => setZoom((v) => Math.max(0.6, v - 0.2))}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {
              setYaw(-0.65);
              setElevation(detail ? 0.36 : 0.68);
              setZoom(1);
            }}
          >
            คืนมุม
          </button>
          <button
            type="button"
            onClick={() => {
              setYaw(0);
              setElevation(1.45);
              setZoom(1);
            }}
          >
            มุมบน
          </button>
        </CameraTools>
      </Viewport>
      <Controls>
        <Status data-testid="live-odom-motion" role="status">
          {live.motion}
        </Status>
      </Controls>
      <SceneDetails>
        <summary>รายละเอียดตำแหน่ง</summary>
        <Disclaimer data-testid="live-odom-readout">
          X {live.raw?.[0].toFixed(4) ?? "—"} m · Y{" "}
          {live.raw?.[1].toFixed(4) ?? "—"} m · หัว{" "}
          {live.raw ? ((live.raw[2] * 180) / Math.PI).toFixed(2) : "—"}° ·
          sample {live.state.pose_sequence ?? "—"}
          <br />
          เส้นสีชมพู = พิกัดที่อ่านได้จริง · เส้นสีทอง = แผน ·
          กำแพงอ้างอิงจากแผน · ภาพไม่คาดเดาตำแหน่งเมื่อข้อมูลขาด
        </Disclaimer>{" "}
      </SceneDetails>
    </Simulator>
  );
}

const Simulator = styled.section`
  min-width: 0;
`;
const Topbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  b {
    display: block;
    font-size: 12px;
    color: #ffdc7c;
    letter-spacing: 0.6px;
  }
  small {
    display: block;
    font-size: 9px;
    color: #b9cbe5;
    margin-top: 3px;
  }
  button {
    min-height: 34px;
    border: 1px solid #6d81a9;
    border-radius: 7px;
    background: #314b7c;
    color: #f6e6b4;
    font-size: 10px !important;
    padding: 5px 9px;
  }
`;
const Viewport = styled.div`
  position: relative;
  border: 1px solid #4b6287;
  border-radius: 9px;
  overflow: hidden;
  canvas {
    display: block;
    width: 100%;
    height: clamp(270px, 43dvh, 430px);
    touch-action: none;
    cursor: grab;
  }
  canvas:active {
    cursor: grabbing;
  }
  @media (max-width: 740px) {
    canvas {
      height: auto;
      aspect-ratio: 1 / 1;
    }
  }
  @media (min-width: 741px) and (max-height: 740px) {
    canvas {
      height: max(190px, calc(100dvh - 370px));
    }
  }
`;
const MapStartButton = styled.button`
  position: absolute;
  z-index: 3;
  visibility: hidden;
  transform: translate(-50%, -50%);
  border: 1px solid #98e8de;
  border-radius: 5px;
  background: #173f4c;
  color: #bffff2;
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  pointer-events: auto;
  small {
    display: block;
    font-size: 8px;
    font-weight: 400;
  }
`;
const MapStopCard = styled.button`
  position: absolute;
  z-index: 3;
  visibility: hidden;
  transform: translate(-50%, -90%);
  border: 1px solid #ffa2ac;
  border-radius: 6px;
  background: #652b3bea;
  color: #fff1f1;
  padding: 5px 7px;
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
  pointer-events: auto;
  i {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ff5d70;
    box-shadow: 0 0 9px #ff4d62;
    margin-right: 4px;
  }
  small {
    display: block;
    font-size: 8px;
    font-weight: 400;
    margin-top: 2px;
  }
`;
const CameraTools = styled.div`
  position: absolute;
  top: 7px;
  right: 7px;
  display: flex;
  gap: 4px;
  button {
    min-width: 31px;
    min-height: 32px;
    border: 1px solid #60799e;
    border-radius: 6px;
    background: #172a48e8;
    color: #e3e9f4;
    font-size: 10px !important;
    padding: 4px 6px;
  }
`;
const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  > button {
    min-height: 38px;
    min-width: 38px;
    border: 1px solid #6e80a6;
    border-radius: 7px;
    background: #314879;
    color: #e5ebf5;
    padding: 5px 10px;
    font-size: 12px !important;
  }
`;
const Status = styled.div`
  font-size: 10px;
  color: #e4eafb;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  small {
    display: block;
    color: #a9c2de;
    font-size: 9px;
    margin-top: 3px;
  }
`;
const Disclaimer = styled.p`
  margin: 3px 0 0;
  font-size: 9px;
  color: #afc4df;
  line-height: 1.6;
`;

const SceneDetails = styled.details`
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #415386;
  summary {
    color: #b9cbe5;
    font-size: 10px;
    cursor: pointer;
  }
`;
