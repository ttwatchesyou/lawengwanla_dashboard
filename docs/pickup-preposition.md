# Pickup setup before maze execution

The source grid uses row 0 at the top: floors 1, 2, 3 from top to bottom.
Columns 0, 1, 2 send targets 1 (left), 2 (center), 3 (right).
Each floor has at most one selected slot. Replacing a slot retains its pickup order;
clicking the selected slot again deselects that floor and queues a scoped cancellation.
The destination grid retains its existing bottom-to-top placement order.

Only explicit pickup edits or the prepare button send `/api/io595/pick` requests.
Color and plate edits do not move sliders. Restoring storage, reconnecting, and polling
never replay targets. An explicit prepare button applies a restored draft or retries
an unsuccessful request. The gateway queues only changed targets; existing STM32
limit handling and the mandatory UART heartbeat remain intact.

Readiness requires fresh gateway telemetry, all selected floors at the requested
positions without errors, and no pending or unacknowledged automation commands.
The browser locks setup before posting START. Mainprogram independently confirms
`pick_lock` before executing wheel motion. The gateway lock persists across restarts;
serial disconnects clear target confirmation. The setup view stops polling after lock.
An explicit new-round reset requires Mainprogram reporting ready, fresh stopped pose
and stationary twist; the gateway also rejects reset while sliders are active or queued.
A reset never moves the grippers automatically. Global STOP clears prepared targets
without unlocking setup.

This is prepositioning only. LiDAR cabinet detection and pickup completion checkpoints
are not implemented by this change.

Validation: dashboard unit tests and TypeScript check; gateway protocol/lock tests;
Mainprogram tests with the lock barrier; mocked browser selection and START sequences.
Browser tests intercept actuation requests and never operate physical motors.
