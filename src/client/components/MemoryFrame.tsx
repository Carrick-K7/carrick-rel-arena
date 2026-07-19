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
            <div className="memory-frame__bubble memory-frame__bubble--player">
              <span>{session.briefing.player.name}</span>
              <p>{beat.playerLine}</p>
            </div>
          )}
          <div className="memory-frame__bubble memory-frame__bubble--character">
            <span>{session.briefing.character.name}</span>
            <p>{beat.characterLine}</p>
          </div>
        </div>
      </div>
    </figure>
  );
}
