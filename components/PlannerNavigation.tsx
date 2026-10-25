import { useState } from "react";
import styled from "styled-components";
import { OPEN_MISSION_CHECK_EVENT } from "../utils/plannerEvents";

export function scrollToPlannerSection(id: string) {
  const target = document.getElementById(id);
  if (id === "mission-review" && target?.tagName !== "SECTION") {
    window.dispatchEvent(new Event(OPEN_MISSION_CHECK_EVENT));
    return;
  }
  target?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
}

const sections = [
  { id: "maze-map", label: "สนาม" },
  { id: "rack-pick-controls", label: "ตู้หยิบ" },
  { id: "rack-place-controls", label: "ตู้วาง" },
  { id: "mission-review", label: "ตรวจ / เริ่ม" },
  { id: "mission-retry", label: "Retry" },
];

export default function PlannerNavigation() {
  const [selected, setSelected] = useState("maze-map");
  return (
    <Dock id="planner-navigation" aria-label="ไปยังส่วนของแผนภารกิจ">
      {sections.map((section) => (
        <NavButton
          type="button"
          key={section.id}
          $active={selected === section.id}
          onClick={() => {
            setSelected(section.id);
            scrollToPlannerSection(section.id);
          }}
          aria-label={`ไป${section.label}`}
        >
          {section.label}
        </NavButton>
      ))}
    </Dock>
  );
}

const Dock = styled.nav`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  padding: 5px;
  margin: 0 0 24px;
  background: #172750f5;
  border: 1px solid #63749d;
  border-radius: 12px;
`;
const NavButton = styled.button<{ $active: boolean }>`
  min-width: 0;
  min-height: 42px;
  padding: 6px;
  border: 0;
  border-radius: 8px;
  background: ${({ $active }) => ($active ? "#ffdc7c" : "transparent")};
  color: ${({ $active }) => ($active ? "#1e3271" : "#e7edff")};
  box-shadow: ${({ $active }) => ($active ? "0 1px 4px #1e327110" : "none")};
  font-size: 12px !important;
  font-weight: 500;
  @media (max-width: 480px) {
    font-size: 10px !important;
    padding: 4px 2px;
  }
`;
