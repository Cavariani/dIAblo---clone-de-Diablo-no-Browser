// Fixed-step accumulator with time scale (hit-stop) and smooth recovery.
export const STEP = 1 / 60;

export class FixedLoop {
  private acc = 0;
  timeScale = 1;
  private stopTimer = 0;

  /** Freeze simulation time for `seconds` (real time). */
  hitStop(seconds: number): void {
    this.stopTimer = Math.max(this.stopTimer, seconds);
  }

  /**
   * Advance by real frame time; calls step(dt) for each fixed step.
   * Returns interpolation alpha.
   */
  advance(realDt: number, step: (dt: number) => void): number {
    realDt = Math.min(realDt, 0.1);
    if (this.stopTimer > 0) {
      this.stopTimer -= realDt;
      this.timeScale = 0.06;
    } else {
      this.timeScale += (1 - this.timeScale) * Math.min(1, realDt * 18);
    }
    this.acc += realDt;
    let n = 0;
    while (this.acc >= STEP && n < 5) {
      step(STEP * this.timeScale);
      this.acc -= STEP;
      n++;
    }
    if (n === 5) this.acc = 0;
    return this.acc / STEP;
  }
}
