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
  onBack: () => void;
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
    stageDirection: '对方正在等你先开口。',
  },
  stateChanges: {
    warmth: 0,
    pressure: 0,
    openness: 0,
  },
};

export function Briefing({
  briefing,
  capabilities,
  playerGender,
  starting,
  onPlayerGenderChange,
  onBack,
  onStart,
}: BriefingProps) {
  return (
    <main className="briefing-screen">
      <header className="brand-bar">
        <button
          className="brand brand-button"
          type="button"
          onClick={onBack}
          aria-label="返回关系修炼关卡"
        >
          <span className="brand__mark">修</span>
          <span><b>关系修炼</b></span>
        </button>
        <div className="provider-badge" data-testid="provider-badge">
          <span className="provider-badge__dot" />
          {providerLabel(capabilities)}
        </div>
      </header>

      <section className="briefing-hero">
        <div className="briefing-copy">
          <p className="eyebrow">
            第 {briefing.number} 关 · {typeLabel(briefing.type)} ·{' '}
            {briefing.difficulty}
          </p>
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
              <p>你可以自由表达。每一句都会改变关系温度、对话压力和结局。</p>
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
              className="back-button"
              type="button"
              onClick={onBack}
              disabled={starting}
              data-testid="back-to-levels"
            >
              返回关卡
            </button>
            <button
              className="start-button"
              type="button"
              onClick={onStart}
              disabled={starting}
              data-testid="start-game"
            >
              {starting ? '正在进入…' : '开始挑战'}
            </button>
            <span>
              {briefing.maxRounds} 轮 · 约 {briefing.maxRounds + 1} 分钟 ·
              自由输入
            </span>
          </div>
        </div>

        <div className="briefing-visual">
          <Portrait
            performance={previewPerformance}
            character={briefing.character}
          />
          <blockquote>
            “{briefing.openingLine}”
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
  return '在线角色';
}

function typeLabel(type: ScenarioBriefing['type']): string {
  return {
    invitation: '邀约',
    comfort: '安慰',
    alignment: '磨合',
    repair: '修复',
  }[type];
}
