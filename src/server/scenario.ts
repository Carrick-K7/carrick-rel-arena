import type {
  ActorPerformance,
  EndingId,
  EndingTier,
  Gender,
  ScenarioBriefing,
  StoryEvent,
} from '../shared/contracts.js';

const OPPONENTS = {
  female: {
    gender: 'female',
    name: '黎岚',
    age: 25,
    role: '产品经理',
    experienceYears: 3,
    personality: '可爱、聪明、反应快；生气时会用软语气说一句很扎心的吐槽。',
  },
  male: {
    gender: 'male',
    name: '周叙',
    age: 25,
    role: '程序员',
    experienceYears: 3,
    personality: '克制、敏锐、记细节；生气时会讲一句很冷的笑话。',
  },
} as const;

const PLAYER_ROLES = {
  male: '程序员',
  female: '产品经理',
} as const;

export function createBriefing(
  playerGender: Gender = 'male',
): ScenarioBriefing {
  const opponentGender = playerGender === 'male' ? 'female' : 'male';
  const character = OPPONENTS[opponentGender];
  const pronoun = opponentGender === 'female' ? '她' : '他';
  return {
    id: 'suitcase-at-one',
    title: `凌晨一点：七句话让${character.name}留下吃早餐`,
    timeAndPlace: '周六 01:07 · 你们合租的公寓',
    premise:
      `你答应参加${character.name}母亲的生日晚餐，让${pronoun}第一次正式介绍你们的关系。你全程失联，凌晨才回家。${pronoun}的行李箱已经立在门口，网约车七轮后到。`,
    playerRole:
      `${character.name}的伴侣，25 岁的${PLAYER_ROLES[playerGender]}，进入职场第 3 年。`,
    player: {
      gender: playerGender,
      age: 25,
      role: PLAYER_ROLES[playerGender],
      experienceYears: 3,
    },
    character: {
      ...character,
    },
    goal: `在七轮对话内，让${character.name}愿意留下，和你吃明早的早餐。`,
    maxRounds: 7,
  };
}

export const BRIEFING = createBriefing('male');

export function createScenarioFacts(briefing: ScenarioBriefing): string {
  const { character } = briefing;
  const pronoun = character.gender === 'female' ? '她' : '他';
  return `
场景：周六凌晨一点，玩家与${character.name}合租的公寓门口。
双方设定：玩家与${character.name}都是 25 岁，进入职场第 3 年；玩家是${briefing.player.role}，${character.name}是${character.role}。
已发生：玩家承诺参加${character.name}母亲的生日晚餐，并允许${pronoun}第一次向家人正式介绍这段关系。
已发生：玩家全程失联，直到凌晨才回来。
已发生：${character.name}独自在饭桌上圆场，母亲问“你确定对方是认真的吗？”
当前：${character.name}已经收好一个行李箱，网约车将在七轮后到达。
本关唯一目标：在七轮对话内，让${character.name}愿意留下吃明早的早餐。
角色关注：${character.name}在意玩家是否真正看见${pronoun}在家人面前被晾下的难堪，以及玩家是否愿意用具体行动修复关系。
`.trim();
}

export function createOpeningEvent(
  briefing: ScenarioBriefing,
): StoryEvent {
  const adult =
    briefing.character.gender === 'female' ? '年轻女人' : '年轻男人';
  return {
    id: 'opening-cab-countdown',
    title: '车已接单',
    description: '司机距你们 7 轮。门边的行李箱轮子卡在地垫上。',
    videoCue: {
      hookId: 'opening-suitcase-01',
      kind: 'opening',
      prompt:
        `凌晨一点的城市公寓，浅青色玄关灯，一只深色行李箱靠在门边，${adult}背对镜头看手机上的网约车倒计时，克制的电影感，5 秒。`,
      idempotencyKey: 'suitcase-at-one:opening:v1',
      status: 'reserved',
    },
  };
}

