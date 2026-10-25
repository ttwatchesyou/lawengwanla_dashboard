"use client";
import { useServiceStatus, refreshServices } from "../../utils/useServiceStatus";


import Head from "next/dist/shared/lib/head";
import React, { useState, useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
// import RestartAllButton from "../../components/RestartAllButton";

import { serviceRequest } from "../../lib/serviceApi";

interface ServiceData {
  name: string;
  status: string;
  last_check: string;
  last_restart: string;
  auto_restart?: boolean;
}

type LoadingAction = "start" | "stop" | "restart" | "remove" | null;

const ServiceCard = ({
  name,
  status,
  last_check,
  last_restart,
  onControl,
  onRestart,
  onRemove,
  onViewLogs,
}: {
  name: string;
  status: string;
  last_check: string;
  last_restart: string;
  onControl: (name: string, action: string) => Promise<void>;
  onRestart: (name: string) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
  onViewLogs: (name: string) => void;
}) => {
  const [loading, setLoading] = useState<LoadingAction>(null);
  const [error, setError] = useState("");
  const isActive = status === "active";

  // 💡 เช็คว่านี่คือ Service ของหน้าเว็บตัวเองหรือไม่
  const isSelf = name === "lawengwanla_dashboard.service";

  const handle = async (action: LoadingAction, fn: () => Promise<void>) => {
    setLoading(action);
    setError("");
    try { await fn(); }
    catch (error) { setError(error instanceof Error ? error.message : "เชื่อมต่อ Service ไม่สำเร็จ"); }
    finally { setLoading(null); }
  };

  return (
    <Card $active={isActive}>
      <CardHeader>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ServiceName>{name}</ServiceName>
          <StatusBadge $active={isActive}>{status}</StatusBadge>
        </div>
        <RemoveBtn
          disabled={loading !== null}
          onClick={() => {
            if (
              window.confirm(
                `คุณแน่ใจหรือไม่ที่จะลบ ${name} ออกจากการ Monitor?`
              )
            ) {
              handle("remove", () => onRemove(name));
            }
          }}
          title="Remove Service"
        >
          ✕
        </RemoveBtn>
      </CardHeader>

      {name === "lawengwanla-mainprogram.service" && <div data-testid="mainprogram-no-autorestart">โปรแกรมวิ่งสนาม · ปิดแล้วคงปิด · ไม่ Auto-Restart</div>}
      <TimeInfo>
        <div>⏱ เช็คล่าสุด: {last_check || "-"}</div>
        {last_restart !== "-" && (
          <RestartAlert>🔄 Auto-Restart ล่าสุด: {last_restart}</RestartAlert>
        )}
      </TimeInfo>

      <ButtonGroup>
        <ActionBtn
          $color="#d1fae5" // สีเขียวพาสเทลสำหรับปุ่ม Start (รักษาสีเชิงสัญลักษณ์)
          $textColor="#065f46"
          disabled={loading !== null}
          onClick={() => handle("start", () => onControl(name, "start"))}
        >
          {loading === "start" ? <Spin $dark /> : "▶ START"}
        </ActionBtn>

        {/* 🔒 ล็อกปุ่ม STOP ถ้าเป็นหน้าเว็บตัวเอง */}
        <ActionBtn
          $color={isSelf ? "#f1f5f9" : "#fee2e2"} // เปลี่ยนเป็นสีเทาถ้าเป็นตัวเอง
          $textColor={isSelf ? "#94a3b8" : "#991b1b"}
          disabled={loading !== null || isSelf} // ปิดการกด (Disable)
          onClick={() => handle("stop", () => onControl(name, "stop"))}
          style={{ cursor: isSelf ? "not-allowed" : "pointer" }}
          title={isSelf ? "ไม่สามารถ Stop หน้าเว็บตัวเองได้" : ""}
        >
          {loading === "stop" ? <Spin $dark /> : (isSelf ? "🔒 STOP" : "⏹ STOP")}
        </ActionBtn>

        <RestartCardBtn
          disabled={loading !== null}
          onClick={() => handle("restart", () => onRestart(name))}
        >
          {loading === "restart" ? <Spin $dark /> : "↺ RESTART"}
        </RestartCardBtn>
        
        <LogBtn onClick={() => onViewLogs(name)}>📋 LOGS</LogBtn>
      </ButtonGroup>
      {error && <p role="alert">{error}</p>}
    </Card>
  );
};

export default function ServiceDashboard() {
  const [isClient, setIsClient] = useState(false);
  const { services, error: readError } = useServiceStatus();
  const [newSvc, setNewSvc] = useState("");
  const [logs, setLogs] = useState({ open: false, content: "", title: "" });
  const [error, setError] = useState("");
  const fetchServices = refreshServices;
  useEffect(() => { setError(readError); }, [readError]);

  const handleControl = async (name: string, action: string) => {
    await serviceRequest("/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: name, action }),
    });
    await fetchServices();
  };

  const handleRestart = async (name: string) => {
    await serviceRequest("/restart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: name }),
    });
    await new Promise((r) => setTimeout(r, 1500));
    await fetchServices();
  };

  const handleRemove = async (name: string) => {
    await serviceRequest("/remove_service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: name }),
    });
    await fetchServices();
  };

  const handleViewLogs = async (name: string) => {
    setLogs({ open: true, content: "Loading logs…", title: name });
    try {
      const data = await serviceRequest(`/logs/${encodeURIComponent(name)}`);
      setLogs({
        open: true,
        content: data.logs || "No logs found.",
        title: name,
      });
    } catch {
      setLogs({ open: true, content: "Error fetching logs.", title: name });
    }
  };

  const handleAddService = async () => {
    if (!newSvc.trim()) return;
    try {
    await serviceRequest("/add_service", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service: newSvc.trim() }),
    });
    setNewSvc("");
    fetchServices();
    } catch (error) { setError(error instanceof Error ? error.message : "เพิ่ม Service ไม่สำเร็จ"); }
  };

  useEffect(() => {
    setIsClient(true);

  }, []);

  if (!isClient) return null;

  return (
    <>
      <Head>
        <title>Mechatronics and Robotics</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="/logo/MechaLogo.png" rel="icon" />
      </Head>
      <MainSection>
        <MainBox>
          <Header>
            <Title>LAWENGWANLA SERVICE</Title>
            <Subtitle>เปิด–ปิดโปรแกรมหุ่น · Mainprogram ปิดแล้วไม่เริ่มใหม่อัตโนมัติ</Subtitle>
          </Header>

          <ControlRow>
            <InputGroup>
              <StyledInput
                value={newSvc}
                onChange={(e) => setNewSvc(e.target.value)}
                placeholder="service_name.service"
                onKeyDown={(e) => e.key === "Enter" && handleAddService()}
              />
              <AddButton onClick={handleAddService}>Add Service</AddButton>
              {/* <RestartAllButton services={services} onSuccess={fetchServices} /> */}
            </InputGroup>
          </ControlRow>

          {error && <p role="alert">{error}</p>}
          <ServiceGrid>
            {services.map((svc) => (
              <ServiceCard
                key={svc.name}
                name={svc.name}
                status={svc.status}
                last_check={svc.last_check}
                last_restart={svc.last_restart}
                onControl={handleControl}
                onRestart={handleRestart}
                onRemove={handleRemove}
                onViewLogs={handleViewLogs}
              />
            ))}
          </ServiceGrid>

          {logs.open && (
            <ModalOverlay onClick={() => setLogs({ ...logs, open: false })}>
              <ModalContent onClick={(e) => e.stopPropagation()}>
                <ModalHeader>
                  <ModalTitle># journalctl -u {logs.title}</ModalTitle>
                  <CloseBtn onClick={() => setLogs({ ...logs, open: false })}>
                    ✕ Close
                  </CloseBtn>
                </ModalHeader>
                <LogArea>{logs.content}</LogArea>
              </ModalContent>
            </ModalOverlay>
          )}
        </MainBox>
      </MainSection>
    </>
  );
}

