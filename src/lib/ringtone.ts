interface Beep {
  offsetSeconds: number;
  durationSeconds: number;
  frequency: number;
}

interface RingPattern {
  periodSeconds: number;
  beeps: Beep[];
}

export const RINGTONE_OPTIONS = [
  { id: 'classic', label: 'Классический' },
  { id: 'marimba', label: 'Маримба' },
  { id: 'pulse', label: 'Пульс' },
  { id: 'chime', label: 'Колокольчик' },
] as const;

export type RingtoneId = (typeof RINGTONE_OPTIONS)[number]['id'];

const OUTGOING_PATTERN: RingPattern = {
  periodSeconds: 4,
  beeps: [{ offsetSeconds: 0, durationSeconds: 1, frequency: 425 }],
};

const INCOMING_PATTERNS: Record<RingtoneId, RingPattern> = {
  classic: {
    periodSeconds: 3,
    beeps: [
      { offsetSeconds: 0, durationSeconds: 0.4, frequency: 740 },
      { offsetSeconds: 0.55, durationSeconds: 0.4, frequency: 740 },
    ],
  },
  marimba: {
    periodSeconds: 2.8,
    beeps: [
      { offsetSeconds: 0, durationSeconds: 0.18, frequency: 523 },
      { offsetSeconds: 0.2, durationSeconds: 0.18, frequency: 659 },
      { offsetSeconds: 0.4, durationSeconds: 0.18, frequency: 784 },
      { offsetSeconds: 0.6, durationSeconds: 0.35, frequency: 1047 },
    ],
  },
  pulse: {
    periodSeconds: 2.2,
    beeps: [
      { offsetSeconds: 0, durationSeconds: 0.15, frequency: 880 },
      { offsetSeconds: 0.25, durationSeconds: 0.15, frequency: 880 },
      { offsetSeconds: 0.5, durationSeconds: 0.15, frequency: 880 },
    ],
  },
  chime: {
    periodSeconds: 3.5,
    beeps: [
      { offsetSeconds: 0, durationSeconds: 0.6, frequency: 1047 },
      { offsetSeconds: 0.7, durationSeconds: 0.9, frequency: 784 },
    ],
  },
};

const BEEP_VOLUME = 0.18;
const FADE_SECONDS = 0.02;

export function startRingTone(kind: 'outgoing' | 'incoming', ringtone: RingtoneId = 'classic'): () => void {
  const pattern = kind === 'outgoing' ? OUTGOING_PATTERN : INCOMING_PATTERNS[ringtone];
  const context = new AudioContext();

  const scheduleCycle = () => {
    const start = context.currentTime + 0.05;
    for (const beep of pattern.beeps) {
      const from = start + beep.offsetSeconds;
      const to = from + beep.durationSeconds;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(beep.frequency, from);
      gain.gain.setValueAtTime(0, from);
      gain.gain.linearRampToValueAtTime(BEEP_VOLUME, from + FADE_SECONDS);
      gain.gain.setValueAtTime(BEEP_VOLUME, to - FADE_SECONDS);
      gain.gain.linearRampToValueAtTime(0, to);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(from);
      oscillator.stop(to + 0.05);
    }
  };

  void context.resume().catch(() => undefined);
  scheduleCycle();
  const timer = window.setInterval(scheduleCycle, pattern.periodSeconds * 1000);

  return () => {
    window.clearInterval(timer);
    void context.close();
  };
}

export function previewRingtone(ringtone: RingtoneId): void {
  const stop = startRingTone('incoming', ringtone);
  window.setTimeout(stop, 2600);
}
