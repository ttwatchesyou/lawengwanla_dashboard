import { Input } from "antd";
import { useEffect, useId, useRef, useState } from "react";
import styled from "styled-components";

export function NumericField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(
    Number.isFinite(value) ? String(value) : ""
  );
  const lastEmitted = useRef(value);
  useEffect(() => {
    if (!Object.is(value, lastEmitted.current)) {
      setDraft(Number.isFinite(value) ? String(value) : "");
      lastEmitted.current = value;
    }
  }, [value]);
  return (
    <FieldLabel htmlFor={id}>
      <span>{label}</span>
      <NumberInput
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        placeholder="กรอกค่า"
        aria-required="true"
        aria-invalid={draft !== "" && !Number.isFinite(value)}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const parsed = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(
            text.trim()
          )
            ? Number(text)
            : NaN;
          const next = Number.isFinite(parsed) ? parsed : NaN;
          lastEmitted.current = next;
          onChange(next);
        }}
      />
    </FieldLabel>
  );
}

export function assertCompleteNumbers(value: unknown): void {
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("กรุณากรอกช่องตัวเลขให้ครบและถูกต้องก่อนส่งค่า");
  if (value && typeof value === "object")
    Object.values(value).forEach(assertCompleteNumbers);
}

const FieldLabel = styled.label`
  display: grid;
  grid-template-columns: minmax(110px, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  color: #ffdc7c;
  font-size: 13px;
  min-width: 0;
  @media (max-width: 480px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 5px;
  }
`;
const NumberInput = styled(Input)`
  && {
    width: 100%;
    min-width: 0;
    min-height: 42px;
    background: #0d1117;
    color: #ffdc7c;
    border: 1px solid #455987;
    border-radius: 6px;
    font: inherit;
  }
  &&::placeholder {
    color: #a6b3d1;
  }
  &&:hover,
  &&:focus {
    border-color: #58a6ff;
  }
  &&[aria-invalid="true"] {
    border-color: #f85149;
  }
`;
