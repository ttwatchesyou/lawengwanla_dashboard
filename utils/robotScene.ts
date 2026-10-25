import { ROBOT_PROFILE, RobotPose } from "./robotSimulation";

export type Vec3 = [number, number, number];
export type Face = {
  points: Vec3[];
  color: string;
  alpha?: number;
  layer?: number;
  noEdge?: boolean;
};
export type SceneLabel = { point: Vec3; text: string; color: string };
export type Scene = { faces: Face[]; labels: SceneLabel[] };
const silver = "#b8c6ce",
  dark = "#263344";

export function box(
  scene: Scene,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: string,
  alpha = 1
) {
  const p: Vec3[] = [
    [x, y, z],
    [x + w, y, z],
    [x + w, y + d, z],
    [x, y + d, z],
    [x, y, z + h],
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ];
  const sides = [
    [0, 3, 2, 1],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
    [4, 5, 6, 7],
  ];
  sides.forEach((indices, index) => {
    const factor = [0.42, 0.69, 0.78, 0.83, 0.7, 1][index];
    const rgb = color
      .match(/[a-f\d]{2}/gi)!
      .map((v) => Math.round(parseInt(v, 16) * factor));
    scene.faces.push({
      points: indices.map((i) => p[i]),
      color: `rgb(${rgb.join(",")})`,
      alpha,
    });
  });
}

function cylinder(
  scene: Scene,
  center: Vec3,
  radius: number,
  length: number,
  color: string,
  segments = 12,
  axis: "x" | "z" = "x",
  twist = 0
) {
  const ring = (offset: number): Vec3[] =>
    Array.from({ length: segments }, (_, i) => {
      const a = (i * Math.PI * 2) / segments;
      const point: Vec3 =
        axis === "x"
          ? [offset, Math.cos(a) * radius, Math.sin(a) * radius]
          : [Math.cos(a) * radius, Math.sin(a) * radius, offset];
      return [
        center[0] + point[0] * Math.cos(twist) - point[1] * Math.sin(twist),
        center[1] + point[0] * Math.sin(twist) + point[1] * Math.cos(twist),
        center[2] + point[2],
      ];
    });
  const a = ring(-length / 2),
    b = ring(length / 2);
  scene.faces.push({ points: a, color }, { points: b, color });
  a.forEach((p, i) =>
    scene.faces.push({
      points: [p, a[(i + 1) % segments], b[(i + 1) % segments], b[i]],
      color,
    })
  );
}

