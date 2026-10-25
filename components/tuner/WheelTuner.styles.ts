import styled, { CSSObject } from "styled-components";
import { Button as AntButton } from "antd";
import { tunerSurface } from "./TunerSurface";

const styles: Record<string, CSSObject> = {
  page: {
    width: "100%",
    margin: 0,
    padding: "80px 24px 24px",
    color: "#ffdc7c",
    background: "#fffbde",
    minHeight: "calc(100vh - 80px)",
    fontFamily: "Prompt, Kanit, sans-serif",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: "8px 4px",
  },
  title: {
    margin: 0,
    color: "#b81f20",
    fontFamily: "Prompt, Kanit, sans-serif",
    fontWeight: 700,
  },
  subtitle: {
    margin: "3px 0 0",
    color: "#344054",
    fontFamily: "Prompt, Kanit, sans-serif",
    fontSize: 14,
  },
  muted: { color: "#ffdc7c", opacity: 0.78, fontSize: 12, letterSpacing: 0.4 },
  warning: {
    margin: "14px 0",
    padding: 12,
    borderRadius: 8,
    background: "#fff3ca",
    border: "1px solid #d29922",
    color: "#594000",
    fontFamily: "Prompt, sans-serif",
  },
  badge: {
    padding: "8px 12px",
    borderRadius: 5,
    fontWeight: 700,
    fontSize: 11,
    fontFamily: "Consolas, monospace",
    letterSpacing: 1,
  },
  tabs: { display: "flex", gap: 8, margin: "12px 0" },
  tab: {
    background: "#dbeafe",
    color: "#1e3271",
    border: "1px solid #1e3271",
    padding: "10px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 800,
    fontFamily: "Prompt, sans-serif",
  },
  tabActive: { background: "#1e3271", color: "#ffdc7c" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 12,
  },
  card: {
    background: "#1e3271",
    border: "1px solid #21262d",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    boxShadow: "0 2px 7px #0d111733",
  },
  primary: {
    background: "#00d4aa",
    color: "#0d1117",
    border: 0,
    padding: "9px 12px",
    borderRadius: 5,
    margin: "4px",
    cursor: "pointer",
    fontWeight: 800,
    fontFamily: "Consolas, monospace",
    letterSpacing: 0.5,
  },
  secondary: {
    background: "#58a6ff",
    color: "#0d1117",
    border: 0,
    padding: "9px 12px",
    borderRadius: 5,
    margin: "4px",
    cursor: "pointer",
    fontWeight: 700,
    fontFamily: "Consolas, monospace",
  },
  stop: {
    background: "#f85149",
    color: "#0d1117",
    border: 0,
    padding: "9px 12px",
    borderRadius: 5,
    margin: "4px",
    cursor: "pointer",
    fontWeight: 800,
    fontFamily: "Consolas, monospace",
  },
  wheelButtons: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
  },
  wheelButton: {
    padding: "12px 8px",
    background: "#0d1117",
    color: "#ffdc7c",
    border: "1px solid #21262d",
    borderRadius: 5,
    cursor: "pointer",
    fontWeight: 700,
    fontFamily: "Consolas, monospace",
  },
  inputs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 12,
  },
  preset: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
    fontSize: 11,
  },
  input: {
    display: "block",
    width: "100%",
    marginTop: 5,
    padding: 8,
    boxSizing: "border-box",
    borderRadius: 4,
    border: "1px solid #21262d",
    background: "#0d1117",
    color: "#ffdc7c",
    fontFamily: "Consolas, monospace",
  },
  readings: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
    gap: 12,
  },
  reading: {
    background: "#1e3271",
    border: "1px solid #21262d",
    borderRadius: 8,
    padding: 14,
    display: "grid",
    gap: 7,
    fontSize: 12,
  },
  poseMap: {
    width: "100%",
    maxWidth: 380,
    display: "block",
    margin: "0 auto",
    background: "#0d1117",
    border: "1px solid #5c6fbb",
    borderRadius: 6,
  },
  error: { color: "#f85149" },
};

export const TunerButton = styled(AntButton)`
  && {
    height: auto;
    min-height: 36px;
    white-space: normal;
    font-family: inherit;
    max-width: 100%;
  }
  &&:disabled {
    background: #293c68;
    color: #a6b3d1;
    opacity: 0.7;
    cursor: not-allowed;
  }
`;
export const Page = styled.main(styles.page as CSSObject, tunerSurface);
export const Hero = styled.section(styles.hero as CSSObject, {
  flexWrap: "wrap",
});
export const Title = styled.h1(styles.title as CSSObject);
export const Subtitle = styled.p(styles.subtitle as CSSObject);
export const ConnectionBadge = styled.div<{ $connected: boolean }>(
  (p) =>
    ({
      ...styles.badge,
      background: p.$connected ? "#155e4b" : "#7f1d1d",
    } as CSSObject)
);
export const Warning = styled.section(styles.warning as CSSObject);
export const Tabs = styled.div(styles.tabs as CSSObject, { flexWrap: "wrap" });
export const TabButton = styled(TunerButton)<{ $active: boolean }>(
  (p) =>
    ({ ...styles.tab, ...(p.$active ? styles.tabActive : {}) } as CSSObject)
);
export const Panel = styled.section(styles.card as CSSObject);
export const StopButton = styled(TunerButton)(styles.stop as CSSObject);
export const SecondaryButton = styled(TunerButton)(
  styles.secondary as CSSObject
);
export const Note = styled.p(styles.muted as CSSObject);
export const TabContent = styled.div<{ $active: boolean }>(
  (p) => ({ display: p.$active ? "block" : "none" } as CSSObject)
);
export const PanelGrid = styled.section(styles.grid as CSSObject);
export const PanelCard = styled.div(styles.card as CSSObject);
export const PrimaryButton = styled(TunerButton)(styles.primary as CSSObject);
export const ErrorText = styled.p(styles.error as CSSObject);
export const WheelButtons = styled.div(styles.wheelButtons as CSSObject);
export const WheelButton = styled(TunerButton)<{
  $color: string;
  $selected: boolean;
}>(
  (p) =>
    ({
      ...styles.wheelButton,
      outline: p.$selected ? `3px solid ${p.$color}` : "none",
    } as CSSObject)
);
export const AllWheelsButton = styled(TunerButton)<{ $selected: boolean }>(
  (p) =>
    ({
      ...styles.wheelButton,
      outline: p.$selected ? "3px solid #ffdc7c" : "none",
    } as CSSObject)
);
export const Fields = styled.div(styles.inputs as CSSObject, {
  gridTemplateColumns: "minmax(0, 1fr)",
});
export const PresetControls = styled.div(styles.preset as CSSObject);
export const VelocityChartBody = styled.div({ height: 310 } as CSSObject);
export const Readings = styled.section(styles.readings as CSSObject);
export const WheelReading = styled.div<{ $color: string }>(
  (p) =>
    ({ ...styles.reading, borderTop: `4px solid ${p.$color}` } as CSSObject)
);
export const PoseChartBody = styled.div({
  height: 270,
  minWidth: 0,
} as CSSObject);
export const ErrorChartBody = styled.div({
  height: 170,
  minWidth: 0,
} as CSSObject);
export const Reading = styled.div(styles.reading as CSSObject);
export const MapContainer = styled.div({ height: 330 } as CSSObject);
export const PoseMap = styled.svg(styles.poseMap as CSSObject);
