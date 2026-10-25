import { useEffect, useState } from "react";
import { Modal } from "antd";
import styled from "styled-components";
import { MAZE_PRESETS, MazePreset } from "../utils/mazePresets";

type Props = {
  open: boolean;
  selectedId?: string;
  hasRoute: boolean;
  onClose: () => void;
  onSelect: (preset: MazePreset) => void;
};

export default function MazePresetSelector({
  open,
  selectedId,
  hasRoute,
  onClose,
  onSelect,
}: Props) {
  const [pendingId, setPendingId] = useState<string | undefined>(selectedId);
  useEffect(() => {
    if (open) setPendingId(selectedId);
  }, [open, selectedId]);
  const pending = MAZE_PRESETS.find((preset) => preset.id === pendingId);
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={680}
      zIndex={9500}
      title="เลือกพรีเซ็ตสนาม 6 แบบ"
      centered
      destroyOnClose
    >
      <Intro>เรียงตามภาพ: ซ้ายไปขวา แถวบนแล้วแถวล่าง · เส้นเขียว 37 ช่อง</Intro>
      <Choices role="group" aria-label="พรีเซ็ตสนาม">
        {MAZE_PRESETS.map((preset, index) => (
          <Choice
            type="button"
            key={preset.id}
            $selected={preset.id === pendingId}
            aria-pressed={preset.id === pendingId}
            aria-label={`${preset.name} ${preset.imagePosition}`}
            onClick={() => setPendingId(preset.id)}
          >
            <svg viewBox="0 0 800 800" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <g key={i} stroke="#41577e" strokeWidth="3">
                  <line x1={i * 100} y1="0" x2={i * 100} y2="800" />
                  <line x1="0" y1={i * 100} x2="800" y2={i * 100} />
                </g>
              ))}
              <polyline
                points={preset.route
                  .map(
                    (cell) =>
                      `${cell.col * 100 + 50},${(7 - cell.row) * 100 + 50}`
                  )
                  .join(" ")}
                fill="none"
                stroke="#61e994"
                strokeWidth="16"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="50" cy="50" r="25" fill="#ffdc7c" />
              <circle cx="750" cy="750" r="25" fill="#ffdc7c" />
            </svg>
            <b>
              {String(index + 1).padStart(2, "0")} · {preset.name}
            </b>
            <small>{preset.imagePosition} · A8 → H1</small>
          </Choice>
        ))}
      </Choices>
      <Notice>
        START อยู่นอกสนามซ้าย A6 แล้วเข้าช่อง A8 · FINISH อยู่นอกขอบขวา H1
      </Notice>
      {pending?.waypointSettings && <Notice>แบบนี้คัดลอกค่าตามชื่อช่องที่ตั้งไว้ {Object.keys(pending.waypointSettings).length} ช่อง ช่องที่เหลือใช้ค่าเริ่มต้น · การกดใช้จะโหลดค่าชุดนี้ด้วย</Notice>}
      {hasRoute && (
        <Notice>
          การใช้พรีเซ็ตจะแทนที่เส้นทางปัจจุบัน โดยเก็บชุดหยิบ–วางเดิมไว้
        </Notice>
      )}
      <Apply
        type="button"
        disabled={!pending}
        onClick={() => {
          if (pending) onSelect(pending);
        }}
      >
        ใช้{pending?.name ?? "พรีเซ็ตที่เลือก"}
      </Apply>
    </Modal>
  );
}

const Intro = styled.p`
  font-size: 11px;
  color: #5d6882;
  margin: 8px 0 14px;
`;
const Choices = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  @media (max-width: 420px) {
    gap: 6px;
  }
`;
const Choice = styled.button<{ $selected: boolean }>`
  min-width: 0;
  border: 2px solid ${(p) => (p.$selected ? "#4e1f6e" : "#d7dfeb")};
  border-radius: 9px;
  background: ${(p) => (p.$selected ? "#f4eaf9" : "#f6f8fc")};
  padding: 8px;
  color: #1e3271;
  text-align: left;
  cursor: pointer;
  svg {
    display: block;
    width: 100%;
    max-height: 145px;
    background: #182d54;
    border-radius: 5px;
  }
  b {
    display: block;
    font-size: 12px;
    margin-top: 7px;
  }
  small {
    font-size: 9px;
    color: #64718b;
  }
  @media (max-width: 420px) {
    padding: 5px;
    b {
      font-size: 10px;
    }
    small {
      font-size: 8px;
    }
  }
  @media (max-height: 740px) {
    svg {
      max-height: 95px;
    }
  }
`;
const Notice = styled.p`
  font-size: 11px;
  color: #5d6882;
  line-height: 1.7;
  margin: 11px 0 0;
`;
const Apply = styled.button`
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 14px;
  border: 0;
  border-radius: 8px;
  background: #1e3271;
  color: #ffdc7c;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;
