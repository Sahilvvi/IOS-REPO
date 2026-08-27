/**
 * Stand-in for the socket. Walks the baseline map through a ~2 Hz gait cycle
 * with noise, so the whole app can be demoed without hardware.
 */
import { BASELINE_KPA, PressureFrame, PressureSource } from './types';

export class SimulatedPressureSource implements PressureSource {
 readonly id = 'simulated';
 private tick = 0;

 constructor(private readonly intervalMs = 460) {}

 subscribe(onFrame: (frame: PressureFrame) => void): () => void {
 onFrame(this.next());
 const timer = setInterval(() => onFrame(this.next()), this.intervalMs);
 return () => clearInterval(timer);
 }

 private next(): PressureFrame {
 this.tick += 1;
 return BASELINE_KPA.map((base, i) =>
 Math.max(6, Math.round(base + Math.sin(this.tick * 0.65 + i * 0.5) * 12 + (Math.random() - 0.5) * 7)),
 );
 }
}
