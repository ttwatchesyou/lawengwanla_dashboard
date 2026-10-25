// New physical layout: do not silently reuse the old five-sensor mounting map.
export const TOF_CONFIG_KEY = "lawengwanla-tof-display-v2";
export const TOF_SENSOR_COUNT = 4;
export const TOF_DIRECTIONS = [
  { id: "front", label: "หน้า", point: [150, 84], vector: [0, -1] },
  { id: "rear", label: "หลัง", point: [150, 166], vector: [0, 1] },
  { id: "left", label: "ซ้าย", point: [108, 125], vector: [-1, 0] },
  { id: "right", label: "ขวา", point: [192, 125], vector: [1, 0] },
] as const;
export type TofDirection = (typeof TOF_DIRECTIONS)[number]["id"];
export type TofConfig = {
  unit: "mm" | "cm" | "m" | null;
  confirmed: boolean;
  mapping: Record<TofDirection, number | null>;
};
export type TofPacket = {
  raw_values: (number | null)[];
  fresh: boolean;
  sequence: number;
  age_ms: number | null;
  publisher_count: number | null;
};
export const defaultTofConfig = (): TofConfig => ({
  unit: "mm", // Confirmed by the team; only the channel order is still unknown.
  confirmed: false,
  mapping: {
    front: null,
    rear: null,
    left: null,
    right: null,
  },
});
export function validTofConfig(value: TofConfig) {
  if (
    !value ||
    typeof value !== "object" ||
    !value.mapping ||
    typeof value.mapping !== "object" ||
    Array.isArray(value.mapping) ||
    Object.keys(value.mapping).length !== TOF_SENSOR_COUNT ||
    TOF_DIRECTIONS.some((d) => !(d.id in value.mapping))
  )
    return false;
  const indices = Object.values(value.mapping).filter(
    (v): v is number => v !== null
  );
  return (
    ["mm", "cm", "m"].includes(value.unit ?? "") &&
    value.confirmed === true &&
    indices.length === TOF_SENSOR_COUNT &&
    indices.every(
      (v) => Number.isInteger(v) && v >= 0 && v < TOF_SENSOR_COUNT
    ) &&
    new Set(indices).size === indices.length
  );
}
export function restoreTofConfig(value: unknown): TofConfig {
  const fallback = defaultTofConfig();
  if (!value || typeof value !== "object") return fallback;
  const data = value as TofConfig;
  if (
    !data.mapping ||
    typeof data.mapping !== "object" ||
    Array.isArray(data.mapping) ||
    TOF_DIRECTIONS.some((d) => !(d.id in data.mapping))
  )
    return fallback;
  return validTofConfig(data)
    ? { unit: data.unit, confirmed: true, mapping: { ...data.mapping } }
    : fallback;
}
export function parseTofPacket(value: unknown): TofPacket {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as TofPacket).raw_values)
  )
    throw Error("ข้อมูล ToF ไม่ถูกต้อง");
  const data = value as TofPacket;
  return {
    raw_values: data.raw_values
      .slice(0, 16)
      .map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)),
    fresh: data.fresh === true,
    sequence: Number.isSafeInteger(data.sequence) ? data.sequence : 0,
    age_ms:
      typeof data.age_ms === "number" &&
      Number.isFinite(data.age_ms) &&
      data.age_ms >= 0
        ? data.age_ms
        : null,
    publisher_count:
      Number.isInteger(data.publisher_count) && data.publisher_count! >= 0
        ? data.publisher_count
        : null,
  };
}
export function tofCentimeters(
  raw: unknown,
  unit: TofConfig["unit"]
): number | null {
  if (
    typeof raw !== "number" ||
    !Number.isFinite(raw) ||
    raw <= 0 ||
    unit === null
  )
    return null;
  const value = raw * (unit === "mm" ? 0.1 : unit === "m" ? 100 : 1);
  return Number.isFinite(value) ? value : null;
}
export function tofReadings(
  packet: TofPacket | null,
  config: TofConfig,
  fresh: boolean
) {
  const configured = validTofConfig(config);
  const factor = config.unit === "mm" ? 0.001 : config.unit === "cm" ? 0.01 : 1;
  return TOF_DIRECTIONS.map((direction) => {
    const channel = config.mapping[direction.id],
      raw = channel === null ? null : packet?.raw_values[channel] ?? null;
    const meters =
      configured &&
      packet?.raw_values.length === TOF_SENSOR_COUNT &&
      fresh &&
      typeof raw === "number" &&
      raw > 0 &&
      Number.isFinite(raw * factor)
        ? raw * factor
        : null;
    return { ...direction, channel, raw, meters };
  });
}
