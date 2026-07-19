import { useEffect, useRef, useState } from 'react';
import type {
  Capabilities,
  Gender,
  MediaGeneration,
  OutputMode,
  PublicSession,
  ScenarioBriefing,
  ScenarioId,
  ScenarioSummary,
  TranscriptEntry,
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
import { BrandLogo } from './components/BrandLogo.js';
import {
  GameStage,
  type VisualFrame,
} from './components/GameStage.js';
import { ModalitySettings } from './components/ModalitySettings.js';
import { ResultScreen } from './components/ResultScreen.js';
import { ScenarioSelect } from './components/ScenarioSelect.js';
import {
  hasOutput,
  loadModalities,
  saveModalities,
  toggleOutput,
  type ModalityPreferences,
  withOutput,
} from './modalities.js';
import {
  clearProgress,
  loadProgress,
  recordResult,
  saveProgress,
  withPreferredGender,
} from './progress.js';
import { defaultScenarioId } from './scenario-filters.js';
import {
  speakLine,
  startSpeechInput,
  stopSpeaking,
  supportsSpeechInput,
} from './speech.js';

type Screen = 'select' | 'briefing' | 'playing' | 'result';
const IMAGE_CLIENT_TIMEOUT_MS = 195_000;
const VIDEO_CLIENT_TIMEOUT_MS = 390_000;

export function App() {
  const [screen, setScreen] = useState<Screen>('select');
  const [scenarios, setScenarios] = useState<ScenarioSummary[] | null>(null);
  const [playerGender, setPlayerGender] = useState<Gender>('male');
  const [briefing, setBriefing] = useState<ScenarioBriefing | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<ScenarioId | null>(null);
  const [selectedBriefing, setSelectedBriefing] =
    useState<ScenarioBriefing | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [session, setSession] = useState<PublicSession | null>(null);
  const [progress, setProgress] = useState(loadProgress);
  const [draft, setDraft] = useState('');
  const [pendingLine, setPendingLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [speakingEntryId, setSpeakingEntryId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modalities, setModalities] = useState(loadModalities);
  const [mediaAccessKey, setMediaAccessKey] = useState('');
  const [mediaUnlocked, setMediaUnlocked] = useState(false);
  const [mediaByKey, setMediaByKey] = useState<
    Record<string, MediaGeneration>
  >({});
  const [mediaRetryRevision, setMediaRetryRevision] = useState(0);
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
        setSelectedScenarioId(defaultScenarioId(nextScenarios, progress));
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
    if (screen !== 'select' || !selectedScenarioId) return;
    let active = true;
    setPreviewLoading(true);
    setError(null);
    void getBriefing(selectedScenarioId, progress.preferredGender)
      .then((nextBriefing) => {
        if (active) setSelectedBriefing(nextBriefing);
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [progress.preferredGender, screen, selectedScenarioId]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [screen]);

  useEffect(() => {
    if (
      !session ||
      (!hasOutput(modalities, 'image') &&
        !hasOutput(modalities, 'video')) ||
      !mediaUnlocked ||
      !mediaAccessKey
    ) {
      return;
    }

    const beat = session.visualBeats.find((candidate, index) => {
      const candidateKey = mediaKey(
        session.state.sessionId,
        candidate.id,
        'image',
      );
      if (requestedMediaRef.current.has(candidateKey)) return false;
      return session.visualBeats
        .slice(0, index)
        .every((previous) => {
          const generation =
            mediaByKey[
              mediaKey(
                session.state.sessionId,
                previous.id,
                'image',
              )
            ];
          return (
            generation?.status === 'succeeded' ||
            generation?.status === 'failed'
          );
        });
    });
    if (!beat) return;

    const requestKey = mediaKey(
      session.state.sessionId,
      beat.id,
      'image',
    );
    requestedMediaRef.current.add(requestKey);

    const remember = (generation: MediaGeneration) => {
      if (!mountedRef.current) return;
      setMediaByKey((current) => ({
        ...current,
        [requestKey]: generation,
      }));
    };

    const poll = async (currentGeneration: MediaGeneration) => {
      try {
        const next = await getMediaGeneration(
          currentGeneration.id,
          mediaAccessKey,
        );
        if (
          (next.status === 'queued' || next.status === 'running') &&
          mediaTimedOut(next, IMAGE_CLIENT_TIMEOUT_MS)
        ) {
          remember(
            failedGeneration(
              next,
              '本轮形象生成超时，可以重新生成。',
            ),
          );
          return;
        }
        remember(next);
        if (next.status === 'queued' || next.status === 'running') {
          window.setTimeout(() => void poll(next), 1_500);
        }
      } catch {
        remember(
          failedGeneration(
            currentGeneration,
            '媒体任务已中断，可以重新生成。',
          ),
        );
      }
    };

    void createMediaGeneration(
      {
        sessionId: session.state.sessionId,
        beatId: beat.id,
        kind: 'image',
      },
      mediaAccessKey,
    )
      .then((generation) => {
        remember(generation);
        if (
          generation.status === 'queued' ||
          generation.status === 'running'
        ) {
          return poll(generation);
        }
      })
      .catch((mediaError: unknown) => {
        remember(
          failedMediaRequest(
            session.state.sessionId,
            beat.id,
            'image',
            capabilities?.imageGeneration === 'mock' ? 'mock' : 'ark',
            errorMessage(mediaError),
          ),
        );
      });
  }, [
    mediaAccessKey,
    mediaUnlocked,
    mediaRetryRevision,
    mediaByKey,
    modalities.outputs,
    capabilities?.imageGeneration,
    session,
  ]);

  useEffect(() => {
    if (
      !session ||
      session.state.phase !== 'result' ||
      !hasOutput(modalities, 'video') ||
      !mediaUnlocked ||
      !mediaAccessKey
    ) {
      return;
    }
    const finalBeat = session.visualBeats.at(-1);
    if (!finalBeat) return;
    const finalImage =
      mediaByKey[
        mediaKey(session.state.sessionId, finalBeat.id, 'image')
      ];
    if (
      !finalImage ||
      finalImage.status === 'queued' ||
      finalImage.status === 'running'
    ) {
      return;
    }

    const requestKey = mediaKey(
      session.state.sessionId,
      finalBeat.id,
      'video',
    );
    if (requestedMediaRef.current.has(requestKey)) return;
    requestedMediaRef.current.add(requestKey);

    const remember = (generation: MediaGeneration) => {
      if (!mountedRef.current) return;
      setMediaByKey((current) => ({
        ...current,
        [requestKey]: generation,
      }));
    };
    const poll = async (currentGeneration: MediaGeneration) => {
      try {
        const next = await getMediaGeneration(
          currentGeneration.id,
          mediaAccessKey,
        );
        if (
          (next.status === 'queued' || next.status === 'running') &&
          mediaTimedOut(next, VIDEO_CLIENT_TIMEOUT_MS)
        ) {
          remember(
            failedGeneration(
              next,
              '本局回忆生成超时，可以稍后重试。',
            ),
          );
          return;
        }
        remember(next);
        if (next.status === 'queued' || next.status === 'running') {
          window.setTimeout(() => void poll(next), 4_000);
        }
      } catch {
        remember(
          failedGeneration(
            currentGeneration,
            '回忆任务已中断，可以稍后重试。',
          ),
        );
      }
    };

    void createMediaGeneration(
      {
        sessionId: session.state.sessionId,
        beatId: finalBeat.id,
        kind: 'video',
      },
      mediaAccessKey,
    )
      .then((generation) => {
        remember(generation);
        if (
          generation.status === 'queued' ||
          generation.status === 'running'
        ) {
          return poll(generation);
        }
      })
      .catch((mediaError: unknown) => {
        remember(
          failedMediaRequest(
            session.state.sessionId,
            finalBeat.id,
            'video',
            capabilities?.videoGeneration === 'mock' ? 'mock' : 'ark',
            errorMessage(mediaError),
          ),
        );
      });
  }, [
    mediaAccessKey,
    mediaByKey,
    mediaUnlocked,
    modalities.outputs,
    capabilities?.videoGeneration,
    session,
  ]);

  function selectScenario(scenarioId: ScenarioId) {
    setSelectedScenarioId(scenarioId);
  }

  async function enterSelectedScenario() {
    if (!selectedScenarioId) return;
    setBusy(true);
    setError(null);
    stopSpeaking();
    try {
      const gender = progress.preferredGender;
      const nextBriefing =
        selectedBriefing?.id === selectedScenarioId &&
        selectedBriefing.player.gender === gender
          ? selectedBriefing
          : await getBriefing(selectedScenarioId, gender);
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
    stopSpeaking();
    try {
      const nextSession = await createSession(briefing.id, playerGender);
      setSession(nextSession);
      setScreen('playing');
      setDraft('');
      setPendingLine(null);
      setMediaByKey({});
      requestedMediaRef.current.clear();
      if (hasOutput(modalities, 'voice')) playSessionLine(nextSession);
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
      setPendingLine(null);
      if (hasOutput(modalities, 'voice')) {
        playSessionLine(result.session);
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
    setSpeakingEntryId(null);
    stopRecognitionRef.current?.();
    stopRecognitionRef.current = null;
    setRecording(false);
    setSession(null);
    setBriefing(null);
    setDraft('');
    setPendingLine(null);
    setError(null);
    setMediaByKey({});
    requestedMediaRef.current.clear();
    setScreen('select');
  }

  function resetProgress() {
    setProgress(clearProgress());
  }

  function toggleOutputMode(output: OutputMode) {
    const enabled = hasOutput(modalities, output);
    if (output === 'voice' && enabled) {
      stopSpeaking();
      setSpeakingEntryId(null);
    }
    updateModalities(toggleOutput(modalities, output));
    if (output === 'voice' && !enabled && session) {
      playSessionLine(session);
    }
  }

  function toggleTranscriptSpeech(entry: TranscriptEntry) {
    if (!session || entry.speaker !== 'character' || !entry.tone) return;
    if (speakingEntryId === entry.id) {
      stopSpeaking();
      setSpeakingEntryId(null);
      return;
    }
    setSpeakingEntryId(entry.id);
    void speakLine(
      entry.text,
      entry.tone,
      session.briefing.character.gender,
      session.state.sessionId,
      {
        onEnd: () => {
          if (!mountedRef.current) return;
          setSpeakingEntryId((current) =>
            current === entry.id ? null : current,
          );
        },
      },
    );
  }

  function playSessionLine(nextSession: PublicSession) {
    const entry = [...nextSession.transcript]
      .reverse()
      .find((candidate) => candidate.speaker === 'character');
    if (!entry?.tone) return;
    setSpeakingEntryId(entry.id);
    void speakLine(
      entry.text,
      entry.tone,
      nextSession.briefing.character.gender,
      nextSession.state.sessionId,
      {
        onEnd: () => {
          if (!mountedRef.current) return;
          setSpeakingEntryId((current) =>
            current === entry.id ? null : current,
          );
        },
      },
    );
  }

  function updateModalities(next: ModalityPreferences) {
    setModalities(next);
    saveModalities(next);
  }

  function retryImageGeneration(beatId: string) {
    if (!session) return;
    const requestKey = mediaKey(
      session.state.sessionId,
      beatId,
      'image',
    );
    requestedMediaRef.current.delete(requestKey);
    setMediaByKey((current) => {
      const next = { ...current };
      delete next[requestKey];
      return next;
    });
    setMediaRetryRevision((current) => current + 1);
  }

  async function unlockMedia(
    accessKey: string,
    output: 'image' | 'video',
  ) {
    await verifyMediaAccess(accessKey);
    setMediaAccessKey(accessKey);
    setMediaUnlocked(true);
    updateModalities(withOutput(modalities, output));
  }

  if (!scenarios) {
    return (
      <main className="loading-screen">
        <span className="loading-mark">
          <BrandLogo compact />
        </span>
        <p>{error ?? '正在整理八关目录…'}</p>
        {error && (
          <button type="button" onClick={() => window.location.reload()}>
            重新连接
          </button>
        )}
      </main>
    );
  }

  const latestBeat = session?.visualBeats.at(-1) ?? null;
  const visualFrames: VisualFrame[] =
    session?.visualBeats.map((beat) => ({
      beat,
      generation:
        mediaByKey[
          mediaKey(session.state.sessionId, beat.id, 'image')
        ] ?? null,
    })) ?? [];
  const latestImage =
    session &&
    latestBeat &&
    (hasOutput(modalities, 'image') ||
      hasOutput(modalities, 'video'))
      ? (mediaByKey[
          mediaKey(session.state.sessionId, latestBeat.id, 'image')
        ] ?? null)
      : null;
  const memoryVideo =
    session &&
    latestBeat &&
    hasOutput(modalities, 'video') &&
    session.state.phase === 'result'
      ? (mediaByKey[
          mediaKey(session.state.sessionId, latestBeat.id, 'video')
        ] ?? null)
      : null;

  let content;
  if (screen === 'result' && session) {
    content = (
      <ResultScreen
        session={session}
        outputModes={modalities.outputs}
        visualBeat={latestBeat}
        imageGeneration={latestImage}
        memoryVideoGeneration={memoryVideo}
        replaying={busy}
        onReplay={beginGame}
        onBackToLevels={returnToLevels}
      />
    );
  } else if (screen === 'playing' && session) {
    content = (
      <GameStage
        session={session}
        draft={draft}
        pendingLine={pendingLine}
        busy={busy}
        error={error}
        outputModes={modalities.outputs}
        visualFrames={visualFrames}
        recording={recording}
        speechInputSupported={speechInputSupported}
        speakingEntryId={speakingEntryId}
        onDraftChange={setDraft}
        onSubmit={submitLine}
        onToggleRecording={toggleRecording}
        onToggleSpeech={toggleTranscriptSpeech}
        onRetryImage={retryImageGeneration}
        onOpenSettings={() => setSettingsOpen(true)}
        onExit={returnToLevels}
      />
    );
  } else if (screen === 'briefing' && briefing) {
    content = (
      <>
        <Briefing
          briefing={briefing}
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
        selectedScenarioId={selectedScenarioId ?? scenarios[0].id}
        selectedBriefing={selectedBriefing}
        previewLoading={previewLoading}
        busy={busy}
        error={error}
        onSelect={selectScenario}
        onEnter={enterSelectedScenario}
        onOpenSettings={() => setSettingsOpen(true)}
        onClearProgress={resetProgress}
      />
    );
  }

  return (
    <>
      {content}
      {screen === 'briefing' && (
        <button
          className="settings-trigger settings-trigger--icon"
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="打开互动设置"
          data-testid="open-modality-settings"
        >
          <SettingsIcon />
        </button>
      )}
      <ModalitySettings
        open={settingsOpen}
        capabilities={capabilities}
        preferences={modalities}
        speechInputSupported={speechInputSupported}
        mediaUnlocked={mediaUnlocked}
        onOutputToggle={toggleOutputMode}
        onUnlockMedia={unlockMedia}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
    </svg>
  );
}

function mediaKey(
  sessionId: string,
  beatId: string,
  output: 'image' | 'video',
): string {
  return `${sessionId}:${beatId}:${output}`;
}

function mediaTimedOut(
  generation: MediaGeneration,
  timeoutMs: number,
): boolean {
  return Date.now() - Date.parse(generation.createdAt) >= timeoutMs;
}

function failedGeneration(
  generation: MediaGeneration,
  message: string,
): MediaGeneration {
  return {
    ...generation,
    status: 'failed',
    error: message,
    updatedAt: new Date().toISOString(),
  };
}

function failedMediaRequest(
  sessionId: string,
  beatId: string,
  kind: 'image' | 'video',
  provider: 'mock' | 'ark',
  message: string,
): MediaGeneration {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    sessionId,
    beatId,
    kind,
    status: 'failed',
    url: null,
    error: message,
    provider,
    model: 'request-failed',
    usageTokens: null,
    createdAt: now,
    updatedAt: now,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '现场出现了一个意外，请重试。';
}
