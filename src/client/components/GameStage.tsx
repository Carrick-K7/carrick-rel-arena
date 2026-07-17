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

  useEffect(() => {
    const element = transcriptRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [session.transcript.length, pendingLine, busy]);

  return (
    <main className="game-screen">
      <header className="game-topbar">
        <a className="brand brand--small" href="/" aria-label="关系修罗场">
          <span className="brand__mark">修</span>
          <span>
            <b>关系修罗场</b>
            <small>CASE 001</small>
          </span>
        </a>
        <div className="scene-title">
          <span>{briefing.timeAndPlace}</span>
          <strong>{briefing.title}</strong>
        </div>
        <div className="rounds" data-testid="round-counter">
          <span>剩余对话</span>
          <div className="rounds__pips" aria-label={`已进行 ${state.round} 轮`}>
            {Array.from({ length: state.maxRounds }, (_, index) => (
              <i
                key={index}
                className={
                  index < state.round
                    ? 'is-spent'
                    : index === state.round
                      ? 'is-next'
                      : ''
                }
              />
            ))}
          </div>
          <b>
            {Math.max(0, state.maxRounds - state.round)}
            <small>/ {state.maxRounds}</small>
          </b>
        </div>
      </header>

      <section className="arena-layout">
        <section className="character-stage">
          <Portrait
            performance={lastPerformance}
            round={state.round}
          />
          <div className="speech-card" aria-live="polite">
            <div className="speech-card__speaker">
              <strong>黎岚</strong>
              <span>
                {toneLabel(lastPerformance.tone)} ·{' '}
                {emotionLabel(lastPerformance.emotion)}
              </span>
            </div>
            <p data-testid="latest-line">“{lastPerformance.line}”</p>
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
          </div>
        </section>

        <aside className="play-panel">
          <section className="status-strip">
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
          </section>

          <section className="objective-panel">
            <div className="objective objective--public">
              <span>公开目标</span>
              <p>{briefing.publicGoal}</p>
            </div>
            <div className="objective objective--hidden">
              <span>暗线进度</span>
              <div className="secret-progress">
                {Array.from({ length: 3 }, (_, index) => (
                  <i
                    key={index}
                    className={
                      index < state.metrics.hiddenProgress ? 'is-found' : ''
                    }
                  >
                    {index < state.metrics.hiddenProgress ? '◆' : '?'}
                  </i>
                ))}
              </div>
            </div>
            <div
              className={`objective objective--restriction ${
                state.flags.forbiddenPhraseCount > 0 ? 'is-broken' : ''
              }`}
              data-testid="restriction-count"
            >
              <span>禁词</span>
              <p>
                {state.flags.forbiddenPhraseCount > 0
                  ? `已触发 ${state.flags.forbiddenPhraseCount} 次`
                  : '道歉词 · 0 次'}
              </p>
            </div>
          </section>

          {state.activeEvent && (
            <section
              className="story-event"
              data-testid="story-event"
            >
              <span className="story-event__index">剧情事件</span>
              <div>
                <strong>{state.activeEvent.title}</strong>
                <p>{state.activeEvent.description}</p>
              </div>
              {state.activeEvent.videoCue && (
                <span className="video-hook">
                  ◉ {videoHookLabel(state.activeEvent.videoCue.kind)}
                </span>
              )}
            </section>
          )}

          <section className="transcript-panel">
            <div className="panel-heading">
              <span>对话现场</span>
              <small>
                {capabilities?.remoteText ? 'AI 即时生成' : '可复现演示'}
              </small>
            </div>
            <div className="transcript" ref={transcriptRef}>
              {session.transcript.map((entry) => (
                <article
                  key={entry.id}
                  className={`message message--${entry.speaker}`}
                >
                  <span>
                    {entry.speaker === 'player' ? '你' : '黎岚'}
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
                  <span>场记</span>
                  <p>
                    <i />
                    <i />
                    <i />
                    导演在判断这句话会落在哪里
                  </p>
                </article>
              )}
            </div>
          </section>

          <section className="director-earpiece" aria-live="polite">
            <span>局势</span>
            <p>
              {directorSummary ??
                '少解释一点。她在等你看见今晚真正落在她身上的东西。'}
            </p>
          </section>
        </aside>
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
            rows={2}
            placeholder="你会怎么接？自由输入，越具体越有用…"
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
              className={`icon-button ${recording ? 'is-active' : ''}`}
              onClick={onToggleRecording}
              disabled={!speechInputSupported || busy}
              aria-label={recording ? '停止语音输入' : '开始语音输入'}
              title={
                speechInputSupported
                  ? '语音输入'
                  : '当前浏览器未提供语音输入'
              }
            >
              {recording ? '■' : '●'}
            </button>
            <button
              type="button"
              className={`icon-button ${voiceEnabled ? 'is-active' : ''}`}
              onClick={onToggleVoice}
              aria-label={voiceEnabled ? '关闭 AI 语音' : '开启 AI 语音'}
              title="AI 合成语音"
            >
              {voiceEnabled ? '◖))' : '◖×'}
            </button>
            <button
              className="send-button"
              type="button"
              onClick={onSubmit}
              disabled={busy || draft.trim().length === 0}
              data-testid="send-line"
            >
              {busy ? '等她回应' : '说出口'}
              <span>↵</span>
            </button>
          </div>
        </div>
        {error && (
          <p className="composer-error" role="alert">
            {error}
          </p>
        )}
        <p className="ai-disclosure">
          黎岚由 AI 扮演 · 语音为 AI 合成 · 本局结束后关系状态不延续
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

function videoHookLabel(kind: 'opening' | 'turning_point' | 'ending') {
  if (kind === 'opening') return '开场短视频 Hook';
  if (kind === 'ending') return '结局短视频 Hook';
  return '转折短视频 Hook';
}
