import type {
  ActorPerformance,
  DirectorDecision,
  EvaluationSignals,
  JudgeVerdict,
  MetricDelta,
  TranscriptEntry,
} from '../../shared/contracts.js';
import {
  createTurningPointEvent,
  getEndingDefinition,
  getScenarioDefinition,
  type ScenarioDefinition,
} from '../scenario.js';
import type {
  ActorContext,
  AiProvider,
  DirectorContext,
  JudgeContext,
  StructuredCompletionRequest,
} from './types.js';

const UNDERSTANDING_PATTERN =
  /我(?:知道|明白|听见|看见)|难受|失望|委屈|舍不得|疲惫|累|难堪|越界|被否|被笑|不想|需要|期待|在意的是/;
const ACTION_PATTERN =
  /现在|今晚|明天|早上|上午|下午|周六|周日|下周|几点|十分钟|一起|我来|先去|再去|写进|安排|确认|删除|道歉|看房|吃点|留下/;
const RESPECT_PATTERN =
  /你来选|由你|如果你愿意|不逼|不勉强|可以拒绝|可以改|按你|先听你|你决定|尊重|不替你|选择权/;
const CARE_PATTERN =
  /在意你|你很重要|陪你|想和你|不想你一个人|认真|我会在|站在你|和你一起|我留下|我想听/;
const QUESTION_PATTERN = /你(?:想|需要|愿意|希望)|告诉我|我想听|你来选/;
const DEFENSIVE_PATTERN =
  /但是|可是|可我|因为|手机没电|临时加班|太忙|也没办法|你也|我只是|本来以为/;
const DISMISSIVE_PATTERN =
  /至于吗|小题大做|别闹|冷静点|想太多|随便你|爱走就走|别作|矫情|不就是|天气而已|一个提案而已/;
const VULNERABLE_PATTERN = /我也怕|我害怕|我慌|我不知道怎么|我不敢|我后悔/;

export class MockAiProvider implements AiProvider {
  readonly kind = 'mock' as const;
  readonly model = 'deterministic-eight-scenarios-v1';

  async generate<T>(request: StructuredCompletionRequest<T>) {
    const startedAt = Date.now();
    let output: DirectorDecision | ActorPerformance | JudgeVerdict;

    if (request.agent === 'director') {
      output = mockDirector(request.context as DirectorContext);
    } else if (request.agent === 'actor') {
      output = mockActor(request.context as ActorContext);
    } else {
      output = mockJudge(request.context as JudgeContext);
    }

    const data = request.schema.parse(output);
    const inputTokens = estimateTokens(
      `${request.system}${JSON.stringify(request.input)}`,
    );
    const outputTokens = estimateTokens(JSON.stringify(data));

    return {
      data,
      usage: {
        provider: this.kind,
        model: this.model,
        agent: request.agent,
        sessionId: request.context.state.sessionId,
        occurredAt: new Date().toISOString(),
        success: true,
        attempts: 1,
        measured: false,
        latencyMs: Math.max(0, Date.now() - startedAt),
        inputTokens,
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
        outputTokens,
        reasoningTokens: 0,
        totalTokens: inputTokens + outputTokens,
        errorCode: null,
      },
    };
  }
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 3));
}

