import { useState } from 'react';
import type { PublicSession } from '../../shared/contracts.js';
import { Portrait } from './Portrait.js';

interface ResultScreenProps {
  session: PublicSession;
  replaying: boolean;
  onReplay: () => void;
}

export function ResultScreen({
  session,
  replaying,
  onReplay,
}: ResultScreenProps) {
  const [copied, setCopied] = useState(false);
  const verdict = session.verdict;
  if (!verdict) return null;

  async function copyResult() {
    await navigator.clipboard.writeText(verdict!.shareText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main
      className={`result-screen result-tier-${verdict.tier.toLowerCase()}`}
      data-testid="result-screen"
    >
      <header className="result-topbar">
        <a
          className="brand brand--small"
          href={import.meta.env.BASE_URL}
          aria-label="关系修罗场"
        >
          <span className="brand__mark">修</span>
          <span>
            <b>关系修罗场</b>
            <small>CASE CLOSED</small>
          </span>
        </a>
        <span>单局记录已封存 · 关系状态到此为止</span>
      </header>

      <section className="result-hero">
        <div className="result-grade" aria-label={`${verdict.tier} 级`}>
          {verdict.tier}
        </div>
        <div className="result-title">
          <p>ENDING / {verdict.endingId.toUpperCase()}</p>
          <h1>{endingTitle(verdict.endingId)}</h1>
          <span className="player-title">获得称号 · {verdict.title}</span>
          <blockquote>“{verdict.roast}”</blockquote>
        </div>
        <div className="result-portrait">
          <Portrait
            performance={session.lastPerformance}
            character={session.briefing.character}
            compact
          />
        </div>
      </section>

      <section className="result-body">
        <article className="epilogue">
          <span>结局现场</span>
          <p>{verdict.epilogue}</p>
          {session.state.activeEvent?.videoCue && (
            <small>◉ 结局生成式短视频接口已预留</small>
          )}
          <small data-testid="result-usage">
            ◫ 本局模型 {session.usage.calls} 次 ·{' '}
            {session.usage.totalTokens.toLocaleString()} tokens ·{' '}
            {formatCost(session.usage.estimatedCostUsd)}
          </small>
        </article>

        <div className="score-card">
          <div className="score-card__number">
            <strong>{verdict.score}</strong>
            <span>/ 100</span>
          </div>
          <div>
            <Metric
              label="最终信任"
              value={session.state.metrics.trust}
            />
            <Metric
              label="最终愤怒"
              value={session.state.metrics.anger}
              danger
            />
          </div>
        </div>

        <section className="goal-results">
          <h2>目标判定</h2>
          <article
            className={verdict.goal.met ? 'is-met' : 'is-missed'}
          >
            <span>{verdict.goal.met ? '✓' : '×'}</span>
            <div>
              <strong>{verdict.goal.label}</strong>
              <p>{verdict.goal.detail}</p>
            </div>
          </article>
        </section>

        <section className="review-panel">
          <div className="review-heading">
            <h2>关键对话复盘</h2>
            <span>评判 AI / {verdict.keyMoments.length} 个转折</span>
          </div>
          <div className="review-list">
            {verdict.keyMoments.map((moment, index) => (
              <article key={`${moment.round}-${index}`}>
                <div className={`impact impact--${moment.impact}`}>
                  {moment.impact === 'hurt'
                    ? '失分'
                    : moment.impact === 'helped'
                      ? '推进'
                      : '转折'}
                </div>
                <span className="review-round">ROUND {moment.round}</span>
                <blockquote>“{moment.quote}”</blockquote>
                <p>{moment.analysis}</p>
              </article>
            ))}
          </div>
        </section>
      </section>

      <footer className="result-actions">
        <button
          className="share-button"
          type="button"
          onClick={copyResult}
          data-testid="share-result"
        >
          {copied ? '已复制战报' : '复制战报'}
        </button>
        <button
          className="replay-button"
          type="button"
          onClick={onReplay}
          disabled={replaying}
          data-testid="replay-game"
        >
          {replaying ? '重置现场中…' : '换个说法，再来一局'}
        </button>
      </footer>
    </main>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className={`result-metric ${danger ? 'is-danger' : ''}`}>
      <span>{label}</span>
      <div>
        <i style={{ width: `${value}%` }} />
      </div>
      <b>{value}</b>
    </div>
  );
}

function endingTitle(endingId: NonNullable<PublicSession['state']['endingId']>) {
  const titles = {
    'breakfast-stays-warm': '早餐还热',
    'suitcase-by-the-door': '行李留在门口',
    'elevator-going-down': '电梯下行',
  };
  return titles[endingId];
}

function formatCost(cost: number | null): string {
  return cost === null ? '成本待定' : `估算 $${cost.toFixed(4)}`;
}
