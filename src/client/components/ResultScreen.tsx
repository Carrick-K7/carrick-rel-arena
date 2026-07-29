import { useState } from 'react';
import type {
  MediaGeneration,
  OutputMode,
  PublicSession,
} from '../../shared/contracts.js';
import { GeneratedMedia } from './GeneratedMedia.js';
import { BrandLogo } from './BrandLogo.js';
import { MemoryFrame } from './MemoryFrame.js';
import { Portrait } from './Portrait.js';
import {
  relationshipProgress,
  relationshipProgressLabel,
} from '../relationship-progress.js';

interface ResultScreenProps {
  session: PublicSession;
  outputModes: OutputMode[];
  mediaUnlocked: boolean;
  visualFrames: Array<{
    beat: PublicSession['visualBeats'][number];
    generation: MediaGeneration | null;
  }>;
  memoryVideoGeneration: MediaGeneration | null;
  replaying: boolean;
  onReplay: () => void;
  onOpenSettings: () => void;
  onBackToLevels: () => void;
}

export function ResultScreen({
  session,
  outputModes,
  mediaUnlocked,
  visualFrames,
  memoryVideoGeneration,
  replaying,
  onReplay,
  onOpenSettings,
  onBackToLevels,
}: ResultScreenProps) {
  const [copied, setCopied] = useState(false);
  const verdict = session.verdict;
  if (!verdict) return null;
  const finalProgress = relationshipProgress(session.state.metrics);
  const imageSelected =
    outputModes.includes('image') || outputModes.includes('video');
  const videoSelected = outputModes.includes('video');
  const mediaNeedsUnlock =
    (imageSelected || videoSelected) && !mediaUnlocked;
  const imageEnabled = imageSelected && mediaUnlocked;
  const videoEnabled = videoSelected && mediaUnlocked;

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
        <button
          className="brand brand--small brand-button"
          type="button"
          onClick={onBackToLevels}
          aria-label="返回关系修炼关卡"
        >
          <BrandLogo compact />
        </button>
        <span>单局记录已封存 · 关系状态到此为止</span>
      </header>

      <section className="result-hero">
        <div className="result-grade" aria-label={`${verdict.tier} 级`}>
          {verdict.tier}
        </div>
        <div className="result-title">
          <p>第 {session.briefing.number} 关 · 结局</p>
          <h1>
            {session.state.activeEvent?.title ?? session.briefing.title}
          </h1>
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
        </article>

        <div className="score-card">
          <div className="score-card__number">
            <strong>{verdict.score}</strong>
            <span>/ 100</span>
          </div>
          <div className="result-progress">
            <span>最终关系进展</span>
            <strong>{relationshipProgressLabel(finalProgress)}</strong>
            <p>{finalProgress} / 100</p>
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
            <span>{verdict.keyMoments.length} 个转折</span>
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

        <section
          className="session-archive"
          aria-labelledby="session-archive-title"
          data-testid="session-archive"
        >
          <div className="session-archive__heading">
            <div>
              <span>本局档案</span>
              <h2 id="session-archive-title">完整对话与制品</h2>
            </div>
            <p>
              {visualFrames.length} 个剧情瞬间
              {videoEnabled ? ' · 1 支回忆短片' : ''}
            </p>
          </div>

          {mediaNeedsUnlock && (
            <section
              className="result-media-locked"
              data-testid="media-generation-locked"
            >
              <div>
                <strong>这一页还没有开始生成影像</strong>
                <p>
                  媒体密钥不会保存在浏览器中，刷新后需要重新解锁。
                </p>
              </div>
              <button type="button" onClick={onOpenSettings}>
                重新解锁并生成
              </button>
            </section>
          )}

          <div className="session-archive__timeline">
            {visualFrames.map(({ beat, generation }) => (
              <article
                className="archive-beat"
                key={beat.id}
                data-testid="archive-beat"
                data-visual-beat={beat.id}
              >
                <header>
                  <span>
                    {beat.round === 0
                      ? '开场'
                      : beat.kind === 'ending'
                        ? `第 ${beat.round} 轮 · 结局`
                        : `第 ${beat.round} 轮`}
                  </span>
                  <strong>
                    {beat.eventTitle ??
                      (beat.round === 0
                        ? session.briefing.title
                        : '对话推进')}
                  </strong>
                </header>

                {imageEnabled &&
                  generation?.status === 'succeeded' && (
                    <MemoryFrame
                      session={session}
                      beat={beat}
                      generation={generation}
                    />
                  )}
                {imageEnabled &&
                  generation?.status !== 'succeeded' && (
                    <GeneratedMedia
                      kind="image"
                      title={
                        beat.eventTitle ?? session.briefing.title
                      }
                      generation={generation}
                    />
                  )}

                <div className="archive-beat__dialogue">
                  {beat.playerLine && (
                    <div className="archive-line archive-line--player">
                      <span>{session.briefing.player.name}</span>
                      <p>{beat.playerLine}</p>
                    </div>
                  )}
                  <div className="archive-line archive-line--character">
                    <span>{session.briefing.character.name}</span>
                    <p>{beat.characterLine}</p>
                  </div>
                </div>
                <p className="archive-beat__direction">
                  {beat.action.stageDirection}
                </p>
              </article>
            ))}
          </div>

          {videoEnabled && (
            <section className="memory-film" aria-label="本局回忆短片">
              <div className="memory-film__heading">
                <span>整局制品</span>
                <strong>把完整对话压缩成一支回忆短片</strong>
              </div>
              <GeneratedMedia
                kind="video"
                title={verdict.title}
                generation={memoryVideoGeneration}
              />
              <div className="memory-film__captions">
                {verdict.keyMoments.slice(0, 3).map((moment) => (
                  <p key={`${moment.round}-${moment.quote}`}>
                    <span>第 {moment.round} 轮</span>
                    {moment.quote}
                  </p>
                ))}
              </div>
            </section>
          )}
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
          {replaying ? '重置现场中…' : '再试一次'}
        </button>
        <button
          className="levels-button"
          type="button"
          onClick={onBackToLevels}
          disabled={replaying}
          data-testid="back-to-levels"
        >
          返回关卡
        </button>
      </footer>
    </main>
  );
}