export function mockDirector(context: DirectorContext): DirectorDecision {
  const text = context.playerLine;
  const state = context.state;
  const definition = getScenarioDefinition(context.briefing.id);
  const signals = evaluateSignals(text, definition);
  const asksCharacter = QUESTION_PATTERN.test(text);
  const defensive = DEFENSIVE_PATTERN.test(text);
  const dismissive = DISMISSIVE_PATTERN.test(text);
  const vulnerable = VULNERABLE_PATTERN.test(text);

  let warmth = -1;
  let pressure = 2;
  let openness = 0;

  if (signals.understoodNeed) {
    warmth += 7;
    pressure -= 6;
    openness += 5;
  }
  if (signals.proposedAction) {
    warmth += 6;
    pressure -= 4;
    openness += 3;
  }
  if (signals.respectedChoice) {
    warmth += 4;
    pressure -= 3;
    openness += 3;
  }
  if (signals.sincereCare) {
    warmth += 4;
    pressure -= 3;
    openness += 4;
  }
  if (asksCharacter) {
    warmth += 2;
    pressure -= 1;
  }
  if (vulnerable) {
    warmth += 3;
    pressure -= 2;
    openness += 5;
  }
  if (defensive) {
    warmth -= 6;
    pressure += 8;
    openness -= 3;
  }
  if (dismissive) {
    warmth -= 15;
    pressure += 20;
    openness -= 8;
  }

  const delta: MetricDelta = {
    warmth: clamp(warmth, -18, 16),
    pressure: clamp(pressure, -16, 22),
    openness: clamp(openness, -12, 16),
  };

  const event =
    context.round === definition.turning.round
      ? createTurningPointEvent(
          context.round,
          state.sessionId.slice(0, 8),
          context.briefing,
        )
      : null;

  const projectedFlags = mergeSignals(state.flags, signals);
  const projectedWarmth = state.metrics.warmth + delta.warmth;
  const projectedPressure = state.metrics.pressure + delta.pressure;
  const signalCount = Object.values(projectedFlags).filter(Boolean).length;
  const shouldEnd =
    (context.round >= definition.thresholds.sMinRound &&
      projectedWarmth >= definition.thresholds.sWarmth &&
      projectedPressure <= definition.thresholds.sPressure &&
      projectedFlags.understoodNeed &&
      projectedFlags.proposedAction &&
      signalCount >= 3) ||
    projectedWarmth <= 8 ||
    projectedPressure >= 94;

  return {
    assessment: describeAssessment(signals, defensive, dismissive),
    delta,
    discoveries: signals,
    event,
    actorBrief: buildActorBrief(
      signals,
      defensive,
      dismissive,
      vulnerable,
      Boolean(event),
    ),
    shouldEnd,
    suggestedEndReason:
      projectedWarmth <= 8 || projectedPressure >= 94
        ? 'relationship_break'
        : shouldEnd
          ? 'breakthrough'
          : null,
  };
}

export function mockActor(context: ActorContext): ActorPerformance {
  const { director, state, playerLine, activeEvent } = context;
  const definition = getScenarioDefinition(context.briefing.id);
  const signals = evaluateSignals(playerLine, definition);
  const dismissive = DISMISSIVE_PATTERN.test(playerLine);
  const defensive = DEFENSIVE_PATTERN.test(playerLine);
  const line = definition.mock;

  if (dismissive) {
    return performance(
      line.dismissive,
      'done',
      'icy',
      'flat',
      'narrowed',
      'line',
      'turned-away',
      'checks-phone',
      '对方把视线移开，刚才留下的谈话空间迅速变窄。',
      director.delta,
    );
  }

  if (signals.understoodNeed && signals.proposedAction) {
    return performance(
      line.breakthrough,
      state.metrics.warmth >= 62 ? 'softening' : 'testing',
      'quiet',
      'raised',
      'direct',
      'parted',
      'leaning',
      'reaches-out',
      '对方没有立刻答应，但第一次把身体转回你这边。',
      director.delta,
    );
  }

  if (signals.understoodNeed) {
    return performance(
      line.understood,
      'hurt',
      'shaky',
      'soft',
      'wet',
      'downturned',
      'standing',
      'wipes-eye',
      '对方停了一拍，让那句被理解的话真正落下来。',
      director.delta,
    );
  }

  if (signals.proposedAction) {
    return performance(
      line.action,
      'testing',
      'sharp',
      'raised',
      'direct',
      'line',
      'arms-crossed',
      'none',
      '对方开始检验方案，而不是直接把它挡回去。',
      director.delta,
    );
  }

  if (signals.respectedChoice) {
    return performance(
      line.respectful,
      'softening',
      'soft',
      'soft',
      'direct',
      'parted',
      'relaxed',
      'nods',
      '对方肩膀松了一点，仍把最终选择留在自己手里。',
      director.delta,
    );
  }

  if (defensive) {
    return performance(
      line.defensive,
      'angry',
      'dry',
      'furrowed',
      'direct',
      'smirk',
      'arms-crossed',
      'none',
      '对方用一句很轻的反问，截住继续扩张的理由。',
      director.delta,
    );
  }

  if (activeEvent?.id === definition.turning.id) {
    return performance(
      line.event,
      'hurt',
      'shaky',
      'soft',
      'averted',
      'downturned',
      definition.turning.pose,
      definition.turning.gesture,
      render(definition.turning.stageDirection, context),
      director.delta,
    );
  }

  if (state.metrics.pressure <= 42) {
    return performance(
      line.softening,
      'softening',
      'soft',
      'soft',
      'direct',
      'parted',
      'relaxed',
      'nods',
      '对方仍在确认细节，但不再只想着结束对话。',
      director.delta,
    );
  }

  return performance(
    line.guarded,
    'guarded',
    'sharp',
    'furrowed',
    'direct',
    'line',
    'standing',
    'none',
    '对方保持原来的位置，把问题重新推回你面前。',
    director.delta,
  );
}

