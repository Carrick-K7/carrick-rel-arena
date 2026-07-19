import type {
  MediaGeneration,
  PublicSession,
  VisualBeat,
} from '../../shared/contracts.js';

interface MemoryFrameProps {
  session: PublicSession;
  beat: VisualBeat;
  generation: MediaGeneration;
}

export function MemoryFrame({
  session,
  beat,
  generation,
}: MemoryFrameProps) {
  if (generation.status !== 'succeeded' || !generation.url) return null;

  return (
    <figure
      className="generated-media memory-frame"
      data-testid="generated-media-image"
      data-visual-beat={beat.id}
    >
      <div className="memory-frame__visual">
        <img
          src={generation.url}
          alt={`${session.briefing.title}第${beat.round}轮的剧情记录`}
          referrerPolicy="no-referrer"
        />
        <div
          className="memory-frame__dialogue"
          aria-label={`第${beat.round}轮画面台词`}
        >
          {beat.playerLine && (
            <p className="memory-frame__player">
              <span>{session.briefing.player.name}</span>
              {beat.playerLine}
            </p>
          )}
          <p className="memory-frame__character">
            <span>{session.briefing.character.name}</span>
            {beat.characterLine}
          </p>
        </div>
      </div>
      <figcaption>
        <span>{beat.round === 0 ? '开场' : `第 ${beat.round} 轮`}</span>
        {beat.eventTitle ?? '这一刻'}
        <small>对话文字由原文排版</small>
      </figcaption>
    </figure>
  );
}
