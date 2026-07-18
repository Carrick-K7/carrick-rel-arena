import { useEffect, useRef, useState } from 'react';
import type {
  Capabilities,
  Gender,
  InputMode,
  MediaGeneration,
  OutputMode,
  PublicSession,
  ScenarioBriefing,
  ScenarioId,
  ScenarioSummary,
} from '../shared/contracts.js';
import {
  ApiError,
  createMediaGeneration,
  createSession,
  getBriefing,
  getCapabilities,
  getMediaGeneration,
  getScenarios,
  playTurn,
  verifyMediaAccess,
} from './api.js';
import { Briefing } from './components/Briefing.js';
import { GameStage } from './components/GameStage.js';
import { ModalitySettings } from './components/ModalitySettings.js';
import { ResultScreen } from './components/ResultScreen.js';
import { ScenarioSelect } from './components/ScenarioSelect.js';
import {
  loadModalities,
  saveModalities,
  type ModalityPreferences,
} from './modalities.js';
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
interface DisplayedMedia {
  key: string;
  kind: 'image' | 'video';
  title: string;
}

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalities, setModalities] = useState(loadModalities);
  const [mediaAccessKey, setMediaAccessKey] = useState('');
  const [mediaUnlocked, setMediaUnlocked] = useState(false);
  const [mediaByKey, setMediaByKey] = useState<
    Record<string, MediaGeneration>
  >({});
  const [displayedMedia, setDisplayedMedia] =
    useState<DisplayedMedia | null>(null);
  const stopRecognitionRef = useRef<(() => void) | null>(null);
  const requestedMediaRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const speechInputSupported =
    typeof window !== 'undefined' && supportsSpeechInput();

  useEffect(() => {
    mountedRef.current = true;
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
      mountedRef.current = false;
      stopSpeaking();
      stopRecognitionRef.current?.();
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [screen]);

  useEffect(() => {
    const cue = session?.state.activeEvent?.videoCue;
    const output = modalities.output;
    if (
      !session ||
      !cue ||
      (output !== 'image' && output !== 'video') ||
      !mediaUnlocked ||
      !mediaAccessKey
    ) {
      return;
    }

    const requestKey = mediaKey(
      session.state.sessionId,
      cue.hookId,
      output,
    );
    if (requestedMediaRef.current.has(requestKey)) {
      return;
    }
    requestedMediaRef.current.add(requestKey);
    setDisplayedMedia({
      key: requestKey,
      kind: output,
      title: session.state.activeEvent?.title ?? session.briefing.title,
    });

    const remember = (generation: MediaGeneration) => {
      if (!mountedRef.current) return;
      setMediaByKey((current) => ({
        ...current,
        [requestKey]: generation,
      }));
    };

    const poll = async (generationId: string) => {
      try {
        const next = await getMediaGeneration(
          generationId,
          mediaAccessKey,
        );
        remember(next);
        if (next.status === 'queued' || next.status === 'running') {
          window.setTimeout(
            () => void poll(generationId),
            output === 'video' ? 4_000 : 1_500,
          );
        }
      } catch (mediaError) {
        if (mountedRef.current) setError(errorMessage(mediaError));
      }
    };

    void createMediaGeneration(
      {
        sessionId: session.state.sessionId,
        hookId: cue.hookId,
        kind: output,
      },
      mediaAccessKey,
    )
      .then((generation) => {
        remember(generation);
        if (
          generation.status === 'queued' ||
          generation.status === 'running'
        ) {
          return poll(generation.id);
        }
      })
      .catch((mediaError: unknown) => {
        if (mountedRef.current) setError(errorMessage(mediaError));
      });
  }, [
    mediaAccessKey,
    mediaUnlocked,
    modalities.output,
    session,
  ]);

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
      setMediaByKey({});
      setDisplayedMedia(null);
      requestedMediaRef.current.clear();
      if (modalities.output === 'voice') speakSessionLine(nextSession);
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
      if (modalities.output === 'voice') {
        speakSessionLine(result.session);
      }
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
    setMediaByKey({});
    setDisplayedMedia(null);
    requestedMediaRef.current.clear();
    setScreen('select');
  }

  function resetProgress() {
    setProgress(clearProgress());
  }

  function changeInputMode(input: InputMode) {
    if (input === 'text' && recording) {
      stopRecognitionRef.current?.();
      stopRecognitionRef.current = null;
      setRecording(false);
    }
    updateModalities({ ...modalities, input });
  }

  function changeOutputMode(output: OutputMode) {
    if (output !== 'voice') stopSpeaking();
    updateModalities({ ...modalities, output });
    if (output === 'voice' && session) {
      speakSessionLine(session);
    }
  }

  function updateModalities(next: ModalityPreferences) {
    setModalities(next);
    saveModalities(next);
  }

  async function unlockMedia(
    accessKey: string,
    output: 'image' | 'video',
  ) {
    await verifyMediaAccess(accessKey);
    setMediaAccessKey(accessKey);
    setMediaUnlocked(true);
    updateModalities({ ...modalities, output });
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

  const activeMedia =
    displayedMedia &&
    modalities.output === displayedMedia.kind
      ? (mediaByKey[displayedMedia.key] ?? null)
      : null;

  let content;
  if (screen === 'result' && session) {
    content = (
      <ResultScreen
        session={session}
        outputMode={modalities.output}
        mediaGeneration={activeMedia}
        mediaTitle={displayedMedia?.title ?? null}
        replaying={busy}
        onReplay={beginGame}
        onBackToLevels={returnToLevels}
      />
    );
  } else if (screen === 'playing' && session) {
    content = (
      <GameStage
        session={session}
        capabilities={capabilities}
        draft={draft}
        pendingLine={pendingLine}
        busy={busy}
        error={error}
        directorSummary={directorSummary}
        inputMode={modalities.input}
        outputMode={modalities.output}
        mediaGeneration={activeMedia}
        mediaTitle={displayedMedia?.title ?? null}
        recording={recording}
        speechInputSupported={speechInputSupported}
        onDraftChange={setDraft}
        onSubmit={submitLine}
        onToggleRecording={toggleRecording}
        onOpenSettings={() => setSettingsOpen(true)}
        onExit={returnToLevels}
      />
    );
  } else if (screen === 'briefing' && briefing) {
    content = (
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
  } else {
    content = (
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

  return (
    <>
      {content}
      <button
        className="settings-trigger"
        type="button"
        onClick={() => setSettingsOpen(true)}
        aria-label="打开模态设置"
        data-testid="open-modality-settings"
      >
        <span>设置</span>
        <small>{outputModeLabel(modalities.output)}输出</small>
      </button>
      <ModalitySettings
        open={settingsOpen}
        capabilities={capabilities}
        preferences={modalities}
        speechInputSupported={speechInputSupported}
        mediaUnlocked={mediaUnlocked}
        onInputChange={changeInputMode}
        onOutputChange={changeOutputMode}
        onUnlockMedia={unlockMedia}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

function mediaKey(
  sessionId: string,
  hookId: string,
  output: 'image' | 'video',
): string {
  return `${sessionId}:${hookId}:${output}`;
}

function outputModeLabel(output: OutputMode): string {
  return {
    text: '文字',
    voice: '语音',
    image: '图像',
    video: '视频',
  }[output];
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
