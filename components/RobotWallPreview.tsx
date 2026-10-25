import { CELL_METERS, cellLabel, isCell } from "../utils/mazeRoute";
import { RobotPose } from "../utils/robotSimulation";
import {
  MazeWall,
  pointInRobotFrame,
  previewWallReadings,
} from "../utils/mazeWalls";
import RobotTopView from "./RobotTopView";

type Props = {
  pose: RobotPose;
  walls: MazeWall[];
  readings: ReturnType<typeof previewWallReadings>;
  tolerance: number;
};
export default function RobotWallPreview({
  pose,
  walls,
  readings,
  tolerance,
}: Props) {
  const project = (point: { x: number; y: number }) => {
    const p = pointInRobotFrame(point, pose);
    return { x: 150 + p.right * 125, y: 125 - p.forward * 125 };
  };
  const cell = {
    col: Math.floor(pose.x / CELL_METERS),
    row: Math.floor(pose.y / CELL_METERS),
  };
  return (
    <g aria-label="กำแพงอ้างอิงจากเส้นทาง ไม่ใช่กรอบช่อง">
      <defs>
        <clipPath id="robot-wall-preview-window">
          <rect x="24" y="36" width="252" height="180" rx="10" />
        </clipPath>
      </defs>
      <rect x="24" y="36" width="252" height="180" rx="10" fill="#182c4c" />
      <text x="150" y="19" textAnchor="middle" fill="#ffdc7c" fontSize="11">
        {isCell(cell)
          ? `${cellLabel(cell)} · หัว ↑ คงที่`
          : "START นอกสนาม · หัว ↑ คงที่"}
      </text>
      <g clipPath="url(#robot-wall-preview-window)">
        {walls.map((wall) => {
          const from = project(wall.from),
            to = project(wall.to);
          const near = readings.some(
            (r) =>
              r.wall_id === wall.id &&
              r.distance_m !== null &&
              r.distance_m <= 0.3
          );
          return (
            <path
              data-preview-wall={wall.id}
              key={wall.id}
              d={`M${from.x},${from.y} L${to.x},${to.y}`}
              fill="none"
              stroke={near ? "#ffdc7c" : "#83a5c4"}
              strokeWidth={near ? 5 : 3}
              strokeLinecap="butt"
            />
          );
        })}
        {readings.map((reading) => {
          const from = project(reading.origin),
            end = project(
              reading.hit ?? {
                x: reading.origin.x + reading.direction.x * 0.75,
                y: reading.origin.y + reading.direction.y * 0.75,
              }
            );
          return (
            <path
              key={reading.id}
              data-preview-ray={reading.id}
              d={`M${from.x},${from.y} L${end.x},${end.y}`}
              stroke={reading.hit ? "#98e8de" : "#617ca0"}
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          );
        })}
        <g transform="translate(150 125) scale(1.25)">
          <rect
            x={-33 - tolerance * 100}
            y={-33 - tolerance * 100}
            width={66 + tolerance * 200}
            height={66 + tolerance * 200}
            fill="none"
            stroke="#ffdc7c"
            strokeDasharray="2 2"
          />
          <RobotTopView />
        </g>
      </g>
      <text x="150" y="232" textAnchor="middle" fill="#a7bdd6" fontSize="10">
        เส้นทึบ = กำแพงอ้างอิง · ช่องเปิดไม่มีเส้นขวาง
      </text>
    </g>
  );
}
