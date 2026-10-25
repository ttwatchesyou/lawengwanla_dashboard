# Maze mission / retry contract

## Implementation status

The route editor implements direct pencil editing, checkbox selection, confirmed
deletion, continuity checks, and one-level restore after deletion. Readiness now
uses an instrument cluster: dim icons become illuminated on actual configuration
checks, with hover/focus/touch-hold explanations and tap-to-section navigation.
Mission Check is now a compact fixed HUD portaled to the document body, not a
page section. It stays visible while scrolling; its 72px check dial becomes a
92×92px START button when all loaded checks pass. The six lights remain available
to edit configuration. The navigation's Check/Start action opens details without
scrolling. Its placement avoids the navigation, shutdown and kiosk-exit controls;
dialogs sit above the HUD. Start still uses the unchanged fail-closed API below.
On short/touch-sized screens it starts minimized (120×74px CHECK or 156×74px
START) with a separate 44px expand control. Expanding reveals all six lights and
the full 92×92px START button. Selecting a section or tapping outside minimizes
the panel again. Desktop views retain the expanded instrument cluster.

The placement cabinet display now explicitly faces world -X toward H3: its
back panel is on the east/machine side. The 3D model and station overview retain
blue–green–red left-to-right when looking at the cabinet from the H side. Source
cabinet C8 orientation, relative equipment gaps and unsurveyed docking poses are
unchanged. This display correction does not send rotation commands to the robot.
The main Retry panel now **reads acknowledged mission snapshots automatically**,
without manual task-condition inputs. The old non-persistent sandbox is retained
only inside the collapsed developer tools; it never supplies the live panel.
Normal mission JSON includes the canonical `plan_key`, task graph and retry policy,
NOT sandbox progress. All retry exports remain explicitly `executable: false`.

There is no robot mission executor/ACK publisher wired into this dashboard yet.
`/api/maze/start` still fails closed with `MISSION_EXECUTOR_UNAVAILABLE`.
The backend now subscribes read-only to the contract below. Without a publisher,
the UI says it is waiting and does not assume START or invent task completion.
Nothing in the Retry panel publishes ROS messages, writes serial, calls tuning
APIs, turns on magnets, resets odometry, or starts movement.

## Read-only live status contract

Backend `GET /api/maze/status` caches `std_msgs/msg/String` JSON from
`/lawengwanla/mission_status`. This is a new integration contract, not an existing
navigator output: the current navigator has no full mission progress publisher.
The actual future executor must emit full snapshots derived from controller ACKs,
not from sending a goal or advancing a timer. It must own/persist the run ledger.

```json
{
  "schema_version": 1,
  "source": "controller_ack",
  "run_id": "unique-run-id",
  "pose_epoch": "localization-epoch-id",
  "plan_key": "COPY EXACT plan_key FROM THE EXPORTED MISSION",
  "sequence": 42,
  "highest_reached": 19,
  "phase": "maze",
  "run_state": "paused",
  "stopped": true,
  "localization_valid": false,
  "block_dropped": false,
  "tasks": {
    "blocks.pick": "completed",
    "blocks.retract": "completed",
    "blocks.arrange": "completed",
    "blocks.place.A1": "pending",
    "sheet.pick": "completed",
    "sheet.load": "pending",
    "sheet.fold": "pending",
    "sheet.collect": "pending"
  }
}
```

This example is schema documentation only: task keys must match **all** selected
tasks from the actual mission, including each block's source-cell-specific place
ID. Do not publish fabricated snapshots on the real robot to test the interface.
Browser QA intercepts this GET in a disposable browser context instead.

- `phase`: `maze / cabinet2 / folder / finished`.
- `run_state`: `idle / running / paused / retry_required / completed / faulted`.
- Tasks: `pending / in_progress / completed / result_unknown`. In-flight or unknown
  tasks hold retry review for reconciliation; absent tasks never mean completed.
- Emit a heartbeat with increasing `sequence` at least every 500 ms. The cache
  rejects duplicate/replayed packets as freshness refreshes. Within one run,
  plan/task graph is immutable, highest arrival and phase cannot regress, and
  completed task ACKs cannot be undone. Sequence must survive executor restart
  with its durable run, or a reconciled new run must be created explicitly.
- Require exactly one status publisher and server age + HTTP transit + client
  monotonic elapsed time < 1500 ms. Backend restart starts empty; browser refresh
  re-reads the backend, not localStorage or animation progress.
- Plan review requires fresh matching-plan data, complete task states, a confirmed
  stationary robot, and paused/retry-required/faulted state. Actual retry execution
  is still unavailable, regardless of any status fields sent by the publisher.
- A review closes when mission progress/run/pose epoch changes or freshness is
  lost. Ordinary unchanged-content heartbeats do not close it.

## Three independent progress tracks

```text
Movement: START → A8 → … → [sequence 19 checkpoint] → … → exit
Blocks:   cabinet1 pick → retract → arrange → cabinet2 place each selected block
Sheet:    cabinet1 pick → folder load → fold → collect
```

Tasks are independently acknowledged; independent progress is NOT permission
for unconstrained parallel hardware operation. A future executor must schedule
station access, docking, base motion, grippers and any shared mechanisms using
resource interlocks. Base travel and mechanisms may overlap only where verified
safe by the mechanical/control design. Cabinet2 never picks/folds the sheet.

Arrival means the controller has confirmed both position and heading tolerance
with fresh feedback, not “goal sent”, a browser click, or animation progress.
The highest acknowledged sequence is monotonic. Sequence 19 refers to
`route[18]` of the immutable active plan, not a fixed map cell for all presets.

