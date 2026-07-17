import type {
  Capabilities,
  ScenarioBriefing,
} from '../../shared/contracts.js';
import { Portrait } from './Portrait.js';
import type { ActorPerformance } from '../../shared/contracts.js';

interface BriefingProps {
  briefing: ScenarioBriefing;
  capabilities: Capabilities | null;
  starting: boolean;
  onStart: () => void;
}

const previewPerformance: ActorPerformance = {
  line: '',
  emotion: 'guarded',
  tone: 'icy',
  expression: {
    brows: 'flat',
    eyes: 'direct',
    mouth: 'line',
  },
  action: {
    pose: 'holding-handle',
    gesture: 'checks-phone',
    stageDirection: '她已经把车叫好了。',
  },
  stateChanges: {
    trust: 0,
    anger: 0,
    vulnerability: 0,
    hiddenProgress: 0,
  },
};

export function Briefing({
  briefing,
  capabilities,
  starting,
  onStart,
}: BriefingProps) {
  return (
    <main className="briefing-screen">
      <header className="brand-bar">
        <a className="brand" href="/" aria-label="关系修罗场首页">
          <span className="brand__mark">修</span>
          <span>
            <b>关系修罗场</b>
            <small>RELATIONSHIP ARENA</small>
          </span>
        </a>
        <div className="provider-badge" data-testid="provider-badge">
          <span className="provider-badge__dot" />
          {providerLabel(capabilities)}
        </div>
      </header>

      <section className="briefing-hero">
        <div className="briefing-copy">
          <p className="eyebrow">CASE 001 · 亲密关系 / 失约</p>
          <h1>{briefing.title}</h1>
          <p className="briefing-subtitle">{briefing.subtitle}</p>
          <p className="premise">{briefing.premise}</p>

          <div className="briefing-rules">
            <article>
              <span>公开目标</span>
              <strong>{briefing.publicGoal}</strong>
            </article>
            <article className="rule-hidden">
              <span>隐藏目标</span>
              <strong>{briefing.hiddenGoalTeaser}</strong>
            </article>
            <article className="rule-danger">
              <span>特殊限制</span>
              <strong>{briefing.restriction}</strong>
            </article>
          </div>

          <div className="character-dossier">
            <span className="dossier-index">TARGET / 01</span>
            <div>
              <h2>
                {briefing.character.name}
                <small>{briefing.character.age} 岁</small>
              </h2>
              <p>
                {briefing.character.role} · {briefing.character.personality}
              </p>
            </div>
          </div>

          <button
            className="start-button"
            type="button"
            onClick={onStart}
            disabled={starting}
            data-testid="start-game"
          >
            <span>{starting ? '正在推开玄关门…' : '进入修罗场'}</span>
            <kbd>7 轮</kbd>
          </button>
          <p className="briefing-note">
            自由输入 · AI 合成语音 · 单局状态 · 约 8 分钟
          </p>
        </div>

        <div className="briefing-visual">
          <Portrait performance={previewPerformance} round={0} />
          <div className="case-stamp">LIVE CASE</div>
          <div className="visual-quote">
            <span>黎岚</span>
            “你有七句话。挑几句真的。”
          </div>
        </div>
      </section>
    </main>
  );
}

function providerLabel(capabilities: Capabilities | null): string {
  if (!capabilities) return '连接场记中';
  if (capabilities.textProvider === 'mock') return '本地导演模式';
  if (capabilities.textProvider === 'openai') return 'OpenAI 实时导演';
  return 'DeepSeek 实时导演';
}
