import { useServiceStatus } from "../utils/useServiceStatus";
import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { Layout } from "antd";
import { Divide as HamburgerDivide } from "hamburger-react";
import { useRouter } from "next/router";
// import RestartAllButton from "./RestartAllButton";

const { Header } = Layout;
const API_BASE_URL = `${process.env.NEXT_PUBLIC_ROBOT_API}/api`;

interface ServiceData {
  name: string;
  status: string;
}

const HeaderComponent: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const { services } = useServiceStatus();
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => { setIsClient(true); }, []);

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsMenuOpen(false);
  };

  if (!isClient) return null;

  return (
    <StyledHeader>
      <WrapperHeader>
        <HeadLogo
          alt="logo"
          onClick={() => handleNavigation("/")}
          src="/logo/MechaLogo.png"
        />

        {/* <RestartAllButton services={services} onSuccess={fetchServices} /> */}

        {/* เมนูสำหรับหน้าจอคอม (Desktop) */}
        <DesktopMenuSection>
          <StyledButton onClick={() => handleNavigation("/Service")}>
            Service
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/WheelTuner")}>
            Wheel Tuner
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/RobotTuner")}>
            Tuner
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/MazePlanner")}>
            Maze Planner
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/SensorCheck")}>
            Sensors
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/RelayControl")}>Relays</StyledButton>
          {/*
          <StyledButton onClick={() => handleNavigation("/TelemetryPage")}>
            Telemetry
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/Control")}>
            Control
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/step")}>
            Step run
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/Mission")}>
            Mission
          </StyledButton> */}
        </DesktopMenuSection>

        {/* ปุ่ม Hamburger จะแสดงเฉพาะจอมือถือ/แท็บเล็ต/ไอแพด */}
        <MobileMenuIcon>
          <HamburgerDivide
            toggle={setIsMenuOpen}
            toggled={isMenuOpen}
            color="#ffdc7c"
          />
        </MobileMenuIcon>

        {/* เมนูสำหรับจอมือถือและไอแพด (Slide จากด้านขวา) */}
        <MobileMenu isMenuOpen={isMenuOpen}>
          <StyledButton onClick={() => handleNavigation("/Service")}>
            Service
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/WheelTuner")}>
            Wheel Tuner
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/RobotTuner")}>
            Tuner
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/MazePlanner")}>
            Maze Planner
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/SensorCheck")}>
            Sensors
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/RelayControl")}>Relays</StyledButton>
          {/*
          <StyledButton onClick={() => handleNavigation("/TelemetryPage")}>
            Telemetry
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/Control")}>
            Control
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/step")}>
            Step run
          </StyledButton>
          <StyledButton onClick={() => handleNavigation("/Mission")}>
            Mission
          </StyledButton> */}
        </MobileMenu>

        {/* Overlay คลิกพื้นที่ว่างเพื่อปิดเมนู */}
        {isMenuOpen && <Overlay onClick={() => setIsMenuOpen(false)} />}
      </WrapperHeader>
    </StyledHeader>
  );
};

export default HeaderComponent;

// ─── Styled Components ────────────────────────────────────────────────────────

const StyledHeader = styled(Header)`
  background-color: #4E1F6E;
  width: 100%;
  height: 80px;
  line-height: normal;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(5px);
  position: sticky;
  top: 0;
  z-index: 50;
`;

const WrapperHeader = styled.div`
  width: 100%;
  height: 100%;
  max-width: 1920px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const HeadLogo = styled.img`
  width: 100%;
  max-width: 120px;
  height: auto;
  max-height: 64px;
  object-fit: contain;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }

  @media (max-width: 1200px) {
    max-width: 100px;
  }
`;

const DesktopMenuSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  /* ขยับ Breakpoint เป็น 1200px เพื่อให้ครอบคลุม iPad Pro แนวนอน */
  @media (max-width: 1200px) {
    display: none;
  }
`;

const StyledButton = styled.button`
  display: inline-flex;
  justify-content: center;
  align-items: center;
  color: #ffdc7c;
  font-family: "Prompt", sans-serif;
  font-size: 16px;
  font-weight: 500;
  background: transparent;
  border: none;
  position: relative;
  cursor: pointer;
  padding: 10px 16px;
  transition: color 0.3s ease;

  &:hover {
    color: #a6e1d1;
  }

  &::after {
    content: "";
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 2px;
    background-color: #a6e1d1;
    transition: width 0.3s ease;
  }

  &:hover::after {
    width: 80%;
  }

  @media (max-width: 1200px) {
    font-size: 18px; /* ปรับขนาดฟอนต์ให้พอดี ไม่ใหญ่เกินไป */
    width: 100%;
    padding: 16px;

    &::after {
      display: none;
    }
    &:hover {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
    }
  }
`;

const MobileMenuIcon = styled.div`
  display: none;
  z-index: 100;

  @media (max-width: 1200px) {
    display: block;
  }
`;

const MobileMenu = styled.div<{ isMenuOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  width: 280px;
  height: 100vh;
  background: #152454;
  box-shadow: -4px 0 15px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  padding: 80px 16px 24px;
  gap: 8px;

  /* 🎯 เพิ่มคำสั่งนี้ เพื่อให้เมนูสามารถใช้นิ้วปัดเลื่อนขึ้นลงได้ */
  overflow-y: auto;

  visibility: ${({ isMenuOpen }) => isMenuOpen ? "visible" : "hidden"};
  opacity: ${({ isMenuOpen }) => isMenuOpen ? 1 : 0};
  pointer-events: ${({ isMenuOpen }) => isMenuOpen ? "auto" : "none"};
  transition: opacity 0.2s ease, visibility 0.2s ease;
  z-index: 90;

  @media (min-width: 1201px) {
    display: none;
  }
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 80;
`;
