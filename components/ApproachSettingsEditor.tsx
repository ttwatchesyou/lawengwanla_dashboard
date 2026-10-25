import { useEffect, useState } from "react";
import {
  ExecutionSettings,
  DEFAULT_EXECUTION_SETTINGS,
  APPROACH_DEFAULT_SPEED_MPS,
  APPROACH_DEFAULT_TOLERANCE_M,
  validExecutionSettings,
} from "../utils/mainprogramSettings";
import { mapOffsetToRobot } from "../utils/offsetFrames";
import {
  Error,
  Fields,
  Footer,
  ModalTitle,
  Note,
  NumberControl,
  SettingsModal,
} from "./MotionSettingsUi";

export default function ApproachSettingsEditor({
  open,
  settings,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  settings: ExecutionSettings;
  busy: boolean;
  onClose: () => void;
  onSave: (settings: ExecutionSettings) => void;
}) {
  const [draft, setDraft] = useState({ ...DEFAULT_EXECUTION_SETTINGS, ...settings });
  useEffect(() => {
    if (open) setDraft({ ...DEFAULT_EXECUTION_SETTINGS, ...settings });
  }, [open, settings]);
  const robotOffset = mapOffsetToRobot(
    draft.approach_offset_x_m ?? 0,
    draft.approach_offset_y_m ?? 0
  );
  const valid = validExecutionSettings(draft);
  return (
    <SettingsModal
      open={open}
      title={
        <ModalTitle>
          <div>
            <h2>ระยะก่อนเข้าสนาม</h2>
            <p>START</p>
          </div>
        </ModalTitle>
      }
      onCancel={onClose}
      width={540}
      centered
      zIndex={9700}
      destroyOnClose
      footer={
        <Footer>
          <button type="button" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            data-primary="true"
            disabled={busy || !valid}
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            บันทึก
          </button>
        </Footer>
      }
    >
      <Fields>
        <NumberControl
          label="ระยะเพิ่ม X"
          unit="ซม."
          description="+ เดินหน้า / − ถอยหลัง"
          disabled={busy}
          min={-50}
          max={50}
          step={1}
          value={robotOffset.x * 100}
          onChange={(value) =>
            setDraft({ ...draft, approach_offset_y_m: value / 100 })
          }
        />
        <NumberControl
          label="ระยะเพิ่ม Y"
          unit="ซม."
          description="+ ซ้าย / − ขวา"
          disabled={busy}
          min={-50}
          max={50}
          step={1}
          value={robotOffset.y * 100}
          onChange={(value) =>
            setDraft({ ...draft, approach_offset_x_m: -value / 100 })
          }
        />
      </Fields>
      <Fields>
        <NumberControl label="ความเร็วช่วง START" unit="m/s" disabled={busy}
          min={0.01} max={9999} step={0.05}
          value={draft.approach_speed_mps ?? APPROACH_DEFAULT_SPEED_MPS}
          onChange={value => setDraft({ ...draft, approach_speed_mps: value })} />
        <NumberControl label="Tolerance ช่วง START" unit="ซม." disabled={busy}
          min={0.1} max={40} step={0.5}
          value={(draft.approach_tolerance_m ?? APPROACH_DEFAULT_TOLERANCE_M) * 100}
          onChange={value => setDraft({ ...draft, approach_tolerance_m: value / 100 })} />
      </Fields>
      <Note>ระยะเริ่มต้น 2.00 ม. · สปีดและ tolerance นี้ใช้ทั้งทดสอบ START และช่วงแรกของ Maze</Note>
      <Note>Tolerance เป็นเกณฑ์ตรวจการถึงเป้าฝั่งเว็บ ไม่เปลี่ยน deadband ของบอร์ด ค่าที่ละเอียดกว่าอาจรอจน timeout</Note>
      <Note>เมื่อเริ่มนอกสนาม ระยะเพิ่ม X/Y ที่ START จะเลื่อนเป้าหมายทุกจุดทั้งแผนด้วย โดยคงระยะระหว่างช่องเดิม และไม่หักค่าที่เพิ่มกลับตอนเข้าสนาม</Note>
      {!valid && <Error role="alert">กรอกระยะตั้งแต่ −50 ถึง 50 ซม.</Error>}
    </SettingsModal>
  );
}
