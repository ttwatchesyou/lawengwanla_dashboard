import { selectPickupCell } from "../utils/pickupPreposition";
import { ReactNode, useState } from "react";
import styled from "styled-components";
import {
  CheckOutlined,
  DownloadOutlined,
  LockOutlined,
} from "@ant-design/icons";
import {
  emptyRackSelection,
  RACK_COLORS,
  RackCell,
  rackCellLabel,
  rackMission,
  RackSelection,
  sameRackCell,
} from "../utils/rackMission";

type Props = {
  locked?: boolean;
  preparation?: ReactNode;
  selection: RackSelection;
  onChange: (selection: RackSelection) => void;
  ready: boolean;
  storageError: boolean;
  onExport: () => void;
};
const cells = Array.from({ length: 9 }, (_, index) => ({
  row: 2 - Math.floor(index / 3),
  col: index % 3,
}));

export default function RackMissionControls({
  selection,
  locked = false,
  preparation,
  onChange,
  ready,
  storageError,
  onExport,
}: Props) {
  const [message, setMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const selectedColor = RACK_COLORS.find(
    (color) => color.id === selection.color
  );
  const configured = rackMission(selection).status === "configured";

  const pick = (cell: RackCell) => {
    if (locked) return;
    onChange(selectPickupCell(selection, cell));
    setMessage(`ชั้น ${cell.row + 1} · ${["ซ้าย", "กลาง", "ขวา"][cell.col]} · เลือกได้หนึ่งช่องต่อชั้น`);
  };

  return (
    <Section id="rack-controls" aria-labelledby="rack-title" aria-busy={!ready}>
      <Heading>
        <div>
          <h2 id="rack-title">วางแผนหยิบ–วางบล็อก</h2>
          <p>เลือกแผ่นรอง 1 แผ่น · ช่องหยิบชั้นละ 1 ช่อง · สี 1 สี</p>
        </div>
        <DraftBadge>
          {storageError
            ? "บันทึกไม่ได้"
            : ready
            ? "บันทึกอัตโนมัติ"
            : "กำลังโหลด…"}
        </DraftBadge>
      </Heading>

      <ColorBar id="rack-pick-controls">
        <div>
          <StepTag>01</StepTag>
          <div>
            <h3>เลือกสีบล็อก</h3>
            <p>ตู้วางจะล็อกคอลัมน์ให้ทันที</p>
          </div>
        </div>
        <ColorChoices role="radiogroup" aria-label="สีบล็อก">
          {RACK_COLORS.map((color) => (
            <ColorButton
              type="button"
              role="radio"
              aria-checked={selection.color === color.id}
              key={color.id}
              $color={color.hex}
              $selected={selection.color === color.id}
              disabled={!ready || locked}
              onClick={() => {
                onChange({ ...selection, color: color.id });
                setMessage(
                  `จดจำสี${color.label}แล้ว · ล็อกตู้วางคอลัมน์ ${color.column} อัตโนมัติ`
                );
              }}
            >
              <i />
              {color.label}
              {selection.color === color.id && <CheckOutlined />}
            </ColorButton>
          ))}
        </ColorChoices>
      </ColorBar>

      {preparation}
      <Cabinets>
        <CabinetCard id="rack-source-cabinet">
          <CabinetHeading>
            <div>
              <StepTag>02</StepTag>
              <div>
                <h3>ตู้ที่ 1 · จุดหยิบ</h3>
                <p>แถวบน = ชั้น 1 · แถวกลาง = ชั้น 2 · แถวล่าง = ชั้น 3</p>
              </div>
            </div>
            <Count>{selection.picks.length} / 3</Count>
          </CabinetHeading>
          <CabinetScene>
            <CabinetLabel>
              <span>ช่องว่างสำหรับเลือกหยิบ</span>
              <span>3 × 3</span>
            </CabinetLabel>
            <RackGrid role="group" aria-label="ตู้หยิบ 3 คูณ 3">
              {Array.from({ length: 9 }, (_, i) => ({ row: Math.floor(i / 3), col: i % 3 })).map((cell) => {
                const index = selection.picks.findIndex((item) =>
                  sameRackCell(item, cell)
                );
                return (
                  <PickSlot
                    type="button"
                    key={rackCellLabel(cell)}
                    $selected={index >= 0}
                    disabled={!ready || locked}
                    aria-label={`ช่องหยิบ ${rackCellLabel(cell)}`}
                    aria-pressed={index >= 0}
                    aria-disabled={!ready || locked}
                    onClick={() => pick(cell)}
                  >
                    <SlotAddress>{rackCellLabel(cell)}</SlotAddress>
                    {index >= 0 ? (
                      <PickNumber>{index + 1}</PickNumber>
                    ) : (
                      <SlotOutline>
                        <span>+</span>
                      </SlotOutline>
                    )}
                    <SlotCaption>
                      {index >= 0 ? `หยิบลำดับ ${index + 1}` : "เลือกหยิบ"}
                    </SlotCaption>
                  </PickSlot>
                );
              })}
            </RackGrid>
            <Plates role="radiogroup" aria-label="เลือกแผ่นเหล็กหนึ่งแผ่น">
              {[1, 2, 3].map((plate) => (
                <PlateButton
                  type="button"
                  role="radio"
                  aria-checked={selection.plate === plate}
                  aria-label={`แผ่นเหล็ก ${plate}`}
                  key={plate}
                  $selected={selection.plate === plate}
                  disabled={!ready || locked}
                  onClick={() => {
                    onChange({ ...selection, plate });
                    setMessage(
                      `เลือกแผ่นเหล็ก ${plate} แล้ว (เลือกได้ครั้งละ 1 แผ่น)`
                    );
                  }}
                >
                  <PlateSurface>
                    {selection.plate === plate ? <CheckOutlined /> : <span />}
                  </PlateSurface>
                  <b>แผ่น {plate}</b>
                </PlateButton>
              ))}
            </Plates>
            <FloorLine />
            <CabinetHint>
              แผ่นรองยื่นด้านหน้า · เลือกได้ 1 จาก 3 แผ่น
            </CabinetHint>
          </CabinetScene>
        </CabinetCard>

        <CabinetCard id="rack-place-controls">
          <CabinetHeading>
            <div>
              <StepTag>03</StepTag>
              <div>
                <h3>ตู้ที่ 2 · จุดวาง</h3>
                <p>สีเรียงแนวตั้ง น้ำเงิน → เขียว → แดง</p>
              </div>
            </div>
            <LockBadge>
              <LockOutlined /> อัตโนมัติ
            </LockBadge>
          </CabinetHeading>
          <CabinetScene>
            <ColumnColors>
              {RACK_COLORS.map((color) => (
                <span key={color.id} style={{ color: color.hex }}>
                  {color.label}
                  {selection.color === color.id && <LockOutlined />}
                </span>
              ))}
            </ColumnColors>
            <RackGrid role="group" aria-label="ตู้วาง 3 คูณ 3 ล็อกตามสี">
              {cells.map((cell) => {
                const color = RACK_COLORS[cell.col];
                const active = selection.color === color.id;
                const assigned = active && cell.row < selection.picks.length;
                return (
                  <TargetSlot
                    key={rackCellLabel(cell)}
                    $color={color.hex}
                    $active={active}
                    $assigned={assigned}
                    role="img"
                    aria-label={`จุดวางสี${color.label} ชั้น ${cell.row + 1}${
                      active ? " ล็อกแล้ว" : ""
                    }${assigned ? ` วางลำดับ ${cell.row + 1}` : ""}`}
                  >
                    <SlotAddress>ชั้น {cell.row + 1}</SlotAddress>
                    <Block $color={color.hex} $active={active}>
                      {assigned ? cell.row + 1 : <LockOutlined />}
                    </Block>
                    <SlotCaption>
                      {assigned
                        ? `รับจาก ${rackCellLabel(selection.picks[cell.row])}`
                        : active
                        ? "ช่องวางอัตโนมัติ"
                        : color.label}
                    </SlotCaption>
                  </TargetSlot>
                );
              })}
            </RackGrid>
            <TargetBase />
            <FloorLine />
            <CabinetHint>
              {selectedColor
                ? `ล็อกคอลัมน์ ${selectedColor.column} · สี${selectedColor.label} · วางจากล่างขึ้นบน`
                : "เลือกสีด้านบนเพื่อกำหนดคอลัมน์วาง"}
            </CabinetHint>
          </CabinetScene>
        </CabinetCard>
      </Cabinets>

      <SummaryBar>
        <div>
          <SummaryTitle>ชุดหยิบ–วางที่เลือก</SummaryTitle>
          <SummaryItems>
            <span>
              แผ่นรอง <b>{selection.plate ?? "—"}</b>
            </span>
            <span>
              ช่องหยิบ{" "}
              <b>
                {selection.picks.map(rackCellLabel).join(" → ") ||
                  "ยังไม่เลือก"}
              </b>
            </span>
            <span>
              สี <b>{selectedColor?.label ?? "ยังไม่เลือก"}</b>
            </span>
            <span>
              ปลายทาง{" "}
              <b>
                {selectedColor
                  ? `คอลัมน์ ${selectedColor.column}`
                  : "รอเลือกสี"}
              </b>
            </span>
          </SummaryItems>
        </div>
        <SummaryActions>
          <DownloadButton
            type="button"
            disabled={!configured || !ready}
            onClick={onExport}
          >
            <DownloadOutlined /> ดาวน์โหลดแผน
          </DownloadButton>
          <ResetButton
            type="button"
            disabled={!ready || locked}
            onClick={() => setConfirmReset(!confirmReset)}
          >
            ล้างชุดนี้
          </ResetButton>
        </SummaryActions>
      </SummaryBar>
      {confirmReset && (
        <ResetPrompt>
          <span>ล้างเฉพาะแผ่นรอง ช่องหยิบ และสีที่เลือก?</span>
          <button
            type="button"
            disabled={!ready || locked}
            onClick={() => {
              onChange(emptyRackSelection());
              setConfirmReset(false);
              setMessage("ล้างชุดหยิบ–วางแล้ว เส้นทางบนสนามยังอยู่");
            }}
          >
            ยืนยันล้าง
          </button>
          <button type="button" onClick={() => setConfirmReset(false)}>
            ยกเลิก
          </button>
        </ResetPrompt>
      )}
      {message && (
        <Feedback role="status" aria-live="polite">
          {message}
        </Feedback>
      )}
    </Section>
  );
}

const Section = styled.section`
  scroll-margin-top: 100px;
  margin-top: 24px;
  padding: 24px;
  border: 1px solid #e2dcbf;
  border-radius: 16px;
  background: #fffef5;
  @media (max-width: 600px) {
    padding: 16px;
  }
`;
const Heading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
  h2 {
    color: #1e3271;
    font-size: 20px;
    margin: 3px 0 6px;
    font-weight: 600;
  }
  p {
    color: #677087;
    font-size: 12px;
  }
`;
const DraftBadge = styled.span`
  font-size: 10px;
  color: #4e1f6e;
  background: #f3eafa;
  border: 1px solid #ddcde7;
  padding: 7px 11px;
  border-radius: 20px;
`;
const ColorBar = styled.div`
  scroll-margin-top: 92px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  background: #fffef5;
  border: 1px solid #e2dcbf;
  padding: 14px 18px;
  border-radius: 12px;
  margin-bottom: 16px;
  > div:first-child {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  h3 {
    font-size: 13px;
    color: #1e3271;
    margin: 0;
  }
  p {
    font-size: 10px;
    color: #737d91;
    margin: 3px 0 0;
  }
`;
const StepTag = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  width: 29px;
  height: 29px;
  flex-shrink: 0;
  background: #ffdc7c;
  color: #1e3271;
  font-size: 11px;
  font-weight: 600;
`;
const ColorChoices = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;
const ColorButton = styled.button<{ $color: string; $selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  min-width: 104px;
  padding: 9px 13px;
  border: 2px solid ${(p) => (p.$selected ? p.$color : "#dce0eb")};
  border-radius: 8px;
  background: ${(p) => (p.$selected ? "#1e3271" : "#ffffff")};
  color: ${(p) => (p.$selected ? "white" : "#364365")};
  font-size: 12px !important;
  box-shadow: ${(p) => (p.$selected ? `0 0 0 3px ${p.$color}22` : "none")};
  i {
    width: 13px;
    height: 13px;
    border-radius: 4px;
    background: ${(p) => p.$color};
  }
  @media (max-width: 420px) {
    min-width: 89px;
    padding: 8px;
  }
`;
const Cabinets = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
  @media (max-width: 740px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }
`;
const CabinetCard = styled.div`
  scroll-margin-top: 92px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #1e3271;
  border: 1px solid #34477d;
  border-radius: 15px;
  color: #e7edff;
  overflow: hidden;
  box-shadow: 0 5px 16px #1e327110;
`;
const CabinetHeading = styled.div`
  padding: 14px 16px;
  border-bottom: 1px solid #415386;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  > div {
    display: flex;
    gap: 9px;
    align-items: center;
    min-width: 0;
  }
  h3 {
    font-size: 14px;
    color: #ffdc7c;
    margin: 0;
  }
  p {
    font-size: 9px;
    color: #bdcbea;
    margin: 4px 0 0;
    line-height: 1.6;
  }
`;
const Count = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: #ffdc7c;
  padding: 4px 8px;
  border: 1px solid #5c6f9e;
  border-radius: 6px;
  white-space: nowrap;
`;
const LockBadge = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  padding: 5px 7px;
  border-radius: 6px;
  color: #98e8de;
  background: #234970;
  white-space: nowrap;
`;
const CabinetScene = styled.div`
  flex: 1;
  padding: 14px 22px 12px;
  max-width: 440px;
  margin: auto;
  @media (max-width: 420px) {
    padding: 12px 16px;
  }
`;
const CabinetLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 26px;
  color: #bdcbea;
  font-size: 10px;
  padding-bottom: 7px;
`;
const RackGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 6px solid #53658c;
  border-bottom-width: 8px;
  border-radius: 5px;
  background: #526486;
  gap: 5px;
  box-shadow: 0 10px 18px #08152e55;
`;
const PickSlot = styled.button<{ $selected: boolean }>`
  position: relative;
  aspect-ratio: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  border: 0;
  border-bottom: 3px solid #7181a1;
  background: ${(p) => (p.$selected ? "#465177" : "#182b56")};
  box-shadow: inset 0 5px 9px #081a3655;
  color: #ffdc7c;
  &::after {
    content: "";
    position: absolute;
    inset: 2px;
    pointer-events: none;
    border: 2px solid ${(p) => (p.$selected ? "#ffdc7c" : "transparent")};
    border-radius: 3px;
  }
  &:hover {
    background: #344772;
  }
`;
const SlotAddress = styled.span`
  position: absolute;
  top: 6px;
  left: 7px;
  font-size: 9px;
  color: #bac8e8;
`;
const SlotOutline = styled.span`
  width: 35%;
  height: 35%;
  border: 1px dashed #6b7b9d;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7185ad;
  font-size: 19px;
`;
const PickNumber = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #ffdc7c;
  color: #1e3271;
  font-size: 17px;
  font-weight: 600;
`;
const SlotCaption = styled.span`
  position: absolute;
  bottom: 6px;
  left: 2px;
  right: 2px;
  text-align: center;
  font-size: 8px;
  color: #d1dcf7;
`;
const Plates = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 11px;
  margin: 0 11px;
  padding-bottom: 3px;
`;
const PlateButton = styled.button<{ $selected: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  flex-direction: column;
  min-width: 0;
  min-height: 64px;
  padding: 0 2px 6px;
  border: 0;
  border-radius: 0 0 6px 6px;
  background: ${(p) => (p.$selected ? "#ffffff0c" : "transparent")};
  color: ${(p) => (p.$selected ? "#ffdc7c" : "#c7d1e9")};
  b {
    font-size: 10px;
    margin-top: 9px;
    font-weight: 500;
  }
  > div {
    border-color: ${(p) => (p.$selected ? "#ffdc7c" : "#9ca8bc")};
    box-shadow: ${(p) =>
      p.$selected
        ? "0 5px 0 #c7a144,0 7px 10px #0004"
        : "0 5px 0 #65728c,0 7px 10px #0004"};
  }
`;
const PlateSurface = styled.div`
  width: 100%;
  height: 26px;
  border: 2px solid #9ca8bc;
  border-top: 0;
  border-radius: 0 0 5px 5px;
  background: linear-gradient(160deg, #d5dce6, #9cabc0 45%, #b9c5d6);
  transform: perspective(80px) rotateX(24deg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1e3271;
  font-size: 15px;
`;
const FloorLine = styled.div`
  height: 2px;
  width: 100%;
  background: #54668b;
  margin-top: 3px;
`;
const CabinetHint = styled.p`
  font-size: 9px;
  text-align: center;
  color: #b7c7e6;
  margin: 9px 0 0;
  line-height: 1.7;
`;
const ColumnColors = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding-bottom: 7px;
  min-height: 26px;
  span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
  }
`;
const TargetSlot = styled.div<{
  $color: string;
  $active: boolean;
  $assigned: boolean;
}>`
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  border-bottom: 3px solid #7181a1;
  background: ${(p) => (p.$active ? `${p.$color}33` : "#182b56")};
  box-shadow: inset 0 5px 9px #081a3655;
  &::after {
    content: "";
    position: absolute;
    inset: 2px;
    border: 2px ${(p) => (p.$assigned ? "solid" : "dashed")}
      ${(p) => (p.$active ? p.$color : "transparent")};
    border-radius: 3px;
  }
`;
const Block = styled.span<{ $color: string; $active: boolean }>`
  position: relative;
  width: 40%;
  height: 40%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(p) => p.$color};
  border: 2px solid #ffffff33;
  border-radius: 5px;
  box-shadow: 3px 4px 0 ${(p) => `${p.$color}88`};
  color: #101f47;
  font-size: 15px;
  font-weight: 600;
  opacity: ${(p) => (p.$active ? 1 : 0.35)};
`;
const TargetBase = styled.div`
  height: 59px;
  position: relative;
  &::before,
  &::after {
    content: "";
    position: absolute;
    top: 0;
    height: 8px;
    width: 9px;
    background: #7181a1;
  }
  &::before {
    left: 14px;
  }
  &::after {
    right: 14px;
  }
`;
const SummaryBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  background: #fffef5;
  border: 1px solid #e2dcbf;
  border-radius: 12px;
  padding: 15px 18px;
  margin-top: 16px;
`;
const SummaryTitle = styled.h3`
  font-size: 12px;
  color: #4e1f6e;
  margin: 0 0 8px;
`;
const SummaryItems = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  font-size: 10px;
  color: #737d91;
  span {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  b {
    color: #1e3271;
    font-weight: 600;
  }
`;
const SummaryActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;
const DownloadButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  padding: 9px 15px;
  background: #1e3271;
  color: #ffdc7c;
  border: 0;
  border-radius: 8px;
  font-size: 11px !important;
`;
const ResetButton = styled.button`
  min-height: 44px;
  padding: 9px 12px;
  background: transparent;
  border: 1px solid #dcd7c4;
  color: #6f637d;
  border-radius: 8px;
  font-size: 11px !important;
`;
const ResetPrompt = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
  padding: 12px;
  border-radius: 8px;
  background: #f3edf5;
  color: #4e1f6e;
  font-size: 12px;
  button {
    min-height: 42px;
    border: 1px solid #bcacc5;
    background: white;
    color: #4e1f6e;
    border-radius: 6px;
    padding: 7px 12px;
  }
`;
const Feedback = styled.p`
  font-size: 11px;
  color: #4e1f6e;
  min-height: 36px;
  padding: 10px 0 0;
  margin: 0;
`;
