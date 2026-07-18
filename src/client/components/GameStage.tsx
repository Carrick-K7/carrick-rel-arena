import { useEffect, useRef } from 'react';
import type {
  Capabilities,
  PublicSession,
} from '../../shared/contracts.js';
import { Gauge } from './Gauge.js';
import { Portrait } from './Portrait.js';

interface GameStageProps {
  session: PublicSession;
  capabilities: Capabilities | null;
  draft: string;
  pendingLine: string | null;
  busy: boolean;
  error: string | null;
  directorSummary: string | null;
  voiceEnabled: boolean;
  recording: boolean;
  speechInputSupported: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onToggleVoice: () => void;
  onToggleRecording: () => void;
}

export function GameStage({
  session,
  capabilities,
  draft,
  pendingLine,
  busy,
  error,
  directorSummary,
  voiceEnabled,
  recording,
  speechInputSupported,
  onDraftChange,
  onSubmit,
  onToggleVoice,
  onToggleRecording,
}: GameStageProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const { state, briefing, lastPerformance } = session;
  const roundsLeft = Math.max(0, state.maxRounds - state.round);

  useEffect(() => {
    const element = transcriptRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [session.transcript.length, pendingLine, busy]);

  return (
    <main className="game-screen">
      <header className="game-topbar">
        <a
          className="brand brand--small"
          href={import.meta.env.BASE_URL}
          aria-label="关系修罗场"
        >
          <span className="brand__mark">修</span>
          <span>
            <b>关系修罗场</b>
            <small>Relationship Arena</small>
          </span>
        </a>
        <div className="scene-title">
          <span>{briefing.timeAndPlace}</span>
          <strong>{briefing.title}</strong>
        </div>
        <div className="rounds" data-testid="round-counter">
          <span>还剩</span>
          <b>{roundsLeft}</b>
          <small>轮对话</small>
        </div>
      </header>

      <section className="game-brief">
        <p>
          <span>目标</span>
          {briefing.goal}
        </p>
      </section>

      <section className="arena-layout">
        <section className="character-stage">
          <Portrait
            performance={lastPerformance}
            character={briefing.character}
          />
        </section>

        <section className="conversation-stage">
          <div className="status-strip">
            <Gauge
              label="信任"
              value={state.metrics.trust}
              kind="trust"
            />
            <Gauge
              label="愤怒"
              value={state.metrics.anger}
              kind="anger"
            />
          </div>

          <section className="latest-reply" aria-live="polite">
            <p className="latest-reply__meta">
              <strong>{briefing.character.name}</strong>
              <span>
                {emotionLabel(lastPerformance.emotion)} ·{' '}
                {toneLabel(lastPerformance.tone)}
              </span>
            </p>
            <h1 data-testid="latest-line">“{lastPerformance.line}”</h1>
            <div className="delta-row">
              <Delta
                label="信任"
                value={lastPerformance.stateChanges.trust}
              />
              <Delta
                label="愤怒"
                value={lastPerformance.stateChanges.anger}
                inverse
              />
            </div>
          </section>

          {state.activeEvent && (
            <section className="story-event" data-testid="story-event">
              <span>剧情转折</span>
              <div>
                <strong>{state.activeEvent.title}</strong>
                <p>{state.activeEvent.description}</p>
              </div>
            </section>
          )}

          <section className="transcript-panel">
            <div className="panel-heading">
              <span>对话</span>
              <small>
                {capabilities?.remoteText ? 'AI 实时生成' : '本地演示'}
              </small>
            </div>
            <div className="transcript" ref={transcriptRef}>
              {session.transcript.map((entry) => (
                <article
                  key={entry.id}
                  className={`message message--${entry.speaker}`}
                >
                  <span>
                    {entry.speaker === 'player'
                      ? '你'
                      : briefing.character.name}
                    {entry.round > 0 && ` · ${entry.round}`}
                  </span>
                  <p>{entry.text}</p>
                </article>
              ))}
              {pendingLine && (
                <article className="message message--player is-pending">
                  <span>你 · {state.round + 1}</span>
                  <p>{pendingLine}</p>
                </article>
              )}
              {busy && (
                <article className="message message--thinking">
                  <span>{briefing.character.name}</span>
                  <p>正在回应…</p>
                </article>
              )}
            </div>
          </section>

          <p className="director-note" aria-live="polite">
            <span>局势</span>
            {directorSummary ??
              '对方在等你说出今晚真正落在自己身上的东西。'}
          </p>
        </section>
      </section>

      <footer className="composer-wrap">
        <div className={`composer ${recording ? 'is-recording' : ''}`}>
          <div className="composer__meta">
            <span>第 {state.round + 1} 句话</span>
            <small>{draft.length}/240</small>
          </div>
          <textarea
            value={draft}
            maxLength={240}
            rows={3}
            placeholder="你会怎么接？"
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
          <div className="composer__actions">
            <button
              type="button"
              className={`utility-button ${recording ? 'is-active' : ''}`}
              onClick={onToggleRecording}
              disabled={!speechInputSupported || busy}
              aria-label={recording ? '停止语音输入' : '开始语音输入'}
            >
              {recording ? '停止录音' : '语音输入'}
            </button>
            <button
              type="button"
              className={`utility-button ${voiceEnabled ? 'is-active' : ''}`}
              onClick={onToggleVoice}
              aria-label={voiceEnabled ? '关闭 AI 语音' : '开启 AI 语音'}
            >
              {voiceEnabled ? '语音已开' : '语音已关'}
            </button>
            <button
              className="send-button"
              type="button"
              onClick={onSubmit}
              disabled={busy || draft.trim().length === 0}
              data-testid="send-line"
            >
              {busy ? '等待回应' : '发送'}
            </button>
          </div>
        </div>
        {error && (
          <p className="composer-error" role="alert">
            {error}
          </p>
        )}
        <p className="ai-disclosure">
          AI 角色与 AI 合成语音 · 单局关系状态
          <span data-testid="usage-meter">{usageLabel(session)}</span>
        </p>
      </footer>
    </main>
  );
}

function Delta({
  label,
  value,
  inverse = false,
}: {
  label: string;
  value: number;
  inverse?: boolean;
}) {
  if (value === 0) return null;
  const beneficial = inverse ? value < 0 : value > 0;
  return (
    <span className={beneficial ? 'delta--good' : 'delta--bad'}>
      {label} {value > 0 ? '+' : ''}
      {value}
    </span>
  );
}

function toneLabel(
  tone: PublicSession['lastPerformance']['tone'],
): string {
  const labels = {
    icy: '冰冷',
    sharp: '锋利',
    quiet: '低声',
    shaky: '发颤',
    dry: '冷幽默',
    soft: '放软',
  };
  return labels[tone];
}

function emotionLabel(
  emotion: PublicSession['lastPerformance']['emotion'],
): string {
  const labels = {
    guarded: '戒备',
    angry: '生气',
    hurt: '受伤',
    testing: '试探',
    softening: '动摇',
    warm: '温和',
    done: '心冷',
  };
  return labels[emotion];
}

function usageLabel(session: PublicSession): string {
  const { usage } = session;
  const cost =
    usage.estimatedCostUsd === null
      ? '成本待定'
      : `$${usage.estimatedCostUsd.toFixed(4)}`;
  return `模型 ${usage.calls} 次 · ${usage.totalTokens.toLocaleString()} tokens · ${cost}`;
}
