import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  Difficulty,
  EndingTier,
  ScenarioBriefing,
  ScenarioId,
  ScenarioSummary,
  ScenarioType,
} from '../../shared/contracts.js';
import type { LocalProgress } from '../progress.js';
import {
  DEFAULT_SCENARIO_FILTERS,
  filterScenarios,
  reconcileSelectedScenario,
  type CompletionFilter,
  type ScenarioFilters,
} from '../scenario-filters.js';
import { BrandLogo } from './BrandLogo.js';

interface ScenarioSelectProps {
  scenarios: ScenarioSummary[];
  progress: LocalProgress;
  selectedScenarioId: ScenarioId;
  selectedBriefing: ScenarioBriefing | null;
  previewLoading: boolean;
  busy: boolean;
  error: string | null;
  onSelect: (scenarioId: ScenarioId) => void;
  onEnter: () => void;
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
  { value: '高压', label: '高压' },
];

const completionFilters: Array<{
  value: CompletionFilter;
  label: string;
}> = [
  { value: 'all', label: '全部' },
  { value: 'incomplete', label: '未完成' },
  { value: 'completed', label: '已完成' },
];

const benefits = [
  ['自由表达', '不选台词'],
  ['八段关系', '真实场景'],
  ['多模态演出', '文字 · 语音 · 影像'],
  ['隐私优先', '进度只留本机'],
] as const;

