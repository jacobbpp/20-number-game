export type SoundName = 'place' | 'win' | 'lose' | 'copy'

const MUTE_STORAGE_KEY = 'order20-sound-muted'

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return null
  if (!audioContext) audioContext = new AudioContextClass()
  // Browsers suspend a freshly created context until a user gesture resumes
  // it — every call site here fires from a click handler, so this is safe.
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

export function isSoundMuted(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setSoundMuted(muted: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0')
  } catch {
    // Storage unavailable — the setting just won't persist across reloads.
  }
}

function playTone(ctx: AudioContext, frequency: number, startTime: number, duration: number, type: OscillatorType, peakGain: number) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + duration)
}

export function playSound(name: SoundName) {
  if (isSoundMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime

  switch (name) {
    case 'place':
      playTone(ctx, 880, now, 0.08, 'sine', 0.12)
      break
    case 'copy':
      playTone(ctx, 660, now, 0.07, 'sine', 0.1)
      break
    case 'win':
      playTone(ctx, 523.25, now, 0.12, 'triangle', 0.14)
      playTone(ctx, 659.25, now + 0.1, 0.12, 'triangle', 0.14)
      playTone(ctx, 783.99, now + 0.2, 0.18, 'triangle', 0.16)
      break
    case 'lose':
      playTone(ctx, 220, now, 0.18, 'sawtooth', 0.1)
      playTone(ctx, 164.81, now + 0.12, 0.22, 'sawtooth', 0.1)
      break
  }
}
