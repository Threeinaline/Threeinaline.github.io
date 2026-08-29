/**
 * Native audio synthesizer using the Web Audio API.
 * Safely self-contained with robust error handling.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      // @ts-ignore
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    } catch (e) {
      console.warn("Web Audio API not supported or blocked in this browser.", e);
    }
  }
  return audioCtx;
}

/**
 * Play a short click or pop sound for X placement.
 */
export function playXSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  try {
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = "sine";
    // Quick pitch drop
    osc.frequency.setValueAtTime(450, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // Graceful fail
  }
}

/**
 * Play a soft synth chord for O placement.
 */
export function playOSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  try {
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = "triangle";
    // Gentle high pleasant chime pitch sliding slightly up
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(512, ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    // Graceful fail
  }
}

/**
 * Play a charming victory arpeggio.
 */
export function playVictorySound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  try {
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    const now = ctx.currentTime;
    
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.1, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.35);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  } catch (e) {
    // Graceful fail
  }
}

/**
 * Play a warm double vibration sound for draw/tie.
 */
export function playDrawSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  try {
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.25);
    
    // Bandpass filter to make it warmer/less harsh
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(250, ctx.currentTime);
    
    osc.disconnect(gain);
    osc.connect(filter);
    filter.connect(gain);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
  } catch (e) {
    // Graceful fail
  }
}

/**
 * Play an error buzzer sound for invalid actions.
 */
export function playErrorSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  
  try {
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = "square";
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.15);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch (e) {
    // Graceful fail
  }
}
