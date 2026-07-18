import type {
  ActorPerformance,
  Capabilities,
  Gender,
  ScenarioBriefing,
} from '../../shared/contracts.js';
import { Portrait } from './Portrait.js';

interface BriefingProps {
  briefing: ScenarioBriefing;
  capabilities: Capabilities | null;
  playerGender: Gender;
  starting: boolean;
  onPlayerGenderChange: (gender: Gender) => void;
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
    stageDirection: '对方已经把车叫好了。',
  },
  stateChanges: {
    trust: 0,
    anger: 0,
    vulnerability: 0,
  },
};

export function Briefing({
  briefing,
  capabilities,
  playerGender,
  starting,
  onPlayerGenderChange,
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

          <div className="briefing-sections">
            <article className="briefing-section">
              <span>情景介绍</span>
              <h2>{briefing.timeAndPlace}</h2>
              <p>{briefing.premise}</p>
            </article>

            <article className="briefing-section briefing-section--goal">
              <span>挑战目标</span>
              <h2>{briefing.goal}</h2>
              <p>你可以自由表达。每一句都会改变信任、愤怒和结局。</p>
            </article>

            <article className="briefing-section briefing-section--character">
              <span>人物介绍</span>
              <h2>
                {briefing.character.name}，{briefing.character.age} 岁
              </h2>
              <p>
                {briefing.character.role} · 职场第{' '}
                {briefing.character.experienceYears} 年
                <br />
                {briefing.character.personality}
              </p>
            </article>

            <fieldset className="briefing-section role-picker">
              <legend>扮演选择</legend>
              <p className="role-picker__intro">
                选择你的角色，对手会自动切换。
              </p>
              <div>
                <button
                  type="button"
                  className={playerGender === 'male' ? 'is-selected' : ''}
                  onClick={() => onPlayerGenderChange('male')}
                  aria-pressed={playerGender === 'male'}
                  data-testid="choose-male"
                >
                  <strong>扮演男生</strong>
                  <span>25 岁 · 程序员 · 职场第 3 年</span>
                </button>
                <button
                  type="button"
                  className={playerGender === 'female' ? 'is-selected' : ''}
                  onClick={() => onPlayerGenderChange('female')}
                  aria-pressed={playerGender === 'female'}
                  data-testid="choose-female"
                >
                  <strong>扮演女生</strong>
                  <span>25 岁 · 产品经理 · 职场第 3 年</span>
                </button>
              </div>
              <p className="role-picker__opponent">
                当前对手：{briefing.character.name} ·{' '}
                {briefing.character.gender === 'female' ? '女生' : '男生'}
              </p>
            </fieldset>
          </div>

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
          <Portrait
            performance={previewPerformance}
            character={briefing.character}
          />
          <blockquote>
            “你有七句话。挑几句真的。”
            <span>— {briefing.character.name}</span>
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