export function mockJudge(context: JudgeContext): JudgeVerdict {
  const { state, lockedEnding, transcript } = context;
  const definition = getScenarioDefinition(context.briefing.id);
  const ending = getEndingDefinition(
    context.briefing.id,
    lockedEnding.endingId,
  );
  const playerLines = transcript.filter((entry) => entry.speaker === 'player');
  const score = clamp(
    Math.round(
      state.metrics.warmth * 0.5 +
        (100 - state.metrics.pressure) * 0.3 +
        state.metrics.openness * 0.1 +
        Object.values(state.flags).filter(Boolean).length * 2.5,
    ),
    0,
    100,
  );

  const titleByTier = {
    S: '关系实干家',
    A: '留白协商员',
    C: '气氛绕行者',
  } as const;
  const roastByTier = {
    S: '你终于把在意从语气词做成了一个对方可以选择的具体行动。',
    A: '你把局面从立即结束抢救成了愿意再谈，下一版别只修措辞。',
    C: `${context.briefing.character.name}需要的是一个能共同决定的人，你交付的却主要是解释。`,
  } as const;

  return {
    endingId: lockedEnding.endingId,
    tier: lockedEnding.tier,
    score,
    title: titleByTier[lockedEnding.tier],
    roast: roastByTier[lockedEnding.tier],
    epilogue: lockedEnding.defaultEpilogue,
    goal: {
      label: context.briefing.goal,
      met: lockedEnding.tier !== 'C',
      detail: renderText(ending.goalDetail, context.briefing.character.name),
    },
    keyMoments: selectKeyMoments(playerLines, definition),
    shareText:
      `我在《关系修炼》第 ${definition.number} 关打出「${ending.title}」${lockedEnding.tier} 级结局，${score} 分，称号「${titleByTier[lockedEnding.tier]}」。`,
  };
}

function evaluateSignals(
  text: string,
  definition: ScenarioDefinition,
): EvaluationSignals {
  return {
    understoodNeed:
      UNDERSTANDING_PATTERN.test(text) ||
      includesKeyword(text, definition.signalKeywords.understoodNeed),
    proposedAction:
      ACTION_PATTERN.test(text) ||
      includesKeyword(text, definition.signalKeywords.proposedAction),
    respectedChoice: RESPECT_PATTERN.test(text),
    sincereCare: CARE_PATTERN.test(text),
  };
}

function mergeSignals(
  current: EvaluationSignals,
  next: EvaluationSignals,
): EvaluationSignals {
  return {
    understoodNeed: current.understoodNeed || next.understoodNeed,
    proposedAction: current.proposedAction || next.proposedAction,
    respectedChoice: current.respectedChoice || next.respectedChoice,
    sincereCare: current.sincereCare || next.sincereCare,
  };
}

function includesKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function performance(
  line: string,
  emotion: ActorPerformance['emotion'],
  tone: ActorPerformance['tone'],
  brows: ActorPerformance['expression']['brows'],
  eyes: ActorPerformance['expression']['eyes'],
  mouth: ActorPerformance['expression']['mouth'],
  pose: ActorPerformance['action']['pose'],
  gesture: ActorPerformance['action']['gesture'],
  stageDirection: string,
  stateChanges: MetricDelta,
): ActorPerformance {
  return {
    line,
    emotion,
    tone,
    expression: { brows, eyes, mouth },
    action: { pose, gesture, stageDirection },
    stateChanges,
  };
}

function describeAssessment(
  signals: EvaluationSignals,
  defensive: boolean,
  dismissive: boolean,
): string {
  if (dismissive) return '玩家贬低当下需要，对话压力明显上升。';
  const count = Object.values(signals).filter(Boolean).length;
  if (count >= 3) return '玩家同时理解需要、尊重选择并给出行动，局势出现关键突破。';
  if (signals.understoodNeed) return '玩家说中了对方当下真正介意或需要的部分。';
  if (signals.proposedAction) return '玩家给出行动框架，仍需确认它是否尊重对方选择。';
  if (defensive) return '玩家继续解释自己，冲突焦点从对方身上移开。';
  if (signals.sincereCare) return '玩家表达真实在意，具体承接仍然不足。';
  return '回应较抽象，局势轻微消耗且没有形成新进展。';
}

function buildActorBrief(
  signals: EvaluationSignals,
  defensive: boolean,
  dismissive: boolean,
  vulnerable: boolean,
  event: boolean,
): string {
  if (event) return '让转折事件进入现场，短暂暴露情绪，再把选择交还玩家。';
  if (dismissive) return '冷到接近结束，用场景细节点出玩家仍未看见边界。';
  if (signals.understoodNeed && signals.proposedAction) {
    return '出现动摇，用一个具体问题检验行动是否真实且可共同决定。';
  }
  if (signals.understoodNeed) return '承认对方终于看见需要，仍要求继续说具体。';
  if (signals.respectedChoice) return '压力下降一格，表现选择权被归还后的松动。';
  if (vulnerable) return '接受玩家的脆弱，但追问它如何转化为可靠行动。';
  if (defensive) return '用一句贴合人物语言指纹的轻吐槽拆穿理由清单。';
  return '保持戒备，用当前关卡的具体问题把焦点推回对方需要。';
}

function selectKeyMoments(
  playerLines: TranscriptEntry[],
  definition: ScenarioDefinition,
): JudgeVerdict['keyMoments'] {
  const ranked = [...playerLines]
    .map((entry) => {
      const signals = evaluateSignals(entry.text, definition);
      const helped = Object.values(signals).some(Boolean);
      const hurt =
        DEFENSIVE_PATTERN.test(entry.text) ||
        DISMISSIVE_PATTERN.test(entry.text);
      return {
        entry,
        helped,
        hurt,
        weight: hurt ? 3 : helped ? 2 : 1,
      };
    })
    .sort((left, right) => right.weight - left.weight)
    .slice(0, Math.min(3, Math.max(1, playerLines.length)));

  return ranked.map(({ entry, helped, hurt }) => ({
    round: entry.round,
    quote: entry.text.slice(0, 100),
    analysis: hurt
      ? '这句话把焦点拉回理由或否定，让对方更需要保护自己的选择。'
      : helped
        ? '这句话提供了具体理解、行动或选择空间，关系状态因此出现实质变化。'
        : '这句话维持了对话，却缺少能让对方重新参与决定的具体信息。',
    impact: hurt ? 'hurt' : helped ? 'helped' : 'turned',
  }));
}

function render(value: string, context: ActorContext): string {
  const pronoun =
    context.briefing.character.gender === 'female' ? '她' : '他';
  return value
    .replaceAll('{name}', context.briefing.character.name)
    .replaceAll('{pronoun}', pronoun);
}

function renderText(value: string, characterName: string): string {
  return value.replaceAll('{name}', characterName);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
