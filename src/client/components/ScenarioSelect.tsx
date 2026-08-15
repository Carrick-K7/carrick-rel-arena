import { useMemo, useState } from 'react';
import type {
  Difficulty,
  EndingTier,
  ScenarioId,
  ScenarioSummary,
  ScenarioType,
} from '../../shared/contracts.js';
import type { LocalProgress } from '../progress.js';
import {
  DEFAULT_SCENARIO_FILTERS,
  filterScenarios,
  type CompletionFilter,
  type ScenarioFilters,
} from '../scenario-filters.js';
import { BrandLogo } from './BrandLogo.js';

interface ScenarioSelectProps {
  scenarios: ScenarioSummary[];
  progress: LocalProgress;
  busy: boolean;
  error: string | null;
  artifactCounts: Partial<Record<ScenarioId, number>>;
  onEnterScenario: (scenarioId: ScenarioId) => void;
  onOpenArtifacts: (scenarioId: ScenarioId) => void;
  onOpenSettings: () => void;
  onClearProgress: () => void;
}

const typeFilters: Array<{ value: ScenarioType; label: string }> = [
  { value: 'invitation', label: '邀约' },
  { value: 'comfort', label: '安慰' },
  { value: 'alignment', label: '磨合' },
  { value: 'repair', label: '修复' },
];

const difficultyFilters: Array<{
  value: Difficulty;
  label: string;
}> = [
  { value: '入门', label: '入门' },
  { value: '进阶', label: '进阶' },
  { value: '挑战', label: '挑战' },
];

const completionFilters: Array<{
  value: CompletionFilter;
  label: string;
}> = [
  { value: 'all', label: '全部' },
  { value: 'incomplete', label: '未完成' },
  { value: 'completed', label: '已完成' },
];

const advantages = [
  [
    '真实场景',
    '邀约、安慰、磨合与修复，来自日常关系里的真实难题。',
  ],
  [
    '自由表达',
    '不选预设台词，用自己的话试探、解释或靠近。',
  ],
  [
    '多模态演出',
    '文字、语音与实时影像组合，让回应拥有表情与声音。',
  ],
] as const;

