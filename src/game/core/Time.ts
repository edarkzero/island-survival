/** Engine-agnostic frame clock — accumulates dt and provides a tick counter. */
export class GameClock {
  totalSeconds = 0;
  ticks = 0;

  advance(dtSeconds: number) {
    this.totalSeconds += dtSeconds;
    this.ticks += 1;
  }
}
