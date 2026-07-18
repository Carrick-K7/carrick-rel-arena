import type {
  ActorPerformance,
  Capabilities,
  ScenarioBriefing,
} from '../../shared/contracts.js';
import { Portrait } from './Portrait.js';

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
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="关系修罗场首页"
        >
          <span className="brand__mark">修</span>
          <span>
            <b>关系修罗场</b>
            <small>Relationship Arena</small>
          </span>
        </a>
        <div className="provider-badge" data-testid="provider-badge">
          <span className="provider-badge__dot" />
          {providerLabel(capabilities)}
        </div>
      </header>

      <section className="briefing-hero">
        <div className="briefing-copy">
          <p className="eyebrow">第一关 · 亲密关系 / 失约</p>
          <h1>{briefing.title}</h1>
          <p className="briefing-subtitle">{briefing.subtitle}</p>
          <p className="premise">{briefing.premise}</p>

          <div className="briefing-rules">
            <article>
              <span>你的目标</span>
              <strong>{briefing.publicGoal}</strong>
            </article>
            <article>
              <span>隐藏目标</span>
              <strong>{briefing.hiddenGoalTeaser}</strong>
            </article>
            <article className="rule-danger">
              <span>特殊限制</span>
              <strong>{briefing.restriction}</strong>
            </article>
          </div>

          <p className="character-dossier">
            <strong>{briefing.character.name}，{briefing.character.age} 岁</strong>
            <span>
              {briefing.character.role} · {briefing.character.personality}
            </span>
          </p>

          <div className="briefing-actions">
            <button
              className="start-button"
              type="button"
              onClick={onStart}
              disabled={starting}
              data-testid="start-game"
            >
              {starting ? '正在进入…' : '开始挑战'}
            </button>
            <span>7 轮 · 约 8 分钟 · 自由输入</span>
          </div>
        </div>

        <div className="briefing-visual">
          <Portrait performance={previewPerformance} round={0} />
          <blockquote>
            “你有七句话。挑几句真的。”
            <span>— 黎岚</span>
          </blockquote>
        </div>
      </section>
    </main>
  );
}

function providerLabel(capabilities: Capabilities | null): string {
  if (!capabilities) return '连接中';
  if (capabilities.textProvider === 'mock') return '本地模式';
  if (capabilities.textProvider === 'openai') return 'OpenAI 在线';
  return 'DeepSeek 在线';
}