export function ScenarioSelect({
  scenarios,
  progress,
  selectedScenarioId,
  selectedBriefing,
  previewLoading,
  busy,
  error,
  onSelect,
  onEnter,
  onOpenSettings,
  onClearProgress,
}: ScenarioSelectProps) {
  const [filters, setFilters] = useState<ScenarioFilters>(
    DEFAULT_SCENARIO_FILTERS,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const visibleScenarios = useMemo(
    () => filterScenarios(scenarios, progress, filters),
    [filters, progress, scenarios],
  );

  useEffect(() => {
    const reconciled = reconcileSelectedScenario(
      selectedScenarioId,
      visibleScenarios,
    );
    if (reconciled && reconciled !== selectedScenarioId) onSelect(reconciled);
  }, [onSelect, selectedScenarioId, visibleScenarios]);

  function confirmClear() {
    if (
      window.confirm(
        '确定清除本机的完成记录、最佳成绩和结局收藏吗？此操作不可恢复。',
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
        <p className="eyebrow">八次对话 · 八种靠近</p>
        <h1>把关系练成<br />两个人的功课</h1>
        <p>在一次次真实对话里，练习理解、表达与修复。</p>
      </section>

      <section className="benefit-strip" aria-label="玩法特点">
        {benefits.map(([title, detail]) => (
          <article key={title}>
            <strong>{title}</strong>
            <span>{detail}</span>
          </article>
        ))}
      </section>

      {error && (
        <p className="level-error" role="alert">
          {error}
        </p>
      )}

      <section className="scenario-browser" aria-label="关卡选择">
        <div className="scenario-browser__toolbar">
          <div>
            <span>场景目录</span>
            <strong>{visibleScenarios.length} / {scenarios.length}</strong>
          </div>
          <button
            type="button"
            className={filtersOpen ? 'is-active' : ''}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="scenario-filters"
          >
            <FilterIcon />
            筛选
          </button>
        </div>

        <aside
          className={`scenario-filters ${filtersOpen ? 'is-open' : ''}`}
          id="scenario-filters"
          aria-label="筛选关卡"
        >
          <div className="scenario-filters__heading">
            <span>筛选</span>
            <strong>{visibleScenarios.length} 个场景</strong>
          </div>
          <FilterSection label="完成状态">
            {completionFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                className={
                  filters.completion === item.value ? 'is-active' : ''
                }
                aria-pressed={filters.completion === item.value}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    completion: item.value,
                  }))
                }
                data-testid={`progress-filter-${item.value}`}
              >
                <span>{item.label}</span>
                <i aria-hidden="true" />
              </button>
            ))}
          </FilterSection>
          <FilterSection label="关系类型">
            {typeFilters.map((item) => (
              <ToggleFilter
                key={item.value}
                label={item.label}
                selected={filters.types.includes(item.value)}
                onToggle={() =>
                  setFilters((current) => ({
                    ...current,
                    types: toggleValue(current.types, item.value),
                  }))
                }
                testId={`type-filter-${item.value}`}
              />
            ))}
          </FilterSection>
          <FilterSection label="对话强度">
            {difficultyFilters.map((item) => (
              <ToggleFilter
                key={item.value}
                label={item.label}
                selected={filters.difficulties.includes(item.value)}
                onToggle={() =>
                  setFilters((current) => ({
                    ...current,
                    difficulties: toggleValue(
                      current.difficulties,
                      item.value,
                    ),
                  }))
                }
                testId={`difficulty-filter-${item.value}`}
              />
            ))}
          </FilterSection>
          <button
            className="clear-filters"
            type="button"
            disabled={!hasFilters}
            onClick={() => setFilters(DEFAULT_SCENARIO_FILTERS)}
          >
            清除筛选
          </button>
        </aside>

        <section
          className="scenario-list"
          aria-label="关卡目录"
          data-testid="scenario-grid"
        >
          {visibleScenarios.map((scenario) => {
            const scenarioProgress = progress.scenarios[scenario.id];
            const selected = selectedScenarioId === scenario.id;
            return (
              <button
                key={scenario.id}
                type="button"
                className={[
                  'scenario-card',
                  `scenario-card--${scenario.type}`,
                  scenarioProgress?.completed ? 'is-completed' : '',
                  selected ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={busy}
                aria-pressed={selected}
                onClick={() => onSelect(scenario.id)}
                data-testid={`scenario-card-${scenario.id}`}
              >
                <span className="scenario-card__number">
                  {String(scenario.number).padStart(2, '0')}
                </span>
                <span className="scenario-card__copy">
                  <span className="scenario-card__tags">
                    <i>{typeLabel(scenario.type)}</i>
                    <i>{scenario.difficulty}</i>
                    <i>{scenario.maxRounds} 轮</i>
                  </span>
                  <strong>{scenario.title}</strong>
                  <span className="scenario-card__record">
                    <b>
                      {scenarioProgress?.completed ? '已完成' : '未完成'}
                    </b>
                    <span>
                      徐坤{' '}
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
                </span>
                <ChevronIcon />
              </button>
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

        <aside
          className="scenario-preview"
          aria-live="polite"
          data-testid="scenario-preview"
        >
          {previewLoading || !selectedBriefing ? (
            <div className="scenario-preview__loading">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <>
              <div className="scenario-preview__meta">
                <span>第 {selectedBriefing.number} 关</span>
                <span>{typeLabel(selectedBriefing.type)}</span>
                <span>{selectedBriefing.difficulty}</span>
                <span>{selectedBriefing.maxRounds} 轮</span>
              </div>
              <h2>{selectedBriefing.title}</h2>
              <div className="scenario-preview__facts">
                <article>
                  <span>时间与地点</span>
                  <strong>{selectedBriefing.timeAndPlace}</strong>
                </article>
                <article>
                  <span>事情发生之前</span>
                  <p>{selectedBriefing.premise}</p>
                </article>
                <article className="scenario-preview__goal">
                  <span>这一次要做到</span>
                  <p>{selectedBriefing.goal}</p>
                </article>
              </div>
              <div className="scenario-preview__opponent">
                <span>当前对手</span>
                <strong>{selectedBriefing.character.name}</strong>
                <p>{selectedBriefing.character.personality}</p>
              </div>
              <button
                className="scenario-preview__enter"
                type="button"
                onClick={onEnter}
                disabled={busy || previewLoading}
                data-testid="enter-scenario"
              >
                查看场景
                <ArrowIcon />
              </button>
            </>
          )}
        </aside>
      </section>

      <footer className="level-footer">
        <p>本机只保存完成记录、分身份最佳成绩和已见结局。</p>
        <button type="button" onClick={confirmClear}>
          清除本机进度
        </button>
      </footer>
    </main>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="filter-section">
      <h2>{label}</h2>
      <div>{children}</div>
    </section>
  );
}

function ToggleFilter({
  label,
  selected,
  onToggle,
  testId,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      className={selected ? 'is-active' : ''}
      aria-pressed={selected}
      onClick={onToggle}
      data-testid={testId}
    >
      <span>{label}</span>
      <i aria-hidden="true" />
    </button>
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

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="scenario-card__chevron" viewBox="0 0 24 24" aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}
