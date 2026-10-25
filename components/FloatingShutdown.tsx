"use client";

import React from "react";
import styled from "styled-components";

const API_BASE_URL = `${process.env.NEXT_PUBLIC_ROBOT_API}/api`;

export default function FloatingShutdown() {
  const handleShutdown = async () => {
    if (window.confirm("🚨 อันตราย: คุณแน่ใจหรือไม่ที่จะสั่ง 'ปิดเครื่อง (Shutdown)' หุ่นยนต์?")) {
      try {
        await fetch(`${API_BASE_URL}/cmd/shutdown`, { method: "POST" });
        alert("🔌 กำลังสั่งปิดเครื่อง... การเชื่อมต่อจะถูกตัดในไม่ช้า");
      } catch (e) {
        console.error("Shutdown error:", e);
      }
    }
  };

  return (
    <FloatingBtn onClick={handleShutdown} title="Shutdown Robot">
      ⏻
    </FloatingBtn>
  );
}

const FloatingBtn = styled.button`
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #fee2e2;
  color: #b91c1c;
  font-size: 24px;
  border: 3px solid #fca5a5;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999; /* ให้ลอยอยู่บนสุดเสมอ */
  transition: all 0.2s ease;

  &:hover {
    background-color: #fca5a5;
    color: #7f1d1d;
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: scale(0.95);
  }
`;