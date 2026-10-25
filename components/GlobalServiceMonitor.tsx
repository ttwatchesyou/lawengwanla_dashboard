"use client";
import React, { useEffect, useRef } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useServiceStatus } from "../utils/useServiceStatus";

export default function GlobalServiceMonitor() {
  const { ready, services, error } = useServiceStatus();
  const previous = useRef<boolean | null>(null);
  const previousError = useRef("");
  useEffect(() => {
    if (error && error !== previousError.current) toast.error("❌ ขาดการเชื่อมต่อกับ Backend API!");
    if (!error && previous.current !== null && previous.current !== ready) {
      if (ready) toast.success("✅ ระบบพร้อมทำงาน: Services ทั้งหมด Active", { duration: 4000 });
      else if (ready === false) {
        const down = services.filter(s => s.status !== "active" && s.auto_restart !== false).map(s => s.name).join(", ");
        toast.error(`⚠️ ตรวจพบปัญหา! กำลัง Auto-Restart: ${down}`, { duration: 6000 });
      }
    }
    previous.current = ready; previousError.current = error;
  }, [ready, services, error]);
  return <Toaster position="top-right" />;
}