## Retry policy

| Context                                     | Resume point                                     | Tasks                                                       |
| ------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| Maze, highest arrival < 19                  | Physical external START, left of A6; approach A8 | Retain all completed task ACKs                              |
| Maze, highest arrival >= 19                 | Physical checkpoint at route sequence 19         | Resume route 19–37; keep task ACKs                          |
| Cabinet2 interrupted                        | Cabinet2 docking location                        | Place only unacknowledged blocks                            |
| Cabinet2 fully complete, folder interrupted | Folder docking location                          | Do not revisit cabinet2; resume pending sheet subtask       |
| All tasks complete                          | No movement                                      | Do not rerun mission                                        |
| Actuator result unknown/in flight           | HOLD/reconcile                                   | Inspect hardware/state before retrying irreversible actions |

Block drop adds a recovery barrier, not a replay of cabinet1 acquisition:
verify stopped state and operator reload/clearance, request **all block-gripper
magnets ON** (not sheet actuators), wait for controller ACK AND verified block
presence, verify/restore carried block arrangement, then allow travel. The
checkpoint rule is unchanged. Do not release all magnets merely because retry
was pressed. Already-placed block ACKs remain complete. A “drop” after every
block was placed is inconsistent and requires reconciliation.

Block regrip does not prove the sheet has been acquired. If sheet pickup is
pending, do not silently mark it complete or skip that task. A checkpoint19 retry
with cabinet1 work still pending is held for an explicit recovery plan; the
sandbox does not invent a route backwards through the maze to cabinet1.
Before checkpoint19, a pending sheet task remains at cabinet1 even if source
block acquisition is skipped.

## Durable executor ledger (required next integration)

The robot/backend, not localStorage, must own an immutable `plan_id/revision`
and `run_id`, plus highest confirmed route sequence, current phase/station,
per-block placements, sheet state, physical possession, and task states such as
`not_started / in_progress / completed / result_unknown`. Persist ACK transitions
atomically. Reconnecting/reloading the UI reads the existing run; it never resets
physical progress. Reject ACKs from another plan, run, or pose epoch.

Commands need stable `(run_id, task_id, attempt_id)` idempotency keys. A retry of
the same request returns the known result rather than repeating the actuator.
Persist intent before dispatch and persist results; “command delivered” is not
“physical task completed”. On a timeout or restart, reconcile in-flight tasks
against board status/limit switches/object sensors or operator inspection before
any repeat. A folded sheet must not be folded a second time because an ACK was
lost. The browser sandbox's `completed` selectors are deliberately not this ledger.

## Reposition / coordinate safety handshake

Picking up the robot invalidates the relationship between its physical map pose
and odometry. Sending a map coordinate such as `(7,4)` directly to a controller
whose odometry reads `(0,0)` produces a large error. Resetting encoder odometry
alone does not repair a frame mismatch.

Use `map → odom → base_link` and a stopped-state re-localization handshake:

1. Pause; require fresh controller ACK that base is stationary. Keep safe holding
   actuators engaged. Cancel old goals and fence late commands by a new pose epoch.
2. Operator repositions at the selected START/checkpoint/station and confirms
   physical placement. Establish measured/calibrated map position AND heading.
3. Capture fresh odometry and estimate
   `T_map_odom = T_map_base(measured anchor) × inverse(T_odom_base(now))`.
   Heading is part of SE(2); it is not just subtraction of X/Y offsets.
4. Have the localization/TF owner apply the new transform (only one TF publisher
   owns that link). Do not publish a competing TF from the web UI. If the board
   only accepts odom-frame goals, convert the map goal into that same odom frame.
5. Controller acknowledges the new epoch, discards old trajectories, resets PID
   integrators and velocity targets, and reinitializes setpoints at the current
   measured pose. Never apply a sudden map correction to an active position loop.
6. Validate localization freshness, uncertainty, fixed heading, docking/clearance
   and recovery gripper ACKs. Require explicit resume ACK, bounded acceleration,
   speed limits, command expiry/watchdog and an independent emergency stop.

Example with identical frame headings: measured anchor in map is `(7,4)`, current
odom is `(0,0)`. The map→odom translation is `(7,4)`. A map goal `(7.954,4)` then
becomes odom goal `(.954,0)`, not `(7.954,4)`. At checkpoint19 the anchor itself
is not a new long-distance driving command. `previewMapToOdom()` provides only
pure arithmetic for tests/design; it does not establish that a physical anchor
measurement is correct and does not update live localization.

START, exit and station docking poses still need physical survey/calibration.
The planner's nominal cell centers and illustrative outside lane offsets are
not authoritative localization measurements. Four near-floor ToF sensors
cannot uniquely identify a cell in repeating corridors; side mapping is also
still unconfirmed. Use a placement jig/fiducial/docking reference with suitable
heading feedback, or another validated localization method. Do not automatically
declare pose valid just because nominal cell coordinates or wall ranges match.

## References

- [ROS REP 105 coordinate frames](https://github.com/openrobotics/reps/blob/main/_posts/rep-0105.md)
- [robot_localization state estimation / frame and SetPose semantics](https://github.com/cra-ros-pkg/robot_localization/blob/rolling-devel/doc/state_estimation_nodes.rst)

The above stop/reconcile/reanchor/controller-reset sequence is this project's
proposed safety design; the ROS references explain frames, not a guarantee of
physical robot safety or an existing integration in this repository.