export const OPENING_EVENT = createOpeningEvent(BRIEFING);

export function createOpeningPerformance(
  briefing: ScenarioBriefing,
): ActorPerformance {
  const pronoun = briefing.character.gender === 'female' ? '她' : '他';
  return {
    line: '车还有七分钟。你也有七句话——挑几句真的，省得我们都浪费时间。',
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
      stageDirection: `${pronoun}按灭手机屏幕，手仍扣在行李箱拉杆上。`,
    },
  stateChanges: {
    trust: 0,
    anger: 0,
    vulnerability: 0,
    },
  };
}

export const OPENING_PERFORMANCE = createOpeningPerformance(BRIEFING);

export interface EndingDefinition {
  id: EndingId;
  tier: EndingTier;
  title: string;
  defaultEpilogue: string;
  videoPrompt: string;
}

export const ENDING_CATALOG: Record<EndingId, EndingDefinition> = {
  'breakfast-stays-warm': {
    id: 'breakfast-stays-warm',
    tier: 'S',
    title: '早餐还热',
    defaultEpilogue:
      '对方盯着你看了三秒，把行李箱推回墙边，没有说原谅，只问：“明早几点出门？”',
    videoPrompt:
      '凌晨公寓玄关，{adult}慢慢松开行李箱拉杆，把箱子推回墙边，窗外天色将亮，克制而温暖的电影镜头。',
  },
  'suitcase-by-the-door': {
    id: 'suitcase-by-the-door',
    tier: 'A',
    title: '行李留在门口',
    defaultEpilogue:
      '对方取消了车，行李箱还立在门边，给了你一个早晨，也给这段关系一个观察期。',
    videoPrompt:
      '手机上的网约车订单被取消，行李箱仍在门口，{adult}坐到沙发边，留出半个座位，安静的悬而未决感。',
  },
  'elevator-going-down': {
    id: 'elevator-going-down',
    tier: 'C',
    title: '电梯下行',
    defaultEpilogue:
      '电梯门合上前，对方替你按掉了开门键。数字从 18 开始下降，今晚终于没有下一句了。',
    videoPrompt:
      '深夜公寓电梯门缓慢合上，{adult}和行李箱留在门内，楼层数字向下跳动，冷色克制电影镜头。',
  },
};

export function createTurningPointEvent(
  round: number,
  idempotencySuffix: string,
  briefing: ScenarioBriefing = BRIEFING,
): StoryEvent {
  const { character } = briefing;
  const pronoun = character.gender === 'female' ? '她' : '他';
  return {
    id: 'mother-voice-note',
    title: '妈妈的语音',
    description:
      `${character.name}的手机亮起：“到家了吗？今晚的事，别一个人扛。”${pronoun}没有点开。`,
    videoCue: {
      hookId: `turning-mother-note-${round}`,
      kind: 'turning_point',
      prompt:
        `深夜玄关特写，手机屏幕亮起母亲的语音消息，${character.gender === 'female' ? '年轻女人' : '年轻男人'}看到后迅速按灭屏幕，眼神短暂动摇，3 秒电影镜头。`,
      idempotencyKey: `suitcase-at-one:turning:${round}:${idempotencySuffix}`,
      status: 'reserved',
    },
  };
}

export function createEndingVideoEvent(
  ending: EndingDefinition,
  sessionId: string,
  briefing: ScenarioBriefing = BRIEFING,
): StoryEvent {
  const adult =
    briefing.character.gender === 'female' ? '年轻女人' : '年轻男人';
  return {
    id: `ending-${ending.id}`,
    title: ending.title,
    description: ending.defaultEpilogue,
    videoCue: {
      hookId: `ending-${ending.id}`,
      kind: 'ending',
      prompt: ending.videoPrompt.replace('{adult}', adult),
      idempotencyKey: `${sessionId}:ending:${ending.id}:v1`,
      status: 'reserved',
    },
  };
}
