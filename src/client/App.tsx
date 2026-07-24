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
  getSession,
  playTurn,
  verifyMediaAccess,
} from './api.js';
import {
  artifactRunsForScenario,
  clearArtifactLibrary,
  loadArtifactLibrary,
  recordArtifactRun,
  saveArtifactLibrary,
} from './artifacts.js';
import { ArtifactLibraryScreen } from './components/ArtifactLibraryScreen.js';
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
import {
  initializeAppHistory,
  readAppRoute,
  returnToAppRoot,
  writeAppRoute,
  type AppRoute,
} from './routing.js';
import { defaultScenarioId } from './scenario-filters.js';
import {
  speakLine,
  startSpeechInput,
  stopSpeaking,
  supportsSpeechInput,
} from './speech.js';

type Screen =
  | 'select'
  | 'briefing'
  | 'playing'
  | 'result'
  | 'archive';
const IMAGE_CLIENT_TIMEOUT_MS = 195_000;
const VIDEO_CLIENT_TIMEOUT_MS = 630_000;
const MAX_CONCURRENT_IMAGE_GENERATIONS = 3;

export function App() {
  const initialRouteRef = useRef<AppRoute | null>(readAppRoute());
  const [screen, setScreen] = useState<Screen>(
    initialRouteRef.current?.screen ?? 'select',
  );
  const [routeLoading, setRouteLoading] = useState(
    initialRouteRef.current?.screen !== undefined &&
      initialRouteRef.current.screen !== 'select',
  );
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
  const [artifactLibrary, setArtifactLibrary] = useState(
    loadArtifactLibrary,
  );
  const [archiveScenarioId, setArchiveScenarioId] =
    useState<ScenarioId | null>(null);
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
  const artifactRunIdsRef = useRef(new Map<string, string>());
  const routeRestoreRef = useRef(0);
  const mountedRef = useRef(true);
  const speechInputSupported =
    typeof window !== 'undefined' && supportsSpeechInput();

  useEffect(() => {
    mountedRef.current = true;
    initializeAppHistory();
    let active = true;
    Promise.all([getScenarios(), getCapabilities()])
      .then(([nextScenarios, nextCapabilities]) => {
        if (!active) return;
        setScenarios(nextScenarios);
        setCapabilities(nextCapabilities);
        const route = readAppRoute();
        if (!route) {
          writeAppRoute({ screen: 'select' }, { replace: true });
        }
        void restoreRoute(
          route ?? { screen: 'select' },
          nextScenarios,
        );
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
    if (!scenarios) return;
    const handlePopState = () => {
      const route = readAppRoute();
      if (!route) {
        writeAppRoute({ screen: 'select' }, { replace: true });
      }
      void restoreRoute(route ?? { screen: 'select' }, scenarios);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [progress.preferredGender, scenarios]);

  useEffect(() => {
    if (screen !== 'select' || !selectedScenarioId) return;
    let active = true;
    setPreviewLoading(true);
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
    if (screen === 'briefing' && briefing) {
      document.title = `${briefing.title} · 关系修炼`;
      return;
    }
    if ((screen === 'playing' || screen === 'result') && session) {
      document.title =
        screen === 'result'
          ? `${session.verdict?.title ?? '结算'} · 关系修炼`
          : `${session.briefing.title} · 对话`;
      return;
    }
    if (screen === 'archive' && archiveScenarioId && scenarios) {
      const scenario = scenarios.find(
        (candidate) => candidate.id === archiveScenarioId,
      );
      document.title = `${scenario?.title ?? '章节'}回忆 · 关系修炼`;
      return;
    }
    document.title = '关系修炼 · 八段关系对话挑战';
  }, [archiveScenarioId, briefing, scenarios, screen, session]);

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

    const activeImageCount = Object.values(mediaByKey).filter(
      (generation) =>
        generation.sessionId === session.state.sessionId &&
        generation.kind === 'image' &&
        (generation.status === 'queued' ||
          generation.status === 'running'),
    ).length;
    if (activeImageCount >= MAX_CONCURRENT_IMAGE_GENERATIONS) return;

    const beat = session.visualBeats.find((candidate) => {
      const candidateKey = mediaKey(
        session.state.sessionId,
        candidate.id,
        'image',
      );
      return !requestedMediaRef.current.has(candidateKey);
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
      !session.verdict
    ) {
      return;
    }
    const images = session.visualBeats.flatMap((beat) => {
      const generation =
        mediaByKey[
          mediaKey(session.state.sessionId, beat.id, 'image')
        ];
      if (generation?.status !== 'succeeded' || !generation.url) {
        return [];
      }
      return [
        {
          id: generation.id,
          round: beat.round,
          label:
            beat.round === 0
              ? '开场'
              : beat.kind === 'ending'
                ? `第 ${beat.round} 轮 · 结局`
                : `第 ${beat.round} 轮`,
          url: generation.url,
          provider: generation.provider,
        },
      ];
    });
    const finalBeat = session.visualBeats.at(-1);
    const videoGeneration = finalBeat
      ? mediaByKey[
          mediaKey(
            session.state.sessionId,
            finalBeat.id,
            'video',
          )
        ]
      : null;
    const video =
      videoGeneration?.status === 'succeeded' &&
      videoGeneration.url
        ? {
            id: videoGeneration.id,
            url: videoGeneration.url,
            provider: videoGeneration.provider,
          }
        : null;
    if (images.length === 0 && !video) return;

    let archiveId = artifactRunIdsRef.current.get(
      session.state.sessionId,
    );
    if (!archiveId) {
      archiveId =
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `archive-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2)}`;
      artifactRunIdsRef.current.set(
        session.state.sessionId,
        archiveId,
      );
    }
    const now = new Date().toISOString();
    const verdict = session.verdict;
    setArtifactLibrary((current) => {
      const next = recordArtifactRun(current, {
        id: archiveId,
        scenarioId: session.state.scenarioId,
        scenarioTitle: session.briefing.title,
        playerGender: session.state.playerGender,
        playerName: session.briefing.player.name,
        characterName: session.briefing.character.name,
        tier: verdict.tier,
        endingTitle:
          session.state.activeEvent?.title ?? verdict.title,
        completedAt: now,
        updatedAt: now,
        images,
        video,
      });
      saveArtifactLibrary(next);
      return next;
    });
  }, [mediaByKey, session]);

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

  async function restoreRoute(
    route: AppRoute,
    availableScenarios: ScenarioSummary[],
  ) {
    const restoreId = routeRestoreRef.current + 1;
    routeRestoreRef.current = restoreId;
    stopSpeaking();
    setSpeakingEntryId(null);
    setSettingsOpen(false);
    setError(null);

    if (route.screen === 'select') {
      setScreen('select');
      setBriefing(null);
      setArchiveScenarioId(null);
      setSelectedScenarioId((current) =>
        current && availableScenarios.some(({ id }) => id === current)
          ? current
          : defaultScenarioId(availableScenarios, progress),
      );
      setRouteLoading(false);
      return;
    }

    if (route.screen === 'archive') {
      setSelectedScenarioId(route.scenarioId);
      setArchiveScenarioId(route.scenarioId);
      setBriefing(null);
      setScreen('archive');
      setRouteLoading(false);
      return;
    }

    setRouteLoading(true);
    try {
      if (route.screen === 'briefing') {
        const gender = progress.preferredGender;
        const nextBriefing = await getBriefing(
          route.scenarioId,
          gender,
        );
        if (routeRestoreRef.current !== restoreId) return;
        setSelectedScenarioId(route.scenarioId);
        setPlayerGender(gender);
        setBriefing(nextBriefing);
        setArchiveScenarioId(null);
        setSession(null);
        setScreen('briefing');
        return;
      }

      const nextSession = await getSession(route.sessionId);
      if (routeRestoreRef.current !== restoreId) return;
      const actualScreen =
        nextSession.state.phase === 'result' ? 'result' : 'playing';
      setSelectedScenarioId(nextSession.state.scenarioId);
      setPlayerGender(nextSession.state.playerGender);
      setBriefing(nextSession.briefing);
      setArchiveScenarioId(null);
      setSession(nextSession);
      setDraft('');
      setPendingLine(null);
      setScreen(actualScreen);
      if (route.screen !== actualScreen) {
        writeAppRoute(
          {
            screen: actualScreen,
            sessionId: nextSession.state.sessionId,
          },
          { replace: true },
        );
      }
    } catch (routeError) {
      if (routeRestoreRef.current !== restoreId) return;
      setError(
        routeError instanceof ApiError &&
          (routeError.status === 404 || routeError.status === 410)
          ? '这段对话已经结束或过期，请重新选择场景。'
          : errorMessage(routeError),
      );
      setScreen('select');
      setBriefing(null);
      setArchiveScenarioId(null);
      setSession(null);
      setSelectedScenarioId(
        defaultScenarioId(availableScenarios, progress),
      );
      writeAppRoute({ screen: 'select' }, { replace: true });
    } finally {
      if (routeRestoreRef.current === restoreId) {
        setRouteLoading(false);
      }
    }
  }

  function selectScenario(scenarioId: ScenarioId) {
    setError(null);
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
      writeAppRoute({
        screen: 'briefing',
        scenarioId: selectedScenarioId,
      });
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
      writeAppRoute({
        screen: 'playing',
        sessionId: nextSession.state.sessionId,
      });
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
        writeAppRoute(
          {
            screen: 'result',
            sessionId: result.session.state.sessionId,
          },
          { replace: true },
        );
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
    const keepsImages =
      session?.state.phase === 'result' &&
      mediaUnlocked &&
      (hasOutput(modalities, 'image') ||
        hasOutput(modalities, 'video')) &&
      session.visualBeats.some((beat) => {
        const generation =
          mediaByKey[
            mediaKey(session.state.sessionId, beat.id, 'image')
          ];
        return (
          !generation ||
          generation.status === 'queued' ||
          generation.status === 'running'
        );
      });
    const finalBeat = session?.visualBeats.at(-1);
    const finalVideo =
      session && finalBeat
        ? mediaByKey[
            mediaKey(
              session.state.sessionId,
              finalBeat.id,
              'video',
            )
          ]
        : null;
    const keepsVideo =
      session?.state.phase === 'result' &&
      mediaUnlocked &&
      hasOutput(modalities, 'video') &&
      (!finalVideo ||
        finalVideo.status === 'queued' ||
        finalVideo.status === 'running');
    const keepGenerating = keepsImages || keepsVideo;
    if (!keepGenerating) {
      setSession(null);
      setMediaByKey({});
      requestedMediaRef.current.clear();
    }
    setDraft('');
    setPendingLine(null);
    setError(null);
    if (returnToAppRoot()) return;
    setBriefing(null);
    setScreen('select');
  }

  function resetProgress() {
    setProgress(clearProgress());
    setArtifactLibrary(clearArtifactLibrary());
    setSession(null);
    setMediaByKey({});
    requestedMediaRef.current.clear();
    artifactRunIdsRef.current.clear();
  }

  function openArtifactLibrary(scenarioId: ScenarioId) {
    setArchiveScenarioId(scenarioId);
    setScreen('archive');
    writeAppRoute({ screen: 'archive', scenarioId });
    window.scrollTo({ top: 0, left: 0 });
  }

  function closeArtifactLibrary() {
    if (returnToAppRoot()) return;
    setArchiveScenarioId(null);
    setScreen('select');
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

  if (!scenarios || routeLoading) {
    return (
      <main className="loading-screen">
        <span className="loading-mark">
          <BrandLogo compact />
        </span>
        <p>
          {error ??
            (routeLoading ? '正在恢复当前页面…' : '正在整理八关目录…')}
        </p>
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
  const memoryVideo =
    session &&
    latestBeat &&
    hasOutput(modalities, 'video') &&
    session.state.phase === 'result'
      ? (mediaByKey[
          mediaKey(session.state.sessionId, latestBeat.id, 'video')
        ] ?? null)
      : null;
  const artifactCounts = Object.fromEntries(
    scenarios.map((scenario) => [
      scenario.id,
      artifactRunsForScenario(artifactLibrary, scenario.id).length,
    ]),
  ) as Partial<Record<ScenarioId, number>>;

  let content;
  if (screen === 'archive' && archiveScenarioId) {
    const archiveScenario = scenarios.find(
      (scenario) => scenario.id === archiveScenarioId,
    );
    content = (
      <ArtifactLibraryScreen
        scenarioTitle={archiveScenario?.title ?? '章节回忆'}
        runs={artifactRunsForScenario(
          artifactLibrary,
          archiveScenarioId,
        )}
        onBack={closeArtifactLibrary}
      />
    );
  } else if (screen === 'result' && session) {
    content = (
      <ResultScreen
        session={session}
        outputModes={modalities.outputs}
        visualFrames={visualFrames}
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
        artifactCounts={artifactCounts}
        onSelect={selectScenario}
        onEnter={enterSelectedScenario}
        onOpenArtifacts={openArtifactLibrary}
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
