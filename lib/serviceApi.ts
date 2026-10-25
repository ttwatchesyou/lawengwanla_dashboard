const API_BASE = `${process.env.NEXT_PUBLIC_ROBOT_API ?? ""}/api`;

export async function serviceRequest(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options, cache: "no-store", signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "สั่ง Service ไม่สำเร็จ");
    return data;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Service ตอบช้าเกิน 10 วินาที กรุณาตรวจสถานะแล้วลองใหม่");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
