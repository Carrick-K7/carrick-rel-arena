import { useEffect, useRef, useState } from 'react';
import type {
  ActorPerformance,
  MediaGeneration,
  OutputMode,
  PublicSession,
  TranscriptEntry,
  VisualBeat,
} from '../../shared/contracts.js';
import {
  relationshipProgress,
  relationshipProgressLabel,
} from '../relationship-progress.js';
import { BrandLogo } from './BrandLogo.js';
import { GenerationProgress } from './GenerationProgress.js';
import { MemoryFrame } from './MemoryFrame.js';
import { Portrait } from './Portrait.js';

export interface VisualFrame {
  beat: VisualBeat;
  generation: MediaGeneration | null;
}

interface GameStageProps {
  session: PublicSession;
  draft: string;
  pendingLine: string | null;
  busy: boolean;
  error: string | null;
  outputModes: OutputMode[];
  mediaUnlocked: boolean;
  visualFrames: VisualFrame[];
  recording: boolean;
  speechInputSupported: boolean;
  speakingEntryId: string | null;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onToggleRecording: () => void;
  onToggleSpeech: (entry: TranscriptEntry) => void;
  onRetryImage: (beatId: string) => void;
  onOpenSettings: () => void;
  onExit: () => void;
}

export function GameStage({
  session,
  draft,
  pendingLine,
  busy,
  error,
  outputModes,
  mediaUnlocked,
  visualFrames,
  recording,
  speechInputSupported,
  speakingEntryId,
  onDraftChange,
  onSubmit,
  onToggleRecording,
  onToggleSpeech,
  onRetryImage,
  onOpenSettings,
  onExit,
}: GameStageProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const { state, briefing } = session;
  const progress = relationshipProgress(state.metrics);
  const progressLabel = relationshipProgressLabel(progress);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(136, Math.max(28, textarea.scrollHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 136 ? 'auto' : 'hidden';
  }, [draft]);

  useEffect(() => {
    const element = transcriptRef.current;
    if (!element) return;
    if (pendingLine || stickToBottomRef.current) {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
      setShowJumpToLatest(false);
      stickToBottomRef.current = true;
    } else {
      setShowJumpToLatest(true);
    }
  }, [busy, pendingLine, session.transcript.length]);

  function handleTranscriptScroll() {
    const element = transcriptRef.current;
    if (!element) return;
    const distance =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    stickToBottomRef.current = distance < 72;
    if (stickToBottomRef.current) setShowJumpToLatest(false);
  }

  function jumpToLatest() {
    const element = transcriptRef.current;
    if (!element) return;
    stickToBottomRef.current = true;
    setShowJumpToLatest(false);
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
  }

  return (
    <main className="game-screen">
      <header className="game-topbar">
        <button
          className="brand brand--small brand-button"
          type="button"
          onClick={onExit}
          aria-label="返回关系修炼关卡"
        >
          <BrandLogo compact />
        </button>
        <span className="game-topbar__title">{briefing.title}</span>
        <div className="game-topbar__actions">
          <span data-testid="round-counter">
            第 {state.round + 1} / {state.maxRounds} 轮
          </span>
          <button
            className="header-icon-button"
            type="button"
            onClick={onOpenSettings}
            aria-label="打开互动设置"
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      <section className="story-context" aria-label="故事背景">
        <div className="story-context__heading">
          <span>第 {briefing.number} 关</span>
          <h1>{briefing.title}</h1>
        </div>
        <article className="story-context__goal">
          <span>目标</span>
          <p>{briefing.goal}</p>
        </article>
        <article>
          <span>此刻</span>
          <strong>{briefing.timeAndPlace}</strong>
        </article>
        <article>
          <span>事情发生之前</span>
          <p>{briefing.premise}</p>
        </article>
        {state.activeEvent && (
          <article
            className="story-context__event"
            data-testid="story-event"
          >
            <span>现场变化</span>
            <strong>{state.activeEvent.title}</strong>
            <p>{state.activeEvent.description}</p>
          </article>
        )}
      </section>

      <section className="chat-stage panel" aria-label="对话">
        <div
          className="relationship-progress"
          role="progressbar"
          aria-label="关系进展"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          data-testid="relationship-progress"
        >
          <div className="relationship-progress__label">
            <span>关系进展</span>
            <strong>{progressLabel}</strong>
          </div>
          <div className="relationship-progress__track">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="chat-history-wrap">
          <div
            className="transcript"
            ref={transcriptRef}
            onScroll={handleTranscriptScroll}
            data-testid="transcript-history"
          >
            {session.transcript.map((entry) => {
              const beat =
                entry.speaker === 'character'
                  ? session.visualBeats.find(
                      (candidate) => candidate.round === entry.round,
                    )
                  : null;
              return (
                <article
                  key={entry.id}
                  className={`message message--${entry.speaker}`}
                  data-testid={`message-${entry.speaker}`}
                >
                  {entry.speaker === 'character' && (
                    <div className="message__meta">
                      <span>{briefing.character.name}</span>
                      <span className="message__round">
                        {entry.round === 0
                          ? '开场'
                          : `第 ${entry.round} 轮`}
                      </span>
                    <button
                      type="button"
                      className={
                        speakingEntryId === entry.id ? 'is-playing' : ''
                      }
                      onClick={() => onToggleSpeech(entry)}
                      aria-label={
                        speakingEntryId === entry.id
                          ? `停止播放${briefing.character.name}第${entry.round}轮的台词`
                          : `播放${briefing.character.name}第${entry.round}轮的台词`
                      }
                      data-testid={`speak-message-${entry.id}`}
                    >
                      {speakingEntryId === entry.id ? (
                        <StopIcon />
                      ) : (
                        <SpeakerIcon />
                      )}
                    </button>
                    </div>
                  )}
                  {beat && (
                    <p
                      className="message__stage-direction"
                      data-testid={`stage-direction-${beat.round}`}
                    >
                      {beat.action.stageDirection}
                    </p>
                  )}
                  <p>{entry.text}</p>
                </article>
              );
            })}
            {pendingLine && (
              <article className="message message--player is-pending">
                <p>{pendingLine}</p>
              </article>
            )}
            {busy && (
              <article className="message message--thinking">
                <div className="message__meta">
                  <span>{briefing.character.name}</span>
                </div>
                <p>正在回应</p>
              </article>
            )}
          </div>
          {showJumpToLatest && (
            <button
              className="jump-to-latest"
              type="button"
              onClick={jumpToLatest}
              data-testid="jump-to-latest"
            >
              回到最新
              <DownIcon />
            </button>
          )}
        </div>

        <div className={`composer ${recording ? 'is-recording' : ''}`}>
          <textarea
            ref={textareaRef}
            value={draft}
            maxLength={240}
            rows={1}
            placeholder={`回复${briefing.character.name}…`}
            disabled={busy}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                onSubmit();
              }
            }}
            data-testid="dialogue-input"
          />
          <div className="composer__toolbar">
            <div>
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="打开互动设置"
              >
                <SettingsIcon />
              </button>
              <button
                type="button"
                className={recording ? 'is-active' : ''}
                onClick={onToggleRecording}
                disabled={!speechInputSupported || busy}
                aria-label={recording ? '停止语音输入' : '开始语音输入'}
                data-testid="voice-input"
              >
                {recording ? <StopIcon /> : <MicIcon />}
              </button>
              {recording && <span>正在听…</span>}
            </div>
            <div>
              {draft.length > 200 && <small>{draft.length}/240</small>}
              <button
                className="send-button"
                type="button"
                onClick={onSubmit}
                disabled={busy || draft.trim().length === 0}
                aria-label={busy ? '等待回应' : '发送'}
                data-testid="send-line"
              >
                {busy ? <WaitingIcon /> : <SendIcon />}
              </button>
            </div>
          </div>
          {error && (
            <p className="composer-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      <section className="opponent-stage" aria-label="对方形象">
        <OpponentVisual
          session={session}
          outputModes={outputModes}
          mediaUnlocked={mediaUnlocked}
          visualFrames={visualFrames}
          onRetryImage={onRetryImage}
          onOpenSettings={onOpenSettings}
        />
      </section>
    </main>
  );
}

