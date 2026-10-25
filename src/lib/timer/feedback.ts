"use client";

/**
 * End-of-rest feedback: a vibration, a short tone, and a notification.
 *
 * All three fire together on the same event so the phone in your pocket, the
 * phone on the bench and the phone face-down all tell you the same thing at
 * the same moment. Each degrades independently: no vibration motor, no
 * notification permission and a muted phone are all normal, and none of them
 * stops the others.
 */

let audioContext: AudioContext | null = null;

/**
 * Prepares audio while a user gesture is still on the stack.
 *
 * Browsers refuse to start an AudioContext outside a gesture, and the timer
 * finishes long after the tap that started it. Creating it on that tap is the
 * only way the tone is allowed to play later.
 */
export function primeAudio(): void {
  if (typeof window === "undefined") return;
  try {
    if (!audioContext) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audioContext = new Ctor();
    }
    if (audioContext.state === "suspended") void audioContext.resume();
  } catch {
    audioContext = null;
  }
}

/** Two short rising blips. Deliberately brief: this is a cue, not an alarm. */
function playTone(): void {
  if (!audioContext || audioContext.state !== "running") return;
  try {
    const now = audioContext.currentTime;
    for (const [index, frequency] of [880, 1320].entries()) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = now + index * 0.16;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      // Ramped rather than switched, so it does not click.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);

      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.16);
    }
  } catch {
    // A failed tone is never worth surfacing.
  }
}

function vibrate(): void {
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    // Not supported on iOS Safari. Expected.
  }
}

function notify(body: string): void {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return; // already looking at it
    new Notification("Rest over", { body, icon: "/icons/icon-192.png", tag: "liftlog-rest" });
  } catch {
    // Some browsers throw when constructing a Notification outside a
    // service worker. Nothing to do about it here.
  }
}

export function restFinishedFeedback(label?: string): void {
  vibrate();
  playTone();
  notify(label ? `Next set: ${label}` : "Next set.");
}

/** Asked for once, from a tap, and never nagged about again. */
export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  try {
    if (typeof Notification === "undefined") return null;
    if (Notification.permission !== "default") return Notification.permission;
    return await Notification.requestPermission();
  } catch {
    return null;
  }
}
