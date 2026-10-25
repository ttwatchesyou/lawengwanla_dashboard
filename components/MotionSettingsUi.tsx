import { useId } from "react";
import styled from "styled-components";
import { Modal } from "antd";

export function NumberControl({
  label,
  unit,
  value,
  step,
  min,
  max,
  onChange,
  disabled = false,
  description,
}: {
  label: string;
  unit: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  description?: string;
}) {
  const id = useId();
  const valid = Number.isFinite(value) && value >= min && value <= max;
  const adjust = (delta: number) =>
    onChange(
      Math.max(
        min,
        Math.min(
          max,
          Number(((Number.isFinite(value) ? value : min) + delta).toFixed(4))
        )
      )
    );
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NumberRow $invalid={!valid}>
        <button
          type="button"
          disabled={disabled}
          aria-label={`ลด${label}`}
          onClick={() => adjust(-step)}
        >
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          aria-label={`${label} (${unit})`}
          aria-invalid={!valid}
          aria-describedby={!valid || description ? `${id}-hint` : undefined}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? Number(value.toFixed(4)) : ""}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? NaN : Number(event.target.value)
            )
          }
        />
        <span>{unit}</span>
        <button
          type="button"
          disabled={disabled}
          aria-label={`เพิ่ม${label}`}
          onClick={() => adjust(step)}
        >
          +
        </button>
      </NumberRow>
      {(!valid || description) && (
        <Hint id={`${id}-hint`} $invalid={!valid}>
          {!valid ? `กรอก ${min} ถึง ${max} ${unit}` : description}
        </Hint>
      )}
    </Field>
  );
}

export const SettingsModal = styled(Modal)`
  .ant-modal-content {
    padding: 0;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 24px 80px #10224130;
  }
  .ant-modal-header {
    margin: 0;
    padding: 24px 28px 20px;
    border-bottom: 1px solid #e7ebf2;
  }
  .ant-modal-close {
    top: 20px;
    right: 20px;
    width: 36px;
    height: 36px;
    border-radius: 10px;
  }
  .ant-modal-body {
    padding: 24px 28px;
    max-height: calc(100dvh - 240px);
    overflow-y: auto;
  }
  .ant-modal-footer {
    margin: 0;
    padding: 16px 28px;
    border-top: 1px solid #e7ebf2;
    background: #fafbfd;
  }
  @media (max-width: 480px) {
    .ant-modal-header {
      padding: 20px;
    }
    .ant-modal-body {
      padding: 20px;
    }
    .ant-modal-footer {
      padding: 14px 20px;
    }
  }
`;
export const ModalTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right: 34px;
  color: #1e3271;
  h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 600;
    line-height: 1.5;
  }
  p {
    margin: 3px 0 0;
    color: #758199;
    font-size: 12px;
    font-weight: 400;
  }
`;
export const CellBadge = styled.span`
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border: 1px solid #dbe3f4;
  border-radius: 14px;
  background: #eef2fb;
  color: #1e3271;
  font-size: 20px;
  font-weight: 600;
`;
export const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 16px;
  @media (max-width: 380px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;
export const Field = styled.div`
  min-width: 0;
  color: #263857;
`;
const FieldLabel = styled.label`
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
`;
const NumberRow = styled.div<{ $invalid: boolean }>`
  display: flex;
  align-items: center;
  height: 48px;
  border: 1px solid ${({ $invalid }) => ($invalid ? "#c65162" : "#dce2ed")};
  border-radius: 10px;
  background: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
  &:focus-within {
    border-color: #516ba6;
    box-shadow: 0 0 0 3px #516ba618;
  }
  input {
    width: 100%;
    min-width: 0;
    padding: 0 2px;
    border: 0;
    outline: 0;
    text-align: center;
    color: #1e3271;
    background: transparent;
    font-size: 18px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  input::-webkit-inner-spin-button,
  input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  span {
    flex-shrink: 0;
    color: #7b879e;
    font-size: 11px;
    padding-right: 8px;
  }
  button {
    flex: 0 0 34px;
    align-self: stretch;
    margin: 4px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    color: #52678d;
    background: #f2f5fa;
    cursor: pointer;
    font-size: 20px;
    touch-action: manipulation;
  }
  button:hover:not(:disabled) {
    background: #e4eaf6;
    color: #1e3271;
  }
  button:focus-visible {
    outline: 2px solid #516ba6;
    outline-offset: 1px;
  }
  button:disabled,
  input:disabled {
    opacity: 0.45;
    cursor: default;
  }
  @media (max-width: 480px) {
    button {
      flex-basis: 28px;
      margin: 3px;
    }
  }
`;
const Hint = styled.small<{ $invalid?: boolean }>`
  display: block;
  margin-top: 6px;
  color: ${({ $invalid }) => ($invalid ? "#b33f52" : "#7b8799")};
  font-size: 11px;
  line-height: 1.6;
`;
export const Note = styled.p`
  margin: 18px 0 0;
  color: #758199;
  font-size: 11px;
  line-height: 1.7;
`;
export const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  button {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 8px;
    border: 1px solid #dce2ed;
    border-radius: 10px;
    background: #fff;
    color: #52617f;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: background 0.15s;
  }
  button:hover:not(:disabled) {
    background: #edf1f8;
  }
  button[data-primary="true"] {
    background: #1e3271;
    border-color: #1e3271;
    color: #fff;
  }
  button[data-primary="true"]:hover:not(:disabled) {
    background: #2e478c;
  }
  button:focus-visible {
    outline: 2px solid #516ba6;
    outline-offset: 3px;
  }
  button:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;
export const Error = styled.p`
  margin: 16px 0 0;
  color: #b33f52;
  font-size: 12px;
`;
