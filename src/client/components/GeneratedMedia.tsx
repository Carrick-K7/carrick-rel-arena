import type {
  MediaGeneration,
  MediaKind,
} from '../../shared/contracts.js';

interface GeneratedMediaProps {
  kind: MediaKind;
  title: string;
  generation: MediaGeneration | null;
}

export function GeneratedMedia({
  kind,
  title,
  generation,
}: GeneratedMediaProps) {
  const label = kind === 'image' ? '剧情图像' : '剧情视频';

  if (!generation || generation.status === 'queued') {
    return (
      <section
        className="generated-media is-loading"
        aria-live="polite"
        data-testid="generated-media-loading"
      >
        <div className="generated-media__skeleton" />
        <p>正在排队生成{label}…</p>
      </section>
    );
  }

  if (generation.status === 'running') {
    return (
      <section
        className="generated-media is-loading"
        aria-live="polite"
        data-testid="generated-media-loading"
      >
        <div className="generated-media__skeleton" />
        <p>
          正在生成{label}
          {kind === 'video' ? '，通常需要一到三分钟…' : '…'}
        </p>
      </section>
    );
  }

  if (generation.status === 'failed' || !generation.url) {
    return (
      <section
        className="generated-media is-failed"
        role="status"
        data-testid="generated-media-failed"
      >
        <strong>{label}没有生成完成</strong>
        <p>{generation.error ?? '可以继续用文字完成本关。'}</p>
      </section>
    );
  }

  if (generation.provider === 'mock' && kind === 'video') {
    return (
      <section
        className="generated-media generated-media--mock-video"
        data-testid="generated-media-video"
      >
        <span>本地视频演示</span>
        <strong>{title}</strong>
        <p>生产环境会在这里播放 Seedance 生成的 4 秒剧情镜头。</p>
      </section>
    );
  }

  return (
    <figure
      className="generated-media"
      data-testid={`generated-media-${kind}`}
    >
      {kind === 'image' ? (
        <img
          src={generation.url}
          alt={`${title}的 AI 生成剧情图像`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <video
          src={generation.url}
          aria-label={`${title}的 AI 生成剧情视频`}
          controls
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      )}
      <figcaption>
        <span>{label}</span>
        {title}
        {generation.usageTokens !== null && generation.usageTokens > 0 && (
          <small>
            {generation.usageTokens.toLocaleString()} tokens
          </small>
        )}
      </figcaption>
    </figure>
  );
}
