import { useEffect, useRef, useState } from "react";
import { Modal } from "antd";
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FlagOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import styled from "styled-components";
import {
  cellKey,
  cellLabel,
  MAX_ROUTE_CELLS,
  MazeCell,
} from "../utils/mazeRoute";
import { routeAfterDeletion } from "../utils/routeEditing";
import {
  settingsForCell,
  waypointOffset,
  WaypointSettingsMap,
} from "../utils/waypointSettings";
import { mapOffsetToRobot } from "../utils/offsetFrames";

type Props = {
  route: MazeCell[];
  settings: WaypointSettingsMap;
  onEdit: (index: number) => void;
  onChange: (route: MazeCell[], message: string) => void;
};
const signature = (route: MazeCell[]) => route.map(cellKey).join(";");

export default function RouteStepList({
  route,
  settings,
  onEdit,
  onChange,
}: Props) {
  const [checked, setChecked] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [undo, setUndo] = useState<{
    before: MazeCell[];
    after: string;
  } | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const previousLength = useRef(route.length);
  const routeSignature = signature(route);
  useEffect(() => {
    setChecked([]);
    setDeleting(null);
  }, [routeSignature]);
  useEffect(() => {
    if (list.current && route.length === previousLength.current + 1)
      list.current.scrollTop = list.current.scrollHeight;
    previousLength.current = route.length;
  }, [route.length]);
  const deletion = routeAfterDeletion(route, deleting || []);
  const suffix = () => {
    const first = route.findIndex((cell) => deleting?.includes(cellKey(cell)));
    if (first >= 0) setDeleting(route.slice(first).map(cellKey));
  };
  return (
    <Panel aria-labelledby="route-order-title">
      <Heading>
        <h2 id="route-order-title">
          <FlagOutlined /> ลำดับการเดิน
        </h2>
        <span>
          {route.length} / {MAX_ROUTE_CELLS}
        </span>
      </Heading>
      <Body>
        <Tools>
          <Button
            disabled={!route.length}
            onClick={() => setDeleting([cellKey(route[route.length - 1])])}
          >
            <UndoOutlined /> ย้อน 1 ช่อง
          </Button>
          <Button
            disabled={!route.length}
            onClick={() => setDeleting(route.map(cellKey))}
          >
            <DeleteOutlined /> ล้าง
          </Button>
        </Tools>
        <Bulk>
          <label>
            <input
              type="checkbox"
              aria-label="เลือกทุกรายการเดิน"
              checked={route.length > 0 && checked.length === route.length}
              disabled={!route.length}
              onChange={(e) =>
                setChecked(e.target.checked ? route.map(cellKey) : [])
              }
            />{" "}
            เลือกทั้งหมด
          </label>
          <Button
            disabled={!checked.length}
            onClick={() => setDeleting([...checked])}
          >
            ลบที่เลือก ({checked.length})
          </Button>
        </Bulk>
        <List ref={list} aria-label="ลำดับ waypoint">
          {!route.length && (
            <Empty>เลือกพรีเซ็ต หรือแตะ A8 เพื่อเริ่มวางเส้นทาง</Empty>
          )}
          {route.map((cell, index) => {
            const key = cellKey(cell),
              config = settingsForCell(settings, cell);
            const previous = route[index - 1],
              mapOffset = waypointOffset(
                config,
                previous ? cell.col - previous.col : 1,
                previous ? cell.row - previous.row : 0
              );
            const offset = mapOffsetToRobot(mapOffset.x, mapOffset.y);
            return (
              <Row key={key} $selected={checked.includes(key)}>
                <Check>
                  <input
                    type="checkbox"
                    aria-label={`เลือกลำดับ ${index + 1} ${cellLabel(
                      cell
                    )} เพื่อลบ`}
                    checked={checked.includes(key)}
                    onChange={(e) =>
                      setChecked(
                        e.target.checked
                          ? [...checked, key]
                          : checked.filter((item) => item !== key)
                      )
                    }
                  />
                </Check>
                <NumberTag>{String(index + 1).padStart(2, "0")}</NumberTag>
                <Detail>
                  <b>
                    {cellLabel(cell)}{" "}
                    <small>
                      {config.stop_here
                        ? "จบเส้นทาง · คงตำแหน่ง"
                        : index === 18
                        ? "CHECKPOINT 19"
                        : index === 0
                        ? "START"
                        : index === route.length - 1
                        ? "END"
                        : ""}
                    </small>
                  </b>
                  <span>
                    {offset.x || offset.y
                      ? `X ${offset.x >= 0 ? "+" : ""}${Number(
                          (offset.x * 100).toFixed(1)
                        )} / Y ${offset.y >= 0 ? "+" : ""}${Number(
                          (offset.y * 100).toFixed(1)
                        )} ซม. · `
                      : ""}
                    {config.speed_mps.toFixed(2)} m/s
                  </span>
                </Detail>
                <IconButton
                  aria-label={`แก้ไขลำดับ ${index + 1} ${cellLabel(cell)}`}
                  title="ปรับค่าช่องนี้"
                  onClick={() => onEdit(index)}
                >
                  <EditOutlined />
                </IconButton>
                <IconButton
                  $danger
                  aria-label={`ลบลำดับ ${index + 1} ${cellLabel(cell)}`}
                  title="ลบรายการ (ต้องยืนยัน)"
                  onClick={() => setDeleting([key])}
                >
                  <CloseOutlined />
                </IconButton>
              </Row>
            );
          })}
        </List>
        {undo && (
          <Button
            disabled={undo.after !== routeSignature}
            onClick={() => {
              onChange(undo.before, "คืนค่ารายการที่ลบล่าสุดแล้ว");
              setUndo(null);
            }}
          >
            ↶ คืนค่าการลบล่าสุด
          </Button>
        )}
      </Body>
      <Modal
        open={deleting !== null}
        title="ยืนยันลบรายการเดิน"
        centered
        zIndex={9600}
        footer={null}
        onCancel={() => setDeleting(null)}
        maskClosable={false}
        width={520}
      >
        <p>
          จะลบ {deletion.removed.length} รายการ และเหลือ{" "}
          {deletion.remaining.length} / {MAX_ROUTE_CELLS} ช่อง
        </p>
        <Preview>{deletion.removed.map(cellLabel).join(" · ")}</Preview>
        <p>
          เก็บค่าความเร็ว/ความคลาดเคลื่อนเดิมไว้ให้ หากเพิ่มช่องกลับมาอีกครั้ง
        </p>
        {deletion.error && <Error role="alert">{deletion.error}</Error>}
        {deletion.error && (
          <ModalButton onClick={suffix}>
            เปลี่ยนเป็นลบตั้งแต่รายการที่เลือกถึงท้าย
          </ModalButton>
        )}
        <Tools>
          <ModalButton onClick={() => setDeleting(null)}>ยกเลิก</ModalButton>
          <ModalButton
            $danger
            disabled={!!deletion.error}
            onClick={() => {
              if (deletion.error) return;
              setUndo({
                before: route.map((cell) => ({ ...cell })),
                after: signature(deletion.remaining),
              });
              onChange(
                deletion.remaining,
                `ลบ ${deletion.removed.length} รายการแล้ว · ตรวจให้ครบ ${MAX_ROUTE_CELLS} ช่องก่อนเริ่ม`
              );
              setDeleting(null);
              setChecked([]);
            }}
          >
            ยืนยันลบ {deletion.removed.length} รายการ
          </ModalButton>
        </Tools>
      </Modal>
    </Panel>
  );
}

