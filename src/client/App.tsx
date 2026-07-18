import { useEffect, useRef, useState } from 'react';
import type {
  Capabilities,
  Gender,
  PublicSession,
  ScenarioBriefing,
} from '../shared/contracts.js';
import {
  ApiError,
  createSession,
  getBriefing,
  getCapabilities,
  playTurn,
} from './api.js';
import { Briefing } from './components/Briefing.js';
import { GameStage } from './components/GameStage.js';
import { ResultScreen } from './components/ResultScreen.js';
import {
  speakLine,
  startSpeechInput,
  stopSpeaking,
  supportsSpeechInput,
} from './speech.js';

type Screen = 'briefing' | 'playing' | 'result';

export function App() {
  const [screen, setScreen] = useState<Screen>('briefing');
  const [playerGender, setPlayerGender] = useState<Gender>('male');
  const [briefings, setBriefings] = useState<Record<
    Gender,
    ScenarioBriefing
  > | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [session, setSession] = useState<PublicSession | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingLine, setPendingLine] = useState<string | null>(null);
  const [directorSummary, setDirectorSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(readVoicePreference);
  const stopRecognitionRef = useRef<(() => void) | null>(null);
  const speechInputSupported =
    typeof window !== 'undefined' && supportsSpeechInput();

  useEffect(() => {
    let active = true;
    Promise.all([
      getBriefing('male'),
      getBriefing('female'),
      getCapabilities(),
    ])
      .then(([maleBriefing, femaleBriefing, nextCapabilities]) => {
        if (!active) return;
        setBriefings({
          male: maleBriefing,
          female: femaleBriefing,
        });
        setCapabilities(nextCapabilities);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : '关卡简报加载失败。',
        );
      });
    return () => {
      active = false;
      stopSpeaking();
      stopRecognitionRef.current?.();
    };
  }, []);

  const briefing = briefings?.[playerGender] ?? null;

  async function beginGame() {
    setBusy(true);
    setError(null);
    setDirectorSummary(null);
    stopSpeaking();
    try {
      const nextSession = await createSession(playerGender);
      setSession(nextSession);
      setScreen('playing');
      setDraft('');
      setPendingLine(null);
      if (voiceEnabled) {
        void speakLine(
          nextSession.lastPerformance.line,
          nextSession.lastPerformance.tone,
          nextSession.briefing.character.gender,
          nextSession.state.sessionId,
        );
      }
    } catch (startError) {
      setError(errorMessage(startError));
    } finally {
      setBusy(false);
    }
  }

  async function submitLine() {
    if (!session || busy) return;
    const text = draft.trim();
    if (!text) return;

    setBusy(true);
    setError(null);
    setPendingLine(text);
    setDraft('');
    stopSpeaking();

    try {
      const result = await playTurn(session.state.sessionId, text);
      setSession(result.session);
      setDirectorSummary(result.directorSummary);
      setPendingLine(null);
      if (voiceEnabled) {
        void speakLine(
          result.session.lastPerformance.line,
          result.session.lastPerformance.tone,
          result.session.briefing.character.gender,
          result.session.state.sessionId,
        );
      }
      if (result.session.state.phase === 'result') {
        setScreen('result');
      }
    } catch (turnError) {
      setError(errorMessage(turnError));
      setDraft(text);
      setPendingLine(null);
    } finally {
      setBusy(false);
    }
  }

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    writeVoicePreference(next);
    if (!next) {
      stopSpeaking();
    } else if (session) {
      void speakLine(
        session.lastPerformance.line,
        session.lastPerformance.tone,
        session.briefing.character.gender,
        session.state.sessionId,
      );
    }
  }

  function toggleRecording() {
    if (recording) {
      stopRecognitionRef.current?.();
      stopRecognitionRef.current = null;
      setRecording(false);
      return;
    }
    setRecording(true);
    stopRecognitionRef.current = startSpeechInput(
      (text) => setDraft(text.slice(0, 240)),
      () => {
        setRecording(false);
        stopRecognitionRef.current = null;
      },
    );
  }

  if (!briefing) {
    return (
      <main className="loading-screen">
        <span className="loading-mark">修</span>
        <p>{error ?? '正在布置凌晨一点的玄关…'}</p>
        {error && (
          <button type="button" onClick={() => window.location.reload()}>
            重新连接
          </button>
        )}
      </main>
    );
  }

  if (screen === 'result' && session) {
    return (
      <ResultScreen
        session={session}
        replaying={busy}
        onReplay={beginGame}
      />
    );
  }

  if (screen === 'playing' && session) {
    return (
      <GameStage
        session={session}
        capabilities={capabilities}
        draft={draft}
        pendingLine={pendingLine}
        busy={busy}
        error={error}
        directorSummary={directorSummary}
        voiceEnabled={voiceEnabled}
        recording={recording}
        speechInputSupported={speechInputSupported}
        onDraftChange={setDraft}
        onSubmit={submitLine}
        onToggleVoice={toggleVoice}
        onToggleRecording={toggleRecording}
      />
    );
  }

  return (
    <>
      <Briefing
        briefing={briefing}
        capabilities={capabilities}
        playerGender={playerGender}
        starting={busy}
        onPlayerGenderChange={setPlayerGender}
        onStart={beginGame}
      />
      {error && (
        <p className="briefing-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '现场出现了一个意外，请重试。';
}

function readVoicePreference(): boolean {
  try {
    return localStorage.getItem('relationship-arena:voice') !== 'off';
  } catch {
    return true;
  }
}

function writeVoicePreference(enabled: boolean) {
  try {
    localStorage.setItem(
      'relationship-arena:voice',
      enabled ? 'on' : 'off',
    );
  } catch {
    // The preference stays in memory when storage is unavailable.
  }
}
