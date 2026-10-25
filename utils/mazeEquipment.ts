import { RACK_COLORS, RackSelection } from "./rackMission";
import { box, Scene, Vec3 } from "./robotScene";

// Display geometry only: dimensions are illustrative, not surveyed docking poses.
// Both cabinets open toward world -Y, the bottom A-H lettering on the field.
export const CABINET_VIEW = {
  pickup: { yaw_rad: 0, front_normal: [0, -1, 0] as Vec3 },
  placement: { yaw_rad: 0, front_normal: [0, -1, 0] as Vec3 },
};
export function cabinetGeometry(
  cx: number,
  cy: number,
  source: boolean,
  selection: RackSelection
) {
  const scene: Scene = { faces: [], labels: [] };
  const width = 0.7,
    depth = 0.5;
  const view = source ? CABINET_VIEW.pickup : CABINET_VIEW.placement;
  const transform = ([x, y, z]: Vec3): Vec3 => [
    cx + x * Math.cos(view.yaw_rad) - y * Math.sin(view.yaw_rad),
    cy + x * Math.sin(view.yaw_rad) + y * Math.cos(view.yaw_rad),
    z,
  ];
  for (const x of [-width / 2, width / 2 - 0.025])
    for (const y of [-depth / 2, depth / 2 - 0.025])
      box(scene, x, y, 0, 0.025, 0.025, 1.08, "#b8c6ce");
  for (const z of [0.03, 0.34, 0.65, 0.96])
    box(scene, -width / 2, -depth / 2, z, width, depth, 0.025, "#8291a1");
  // Explicit rear and dividers make the open side unambiguous from every camera.
  box(
    scene,
    -width / 2,
    depth / 2 - 0.018,
    0.04,
    width,
    0.018,
    0.94,
    "#42576c"
  );
  for (const x of [-width / 6, width / 6])
    box(scene, x - 0.009, -depth / 2, 0.055, 0.018, depth, 0.925, "#9eafb9");
  box(
    scene,
    -width / 2,
    -depth / 2 - 0.012,
    0.032,
    width,
    0.018,
    0.025,
    source ? "#98e8de" : "#ffdc7c"
  );
  const blockCenters: { color: string; point: Vec3 }[] = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const selected = selection.picks.some(
        (p) => p.row === row && p.col === col
      );
      if (source && !selected) continue;
      const x = -0.31 + col * 0.22,
        y = -0.215,
        z = 0.065 + (source ? 2 - row : row) * 0.31;
      const color = source ? "#dfbd69" : RACK_COLORS[col].hex;
      box(scene, x, y, z, 0.18, 0.28, 0.2, color);
      blockCenters.push({
        color,
        point: transform([x + 0.09, y + 0.14, z + 0.1]),
      });
    }
  if (source)
    for (let i = 0; i < 3; i++)
      box(
        scene,
        -0.3 + i * 0.22,
        -0.36,
        0.025,
        0.18,
        0.22,
        0.012,
        selection.plate === i + 1 ? "#ffdc7c" : "#bdc9d0"
      );
  scene.faces.forEach((face) => {
    face.points = face.points.map(transform);
  });
  scene.labels.push({
    point: [cx, cy, 1.22],
    text: source ? "ตู้หยิบ · C8" : "ตู้วาง · H3",
    color: source ? "#98e8de" : "#ffdc7c",
  });
  return {
    ...scene,
    frontNormal: view.front_normal,
    openingCenter: transform([0, -depth / 2, 0.5]),
    rearCenter: transform([0, depth / 2, 0.5]),
    blockCenters,
  };
}