// Code-native approximate model, based on the supplied front/side/rear photographs.
// All geometry stays inside the supplied 0.66 × 0.66 × 1.00 m envelope.
export function robotGeometry(wheelPhase = 0): Scene {
  const s: Scene = { faces: [], labels: [] };
  // Four mecanum hubs and angled rubber rollers.
  for (const x of [-0.279, 0.279])
    for (const y of [-0.21, 0.21]) {
      cylinder(s, [x, y, 0.105], 0.099, 0.086, "#171e28", 16);
      cylinder(s, [x, y, 0.105], 0.067, 0.09, silver, 12);
      cylinder(s, [x, y, 0.105], 0.025, 0.096, "#614e83", 10);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + wheelPhase;
        cylinder(
          s,
          [x, y + Math.cos(a) * 0.077, 0.105 + Math.sin(a) * 0.077],
          0.021,
          0.075,
          "#303945",
          6,
          "x",
          Math.sign(x * y) * 0.55
        );
      }
    }
  // Lower square chassis, extrusion channels and four full-height posts.
  for (const z of [0.07, 0.3, 0.53, 0.97]) {
    for (const y of [-0.315, 0.287]) {
      box(s, -0.315, y, z, 0.63, 0.028, 0.028, silver);
      box(s, -0.295, y - 0.001, z + 0.011, 0.59, 0.004, 0.006, "#536070");
    }
    for (const x of [-0.315, 0.287])
      box(s, x, -0.287, z, 0.028, 0.574, 0.028, silver);
  }
  for (const x of [-0.315, 0.287])
    for (const y of [-0.315, 0.287]) {
      box(s, x, y, 0.098, 0.028, 0.028, 0.902, silver);
      box(s, x + 0.011, y - 0.001, 0.12, 0.006, 0.004, 0.84, "#526275");
      for (const z of [0.11, 0.31, 0.55, 0.97])
        cylinder(s, [x + 0.014, y - 0.004, z], 0.009, 0.006, "#785195", 8, "z");
    }
  // Electronics deck, battery box, blue controller boards, pneumatic plumbing.
  box(s, -0.26, -0.27, 0.205, 0.52, 0.5, 0.018, "#84939d");
  box(s, -0.18, -0.2, 0.113, 0.36, 0.3, 0.1, "#c5d0d9");
  box(s, -0.22, -0.22, 0.225, 0.16, 0.27, 0.035, "#285cbb");
  box(s, 0.04, -0.2, 0.225, 0.17, 0.25, 0.035, "#276fc6");
  for (const x of [-0.19, 0.07]) {
    box(s, x, -0.16, 0.26, 0.1, 0.12, 0.018, dark);
    for (let i = 0; i < 5; i++)
      box(s, x + i * 0.02, -0.205, 0.26, 0.011, 0.028, 0.012, "#70bbb5");
  }
  for (let i = 0; i < 6; i++)
    box(
      s,
      -0.23 + i * 0.075,
      -0.245,
      0.29,
      0.009,
      0.42,
      0.009,
      i % 2 ? "#48799c" : "#c86663"
    );
  // Three thin pick shelves, black vertical lifts and sliding grippers.
  for (const z of [0.43, 0.64, 0.84]) {
    box(s, -0.28, -0.27, z, 0.56, 0.5, 0.012, "#a88b68");
    box(s, -0.265, -0.19, z + 0.025, 0.53, 0.014, 0.014, silver);
    box(s, -0.055, -0.205, z + 0.02, 0.11, 0.09, 0.075, "#25303c");
    cylinder(
      s,
      [0, -0.11, z + 0.06],
      0.028,
      0.035,
      "#a3b3c0",
      12,
      "x",
      Math.PI / 2
    );
    for (const x of [-0.04, 0.026])
      box(s, x, -0.125, z + 0.005, 0.014, 0.16, 0.025, "#4e5b66");
  }
  for (const x of [-0.25, 0.22]) {
    box(s, x, -0.22, 0.37, 0.03, 0.04, 0.55, "#1c2b38");
    box(s, x + 0.008, -0.226, 0.4, 0.009, 0.008, 0.47, "#7b8e9e");
  }
  // Amber front panel, touch screen, ON and red emergency-stop, gauge and regulator.
  box(s, -0.265, 0.292, 0.24, 0.53, 0.015, 0.28, "#b77524", 0.85);
  box(s, -0.075, 0.308, 0.35, 0.18, 0.016, 0.125, "#131f2b");
  box(s, -0.059, 0.325, 0.368, 0.147, 0.003, 0.085, "#5590aa");
  box(s, -0.05, 0.328, 0.379, 0.063, 0.002, 0.055, "#233d6b");
  box(s, -0.195, 0.312, 0.37, 0.035, 0.016, 0.035, "#db353e");
  box(s, -0.195, 0.312, 0.44, 0.035, 0.016, 0.035, "#c7d5d4");
  box(s, 0.18, 0.275, 0.54, 0.055, 0.048, 0.105, "#b8ced3");
  box(s, 0.18, 0.29, 0.655, 0.055, 0.03, 0.04, "#233b4c");
  cylinder(
    s,
    [-0.215, 0.3, 0.64],
    0.043,
    0.018,
    "#263747",
    16,
    "x",
    Math.PI / 2
  );
  cylinder(
    s,
    [-0.215, 0.313, 0.64],
    0.033,
    0.012,
    "#d4e1dd",
    16,
    "x",
    Math.PI / 2
  );
  box(s, -0.235, 0.321, 0.641, 0.025, 0.003, 0.004, "#233644");
  box(s, -0.14, 0.28, 0.58, 0.28, 0.02, 0.16, "#b8c7cc");
  // Hose runs and a small front-facing blue navigation sensor.
  for (const x of [-0.23, 0.23])
    box(s, x, 0.23, 0.25, 0.012, 0.012, 0.6, "#b7cbd6");
  box(s, -0.04, 0.29, 0.14, 0.08, 0.035, 0.055, "#285e9a");
  // Subdivide broad panels for correct painter ordering around the grippers.
  // Leave beams/rollers untouched and omit internal panel seams.
  s.faces = s.faces.flatMap((face) => {
    if (face.points.length !== 4) return [face];
    const [a, b, , d] = face.points;
    const u = Math.hypot(...b.map((n, i) => n - a[i]));
    const v = Math.hypot(...d.map((n, i) => n - a[i]));
    if (Math.min(u, v) < 0.1) return [face];
    const cols = Math.ceil(u / 0.085),
      rows = Math.ceil(v / 0.085);
    const point = (x: number, y: number): Vec3 =>
      a.map((n, i) => n + (b[i] - n) * x + (d[i] - n) * y) as Vec3;
    const tiles: Face[] = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        tiles.push({
          ...face,
          noEdge: true,
          points: [
            point(x / cols, y / rows),
            point((x + 1) / cols, y / rows),
            point((x + 1) / cols, (y + 1) / rows),
            point(x / cols, (y + 1) / rows),
          ],
        });
    return tiles;
  });
  return s;
}

export function placeRobot(model: Scene, pose: RobotPose): Scene {
  // Fix the photographed body front, without changing logical map/ROS headings.
  const angle =
    pose.heading + (ROBOT_PROFILE.model_forward_offset_deg * Math.PI) / 180;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return {
    labels: [],
    faces: model.faces.map((face) => ({
      ...face,
      points: face.points.map(
        ([x, y, z]) =>
          [pose.x + x * s + y * c, pose.y - x * c + y * s, z] as Vec3
      ),
    })),
  };
}
