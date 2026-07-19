import { useMemo, useState } from 'react';
import type {
  Capabilities,
  EndingTier,
  ScenarioId,
  ScenarioSummary,
  ScenarioType,
} from '../../shared/contracts.js';
import type { LocalProgress } from '../progress.js';

type TypeFilter = 'all' | ScenarioType;
type CompletionFilter = 'all' | 'incomplete' | 'completed';

interface ScenarioSelectProps {
  scenarios: ScenarioSummary[];
  progress: LocalProgress;
  capabilities: Capabilities | null;
  busy: boolean;
  error: string | null;
  onSelect: (scenarioId: ScenarioId) => void;
  onClearProgress: () => void;
}

const typeFilters: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'invitation', label: '邀约' },
  { value: 'comfort', label: '安慰' },
  { value: 'alignment', label: '磨合' },
  { value: 'repair', label: '修复' },
];

const completionFilters: Array<{
  value: CompletionFilter;
  label: string;
}> = [
  { value: 'all', label: '全部' },
  { value: 'incomplete', label: '未完成' },
  { value: 'completed', label: '已完成' },
];

export function ScenarioSelect({
  scenarios,
  progress,
  capabilities,
  busy,
  error,
  onSelect,
  onClearProgress,
}: ScenarioSelectProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [completionFilter, setCompletionFilter] =
    useState<CompletionFilter>('all');

  const visibleScenarios = useMemo(
    () =>
      scenarios.filter((scenario) => {
        const completed =
          progress.scenarios[scenario.id]?.completed === true;
        const matchesType =
          typeFilter === 'all' || scenario.type === typeFilter;
        const matchesCompletion =
          completionFilter === 'all' ||
          (completionFilter === 'completed' && completed) ||
          (completionFilter === 'incomplete' && !completed);
        return matchesType && matchesCompletion;
      }),
    [completionFilter, progress.scenarios, scenarios, typeFilter],
  );

  function confirmClear() {
    if (
      window.confirm(
        '确定清除本机的完成记录、最佳成绩和结局收藏吗？此操作不可恢复。',
      )
    ) {
      onClearProgress();
    }
  }

  return (
    <main className="level-screen">
      <header className="brand-bar level-topbar">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="关系修炼首页"
        >
          <span className="brand__mark">修</span>
          <span>
            <b>关系修炼</b>
          </span>
        </a>
        <div className="provider-badge" data-testid="provider-badge">
          <span className="provider-badge__dot" />
          {providerLabel(capabilities)}
        </div>
      </header>

      <section className="level-intro">
        <p className="eyebrow">八次对话 · 八种靠近</p>
        <h1>把关系练成<br />两个人的功课</h1>
        <p>
          秋雾与徐坤从第一次邀约走到下一年的家。每关独立结算，
          所有关卡都可以直接开始。
        </p>
      </section>

      <section className="level-filters" aria-label="关卡筛选">
        <FilterGroup
          label="类型"
          values={typeFilters}
          current={typeFilter}
          onChange={setTypeFilter}
          testIdPrefix="type-filter"
        />
        <FilterGroup
          label="进度"
          values={completionFilters}
          current={completionFilter}
          onChange={setCompletionFilter}
          testIdPrefix="progress-filter"
        />
      </section>

      {error && (
        <p className="level-error" role="alert">
          {error}
        </p>
      )}

      <section
        className="scenario-grid"
        aria-label="八关目录"
        data-testid="scenario-grid"
      >
        {visibleScenarios.map((scenario) => {
          const scenarioProgress = progress.scenarios[scenario.id];
          return (
            <button
              key={scenario.id}
              type="button"
              className={`scenario-card scenario-card--${scenario.type} ${
                scenarioProgress?.completed ? 'is-completed' : ''
              }`}
              disabled={busy}
              onClick={() => onSelect(scenario.id)}
              data-testid={`scenario-card-${scenario.id}`}
            >
              <span className="scenario-card__number">
                {String(scenario.number).padStart(2, '0')}
              </span>
              <span className="scenario-card__tags">
                <i>{typeLabel(scenario.type)}</i>
                <i>{scenario.difficulty}</i>
                <i>{scenario.maxRounds} 轮</i>
              </span>
              <strong>{scenario.title}</strong>
              <p>{scenario.summary}</p>
              <span className="scenario-card__record">
                <b>
                  {scenarioProgress?.completed ? '已完成' : '未完成'}
                </b>
                <span>
                  男{' '}
                  <TierMark tier={scenarioProgress?.genders.male?.bestTier} />
                  {' · '}
                  女{' '}
                  <TierMark
                    tier={scenarioProgress?.genders.female?.bestTier}
                  />
                </span>
              </span>
            </button>
          );
        })}
      </section>

      {visibleScenarios.length === 0 && (
        <p className="empty-levels">这个筛选下还没有关卡记录。</p>
      )}

      <footer className="level-footer">
        <p>本机只保存完成记录、分身份最佳成绩和已见结局。</p>
        <button type="button" onClick={confirmClear}>
          清除本机进度
        </button>
      </footer>
    </main>
  );
}

function FilterGroup<T extends string>({
  label,
  values,
  current,
  onChange,
  testIdPrefix,
}: {
  label: string;
  values: Array<{ value: T; label: string }>;
  current: T;
  onChange: (value: T) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="filter-group">
      <span>{label}</span>
      <div>
        {values.map((item) => (
          <button
            key={item.value}
            type="button"
            className={current === item.value ? 'is-active' : ''}
            aria-pressed={current === item.value}
            onClick={() => onChange(item.value)}
            data-testid={`${testIdPrefix}-${item.value}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
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

function providerLabel(capabilities: Capabilities | null): string {
  if (!capabilities) return '连接中';
  if (capabilities.textProvider === 'mock') return '本地模式';
  if (capabilities.textProvider === 'openai') return '在线角色';
  return '在线角色';
}