export function ScenarioSelect({
  scenarios,
  progress,
  busy,
  error,
  artifactCounts,
  onEnterScenario,
  onOpenArtifacts,
  onOpenSettings,
  onClearProgress,
}: ScenarioSelectProps) {
  const [filters, setFilters] = useState<ScenarioFilters>(
    DEFAULT_SCENARIO_FILTERS,
  );
  const visibleScenarios = useMemo(
    () => filterScenarios(scenarios, progress, filters),
    [filters, progress, scenarios],
  );

  function confirmClear() {
    if (
      window.confirm(
        '确定清除本机的完成记录、最佳成绩、结局收藏和回忆索引吗？此操作不可恢复。',
      )
    ) {
      onClearProgress();
    }
  }

  const hasFilters =
    filters.completion !== 'all' ||
    filters.types.length > 0 ||
    filters.difficulties.length > 0;

  return (
    <main className="level-screen">
      <header className="brand-bar level-topbar">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="关系修炼首页"
        >
          <BrandLogo />
        </a>
        <button
          className="header-icon-button"
          type="button"
          onClick={onOpenSettings}
          aria-label="打开互动设置"
          data-testid="open-modality-settings"
        >
          <SettingsIcon />
        </button>
      </header>

      <section className="level-intro">
        <h1>练习那些<br />让彼此更靠近的回应</h1>
        <div
          className="level-intro__advantages"
          aria-label="关系修炼的核心优势"
        >
          {advantages.map(([title, detail], index) => (
            <article key={title}>
              <i aria-hidden="true">0{index + 1}</i>
              <div>
                <h2>{title}</h2>
                <p>{detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {error && (
        <p className="level-error" role="alert">
          {error}
        </p>
      )}

      <section className="scenario-browser" aria-label="关卡选择">
        <div className="scenario-toolbar">
          <div className="segmented" role="group" aria-label="完成状态">
            {completionFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filters.completion === item.value}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    completion: item.value,
                  }))
                }
                data-testid={`progress-filter-${item.value}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div
            className="scenario-toolbar__group"
            role="group"
            aria-label="关系类型"
          >
            {typeFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                className="chip"
                aria-pressed={filters.types.includes(item.value)}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    types: toggleValue(current.types, item.value),
                  }))
                }
                data-testid={`type-filter-${item.value}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div
            className="scenario-toolbar__group"
            role="group"
            aria-label="对话强度"
          >
            {difficultyFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                className="chip"
                aria-pressed={filters.difficulties.includes(item.value)}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    difficulties: toggleValue(
                      current.difficulties,
                      item.value,
                    ),
                  }))
                }
                data-testid={`difficulty-filter-${item.value}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="scenario-toolbar__count">
            {visibleScenarios.length} / {scenarios.length} 个场景
          </span>
          {hasFilters && (
            <button
              className="scenario-toolbar__clear"
              type="button"
              onClick={() => setFilters(DEFAULT_SCENARIO_FILTERS)}
            >
              清除筛选
            </button>
          )}
        </div>

        <section
          className="scenario-grid"
          aria-label="关卡目录"
          data-testid="scenario-grid"
        >
          {visibleScenarios.map((scenario) => {
            const scenarioProgress = progress.scenarios[scenario.id];
            const artifacts = artifactCounts[scenario.id] ?? 0;
            return (
              <article
                key={scenario.id}
                className={[
                  'scenario-card',
                  'panel',
                  `scenario-card--${scenario.type}`,
                  scenarioProgress?.completed ? 'is-completed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <button
                  type="button"
                  className="scenario-card__main"
                  disabled={busy}
                  onClick={() => onEnterScenario(scenario.id)}
                  data-testid={`scenario-card-${scenario.id}`}
                >
                  <span className="scenario-card__number" aria-hidden="true">
                    {String(scenario.number).padStart(2, '0')}
                  </span>
                  <span className="scenario-card__tags">
                    <i>{typeLabel(scenario.type)}</i>
                    <i>{scenario.difficulty}</i>
                    <i>{scenario.maxRounds} 轮</i>
                  </span>
                  <strong className="scenario-card__title">
                    {scenario.title}
                  </strong>
                  <span className="scenario-card__record">
                    <b>
                      {scenarioProgress?.completed ? '已完成' : '未完成'}
                    </b>
                    <span>
                      江影{' '}
                      <TierMark
                        tier={scenarioProgress?.genders.male?.bestTier}
                      />
                      <i>·</i>
                      秋雾{' '}
                      <TierMark
                        tier={scenarioProgress?.genders.female?.bestTier}
                      />
                    </span>
                  </span>
                </button>
                {artifacts > 0 && (
                  <button
                    type="button"
                    className="scenario-card__memories"
                    onClick={() => onOpenArtifacts(scenario.id)}
                    disabled={busy}
                    data-testid="open-artifact-library"
                  >
                    查看回忆
                    <span>{artifacts} 次</span>
                  </button>
                )}
              </article>
            );
          })}
          {visibleScenarios.length === 0 && (
            <div className="empty-levels">
              <strong>没有符合条件的场景</strong>
              <p>换一组筛选条件，再看看其他关系练习。</p>
              <button
                type="button"
                onClick={() => setFilters(DEFAULT_SCENARIO_FILTERS)}
              >
                查看全部场景
              </button>
            </div>
          )}
        </section>
      </section>

      <footer className="level-footer">
        <button type="button" onClick={confirmClear}>
          清除本机进度
        </button>
      </footer>
    </main>
  );
}

function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function typeLabel(type: ScenarioType): string {
  return {
    invitation: '邀约',
    comfort: '安慰',
    alignment: '磨合',
    repair: '修复',
  }[type];
}

function TierMark({ tier }: { tier: EndingTier | undefined }) {
  if (!tier) return <b className="tier">—</b>;
  return <b className={`tier tier--${tier.toLowerCase()}`}>{tier}</b>;
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />
    </svg>
  );
}