const Panel = styled.section`
  border: 1px solid #445c95;
  border-radius: 15px;
  background: #1e3271;
  color: #e5edff;
  overflow: hidden;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;
const Heading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 20px;
  min-height: 68px;
  border-bottom: 1px solid #445987;
  h2 {
    margin: 0;
    color: #ffdc7c;
    font-size: 15px;
  }
  span {
    font-size: 11px;
  }
`;
const Body = styled.div`
  padding: 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;
const Tools = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;
const Button = styled.button.attrs({ type: "button" })`
  min-height: 40px;
  border: 1px solid #566a9b;
  border-radius: 7px;
  background: #30467f;
  color: #e2e7f7;
  font-size: 11px !important;
  padding: 7px 10px;
  flex: 1;
`;
const Bulk = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    min-height: 40px;
    flex: 1;
  }
  input {
    width: 20px;
    height: 20px;
    accent-color: #ffdc7c;
  }
`;
const List = styled.ol`
  list-style: none;
  margin: 9px 0;
  padding: 0 3px 0 0;
  height: 0;
  min-height: 320px;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #677bb1 transparent;
  @media (min-width: 741px) and (max-height: 740px) {
    min-height: 240px;
  }
`;
const Row = styled.li<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 0;
  border-bottom: 1px solid #445987;
  background: ${(p) => (p.$selected ? "#344b86" : "transparent")};
`;
const Check = styled.label`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 44px;
  input {
    width: 20px;
    height: 20px;
    accent-color: #ffdc7c;
  }
`;
const NumberTag = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 30px;
  flex-shrink: 0;
  background: #344b86;
  color: #ffdc7c;
  border-radius: 8px;
  font-size: 11px;
  border: 1px solid #566a9b;
`;
const Detail = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  b {
    color: #fff5d4;
    font-size: 13px;
  }
  small {
    font-size: 8px;
    color: #c4cfe9;
  }
  span {
    color: #c4cfe9;
    font-size: 10px;
    overflow-wrap: anywhere;
  }
`;
const IconButton = styled.button.attrs({ type: "button" })<{
  $danger?: boolean;
}>`
  width: 40px;
  min-height: 44px;
  flex-shrink: 0;
  border: 1px solid ${(p) => (p.$danger ? "#925e7a" : "#566a9b")};
  border-radius: 8px;
  background: ${(p) => (p.$danger ? "#493858" : "#30467f")};
  color: ${(p) => (p.$danger ? "#ffadb5" : "#ffdc7c")};
  font-size: 17px !important;
`;
const Empty = styled.li`
  padding: 24px 8px;
  text-align: center;
  color: #c4cfe9;
  font-size: 12px;
`;
const Preview = styled.p`
  max-height: 100px;
  overflow-y: auto;
  background: #f3f5fa;
  padding: 10px;
  border-radius: 8px;
`;
const Error = styled.p`
  color: #ad253d;
  background: #fff1f0;
  padding: 10px;
  border-radius: 8px;
`;
const ModalButton = styled.button.attrs({ type: "button" })<{
  $danger?: boolean;
}>`
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #a9b3ca;
  background: ${(p) => (p.$danger ? "#a72945" : "#eef1fa")};
  color: ${(p) => (p.$danger ? "white" : "#1e3271")};
  margin: 5px 0;
  cursor: pointer;
  touch-action: manipulation;
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  &:focus-visible {
    outline: 3px solid #45a9a9;
    outline-offset: 2px;
  }
`;
