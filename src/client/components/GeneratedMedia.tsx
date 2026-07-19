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
  const label = kind === 'image' ? '剧情图像' : '本局回忆';

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
          {kind === 'video'
            ? '，通常需要三到六分钟…'
            : '，通常需要约一分钟…'}
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
        <span>本局回忆</span>
        <strong>{title}</strong>
        <p>整段对话已经压缩为一支连续短片。</p>
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
          alt={`${title}的剧情图像`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <video
          src={generation.url}
          aria-label={`${title}的剧情视频`}
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
      </figcaption>
    </figure>
  );
}
