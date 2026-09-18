/** Browser-only sound adapter. It is intentionally outside the pure rule core. */
export type SoundName = 'pick' | 'store' | 'fit' | 'spin' | 'complete' | 'win' | 'error' | 'undo';

let context: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

export function unlockAudio(): void {
  if (muted) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
  } catch {
    context = null;
  }
}

function tone(frequency: number, duration: number, delay = 0, volume = 0.025): void {
  if (muted || !context) return;
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + delay;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  } catch { /* WebView audio is optional; rules remain playable. */ }
}

export function playSound(name: SoundName): void {
  switch (name) {
    case 'pick': tone(520, 0.06, 0, 0.012); break;
    case 'store': tone(370, 0.11, 0, 0.02); break;
    case 'fit': tone(659, 0.12); tone(988, 0.16, 0.05); break;
    case 'spin': [330, 392, 494, 587].forEach((frequency, index) => tone(frequency, 0.07, index * 0.045, 0.014)); break;
    case 'complete': [784, 988, 1175].forEach((frequency, index) => tone(frequency, 0.13, index * 0.05)); break;
    case 'win': [523, 659, 784, 1047].forEach((frequency, index) => tone(frequency, 0.26, index * 0.09)); break;
    case 'error': tone(165, 0.08, 0, 0.017); break;
    case 'undo': tone(587, 0.07); tone(392, 0.11, 0.05); break;
  }
}

export function stopAudio(): void {
  if (context?.state === 'running') void context.suspend();
}
