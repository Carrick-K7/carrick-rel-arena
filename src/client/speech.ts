import type { Gender, Tone } from '../shared/contracts.js';
import { requestSpeech } from './api.js';

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let currentOnEnd: (() => void) | null = null;
let playbackSerial = 0;

interface PlaybackCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
}

export async function speakLine(
  text: string,
  tone: Tone,
  speakerGender: Gender,
  sessionId: string | null,
  callbacks: PlaybackCallbacks = {},
): Promise<void> {
  stopSpeaking();
  const serial = playbackSerial;
  currentOnEnd = callbacks.onEnd ?? null;
  callbacks.onStart?.();

  try {
    const audioBlob = await requestSpeech(
      text,
      tone,
      speakerGender,
      sessionId,
    );
    if (serial !== playbackSerial) return;
    if (audioBlob) {
      currentUrl = URL.createObjectURL(audioBlob);
      currentAudio = new Audio(currentUrl);
      currentAudio.addEventListener(
        'ended',
        finishPlayback,
        { once: true },
      );
      currentAudio.addEventListener('error', finishPlayback, {
        once: true,
      });
      await currentAudio.play();
      return;
    }
  } catch {
    releaseAudio();
  }

  if (serial !== playbackSerial) return;
  speakWithBrowser(text, tone, speakerGender, finishPlayback);
}

export function stopSpeaking(): void {
  playbackSerial += 1;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  releaseAudio();
  window.speechSynthesis?.cancel();
  const onEnd = currentOnEnd;
  currentOnEnd = null;
  onEnd?.();
}

function releaseAudio() {
  currentAudio = null;
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

function speakWithBrowser(
  text: string,
  tone: Tone,
  speakerGender: Gender,
  onEnd: () => void,
) {
  if (!('speechSynthesis' in window)) {
    onEnd();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate =
    tone === 'sharp' ? 1.06 : tone === 'shaky' || tone === 'quiet' ? 0.9 : 0.96;
  const genderPitch = speakerGender === 'male' ? 0.86 : 1.02;
  utterance.pitch =
    tone === 'icy'
      ? genderPitch - 0.04
      : tone === 'soft'
        ? genderPitch + 0.03
        : genderPitch;
  const voices = window.speechSynthesis.getVoices();
  const chineseVoice = voices.find((voice) =>
    voice.lang.toLowerCase().startsWith('zh'),
  );
  if (chineseVoice) utterance.voice = chineseVoice;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

function finishPlayback() {
  releaseAudio();
  const onEnd = currentOnEnd;
  currentOnEnd = null;
  onEnd?.();
}

interface BrowserSpeechRecognitionEvent extends Event {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: {
        transcript: string;
      };
    };
  };
}

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    | ((event: BrowserSpeechRecognitionEvent) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function supportsSpeechInput(): boolean {
  return Boolean(
    window.SpeechRecognition ?? window.webkitSpeechRecognition,
  );
}

export function startSpeechInput(
  onResult: (text: string) => void,
  onEnd: () => void,
): () => void {
  const Recognition =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Recognition) {
    onEnd();
    return () => undefined;
  }

  const recognition = new Recognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    let text = '';
    for (let index = 0; index < event.results.length; index += 1) {
      text += event.results[index][0].transcript;
    }
    onResult(text.trim());
  };
  recognition.onend = onEnd;
  recognition.onerror = onEnd;
  recognition.start();

  return () => recognition.abort();
}
