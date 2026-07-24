import { useEffect, useRef, useState } from 'react';
import type {
  MediaGeneration,
  MediaKind,
} from '../../shared/contracts.js';
import {
  estimateGenerationProgress,
  formatGenerationWait,
} from '../generation-progress.js';

interface GenerationProgressProps {
  kind: MediaKind;
  label: string;
  generation: MediaGeneration | null;
  className?: string;
}

export function GenerationProgress({
  kind,
  label,
  generation,
  className = '',
}: GenerationProgressProps) {
  const fallbackStartedAt = useRef(Date.now());
  const [now, setNow] = useState(Date.now);
  const active =
    !generation ||
    generation.status === 'queued' ||
    generation.status === 'running';

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active, generation?.id]);

  const progress = estimateGenerationProgress(
    kind,
    generation,
    now,
    fallbackStartedAt.current,
  );
  const kindLabel = kind === 'image' ? '图片' : '视频';

  return (
    <div
      className={`generation-progress ${className}`.trim()}
      aria-label={`${label}${kindLabel}预计生成进度 ${progress.percent}%`}
      data-testid="media-generation-progress"
      data-progress={progress.percent}
    >
      <div className="generation-progress__heading">
        <span>{label}</span>
        <strong>预计 {progress.percent}%</strong>
      </div>
      <div
        className="generation-progress__track"
        aria-hidden="true"
      >
        <i style={{ width: `${progress.percent}%` }} />
      </div>
      <small>
        {progress.stage} · 已等待{' '}
        {formatGenerationWait(progress.elapsedSeconds)}
      </small>
    </div>
  );
}
