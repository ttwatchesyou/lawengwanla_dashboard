import type { NextApiRequest, NextApiResponse } from "next";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function isLocalRequest(request: NextApiRequest) {
  const address = request.socket.remoteAddress;
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).end();
  }
  if (!isLocalRequest(request)) return response.status(403).json({ error: "local requests only" });

  try {
    await execFileAsync("/usr/bin/systemctl", ["--user", "stop", "lawengwanla-kiosk.service"], {
      env: {
        ...process.env,
        XDG_RUNTIME_DIR: "/run/user/1000",
        DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/1000/bus",
      },
    });
    return response.status(204).end();
  } catch (error) {
    console.error("Could not stop kiosk service", error);
    return response.status(500).json({ error: "could not stop kiosk" });
  }
}
