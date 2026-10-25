import styled, { CSSObject } from "styled-components";
import { Button as AntButton } from "antd";
import { tunerSurface } from "./TunerSurface";

const styles: Record<string, CSSObject> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    boxSizing: "border-box",
    background: "#fffbde",
    color: "#ffdc7c",
    padding: "80px 24px 24px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    minHeight: 30,
  },
  badge: { fontSize: 10, fontWeight: 700, letterSpacing: 0.5 },
  card: {
    background: "#1e3271",
    border: "1px solid #21262d",
    borderRadius: 8,
    marginBottom: 10,
    minWidth: 0,
    overflow: "hidden",
    padding: "0 12px 10px",
  },
  heading: {
    margin: "0 -12px 10px",
    padding: "8px 12px 6px",
    borderBottom: "1px solid #21262d",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 1.5,
    color: "#ffdc7c",
  },
  graphTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "0 -12px 8px",
    padding: "0 12px",
    borderBottom: "1px solid #44568c",
    minHeight: 34,
  },
  fullGraphHeading: {
    margin: 0,
    padding: "7px 0",
    border: 0,
    fontSize: 11,
    letterSpacing: 1.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  fullGraphCard: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    marginBottom: 0,
    paddingBottom: 8,
    boxShadow: "0 3px 10px rgba(19,34,74,.12)",
  },
  fullGraphBody: { flex: 1, minWidth: 0, minHeight: 0 },
  graphFocusButton: {
    background: "#314881",
    color: "#ffdc7c",
    border: "1px solid #5c6fbb",
    borderRadius: 4,
    width: 24,
    height: 22,
    cursor: "pointer",
    fontSize: 15,
    lineHeight: 1,
  },
  graphLegend: {
    display: "flex",
    flexWrap: "wrap",
    gap: "3px 9px",
    paddingBottom: 6,
    fontSize: 9,
    color: "#e6ecff",
    minHeight: 15,
  },
  graphLegendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap",
  },
  graphLegendSwatch: {
    display: "inline-block",
    width: 12,
    height: 3,
    borderRadius: 2,
  },
  graphViewButton: {
    background: "#1e3271",
    color: "#ffdc7c",
    border: "1px solid #5c6fbb",
    borderRadius: 5,
    padding: "7px 11px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "Consolas, monospace",
  },
  graphClose: {
    background: "#ffdc7c",
    color: "#1e3271",
    border: 0,
    borderRadius: 5,
    padding: "8px 12px",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  wheelSelect: {
    background: "#314881",
    color: "#ffdc7c",
    border: "1px solid #5c6fbb",
    borderRadius: 4,
    padding: "5px 8px",
    marginLeft: 4,
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  inputs: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 8,
    marginBottom: 8,
  },
  goalInputs: { display: "block", width: "100%", marginBottom: 10 },
  field: {
    display: "grid",
    alignItems: "center",
    gap: 8,
    fontSize: 9,
    letterSpacing: 0.4,
    marginBottom: 8,
    color: "#ffdc7c",
  },
  input: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: "5px 8px",
    marginTop: 4,
    background: "#0d1117",
    color: "#ffdc7c",
    border: "1px solid #21262d",
    borderRadius: 4,
    fontFamily: "Consolas, monospace",
    fontSize: 11,
  },
  goalInput: {
    minHeight: 38,
    padding: "7px 10px",
    fontSize: 14,
    border: "1px solid #6e85c5",
  },
  button: {
    background: "#58a6ff",
    color: "#0d1117",
    border: 0,
    borderRadius: 5,
    padding: "7px 12px",
    margin: "4px 6px 4px 0",
    fontFamily: "Consolas, monospace",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  stop: {
    background: "#f85149",
    color: "#0d1117",
    border: 0,
    borderRadius: 5,
    padding: "8px 12px",
    fontFamily: "Consolas, monospace",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  go: {
    background: "#00d4aa",
    color: "#0d1117",
    border: 0,
    borderRadius: 5,
    padding: "8px 12px",
    fontFamily: "Consolas, monospace",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  reset: {
    background: "#d29922",
    color: "#0d1117",
    border: 0,
    borderRadius: 5,
    padding: "8px 12px",
    fontFamily: "Consolas, monospace",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  send: {
    background: "#ff6b35",
    color: "#0d1117",
    border: 0,
    borderRadius: 5,
    padding: "7px 16px",
    fontFamily: "Consolas, monospace",
    fontSize: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
  preset: {
    background: "#21262d",
    color: "#ffdc7c",
    border: 0,
    borderRadius: 4,
    padding: "5px 12px",
    fontFamily: "Consolas, monospace",
    fontSize: 9,
    cursor: "pointer",
  },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 6 },
  odom: { fontSize: 11, color: "#00d4aa", margin: "0 0 6px" },
  note: { color: "#ffdc7c", fontSize: 9, lineHeight: 1.5, margin: "6px 0" },
};

export const TunerLayout = styled.div`
  display: flex;
  align-items: flex-start;
  min-height: calc(100vh - 104px);
  @media (max-width: 900px) {
    flex-direction: column;
  }
`;
export const TunerControls = styled.div`
  width: 440px;
  flex-shrink: 0;
  padding: 16px 8px 16px 16px;
  border-right: 1px solid #21262d;
  box-sizing: border-box;
  @media (max-width: 900px) {
    width: 100%;
    border-right: 0;
    border-bottom: 1px solid #21262d;
  }
  @media (max-width: 600px) {
    padding: 12px 0;
  }
`;
export const TunerReadout = styled.div`
  flex: 1;
  min-width: 0;
  padding: 16px;
  box-sizing: border-box;
  @media (max-width: 900px) {
    width: 100%;
  }
  @media (max-width: 600px) {
    padding: 12px 0;
  }
`;

export const GraphWorkspace = styled.div`
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  box-sizing: border-box;
  background: #fffbde;
  color: #1e3271;
  overflow: hidden;
  @media (max-width: 1100px), (max-height: 650px) {
    overflow-y: auto;
  }
`;
export const GraphWorkspaceHeader = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 56px;
  padding: 9px 16px;
  box-sizing: border-box;
  border-radius: 8px;
  background: #1e3271;
  color: #ffdc7c;
`;
export const GraphWorkspaceTitle = styled.div`
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.6px;
  span {
    color: #00d4aa;
  }
`;
export const GraphWorkspaceSubtitle = styled.div`
  font-size: 10px;
  opacity: 0.8;
  margin-top: 3px;
`;
export const GraphWorkspaceActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;
export const GraphStats = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  @media (max-width: 800px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;
export const GraphStat = styled.div`
  background: #1e3271;
  color: #ffdc7c;
  border-radius: 7px;
  padding: 7px 11px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  span {
    font-size: 9px;
    opacity: 0.75;
    letter-spacing: 0.6px;
  }
  strong {
    font-size: 14px;
    font-family: Consolas, monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
export const GraphGrid = styled.div<{ $focused: boolean }>`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: ${(props) =>
    props.$focused ? "minmax(0, 1fr)" : "repeat(3, minmax(0, 1fr))"};
  grid-template-rows: ${(props) =>
    props.$focused ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))"};
  gap: 10px;
  @media (max-width: 1100px) {
    grid-template-columns: ${(props) =>
      props.$focused ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))"};
    grid-template-rows: ${(props) =>
      props.$focused ? "minmax(420px, 1fr)" : "repeat(3, minmax(220px, 1fr))"};
  }
  @media (max-width: 620px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: ${(props) =>
      props.$focused ? "minmax(420px, 1fr)" : "repeat(6, minmax(220px, 1fr))"};
  }
  @media (max-height: 650px) {
    min-height: 520px;
  }
`;
export const GraphWorkspaceFooter = styled.footer`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  min-height: 26px;
  font-size: 10px;
  color: #475882;
`;

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
export const ChartPanel = styled.section<{ $full: boolean }>(
  (p) =>
    ({ ...styles.card, ...(p.$full ? styles.fullGraphCard : {}) } as CSSObject)
);
export const ChartTitleRow = styled.div<{ $full: boolean }>(
  (p) =>
    ({
      ...styles.graphTitleRow,
      ...(p.$full ? { marginBottom: 8 } : {}),
    } as CSSObject)
);
export const ChartHeading = styled.h2<{ $full: boolean }>(
  (p) =>
    ({
      ...styles.heading,
      ...(p.$full ? styles.fullGraphHeading : {}),
    } as CSSObject)
);
export const FocusButton = styled(TunerButton)(
  styles.graphFocusButton as CSSObject
);
export const ChartLegend = styled.div(styles.graphLegend as CSSObject);
export const LegendItem = styled.span(styles.graphLegendItem as CSSObject);
export const LegendSwatch = styled.i<{ $color: string }>(
  (p) => ({ ...styles.graphLegendSwatch, background: p.$color } as CSSObject)
);
export const ChartBody = styled.div<{ $full: boolean }>(
  (p) =>
    (p.$full ? styles.fullGraphBody : { height: 260, minWidth: 0 }) as CSSObject
);
export const Panel = styled.section(styles.card as CSSObject);
export const PanelHeading = styled.h2(styles.heading as CSSObject);
export const PoseMap = styled.svg({
  width: "100%",
  maxHeight: 440,
  display: "block",
  margin: "auto",
  background: "#0d1117",
  border: "1px solid #21262d",
} as CSSObject);
export const Note = styled.p(styles.note as CSSObject);
export const Page = styled.main(styles.page as CSSObject, tunerSurface);
export const PageHeader = styled.header(styles.header as CSSObject);
export const GraphViewButton = styled(TunerButton)(
  styles.graphViewButton as CSSObject
);
export const ConnectionBadge = styled.span<{ $fresh: boolean }>(
  (p) =>
    ({ ...styles.badge, color: p.$fresh ? "#3fb950" : "#f85149" } as CSSObject)
);
export const GoalFields = styled.div(styles.goalInputs as CSSObject);
export const InlineNote = styled.span(styles.note as CSSObject);
export const PresetButton = styled(TunerButton)(styles.preset as CSSObject);
export const Actions = styled.div(styles.actions as CSSObject);
export const GoButton = styled(TunerButton)(styles.go as CSSObject);
export const StopButton = styled(TunerButton)(styles.stop as CSSObject);
export const ResetButton = styled(TunerButton)(styles.reset as CSSObject);
export const ActionButton = styled(TunerButton)(styles.button as CSSObject);
export const ArmLabel = styled.label({
  ...styles.note,
  display: "block",
} as CSSObject);
export const HoldButton = styled(TunerButton)({
  ...styles.go,
  touchAction: "none",
  marginTop: 7,
} as CSSObject);
export const SendButton = styled(TunerButton)(styles.send as CSSObject);
export const OdometryText = styled.p(styles.odom as CSSObject);
export const LogEntries = styled.div({
  height: 126,
  overflowY: "auto",
  fontFamily: "Consolas, monospace",
  fontSize: 9,
  lineHeight: 1.7,
} as CSSObject);
export const WheelRowControls = styled.div({
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
} as CSSObject);
export const WheelFilterButton = styled(TunerButton)<{
  $color: string;
  $selected: boolean;
}>(
  (p) =>
    ({
      ...styles.button,
      background: p.$selected ? p.$color : "#a6b3d1",
    } as CSSObject)
);
export const NoiseChartBody = styled.div({
  height: 230,
  minWidth: 0,
} as CSSObject);
export const CanvasNote = styled.p({
  ...styles.note,
  color: "#6f6440",
} as CSSObject);
export const CloseGraphButton = styled(TunerButton)(
  styles.graphClose as CSSObject
);
export const WheelSelectButton = styled(TunerButton)<{
  $color: string;
  $selected: boolean;
}>(
  (p) =>
    ({
      ...styles.wheelSelect,
      ...(p.$selected ? { background: p.$color, color: "#0d1117" } : {}),
    } as CSSObject)
);