// ─── STYLED COMPONENTS ───────────────────────────────────────────────────────
const spin = keyframes`from{transform:rotate(0deg)}to{transform:rotate(360deg)}`;

const Spin = styled.span<{ $dark?: boolean }>`
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid ${(p) => (p.$dark ? "#3E3E75" : "currentColor")};
  border-top-color: transparent;
  border-radius: 50%;
  animation: ${spin} 0.6s linear infinite;
`;

const MainSection = styled.div`
  margin-top: 80px;
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  padding: 10px;
  background-color: #fffbde; /* พื้นหลังสีขาวอมมินต์สว่างๆ */

  @media (min-width: 768px) {
    padding: 40px 24px;
  }
`;

const MainBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 1200px;
  padding: 24px 16px;
  background: #4E1F6E; /* กล่องหลักสีขาวสะอาด */
  border-radius: 20px;
  border: 2px solid #98E8DE; /* ขลิบเส้นกรอบสีมินต์ */
  box-shadow: 0 10px 30px rgba(62, 62, 117, 0.12); /* เงาสีกรมท่าจางๆ */

  @media (min-width: 768px) {
    padding: 40px;
    gap: 32px;
  }
`;

const Header = styled.div`
  text-align: center;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 1.8rem;
  font-weight: 900;
  color: #ffdc7c; /* ม่วงเข้ม */

  @media (min-width: 768px) {
    font-size: 2.8rem;
  }
