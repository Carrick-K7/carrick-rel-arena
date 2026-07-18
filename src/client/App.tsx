import { useEffect, useRef, useState } from 'react';
import type {
  Capabilities,
  Gender,
  PublicSession,
  ScenarioBriefing,
  ScenarioId,
  ScenarioSummary,
} from '../shared/contracts.js';
import {
  ApiError,
  createSession,
  getBriefing,
  getCapabilities,
  getScenarios,
  playTurn,
} from './api.js';
import { Briefing } from './components/Briefing.js';
import { GameStage } from './components/GameStage.js';
import { ResultScreen } from './components/ResultScreen.js';
import { ScenarioSelect } from './components/ScenarioSelect.js';
import {
  clearProgress,
  loadProgress,
  recordResult,
  saveProgress,
  withPreferredGender,
} from './progress.js';
import {
  speakLine,
  startSpeechInput,
  stopSpeaking,
  supportsSpeechInput,
} from './speech.js';

type Screen = 'select' | 'briefing' | 'playing' | 'result';

export function App() {
  const [screen, setScreen] = useState<Screen>('select');
  const [scenarios, setScenarios] = useState<ScenarioSummary[] | null>(null);
  const [playerGender, setPlayerGender] = useState<Gender>('male');
  const [briefing, setBriefing] = useState<ScenarioBriefing | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [session, setSession] = useState<PublicSession | null>(null);
  const [progress, setProgress] = useState(loadProgress);
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
    Promise.all([getScenarios(), getCapabilities()])
      .then(([nextScenarios, nextCapabilities]) => {
        if (!active) return;
        setScenarios(nextScenarios);
        setCapabilities(nextCapabilities);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(errorMessage(loadError));
      });
    return () => {
      active = false;
      stopSpeaking();
      stopRecognitionRef.current?.();
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [screen]);

  async function selectScenario(scenarioId: ScenarioId) {
    setBusy(true);
    setError(null);
    stopSpeaking();
    try {
      const gender = progress.preferredGender;
      const nextBriefing = await getBriefing(scenarioId, gender);
      setPlayerGender(gender);
      setBriefing(nextBriefing);
      setSession(null);
      setScreen('briefing');
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setBusy(false);
    }
  }

  async function changePlayerGender(gender: Gender) {
    if (!briefing || busy) return;
    setBusy(true);
    setError(null);
    setPlayerGender(gender);
    setProgress((current) => {
      const next = withPreferredGender(current, gender);
      saveProgress(next);
      return next;
    });
    try {
      setBriefing(await getBriefing(briefing.id, gender));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setBusy(false);
    }
  }

  async function beginGame() {
    if (!briefing) return;
    setBusy(true);
    setError(null);
    setDirectorSummary(null);
    stopSpeaking();
    try {
      const nextSession = await createSession(briefing.id, playerGender);
      setSession(nextSession);
      setScreen('playing');
      setDraft('');
      setPendingLine(null);
      if (voiceEnabled) speakSessionLine(nextSession);
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
      if (voiceEnabled) speakSessionLine(result.session);
      if (
        result.session.state.phase === 'result' &&
        result.session.verdict
      ) {
        const verdict = result.session.verdict;
        setProgress((current) => {
          const next = recordResult(current, {
            scenarioId: result.session.state.scenarioId,
            gender: result.session.state.playerGender,
            score: verdict.score,
            tier: verdict.tier,
            endingId: verdict.endingId,
          });
          saveProgress(next);
          return next;
        });
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
      speakSessionLine(session);
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

  function returnToLevels() {
    stopSpeaking();
    stopRecognitionRef.current?.();
    stopRecognitionRef.current = null;
    setRecording(false);
    setSession(null);
    setBriefing(null);
    setDraft('');
    setPendingLine(null);
    setDirectorSummary(null);
    setError(null);
    setScreen('select');
  }

  function resetProgress() {
    setProgress(clearProgress());
  }

  if (!scenarios) {
    return (
      <main className="loading-screen">
        <span className="loading-mark">修</span>
        <p>{error ?? '正在整理八关目录…'}</p>
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
        onBackToLevels={returnToLevels}
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
        onExit={returnToLevels}
      />
    );
  }

  if (screen === 'briefing' && briefing) {
    return (
      <>
        <Briefing
          briefing={briefing}
          capabilities={capabilities}
          playerGender={playerGender}
          starting={busy}
          onPlayerGenderChange={changePlayerGender}
          onBack={returnToLevels}
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

  return (
    <ScenarioSelect
      scenarios={scenarios}
      progress={progress}
      capabilities={capabilities}
      busy={busy}
      error={error}
      onSelect={selectScenario}
      onClearProgress={resetProgress}
    />
  );
}

function speakSessionLine(session: PublicSession) {
  void speakLine(
    session.lastPerformance.line,
    session.lastPerformance.tone,
    session.briefing.character.gender,
    session.state.sessionId,
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '现场出现了一个意外，请重试。';
}

function readVoicePreference(): boolean {
  try {
    return localStorage.getItem('relationship-training:voice') !== 'off';
  } catch {
    return true;
  }
}

function writeVoicePreference(enabled: boolean) {
  try {
    localStorage.setItem(
      'relationship-training:voice',
      enabled ? 'on' : 'off',
    );
  } catch {
    // The preference stays in memory when storage is unavailable.
  }
}
