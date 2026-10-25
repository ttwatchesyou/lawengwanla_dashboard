// components/Layout/index.tsx

import React, { ReactNode, useEffect } from "react";
import styled, { css } from "styled-components";
import { Layout as AntLayout } from "antd";
import { useRouter } from "next/router";

import StyledHeader from "../Header";
import Footer from "../Footer";
import ScrollToTop from "../../utils/ScrollToTop";

const { Content } = AntLayout;

interface AppLayoutProps {
  children: ReactNode;
  hideNavbar?: boolean;
  hideFooter?: boolean;
  showMainFooter?: boolean;
  isFullscreen?: boolean;
}

const Layout = ({
  children,
  hideNavbar = false,
  hideFooter = false,
  showMainFooter = false,
  isFullscreen = false,
}: AppLayoutProps) => {
  const planner = useRouter().pathname === "/MazePlanner";
  const tuner = ["/RobotTuner", "/WheelTuner", "/SensorCheck"].includes(
    useRouter().pathname
  );
  useEffect(() => {
    document.body.classList.toggle("tuner-page", tuner);
    return () => document.body.classList.remove("tuner-page");
  }, [tuner]);
  useEffect(() => {
    document.body.classList.toggle("planner-page", planner);
    document.documentElement.classList.toggle("planner-page", planner);
    return () => {
      document.body.classList.remove("planner-page");
      document.documentElement.classList.remove("planner-page");
    };
  }, [planner]);
  return (
    <>
      <ScrollToTop />
      <StyledLayout $tuner={tuner}>
        {!hideNavbar && !isFullscreen && <StyledHeader />}

        <StyledContent
          $planner={planner}
          $tuner={tuner}
          isFullscreen={isFullscreen}
        >
          {children}
        </StyledContent>

        {!hideFooter && !showMainFooter && !isFullscreen && <Footer />}
        {showMainFooter && !isFullscreen && <Footer />}
      </StyledLayout>
    </>
  );
};

export default Layout;

const StyledLayout = styled(AntLayout)<{ $tuner: boolean }>`
  min-height: 100dvh;
  background: ${({ $tuner }) => ($tuner ? "#fffbde" : "#ffffff")};
`;

const StyledContent = styled(Content)<{
  isFullscreen?: boolean;
  $tuner: boolean;
  $planner: boolean;
}>`
  width: 100%;
  height: ${({ isFullscreen }) => (isFullscreen ? "100%" : "auto")};
  background-color: ${({ $tuner }) => ($tuner ? "#fffbde" : "#ffffff")};
  overflow-y: ${({ $planner }) => ($planner ? "visible" : "auto")};
  margin-top: -80px;

  ::-webkit-scrollbar {
    display: none;
  }
`;