`;

const Subtitle = styled.p`
  margin: 8px 0 0;
  font-family: monospace;
  font-size: 0.9rem;
  color: #ffdc7c; /* Teal */
`;

const ControlRow = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;

  @media (min-width: 768px) {
    flex-direction: row;
    max-width: 800px;
    margin: 0 auto;
    align-items: center;
  }
`;

const StyledInput = styled.input`
  width: 100%;
  padding: 14px;
  background: #ffffff;
  color: #3E3E75; /* กรมท่า */
  border: 2px solid #98E8DE; /* เส้นกรอบสีมินต์ */
  border-radius: 12px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    border-color: #45A9A9; /* สี Teal เวลาพิมพ์ */
    box-shadow: 0 0 0 3px rgba(69, 169, 169, 0.15);
  }

  &::placeholder {
    color: #cbd5e1;
  }

  @media (min-width: 768px) {
    flex: 1;
  }
`;

const AddButton = styled.button`
  width: 100%;
  padding: 14px 24px;
  background: #45A9A9; /* สี Teal */
  color: #ffffff;
  font-weight: bold;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;

  &:hover {
    background: #3E3E75; /* สีกรมท่าตอน Hover */
  }
  
  &:active {
    transform: scale(0.98);
  }

  @media (min-width: 768px) {
    width: auto;
    white-space: nowrap;
  }
`;

const ServiceGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
`;

const Card = styled.div<{ $active: boolean }>`
  padding: 18px;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #98E8DE; /* กรอบการ์ดสีมินต์ */
  border-left: 6px solid ${(p) => (p.$active ? "#45A9A9" : "#f87171")}; /* แถบสถานะใช้ Teal ถ้าทำงานอยู่ */
  box-shadow: 0 4px 12px rgba(62, 62, 117, 0.05);
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: border-color 0.3s;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
`;

const ServiceName = styled.h3`
  margin: 0;
  font-size: 1rem;
  color: #3E3E75; /* สีกรมท่า */
  word-break: break-all;
  line-height: 1.4;
`;

const StatusBadge = styled.span<{ $active: boolean }>`
  padding: 4px 8px;
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  color: ${(p) => (p.$active ? "#ffffff" : "#991b1b")};
  background: ${(p) =>
    p.$active ? "#45A9A9" : "#fee2e2"};
  border-radius: 4px;
  flex-shrink: 0;
`;

const RemoveBtn = styled.button`
  background: transparent;
  border: none;
  color: #fca5a5;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  padding: 0 4px;
  transition: transform 0.15s, color 0.15s;

  &:hover {
    color: #ef4444;
    transform: scale(1.2);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const TimeInfo = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  margin-bottom: 8px;
`;

const RestartAlert = styled.div`
  color: #f87171;
  margin-top: 4px;
`;

const ButtonGroup = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  width: 100%;

  @media (min-width: 480px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const ActionBtn = styled.button<{ $color: string; $textColor: string }>`
  width: 100%;
  padding: 12px 6px;
  background: ${(p) => p.$color};
  color: ${(p) => p.$textColor};
  font-size: 12px;
  font-weight: 800;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    filter: brightness(0.95);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const RestartCardBtn = styled.button`
  width: 100%;
  padding: 12px 6px;
  background: #fde68a; /* สีเหลืองพาสเทลเดิม เพราะในพาเลตไม่มีเหลือง */
  color: #92400e;
  font-size: 12px;
  font-weight: 800;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: #fcd34d;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const LogBtn = styled.button`
  width: 100%;
  padding: 12px 6px;
  background: #98E8DE; /* สีมินต์ */
  color: #3E3E75; /* สีกรมท่า */
  font-size: 12px;
  font-weight: 800;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #45A9A9; /* สี Teal */
    color: #ffffff;
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(62, 62, 117, 0.6); /* ฉากหลังสีกรมท่าโปร่งแสง */
  backdrop-filter: blur(5px);
`;

const ModalContent = styled.div`
  width: 90%;
  max-width: 850px;
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #3E3E75; /* แถบบนของ Modal สีกรมท่า */
`;

const ModalTitle = styled.div`
  font-family: monospace;
  font-size: 0.9rem;
  color: #98E8DE; /* ตัวอักษรสีมินต์ */
  font-weight: bold;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  color: #98E8DE; /* ปุ่มปิดสีมินต์ */
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  &:hover {
    color: #ffffff;
  }
`;

const LogArea = styled.pre`
  height: 400px;
  margin: 0;
  padding: 24px;
  overflow-y: auto;
  background: #4E1F6E; /* พื้นหลัง Terminal สีม่วงเข้ม */
  color: #98E8DE; /* สีอักษรสีมินต์ */
  font-family: "Consolas", monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
`;
