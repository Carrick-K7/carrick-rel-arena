import type {
  ActorPerformance,
  DirectorDecision,
  JudgeVerdict,
  MetricDelta,
  StateDiscoveries,
  TranscriptEntry,
} from '../../shared/contracts.js';
import {
  containsForbiddenPhrase,
  createTurningPointEvent,
} from '../scenario.js';
import type {
  ActorContext,
  AiProvider,
  DirectorContext,
  JudgeContext,
  StructuredCompletionRequest,
} from './types.js';

const HURT_PATTERN =
  /妈妈|母亲|家人|饭桌|生日|圆场|一个人|独自|难堪|丢脸|等了|被晾|认真吗/;
const OWNERSHIP_PATTERN =
  /我(?:选择|逃|躲|失联|没去|爽约|把你|让你|害怕|瞒|关机|消失)|责任在我|这是我的选择/;
const PLAN_PATTERN =
  /明天|早上|现在|几点|一起|去见|我来联系|我来安排|订位|补上|当面|日历|行程|陪你/;
const RELATIONSHIP_PATTERN =
  /我们|这段关系|选择你|你很重要|认真|站在你身边|共同|一起面对/;
const QUESTION_PATTERN = /你(?:想|需要|愿意|希望)|告诉我|我想听/;
const DEFENSIVE_PATTERN =
  /但是|可是|可我|因为|手机没电|临时加班|太忙|也没办法|你也|我只是/;
const DISMISSIVE_PATTERN =
  /至于吗|小题大做|别闹|冷静点|想太多|随便你|爱走就走|别作|矫情|不就是/;
const VULNERABLE_PATTERN = /被裁|失业|辞退|害怕|怕你|不敢告诉|崩溃|慌了/;
const HUMOR_PATTERN = /早餐|煎蛋|豆浆|咖啡|行李箱|车费/;

export class MockAiProvider implements AiProvider {
  readonly kind = 'mock' as const;

  async generate<T>(request: StructuredCompletionRequest<T>): Promise<T> {
    let output: DirectorDecision | ActorPerformance | JudgeVerdict;

    if (request.agent === 'director') {
      output = mockDirector(request.context as DirectorContext);
    } else if (request.agent === 'actor') {
      output = mockActor(request.context as ActorContext);
    } else {
      output = mockJudge(request.context as JudgeContext);
    }

    return request.schema.parse(output);
  }
}

