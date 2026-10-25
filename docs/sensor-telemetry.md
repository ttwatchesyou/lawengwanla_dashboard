Current IO595 gateway: `127.0.0.1:8005`; `8004` is reserved for mainprogram.

# Sensor Check

The combined STM32/Nano/74HC595 panel is at `/SensorCheck#io595`.
It uses a dedicated loopback gateway on port 8004 and
`/api/io595/*`, with eight unassigned limits (L1–L7 = PA1–PA7, L8 = PA0), four Nano inputs
(D2→PB0, D3→PB1, D4→PB5, D5→PB9), and 16 relay outputs, currently configured
active LOW after the user's polarity check. Hold to energize
one channel at a time; release to stop. Limits are display-only until channel
assignments are supplied. Stale or disconnected readings become unknown.
This new path does not feed the old floor/gripper mapping described below.
The old sensor map and its R4/limit/gripper polling loops have been removed from
this page to reduce load and keep Nano readings unambiguous. The relay labels describe the
command acknowledged by STM32; there is no electrical readback of 595 pins,
relay contacts or motor motion.
Firmware reports `active_level` (0=LOW, 1=HIGH); the UI renders electrical levels
from that field. Older packets without the field retain the previous LOW behavior.
Buttons follow the connected loads: board 1 A–H are eight relays, board 2 A–F
are six motors, and board 2 G–H are two electromagnets. All 16 channels have
buttons. Physical channels are 1–8, 9–14, 15–16 respectively.
Firmware and gateway instructions:
`/home/ubuntu/laweng_cpp/stm32_nano_limits_595/README.md`.

Sensor display tolerates sample ages below 1000 ms to avoid blinking through
brief HTTP delays. Relay authority still uses 250 ms freshness and the board's
350 ms watchdog. The panel renders only when visible values change, pauses
polling while hidden, polls every 150 ms when idle and every 100 ms during a hold.
Verification: 17 dashboard tests, 11 gateway tests, TypeScript checking and full
Next.js build passed. Browser check observed zero idle panel DOM mutations,
32 successful state requests in five seconds, and no sensor requests while hidden.

The following sections document the historical R4/old-limit page, retained for
reference; they do not describe the current SensorCheck route.

Page: `/SensorCheck` (desktop/mobile navigation: **Sensors**).

Pipeline: 4 inductive + 4 analog ToF inputs → R4 USB serial → ROS 2 sensor topics,
and 10 limits → STM32/FTDI → ROS 2 `/sensors/limit`
→ configurable `lawengwanla_bridge` gateway → same-origin Next.js API proxy
→ dashboard. A separate WebSocket rosbridge server is not needed for this path.

The more-specific `/api/telemetry/*` rewrite goes to loopback port 8002.
All existing `/api/*` routes still go to the existing robot backend on 8001.
No commands or writes are added to either backend by this page.

Current inductive firmware: 5VDC NPN NO, A4/D3/D4/A5, plain INPUT, active LOW.
A4/I1 and A5/I4 are ADC-based with raw 14-bit readings displayed on their cards.
Selecting either shows the fixed boundary: ADC <= 1000 is electrical LOW and
ADC > 1000 is electrical HIGH. There is no hysteresis band. As NPN inputs they
are logically active/detected at LOW and inactive/not detected at HIGH.
The external circuit must define idle HIGH; disconnected or unbiased inputs can
float. R4 validation also accepts the previous INPUT_PULLUP mode. STM32 limit
inputs remain INPUT_PULLUP only.
The page shows four compact navy cards named อินดักทีฟ 1–4, each with a status
lamp and a short detection badge. A single heading identifies the page. Lamps follow the
debounced LOW-derived `active`: green ON when detected, dark OFF when not.
Missing/invalid/stale readings show a gray lamp with a dash, distinct from OFF.
The same route renders an interactive schematic of the robot's three shelves,
with left/right limit markers and a second view for lift and extension limits.
Selecting a numbered marker (touch, click, Enter or Space) shows its location,
STM32 pin and live state. Green means active, slate means inactive, and amber
means unknown. This is a location schematic, not measured motor position.
An expandable list contains all ten named limits.

Inductive markers use square badges I1–I4, distinct from circular limit markers.
I1 (UNO R4 A4, previously D2) is at the center of floor 1; I2 (D3) is at the center of floor 2.
I3 (D4) and I4 (A5, previously D5) are labeled as unassigned in the side panel and are not
placed on the schematic until their physical locations are confirmed.
Selecting an inductive marker or side-panel button shows its pin and live metal
detection state. Unknown positions and unknown sensor readings are separate.

The limit pin order is:

| Limit | Pin | Location |
| --- | --- | --- |
| 1 | PA11 | Floor 3 left |
| 2 | PA12 | Floor 2 left |
| 3 | PA8 | Floor 1 left |
| 4 | PB3 | Floor 3 right |
| 5 | PB4 | Floor 2 right |
| 6 | PB5 | Floor 1 right |
| 7 | PB6 | Lift down |
| 8 | PB7 | Extension in |
| 9 | PB8 | Extension out |
| 10 | PB9 | Lift up |

The six shelf limit buttons also start a browser-only gripper preview. The
rectangular carriage moves along its own fixed rail; the shelf, motor and
inductive location markers remain stationary. Limits 1/4 target floor 3,
2/5 floor 2, and 3/6 floor 1. Lift/extension limits remain inspection-only.
Each floor can move independently; a new target reverses from the current
preview position. Stop freezes all previews, and reset restores their centers.
The illustrative full stroke is 3.2 seconds; it is not a calibrated motor speed.
The preview is explicitly labeled as simulation and does not infer real
position from elapsed time, send motor requests, publish ROS commands, or
change live limit/inductive readings. Refresh resets the preview. Reduced-motion
preferences show the requested endpoint without interpolating animation.
Future relay integration should replace this local command boundary with board
acknowledgements and limit-confirmed stops; simulation completion must not be
treated as hardware arrival. The board must enforce stop/timeout/interlocks.

Four ToF cards are ordered
front A2, rear A3, left A0, right A1. ToF cards show the direct 14-bit
`analogRead()` value (0–16383); no voltage or distance equation is applied.
The layout supports the 1024×600 kiosk and smaller mobile screens; scroll down
for additional sensor details when the motion-preview controls are shown.
Readings become unknown on a disconnected board, missing/duplicate publishers,
invalid frames, API failure, or stale data. Browser elapsed time is included so
a cached response cannot keep indicators lit while requests have stalled.
An unplugged NPN NO output with pull-up can read HIGH just like no metal;
plain INPUT without external bias can float. This is not a per-sensor continuity
test. Actual sensor responsiveness needs a physical target.

Add future topic subscriptions in
`/home/ubuntu/ros2_ws/src/lawengwanla_bridge/config/topics.yaml` and rebuild/restart
the gateway. The catalog and generic topic API remain available to future pages;
this page subscribes to the `inductive`, `r4`, and `limit` endpoints.
See the ROS package README for the protocol, service setup, API and safety limits.

Checks: `node --test tests/sensorTelemetry.test.cjs` and `npm run build`.
