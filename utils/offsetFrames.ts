// Inputs use the robot's initial heading: X forward, Y left.
// The planner stores map coordinates: X right, Y forward.
export const mapOffsetToRobot = (x: number, y: number) => ({x:y===0 ? 0 : y,y:x===0 ? 0 : -x});
export const robotOffsetToMap = (x: number, y: number) => ({x:y===0 ? 0 : -y,y:x===0 ? 0 : x});
