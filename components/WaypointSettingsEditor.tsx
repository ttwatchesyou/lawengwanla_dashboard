import useStm32Contract from "../utils/useStm32Contract";
import { useEffect, useState } from "react";
import {
  CellBadge,
  Error,
  Field,
  Fields,
  Footer,
  ModalTitle,
  Note,
  NumberControl,
  SettingsModal,
} from "./MotionSettingsUi";
import styled from "styled-components";
import { cellLabel, MazeCell } from "../utils/mazeRoute";
import { ROBOT_INITIAL_HEADING_DEG } from "../utils/robotSimulation";
import { mapOffsetToRobot } from "../utils/offsetFrames";
import {
  DEFAULT_WAYPOINT_SETTINGS,
  settingsForCell,
  waypointOffset,
  validWaypointSettings,
  WaypointSettings,
  WaypointSettingsMap,
} from "../utils/waypointSettings";

type Props = {
  index: number | null;
  route: MazeCell[];
  settings: WaypointSettingsMap;
  onSelect: (index: number | null) => void;
  onSave: (cell: MazeCell, value: WaypointSettings) => void;
};

export default function WaypointSettingsEditor({
  index,
  route,
  settings,
  onSelect,
  onSave,
}: Props) {
  const { contract } = useStm32Contract();
  const policy = contract?.position;
  const [developerOpen, setDeveloperOpen] = useState(false);
  const cell = index === null ? undefined : route[index];
  const [draft, setDraft] = useState<WaypointSettings>({
    ...DEFAULT_WAYPOINT_SETTINGS,
  });
  useEffect(() => {
    setDeveloperOpen(false);
    if (cell) {
      const config = settingsForCell(settings, cell),
        previous = index ? route[index - 1] : undefined;
      const offset = waypointOffset(
        config,
        previous ? cell.col - previous.col : 1,
        previous ? cell.row - previous.row : 0
      );
      setDraft({
        ...config,
        distance_offset_m: 0,
        distance_offset_axis: "travel",
        distance_offset_x_m: offset.x,
        distance_offset_y_m: offset.y,
      });
    }
  }, [cell, settings, index, route]);
  const valid = validWaypointSettings(draft);
  const robotOffset = mapOffsetToRobot(
    draft.distance_offset_x_m ?? 0,
    draft.distance_offset_y_m ?? 0
  );
  const save = (next: number | null) => {
    if (cell && valid) {
      onSave(cell, { ...draft });
      onSelect(next);
    }
  };
  const change = <K extends keyof WaypointSettings>(
    key: K,
    value: WaypointSettings[K]
  ) => setDraft((previous) => ({ ...previous, [key]: value }));
  return (
    <SettingsModal
      open={!!cell}
      onCancel={() => onSelect(null)}
      width={580}
      centered
      zIndex={9600}
      destroyOnClose
      title={
        <ModalTitle>
          {cell && <CellBadge>{cellLabel(cell)}</CellBadge>}
          <div>
            <h2>ตั้งค่าการเคลื่อนที่</h2>
            <p>
              ช่อง {index === null ? 0 : index + 1} จาก {route.length}
            </p>
          </div>
        </ModalTitle>
      }
      footer={
        <Footer>
          <button
            type="button"
            disabled={!valid || index === null || index === 0}
            onClick={() => save(index! - 1)}
          >
            บันทึก · ก่อนหน้า
          </button>
          <button
            type="button"
            data-primary="true"
            disabled={!valid}
            onClick={() => save(null)}
          >
            บันทึก
          </button>
          <button
            type="button"
            disabled={!valid || index === null || index >= route.length - 1}
            onClick={() => save(index! + 1)}
          >
            บันทึก · ถัดไป
          </button>
        </Footer>
      }
    >
      <Fields>
        <NumberControl
          label="ระยะเพิ่ม X"
          unit="ซม."
          description="+ เดินหน้า / − ถอยหลัง"
          value={robotOffset.x * 100}
          step={1}
          min={-50}
          max={50}
          onChange={(value) => change("distance_offset_y_m", value / 100)}
        />
        <NumberControl
          label="ระยะเพิ่ม Y"
          unit="ซม."
          description="+ ซ้าย / − ขวา"
          value={robotOffset.y * 100}
          step={1}
          min={-50}
          max={50}
          onChange={(value) => change("distance_offset_x_m", -value / 100)}
        />
        <NumberControl
          label="ความเร็ว"
          unit="m/s"
          value={draft.speed_mps}
          step={0.05}
          min={0.01}
          max={9999}
          onChange={(value) => change("speed_mps", value)}
        />
        <NumberControl
          label="คลาดเคลื่อนที่ยอมรับได้"
          unit="ซม."
          value={draft.position_tolerance_m * 100}
          step={0.5}
          min={0.1}
          max={40}
          description="สูงสุด 40 ซม."
          onChange={(value) => change("position_tolerance_m", value / 100)}
        />
        <NumberControl
          label="องศาหันหน้า"
          unit="°"
          value={draft.heading_deg ?? ROBOT_INITIAL_HEADING_DEG}
          step={15}
          min={-180}
          max={360}
          onChange={(value) => change("heading_deg", value)}
        />
      </Fields>
      <Note>ขณะวิ่ง: หัวคงที่ 0° · ค่าคลาดเคลื่อนรายจุดใช้ตรวจการถึงเป้า</Note>
      {contract?.protocol === "stm32_original_gvps" &&
        (draft.position_tolerance_m < (contract.goal_stop_policy?.GOAL_POSITION_TOLERANCE_M ?? .02) ||
         draft.heading_tolerance_deg * Math.PI / 180 < (policy?.yaw_tolerance_rad ?? .02)) &&
        <Note role="alert">ค่าที่ตั้งละเอียดกว่า deadband ในโค้ดบอร์ด หุ่นอาจหยุดก่อนผ่านเกณฑ์นี้และจบด้วย timeout · ไม่มีการลดความละเอียดที่กรอกให้อัตโนมัติ</Note>}
      <DeveloperButton
        type="button"
        aria-expanded={developerOpen}
        aria-controls="waypoint-developer-settings"
        onClick={() => setDeveloperOpen((open) => !open)}
      >
        สำหรับนักพัฒนา
        <Chevron $open={developerOpen} aria-hidden="true" />
      </DeveloperButton>
      {developerOpen && (
        <DeveloperPanel
          id="waypoint-developer-settings"
          aria-label="การตั้งค่าสำหรับนักพัฒนา"
        >
          <Fields>
            <Field>
              <label>
                <input
                  type="checkbox"
                  aria-label="หยุดจบที่ช่องนี้"
                  checked={draft.stop_here ?? false}
                  onChange={(event) =>
                    change("stop_here", event.target.checked)
                  }
                />{" "}
                หยุดจบที่ช่องนี้
              </label>
            </Field>
            <NumberControl
              label="ความเร็วหมุน"
              unit="rad/s"
              value={draft.angular_speed_radps ?? 1}
              step={0.1}
              min={0.01}
              max={5}
              onChange={(value) => change("angular_speed_radps", value)}
            />
            <NumberControl
              label="คลาดเคลื่อนมุม"
              unit="°"
              value={draft.heading_tolerance_deg}
              step={1}
              min={0.1}
              max={30}
              onChange={(value) => change("heading_tolerance_deg", value)}
            />
          </Fields>
          <Note>
            องศารายช่องบันทึกในแผน ยังไม่ใช้สั่งหมุน ·
            ค่าคลาดเคลื่อนรายจุดใช้ตรวจการถึงเป้า แต่ไม่เปลี่ยน deadband ของบอร์ด
          </Note>
          <Note>
            {policy
              ? `ค่าเฟิร์มแวร์ STM32: คลาดเคลื่อนตำแหน่ง ${(
                  (contract?.goal_stop_policy?.GOAL_POSITION_TOLERANCE_M ?? policy.position_tolerance_m ?? .02) * 100
                ).toFixed(1)} ซม. · มุม ${(
                  (policy.yaw_tolerance_rad * 180) /
                  Math.PI
                ).toFixed(2)}°`
              : "ยังไม่มีข้อมูลค่าควบคุมจากเฟิร์มแวร์ STM32"}
          </Note>
        </DeveloperPanel>
      )}
      {!valid && (
        <Error role="alert">กรอกค่าภายในช่วงที่กำหนดให้ครบก่อนบันทึก</Error>
      )}
    </SettingsModal>
  );
}

const DeveloperButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 22px;
  padding: 16px 0 0;
  border: 0;
  border-top: 1px solid #e7ebf2;
  color: #687891;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  &:hover {
    color: #1e3271;
  }
  &:focus-visible {
    outline: 2px solid #516ba6;
    outline-offset: 4px;
    border-radius: 4px;
  }
`;
const Chevron = styled.span<{ $open: boolean }>`
  width: 7px;
  height: 7px;
  margin-right: 4px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(${({ $open }) => ($open ? "225deg" : "45deg")});
  transition: transform 0.15s;
`;
const DeveloperPanel = styled.section`
  margin-top: 16px;
  padding: 18px;
  border: 1px solid #e2e8f1;
  border-radius: 12px;
  background: #f8fafd;
  label {
    font-size: 12px;
  }
  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    vertical-align: middle;
    margin-right: 6px;
    accent-color: #1e3271;
  }
`;
