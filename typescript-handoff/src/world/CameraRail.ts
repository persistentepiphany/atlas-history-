import type { CameraMove } from '../data/types';
import type { Pose } from './WorldSource';
import { ease } from '../sequence/beats';

/**
 * Turns a stop's CameraMove list into timed pose steps with the shared bezier easing.
 * The rail ticks at a fixed rate and sends the eased delta of each move over the tick as a
 * relative pose, so a dolly of 0.12 over six seconds lands exactly 0.12 units forward however
 * the model chunks its frames. Free movement is disabled. The only extra input is a one shot
 * look nudge, already clamped by the orchestrator, which is added to the next tick.
 */
export interface PoseSink { applyPose(pose: Pose): void; release?(): void }

export const RAIL_TICK_MS = 250;

interface Segment { seconds: number; pose: Pose }

/** dolly moves along the look axis, pan and tilt rotate, orbit rotates while strafing the other way so the subject stays centred. */
export function moveToPose(m: CameraMove): Segment {
  if ('hold' in m) return { seconds: m.hold, pose: [0, 0, 0, 0, 0, 0] };
  if ('dolly' in m) return { seconds: m.seconds, pose: [0, 0, 0, 0, 0, m.dolly] };
  if ('pan' in m) return { seconds: m.seconds, pose: [0, m.pan, 0, 0, 0, 0] };
  if ('tilt' in m) return { seconds: m.seconds, pose: [m.tilt, 0, 0, 0, 0, 0] };
  return { seconds: m.seconds, pose: [0, m.orbit, 0, -m.orbit, 0, 0] };
}

export class CameraRail {
  private timer: ReturnType<typeof setInterval> | null = null;
  private segments: Segment[] = [];
  private segIndex = 0; private segElapsed = 0; private paused = false;
  private nudge: [number, number] = [0, 0];
  constructor(private sink: PoseSink) {}

  play(moves: CameraMove[]) {
    this.stop();
    this.segments = moves.map(moveToPose); this.segIndex = 0; this.segElapsed = 0;
    if (!this.segments.length) return;
    this.timer = setInterval(() => this.tick(RAIL_TICK_MS / 1000), RAIL_TICK_MS);
  }
  get playing() { return this.timer !== null; }
  pause() { this.paused = true; this.sink.applyPose([0, 0, 0, 0, 0, 0]); }
  resume() { this.paused = false; }
  look(dx: number, dy: number) { this.nudge = [dx, dy]; }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.sink.release?.(); }

  private tick(dt: number) {
    if (this.paused) return;
    const seg = this.segments[this.segIndex];
    if (!seg) { this.stop(); return; }
    const t0 = seg.seconds > 0 ? this.segElapsed / seg.seconds : 1;
    this.segElapsed = Math.min(seg.seconds, this.segElapsed + dt);
    const t1 = seg.seconds > 0 ? this.segElapsed / seg.seconds : 1;
    const k = ease(t1) - ease(t0);
    const pose = seg.pose.map((v) => v * k) as Pose;
    pose[1] += this.nudge[0]; pose[0] += this.nudge[1]; this.nudge = [0, 0];
    this.sink.applyPose(pose);
    if (this.segElapsed >= seg.seconds) { this.segIndex += 1; this.segElapsed = 0; }
  }
}
