import { useRef, useCallback, useEffect } from 'react';

let ambientAudio: HTMLAudioElement | null = null;
let ambientUrl: string | null = null;
let sharedAudioContext: AudioContext | null = null;
let ambientSuppressionCount = 0;

type CueName = 'radarPing' | 'victory' | 'defeat' | 'abandon';

type CueStep = {
  offset: number;
  duration: number;
  frequency: number;
  endFrequency?: number;
  gain: number;
  type?: OscillatorType;
};

const CUE_STEPS: Record<CueName, CueStep[]> = {
  radarPing: [
    { offset: 0, duration: 0.075, frequency: 1720, endFrequency: 1360, gain: 0.048, type: 'sine' },
    { offset: 0.11, duration: 0.09, frequency: 1180, endFrequency: 920, gain: 0.015, type: 'triangle' },
  ],
  victory: [
    { offset: 0, duration: 0.12, frequency: 523.25, gain: 0.05, type: 'triangle' },
    { offset: 0.1, duration: 0.12, frequency: 659.25, gain: 0.048, type: 'triangle' },
    { offset: 0.22, duration: 0.16, frequency: 783.99, gain: 0.05, type: 'triangle' },
    { offset: 0.36, duration: 0.28, frequency: 1046.5, gain: 0.045, type: 'sine' },
  ],
  defeat: [
    { offset: 0, duration: 0.16, frequency: 392, gain: 0.05, type: 'sawtooth' },
    { offset: 0.15, duration: 0.18, frequency: 311.13, gain: 0.048, type: 'sawtooth' },
    { offset: 0.32, duration: 0.34, frequency: 220, gain: 0.045, type: 'triangle' },
  ],
  abandon: [
    { offset: 0, duration: 0.055, frequency: 880, endFrequency: 740, gain: 0.03, type: 'square' },
    { offset: 0.08, duration: 0.12, frequency: 392, endFrequency: 280, gain: 0.05, type: 'sawtooth' },
    { offset: 0.21, duration: 0.24, frequency: 240, endFrequency: 160, gain: 0.046, type: 'triangle' },
  ],
};

function resetAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  audio.src = '';
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const ctor = window.AudioContext
    ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!ctor) return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new ctor();
  }

  if (sharedAudioContext.state === 'suspended') {
    void sharedAudioContext.resume().catch(() => {});
  }

  return sharedAudioContext;
}

function playCueSound(cue: CueName) {
  const audioContext = getAudioContext();
  if (!audioContext) return;

  const steps = CUE_STEPS[cue];
  const now = audioContext.currentTime + 0.01;
  const master = audioContext.createGain();
  master.gain.setValueAtTime(0.9, now);
  master.connect(audioContext.destination);

  let lastStepEnd = now;

  for (const step of steps) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startTime = now + step.offset;
    const endTime = startTime + step.duration;

    oscillator.type = step.type ?? 'sine';
    oscillator.frequency.setValueAtTime(step.frequency, startTime);
    if (step.endFrequency && step.endFrequency > 0) {
      oscillator.frequency.exponentialRampToValueAtTime(step.endFrequency, endTime);
    }

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(step.gain, startTime + Math.min(0.025, step.duration / 2));
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

    oscillator.connect(gainNode);
    gainNode.connect(master);

    oscillator.start(startTime);
    oscillator.stop(endTime + 0.02);
    lastStepEnd = Math.max(lastStepEnd, endTime + 0.02);
  }

  window.setTimeout(() => {
    master.disconnect();
  }, Math.ceil((lastStepEnd - now + 0.1) * 1000));
}

function playOneShotAudio(url: string | null, volume = 1) {
  if (!url) return;

  const audio = new Audio(url);
  audio.volume = volume;
  audio.play().catch(() => {});
}

function syncAmbientPlayback() {
  if (!ambientAudio) return;

  if (ambientSuppressionCount > 0) {
    ambientAudio.pause();
    return;
  }

  ambientAudio.play().catch(() => {});
}

export function useAmbientSuppression(active: boolean) {
  useEffect(() => {
    if (!active) return;

    ambientSuppressionCount += 1;
    syncAmbientPlayback();

    return () => {
      ambientSuppressionCount = Math.max(0, ambientSuppressionCount - 1);
      syncAmbientPlayback();
    };
  }, [active]);
}

export function useLoopingSound(url: string | null, active: boolean, volume = 0.35) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!active || !url) {
      resetAudio(audioRef.current);
      audioRef.current = null;
      return;
    }

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = volume;
    audio.play().catch(() => {});
    audioRef.current = audio;

    return () => {
      if (audioRef.current === audio) {
        resetAudio(audioRef.current);
        audioRef.current = null;
        return;
      }

      resetAudio(audio);
    };
  }, [active, url, volume]);
}

export function useRepeatingCue(cue: CueName, active: boolean, intervalMs: number) {
  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    playCueSound(cue);
    const intervalId = window.setInterval(() => {
      playCueSound(cue);
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [active, cue, intervalMs]);
}

export function useSoundEngine() {
  const stopAmbient = useCallback(() => {
    resetAudio(ambientAudio);
    ambientAudio = null;
    ambientUrl = null;
  }, []);

  const playAmbient = useCallback((url: string | null, volume = 0.3) => {
    if (!url) return;
    if (ambientAudio && ambientUrl === url) {
      ambientAudio.volume = volume;
      syncAmbientPlayback();
      return;
    }

    stopAmbient();
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = volume;
    audio.preload = 'auto';
    ambientAudio = audio;
    ambientUrl = url;
    syncAmbientPlayback();
  }, [stopAmbient]);

  const playTransition = useCallback((url: string | null) => {
    playOneShotAudio(url);
  }, []);

  const playNarration = useCallback((url: string | null) => {
    playOneShotAudio(url);
  }, []);

  const playCue = useCallback((cue: CueName) => {
    playCueSound(cue);
  }, []);

  return { playAmbient, stopAmbient, playTransition, playNarration, playCue };
}
