import type { Tone } from '../shared/contracts.js';
import { requestSpeech } from './api.js';

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export async function speakLine(text: string, tone: Tone): Promise<void> {
  stopSpeaking();

  try {
    const audioBlob = await requestSpeech(text, tone);
    if (audioBlob) {
      currentUrl = URL.createObjectURL(audioBlob);
      currentAudio = new Audio(currentUrl);
      currentAudio.addEventListener(
        'ended',
        () => {
          releaseAudio();
        },
        { once: true },
      );
      await currentAudio.play();
      return;
    }
  } catch {
    releaseAudio();
  }

  speakWithBrowser(text, tone);
}

export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  releaseAudio();
  window.speechSynthesis?.cancel();
}

function releaseAudio() {
  currentAudio = null;
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

function speakWithBrowser(text: string, tone: Tone) {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate =
    tone === 'sharp' ? 1.06 : tone === 'shaky' || tone === 'quiet' ? 0.9 : 0.96;
  utterance.pitch = tone === 'icy' ? 0.9 : tone === 'soft' ? 1.02 : 0.96;
  const voices = window.speechSynthesis.getVoices();
  const chineseVoice = voices.find((voice) =>
    voice.lang.toLowerCase().startsWith('zh'),
  );
  if (chineseVoice) utterance.voice = chineseVoice;
  window.speechSynthesis.speak(utterance);
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
