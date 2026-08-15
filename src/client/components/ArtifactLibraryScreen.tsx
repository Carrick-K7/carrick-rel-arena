import type { ArtifactRun } from '../artifacts.js';
import { BrandLogo } from './BrandLogo.js';

interface ArtifactLibraryScreenProps {
  scenarioTitle: string;
  runs: ArtifactRun[];
  onBack: () => void;
}

export function ArtifactLibraryScreen({
  scenarioTitle,
  runs,
  onBack,
}: ArtifactLibraryScreenProps) {
  const first = runs[0];
  const title = first?.scenarioTitle ?? scenarioTitle;

  return (
    <main
      className="artifact-library-screen"
      data-testid="artifact-library"
    >
      <header className="artifact-library__topbar">
        <button
          className="brand brand--small brand-button"
          type="button"
          onClick={onBack}
          aria-label="返回关系修炼关卡"
        >
          <BrandLogo compact />
        </button>
        <button
          className="artifact-library__back"
          type="button"
          onClick={onBack}
        >
          返回关卡
        </button>
      </header>

      <section className="artifact-library__hero">
        <span>已完成章节 · 回忆库</span>
        <h1>{title}</h1>
        <p>
          这里保存本机完成该章节时生成的剧情图片与回忆短片。
          对话正文不会写入回忆库。
        </p>
      </section>

      <section
        className="artifact-library__runs"
        aria-label={`${title}的生成制品`}
      >
        {runs.length === 0 && (
          <div className="artifact-library__empty">
            <strong>本机还没有这一章的回忆</strong>
            <p>完成场景并生成图片或视频后，制品会出现在这里。</p>
          </div>
        )}
        {runs.map((run, runIndex) => (
          <article
            className="artifact-run panel"
            key={run.id}
            data-testid="artifact-run"
          >
            <header className="artifact-run__heading">
              <div>
                <span>
                  {formatCompletedAt(run.completedAt)}
                  {runIndex === 0 ? ' · 最近一次' : ''}
                </span>
                <h2>{run.endingTitle}</h2>
              </div>
              <div className="artifact-run__meta">
                <strong>{run.tier}</strong>
                <span>
                  {run.playerName} × {run.characterName}
                </span>
              </div>
            </header>

            {run.images.length > 0 && (
              <section className="artifact-run__images">
                <div className="artifact-run__section-title">
                  <span>剧情图片</span>
                  <strong>{run.images.length} 张</strong>
                </div>
                <div className="artifact-image-grid">
                  {run.images.map((image) => (
                    <figure key={image.id}>
                      <img
                        src={image.url}
                        alt={`${run.scenarioTitle}${image.label}的剧情图片`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <figcaption>{image.label}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {run.video && (
              <section className="artifact-run__video">
                <div className="artifact-run__section-title">
                  <span>回忆短片</span>
                  <strong>整局制品</strong>
                </div>
                {run.video.provider === 'mock' ? (
                  <div
                    className="artifact-video-placeholder"
                    data-testid="archived-video"
                  >
                    <span>本局回忆</span>
                    <strong>{run.endingTitle}</strong>
                    <p>整段对话已经压缩为一支连续短片。</p>
                  </div>
                ) : (
                  <video
                    src={run.video.url}
                    aria-label={`${run.scenarioTitle}回忆短片`}
                    controls
                    playsInline
                    preload="metadata"
                    data-testid="archived-video"
                  />
                )}
              </section>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

function formatCompletedAt(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