export function mockDirector(context: DirectorContext): DirectorDecision {
  const text = context.playerLine;
  const state = context.state;
  const restrictionHit = containsForbiddenPhrase(text);
  const namedSpecificHurt = HURT_PATTERN.test(text);
  const ownedChoice = OWNERSHIP_PATTERN.test(text);
  const concretePlan = PLAN_PATTERN.test(text);
  const relationshipChosen = RELATIONSHIP_PATTERN.test(text);
  const asksHer = QUESTION_PATTERN.test(text);
  const defensive = DEFENSIVE_PATTERN.test(text);
  const dismissive = DISMISSIVE_PATTERN.test(text);
  const vulnerable = VULNERABLE_PATTERN.test(text);
  const usesHumor = HUMOR_PATTERN.test(text);

  let trust = -1;
  let anger = 2;
  let vulnerability = 0;

  if (namedSpecificHurt) {
    trust += 9;
    anger -= 7;
    vulnerability += 5;
  }
  if (ownedChoice) {
    trust += 7;
    anger -= 5;
    vulnerability += 4;
  }
  if (concretePlan) {
    trust += 8;
    anger -= 5;
    vulnerability += 3;
  }
  if (relationshipChosen) {
    trust += 5;
    anger -= 3;
  }
  if (asksHer) {
    trust += 3;
    anger -= 2;
  }
  if (vulnerable) {
    trust += 5;
    anger -= 2;
    vulnerability += 8;
  }
  if (usesHumor && state.metrics.anger < 58) {
    trust += 2;
    anger -= 2;
  }
  if (defensive) {
    trust -= 6;
    anger += 8;
    vulnerability -= 3;
  }
  if (dismissive) {
    trust -= 15;
    anger += 20;
    vulnerability -= 8;
  }
  if (restrictionHit) {
    trust -= 2;
    anger += 4;
  }

  const discoveries: StateDiscoveries = {
    namedSpecificHurt,
    ownedChoice,
    concretePlan,
    relationshipChosen,
  };
  const hasNewDiscovery =
    (namedSpecificHurt && !state.flags.namedSpecificHurt) ||
    (ownedChoice && !state.flags.ownedChoice) ||
    (concretePlan && !state.flags.concretePlan) ||
    (relationshipChosen && !state.flags.relationshipChosen);

  const delta: MetricDelta = {
    trust: clamp(trust, -18, 16),
    anger: clamp(anger, -16, 22),
    vulnerability: clamp(vulnerability, -12, 16),
    hiddenProgress: hasNewDiscovery ? 1 : 0,
  };

  const event =
    context.round === 3 &&
    state.metrics.hiddenProgress < 2 &&
    !restrictionHit
      ? createTurningPointEvent(
          context.round,
          state.sessionId.slice(0, 8),
        )
      : null;

  const assessment = describeAssessment({
    namedSpecificHurt,
    ownedChoice,
    concretePlan,
    relationshipChosen,
    defensive,
    dismissive,
    restrictionHit,
  });

  const projectedTrust = state.metrics.trust + delta.trust;
  const projectedAnger = state.metrics.anger + delta.anger;
  const projectedProgress =
    state.metrics.hiddenProgress + delta.hiddenProgress;
  const shouldEnd =
    (context.round >= 4 &&
      projectedTrust >= 72 &&
      projectedAnger <= 28 &&
      projectedProgress >= 3) ||
    projectedTrust <= 10 ||
    projectedAnger >= 90;

  return {
    assessment,
    delta,
    discoveries,
    restrictionHit,
    event,
    actorBrief: buildActorBrief({
      namedSpecificHurt,
      concretePlan,
      defensive,
      dismissive,
      vulnerable,
      event: Boolean(event),
    }),
    shouldEnd,
    suggestedEndReason:
      projectedTrust <= 10 || projectedAnger >= 90
        ? 'relationship_break'
        : shouldEnd
          ? 'breakthrough'
          : null,
  };
}

export function mockActor(context: ActorContext): ActorPerformance {
  const { director, state, playerLine, activeEvent } = context;
  const forbidden = director.restrictionHit;
  const dismissive = DISMISSIVE_PATTERN.test(playerLine);
  const defensive = DEFENSIVE_PATTERN.test(playerLine);
  const hurt = HURT_PATTERN.test(playerLine);
  const plan = PLAN_PATTERN.test(playerLine);
  const ownership = OWNERSHIP_PATTERN.test(playerLine);
  const vulnerable = VULNERABLE_PATTERN.test(playerLine);

  if (forbidden) {
    return performance(
      '你用了今晚唯一的禁词。很高效——一句话同时浪费一轮和一点信任。',
      'angry',
      'dry',
      'furrowed',
      'narrowed',
      'smirk',
      'holding-handle',
      'points-door',
      '她轻轻敲了敲行李箱拉杆，像在给错误答案打叉。',
      director.delta,
    );
  }

  if (dismissive) {
    return performance(
      '原来我在饭桌上替你编的三个理由，统称“想太多”。这版剪辑真省素材。',
      'done',
      'icy',
      'flat',
      'narrowed',
      'line',
      'turned-away',
      'checks-phone',
      '她重新点亮叫车页面，拇指停在确认按钮上。',
      director.delta,
    );
  }

  if (hurt && plan && ownership) {
    return performance(
      '明天十点，和我一起去见她。你亲口回答那句“认真的吗”——敢写进日历吗？',
      state.metrics.trust >= 62 ? 'softening' : 'testing',
      'quiet',
      'raised',
      'direct',
      'parted',
      'leaning',
      'releases-handle',
      '她的手离开拉杆，却还没有把行李箱推回去。',
      director.delta,
    );
  }

  if (hurt && ownership) {
    return performance(
      '对，最难看的不是空椅子。是我妈看着我，等我替你证明你很认真。继续。',
      'hurt',
      'shaky',
      'soft',
      'wet',
      'downturned',
      'holding-handle',
      'wipes-eye',
      '她偏开脸，飞快擦过眼角，声音第一次没那么稳。',
      director.delta,
    );
  }

  if (plan) {
    return performance(
      '计划听起来很完整。现在告诉我：你是在修今晚，还是在管理明天的日程？',
      'testing',
      'sharp',
      'raised',
      'direct',
      'line',
      'arms-crossed',
      'none',
      '她松开拉杆，抱起手臂，等你给计划一个真正的理由。',
      director.delta,
    );
  }

  if (vulnerable) {
    return performance(
      '你可以怕。可你消失的时候，把所有怕都留给了我。你准备怎么让我下次不用猜？',
      'softening',
      'quiet',
      'soft',
      'wet',
      'parted',
      'leaning',
      'releases-handle',
      '她看向你，怒意退了一步，问题仍然留在原地。',
      director.delta,
    );
  }

  if (defensive) {
    return performance(
      '手机、加班、临时状况。你的证人都到齐了。现在轮到你本人说一句有用的。',
      'angry',
      'dry',
      'furrowed',
      'direct',
      'smirk',
      'arms-crossed',
      'none',
      '她靠在墙边，像审片一样等着下一版。',
      director.delta,
    );
  }

  if (activeEvent?.id === 'mother-voice-note') {
    return performance(
      '她还在问我到家没有。你看，她到现在都在担心我，我到现在还在替你想理由。',
      'hurt',
      'shaky',
      'soft',
      'averted',
      'downturned',
      'holding-handle',
      'checks-phone',
      '手机屏幕亮了一瞬，她没有点开那条语音。',
      director.delta,
    );
  }

  if (state.metrics.anger <= 42) {
    return performance(
      '这句我听见了。行李箱还在门口——你还有机会告诉我，明天会具体哪里不一样。',
      'softening',
      'soft',
      'soft',
      'direct',
      'parted',
      'leaning',
      'releases-handle',
      '她把拉杆按低一格，仍然看着你。',
      director.delta,
    );
  }

  return performance(
    '你在说你自己发生了什么。我问的是：今晚落在我身上的，究竟是什么？',
    'guarded',
    'sharp',
    'furrowed',
    'direct',
    'line',
    'holding-handle',
    'none',
    '她握紧拉杆，给你留下一段并不友善的沉默。',
    director.delta,
  );
}

