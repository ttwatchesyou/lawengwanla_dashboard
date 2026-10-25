import { css } from "styled-components";

export const tunerSurface = css`
  min-width: 0;
  font-family: Prompt, Kanit, sans-serif;
  box-sizing: border-box;
  overflow-wrap: anywhere;
  .recharts-default-tooltip {
    background: #0d1117 !important;
    border: 1px solid #455987 !important;
    color: #ffdc7c !important;
    border-radius: 6px;
  }
  select {
    max-width: 100%;
    min-height: 38px;
    background: #0d1117;
    color: #ffdc7c;
    border: 1px solid #455987;
    border-radius: 6px;
    padding: 6px;
    font: inherit;
  }
  @media (max-width: 600px) {
    padding: 80px 10px 16px;
  }
`;
