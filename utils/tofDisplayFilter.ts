// Independent per-channel median(5) plus a time-based EMA (0.5 s constant).
// Reset after stale input or a board reconnect; never reuse old distances.
export class TofDisplayFilter {
  private windows: number[][] = [];
  private filtered: number[] = [];
  private epoch = "";
  private sequence = -1;
  private lastAt = 0;

  reset() {
    this.windows = [];
    this.filtered = [];
    this.epoch = "";
    this.sequence = -1;
    this.lastAt = 0;
  }

  sample(values: number[], epoch: string, sequence: number, now: number): number[] {
    if (values.length !== 4 || values.some(value => !Number.isFinite(value))) {
      this.reset();
      return [];
    }
    if (epoch !== this.epoch || now - this.lastAt >= 1000 || now < this.lastAt) this.reset();
    if (this.windows.length && sequence === this.sequence) return [...this.filtered];
    const first = !this.windows.length;
    const alpha = first ? 1 : 1 - Math.exp(-(now - this.lastAt) / 500);
    this.filtered = values.map((value, index) => {
      const window = [...(this.windows[index] ?? []), value].slice(-5);
      this.windows[index] = window;
      const sorted = [...window].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
      return first ? median : this.filtered[index] + alpha * (median - this.filtered[index]);
    });
    this.epoch = epoch;
    this.sequence = sequence;
    this.lastAt = now;
    return [...this.filtered];
  }
}