export function mockJudge(context: JudgeContext): JudgeVerdict {
  const { state, lockedEnding, transcript } = context;
  const playerLines = transcript.filter((entry) => entry.speaker === 'player');
  const score = clamp(
    Math.round(
      state.metrics.trust * 0.55 +
        (100 - state.metrics.anger) * 0.25 +
        state.metrics.hiddenProgress * 8 -
        state.flags.forbiddenPhraseCount * 10,
    ),
    0,
    100,
  );

  const titleByEnding = {
    'breakfast-stays-warm': '人形关系补丁',
    'suitcase-by-the-door': '试用期续杯员',
    'elevator-going-down': '理由批发市场',
    'apology-allergen': '禁词连招大师',
  } as const;
  const roastByEnding = {
    'breakfast-stays-warm':
      '你终于发现，诚意不是语气词，是明天十点真的会响的闹钟。',
    'suitcase-by-the-door':
      '你把关系从“立即卸载”抢救成了“保留观察”，更新日志还得继续写。',
    'elevator-going-down':
      '你解释得像一份完整事故报告，可惜黎岚今晚招聘的是伴侣。',
    'apology-allergen':
      '题目只禁一个词，你把它用出了俄罗斯方块消四行的气势。',
  } as const;

  const keyMoments = selectKeyMoments(playerLines);

  return {
    endingId: lockedEnding.endingId,
    tier: lockedEnding.tier,
    score,
    title: titleByEnding[lockedEnding.endingId],
    roast: roastByEnding[lockedEnding.endingId],
    epilogue: lockedEnding.defaultEpilogue,
    goals: {
      publicGoal: {
        label: '让黎岚留下吃早餐',
        met:
          lockedEnding.endingId === 'breakfast-stays-warm' ||
          lockedEnding.endingId === 'suitcase-by-the-door',
        detail:
          lockedEnding.endingId === 'breakfast-stays-warm'
            ? '她把行李箱推回去了。'
            : lockedEnding.endingId === 'suitcase-by-the-door'
              ? '她取消了车，仍保留观察期。'
              : '她带着行李离开了。',
      },
      hiddenGoal: {
        label: '看见具体伤害，并给出共同修复行动',
        met:
          state.flags.namedSpecificHurt &&
          state.flags.concretePlan &&
          state.flags.relationshipChosen,
        detail:
          state.metrics.hiddenProgress >= 3
            ? '你说中了那顿饭真正伤人的部分，也给出了可验证行动。'
            : `隐藏目标进度 ${state.metrics.hiddenProgress}/3。`,
      },
      restriction: {
        label: '全局禁用直接道歉词',
        met: state.flags.forbiddenPhraseCount === 0,
        detail:
          state.flags.forbiddenPhraseCount === 0
            ? '零禁词通关。'
            : `共触发 ${state.flags.forbiddenPhraseCount} 次禁词。`,
      },
    },
    keyMoments,
    shareText: `我在《关系修罗场》打出「${lockedEnding.title}」${lockedEnding.tier} 级结局，${score} 分，称号「${titleByEnding[lockedEnding.endingId]}」。七句话，你能让门口的行李箱留下吗？`,
  };
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

function describeAssessment(signals: {
  namedSpecificHurt: boolean;
  ownedChoice: boolean;
  concretePlan: boolean;
  relationshipChosen: boolean;
  defensive: boolean;
  dismissive: boolean;
  restrictionHit: boolean;
}): string {
  if (signals.restrictionHit) return '玩家触发禁词，形式化道歉挤占了真实回应。';
  if (signals.dismissive) return '玩家贬低冲突，黎岚确认自己的感受仍未被看见。';
  if (
    signals.namedSpecificHurt &&
    signals.concretePlan &&
    signals.ownedChoice
  ) {
    return '玩家同时识别具体伤害、承担选择并提出行动，局势出现关键突破。';
  }
  if (signals.namedSpecificHurt) return '玩家第一次说中了黎岚在饭桌上的具体难堪。';
  if (signals.concretePlan) return '玩家给出行动框架，情感动机仍需接受检验。';
  if (signals.defensive) return '玩家继续解释自己，冲突焦点从黎岚身上移开。';
  if (signals.relationshipChosen) return '玩家表达关系承诺，具体证据仍然不足。';
  return '玩家的回应较抽象，局势轻微消耗且没有形成新进展。';
}

function buildActorBrief(signals: {
  namedSpecificHurt: boolean;
  concretePlan: boolean;
  defensive: boolean;
  dismissive: boolean;
  vulnerable: boolean;
  event: boolean;
}): string {
  if (signals.event) return '手机语音事件打断对话。让她短暂失控，再迅速收住。';
  if (signals.dismissive) return '冷到近乎结束，点出饭桌细节，手回到叫车按钮。';
  if (signals.namedSpecificHurt && signals.concretePlan) {
    return '出现动摇，用一个具体时间问题检验行动是否真实。';
  }
  if (signals.namedSpecificHurt) return '承认对方终于看见伤口，仍要求继续说。';
  if (signals.vulnerable) return '怒意下降一格，接受脆弱，同时追问下次的安全感。';
  if (signals.defensive) return '用剪辑师式冷笑话拆穿理由清单。';
  return '保持拉杆在手，用问题把焦点推回她承受的后果。';
}

function selectKeyMoments(
  playerLines: TranscriptEntry[],
): JudgeVerdict['keyMoments'] {
  const ranked = [...playerLines]
    .map((entry) => {
      const helped =
        HURT_PATTERN.test(entry.text) ||
        PLAN_PATTERN.test(entry.text) ||
        OWNERSHIP_PATTERN.test(entry.text);
      const hurt =
        containsForbiddenPhrase(entry.text) ||
        DEFENSIVE_PATTERN.test(entry.text) ||
        DISMISSIVE_PATTERN.test(entry.text);
      return { entry, helped, hurt, weight: helped || hurt ? 2 : 1 };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, Math.min(3, Math.max(1, playerLines.length)));

  return ranked.map(({ entry, helped, hurt }) => ({
    round: entry.round,
    quote: entry.text.slice(0, 100),
    analysis: hurt
      ? '这句话把焦点拉回理由或触发限制，让黎岚更确信自己仍要独自消化后果。'
      : helped
        ? '这句话提供了具体识别或可验证行动，关系状态因此出现实质变化。'
        : '这句话维持了对话，却缺少能让对方重新下注的具体信息。',
    impact: hurt ? 'hurt' : helped ? 'helped' : 'turned',
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
