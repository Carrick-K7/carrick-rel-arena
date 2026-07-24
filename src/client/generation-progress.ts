import type {
  MediaGeneration,
  MediaKind,
} from '../shared/contracts.js';

export interface EstimatedGenerationProgress {
  percent: number;
  stage: string;
  elapsedSeconds: number;
}

const EXPECTED_DURATION_MS: Record<MediaKind, number> = {
  image: 75_000,
  video: 270_000,
};

export function estimateGenerationProgress(
  kind: MediaKind,
  generation: MediaGeneration | null,
  now = Date.now(),
  fallbackStartedAt = now,
): EstimatedGenerationProgress {
  if (generation?.status === 'succeeded') {
    return {
      percent: 100,
      stage: kind === 'image' ? '画面已经生成' : '短片已经生成',
      elapsedSeconds: elapsedSeconds(
        generation.createdAt,
        now,
        fallbackStartedAt,
      ),
    };
  }

  const elapsed = elapsedSeconds(
    generation?.createdAt,
    now,
    fallbackStartedAt,
  );
  if (!generation || generation.status === 'queued') {
    return {
      percent: Math.min(8, 3 + Math.floor(elapsed / 4)),
      stage: '等待生成资源',
      elapsedSeconds: elapsed,
    };
  }

  if (generation.status === 'failed') {
    return {
      percent: 0,
      stage: '生成未完成',
      elapsedSeconds: elapsed,
    };
  }

  const expectedDuration = EXPECTED_DURATION_MS[kind];
  const curve = 1 - Math.exp(-(elapsed * 1_000) / expectedDuration);
  const percent = Math.min(96, Math.round(10 + curve * 88));

  return {
    percent,
    stage: generationStage(kind, percent),
    elapsedSeconds: elapsed,
  };
}

export function formatGenerationWait(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0
    ? `${minutes} 分钟`
    : `${minutes} 分 ${remainder} 秒`;
}

function generationStage(kind: MediaKind, percent: number): string {
  if (kind === 'image') {
    if (percent < 24) return '准备人物参考';
    if (percent < 52) return '建立构图与人物一致性';
    if (percent < 78) return '生成情绪与场景细节';
    if (percent < 92) return '细化画面';
    return '等待画面完成并保存';
  }

  if (percent < 24) return '整理整局关键画面';
  if (percent < 52) return '建立连续分镜';
  if (percent < 78) return '生成动作与镜头衔接';
  if (percent < 92) return '合成回忆短片';
  return '等待短片完成并保存';
}

function elapsedSeconds(
  createdAt: string | undefined,
  now: number,
  fallbackStartedAt: number,
): number {
  const parsed = createdAt ? Date.parse(createdAt) : Number.NaN;
  const startedAt = Number.isFinite(parsed) ? parsed : fallbackStartedAt;
  return Math.max(0, Math.floor((now - startedAt) / 1_000));
}