function OpponentVisual({
  session,
  outputModes,
  mediaUnlocked,
  visualFrames,
  onRetryImage,
  onOpenSettings,
}: {
  session: PublicSession;
  outputModes: OutputMode[];
  mediaUnlocked: boolean;
  visualFrames: VisualFrame[];
  onRetryImage: (beatId: string) => void;
  onOpenSettings: () => void;
}) {
  const mediaRequested =
    outputModes.includes('image') || outputModes.includes('video');
  const mediaReady = mediaRequested && mediaUnlocked;
  const latestFrame = visualFrames.at(-1) ?? null;
  const [selectedBeatId, setSelectedBeatId] = useState(
    latestFrame?.beat.id ?? null,
  );

  useEffect(() => {
    if (latestFrame) setSelectedBeatId(latestFrame.beat.id);
  }, [latestFrame?.beat.id]);

  const selectedFrame =
    visualFrames.find((frame) => frame.beat.id === selectedBeatId) ??
    latestFrame;
  const selectedBeat = selectedFrame?.beat ?? null;
  const generation = selectedFrame?.generation ?? null;
  const mediaSucceeded =
    mediaRequested && generation?.status === 'succeeded' && selectedBeat;
  const selectedLabel = selectedBeat
    ? roundLabel(selectedBeat.round)
    : '当前';

  return (
    <div className="opponent-visual">
      <div
        className={`opponent-visual__main ${
          mediaSucceeded ? 'has-generated-media' : ''
        }`}
      >
        {mediaSucceeded && selectedBeat && generation ? (
          <MemoryFrame
            session={session}
            beat={selectedBeat}
            generation={generation}
          />
        ) : (
          <div className="opponent-stage__portrait">
            <Portrait
              performance={
                selectedBeat
                  ? performanceFromBeat(selectedBeat)
                  : session.lastPerformance
              }
              character={session.briefing.character}
            />
            {mediaRequested &&
              !mediaUnlocked &&
              selectedBeat && (
                <div
                  className="opponent-stage__media-locked"
                  data-testid="media-generation-locked"
                >
                  <div>
                    <strong>影像生成尚未解锁</strong>
                    <span>刷新后需要重新输入媒体密钥。</span>
                  </div>
                  <button type="button" onClick={onOpenSettings}>
                    重新解锁
                  </button>
                </div>
              )}
            {mediaReady &&
              selectedBeat &&
              (!generation ||
                generation.status === 'queued' ||
                generation.status === 'running') && (
                <div
                  className="opponent-stage__media-status"
                  data-testid="generated-media-loading"
                >
                  <GenerationProgress
                    kind="image"
                    label={`${selectedLabel}形象`}
                    generation={generation}
                  />
                </div>
              )}
            {mediaReady &&
              selectedBeat &&
              generation?.status === 'failed' && (
                <div
                  className="opponent-stage__media-fallback"
                  data-testid="generated-media-failed"
                >
                  <strong>{generation.error ?? '形象没有生成完成。'}</strong>
                  <button
                    type="button"
                    onClick={() => onRetryImage(selectedBeat.id)}
                  >
                    重新生成
                  </button>
                </div>
              )}
          </div>
        )}
      </div>
      {mediaReady && visualFrames.length > 0 && (
        <nav className="visual-timeline" aria-label="对话形象轨迹">
          <div className="visual-timeline__heading">
            <span>形象轨迹</span>
            <strong>{selectedLabel}</strong>
          </div>
          <div className="visual-timeline__track">
            {visualFrames.map((frame) => {
              const status = frame.generation?.status ?? 'queued';
              const succeeded =
                status === 'succeeded' && frame.generation?.url;
              const label = roundLabel(frame.beat.round);
              return (
                <button
                  key={frame.beat.id}
                  type="button"
                  className={[
                    frame.beat.id === selectedBeat?.id
                      ? 'is-selected'
                      : '',
                    `is-${status}`,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelectedBeatId(frame.beat.id)}
                  aria-label={`查看${label}形象`}
                  aria-current={
                    frame.beat.id === selectedBeat?.id
                      ? 'true'
                      : undefined
                  }
                  data-testid={`visual-frame-${frame.beat.round}`}
                >
                  {succeeded ? (
                    <img
                      src={frame.generation!.url!}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <i aria-hidden="true">
                      {status === 'failed' ? '!' : ''}
                    </i>
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function roundLabel(round: number): string {
  return round === 0 ? '开场' : `第 ${round} 轮`;
}

function performanceFromBeat(beat: VisualBeat): ActorPerformance {
  return {
    line: beat.characterLine,
    emotion: beat.emotion,
    tone: beat.tone,
    expression: beat.expression,
    action: beat.action,
    stateChanges: {
      warmth: 0,
      pressure: 0,
      openness: 0,
    },
  };
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 14-7-4 14-3-6-7-1Z" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 9h4l4-4v14l-4-4H5ZM16 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}

function DownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function WaitingIcon() {
  return (
    <svg className="is-spinning" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-3-6.25" />
    </svg>
  );
}
