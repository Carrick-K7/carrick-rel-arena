import type {
  ActorPerformance,
  ScenarioBriefing,
} from '../../shared/contracts.js';

interface PortraitProps {
  performance: ActorPerformance;
  character: ScenarioBriefing['character'];
  compact?: boolean;
}

export function Portrait({
  performance,
  character,
  compact = false,
}: PortraitProps) {
  const image = portraitImage(character.gender, performance.emotion);
  const className = [
    'portrait',
    compact ? 'portrait--compact' : '',
    `emotion-${performance.emotion}`,
    `tone-${performance.tone}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <figure className={className}>
      <div className="portrait__frame">
        <img
          className="portrait__image"
          src={`${import.meta.env.BASE_URL}portraits/${image}`}
          alt={`${character.name}，${emotionLabel(performance.emotion)}`}
          loading={compact ? 'lazy' : 'eager'}
        />
        <span className="portrait__identity">
          <strong>{character.name}</strong>
          <small>
            {character.age} 岁 · 职场第 {character.experienceYears} 年
          </small>
        </span>
        <span className="portrait__emotion">
          {emotionLabel(performance.emotion)}
        </span>
      </div>
      {!compact && (
        <figcaption>{performance.action.stageDirection}</figcaption>
      )}
    </figure>
  );
}

function portraitImage(
  gender: ScenarioBriefing['character']['gender'],
  emotion: ActorPerformance['emotion'],
): string {
  if (gender === 'male') return 'zhou-xu-guarded.webp';
  return emotion === 'softening' || emotion === 'warm'
    ? 'li-lan-soft.webp'
    : 'li-lan-guarded.webp';
}

function emotionLabel(emotion: ActorPerformance['emotion']): string {
  const labels: Record<ActorPerformance['emotion'], string> = {
    guarded: '戒备',
    angry: '生气',
    hurt: '受伤',
    testing: '试探',
    softening: '动摇',
    warm: '放软',
    done: '心冷',
  };
  return labels[emotion];
}
