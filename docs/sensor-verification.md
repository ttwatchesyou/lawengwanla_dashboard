# Sensor integration verification — 2026-10-17

- PlatformIO renesas-ra 1.9.0 / UNO R4 Minima: build and DFU upload successful.
  Upload was restricted to Arduino serial `32071F1439313139240E33354B57336E`.
- Real firmware packets reached ROS `/sensors/inductive` and its raw/connected
  topics, loopback API port 8002, and the Next.js same-origin proxy on port 3025.
- Observed real electrical readings during verification: D2=LOW, D3=LOW,
  D4=HIGH, D5=HIGH, `connected=true`, `fresh=true`, one ROS publisher,
  `parse_errors=0`. These are observations, not proof of all physical sensors:
  test metal approach/removal on each sensor separately.
- Input-only serial and GET-only gateway user services are enabled and running.
  They start with ubuntu's user manager; boot-before-login is not configured.
- Python protocol/cache suite: 15 passed. Dashboard Node suite: 45 passed
  (40 existing planner tests plus 5 sensor tests). Next.js production build passed.
- Headless browser checked real `/SensorCheck` data at 1024×600 and 390×844.
  No horizontal overflow. All four cards fit the 1024×600 viewport.
- Browser-only HTTP fixtures verified active LOW, stale data, duplicate ROS
  publisher counts, and API failure. Invalid/unavailable readings show unknown.
  The generic ToF selector correctly reports waiting with no real ToF publisher.
  No fake measurements were published to ROS, and no motion/actuator commands
  were sent during these checks.
- Existing STM32 wheel firmware source/config SHA256 unchanged after moving
  to `/home/ubuntu/Lawengwanla_cpp/wheel_tuner`. Compatibility symlink retained.

The Sites local-preview checklist guided responsive and failure-state browser
verification. No external website was registered, synchronized, or published.
