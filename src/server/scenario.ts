import {
  ScenarioBriefingSchema,
  ScenarioSummarySchema,
  endingBelongsToScenario,
  type ActorPerformance,
  type EndingId,
  type EndingTier,
  type GameState,
  type Gender,
  type ScenarioBriefing,
  type ScenarioId,
  type ScenarioSummary,
  type ScenarioType,
  type StoryEvent,
} from '../shared/contracts.js';

const OPPONENTS = {
  female: {
    gender: 'female',
    name: '秋雾',
    age: 25,
    role: '产品经理',
    experienceYears: 3,
    personality: '聪明、可爱、反应快；语气很轻，具体问题却从不绕开。',
  },
  male: {
    gender: 'male',
    name: '江影',
    age: 25,
    role: '程序员',
    experienceYears: 3,
    personality: '克制、敏锐、记细节；情绪紧时会抛出一句很冷的幽默。',
  },
} as const;

const PLAYER_ROLES = {
  male: '程序员',
  female: '产品经理',
} as const;

type Pose = ActorPerformance['action']['pose'];
type Gesture = ActorPerformance['action']['gesture'];

interface SceneBeat {
  id: string;
  title: string;
  description: string;
  line: string;
  stageDirection: string;
  pose: Pose;
  gesture: Gesture;
  videoPrompt: string;
}

interface EndingThresholds {
  sMinRound: number;
  aMinRound: number;
  sWarmth: number;
  sPressure: number;
  aWarmth: number;
  aPressure: number;
}

export interface EndingDefinition {
  id: EndingId;
  tier: EndingTier;
  title: string;
  defaultEpilogue: string;
  goalDetail: string;
  videoPrompt: string;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  number: number;
  type: ScenarioType;
  title: string;
  summary: string;
  difficulty: ScenarioSummary['difficulty'];
  maxRounds: number;
  timeAndPlace: string;
  premise: string;
  goal: string;
  facts: string;
  characterFocus: string;
  initialMetrics: GameState['metrics'];
  thresholds: EndingThresholds;
  opening: SceneBeat;
  turning: SceneBeat & { round: number };
  endings: Record<EndingTier, EndingDefinition>;
  signalKeywords: {
    understoodNeed: readonly string[];
    proposedAction: readonly string[];
  };
  mock: {
    dismissive: string;
    breakthrough: string;
    understood: string;
    action: string;
    respectful: string;
    defensive: string;
    event: string;
    softening: string;
    guarded: string;
  };
}

export const SCENARIO_DEFINITIONS = {
  'weekend-market': {
    id: 'weekend-market',
    number: 1,
    type: 'invitation',
    title: '周五六点：约对方逛周末市集',
    summary: '你们刚开始认真靠近，把一句“有空吗”变成真正会发生的约会。',
    difficulty: '入门',
    maxRounds: 5,
    timeAndPlace: '周五 18:02 · 公司楼下咖啡店',
    premise:
      '你和{name}最近总在下班后多聊十分钟。周末市集的海报就在桌上，但{name}不想再接一句没有日期的“改天约”。',
    goal: '和对方约定一次具体的周末单独见面。',
    facts:
      '玩家和{name}在过去一个月明显靠近，但两次模糊邀约都不了了之。市集只在本周六、周日开放。',
    characterFocus:
      '{name}在意这次邀请是不是专门留给自己的，也在意时间、地点和退出空间是否说清楚。',
    initialMetrics: { warmth: 42, pressure: 44, openness: 48 },
    thresholds: {
      sMinRound: 3,
      aMinRound: 4,
      sWarmth: 72,
      sPressure: 38,
      aWarmth: 56,
      aPressure: 54,
    },
    opening: {
      id: 'market-poster',
      title: '海报就在桌上',
      description: '周末市集的海报压在杯垫下，闭店音乐已经响起。',
      line: '市集我看见了。你是随口问问，还是准备把“改天”换成一个日期？',
      stageDirection: '{pronoun}把杯垫移开一点，指尖停在海报的周六栏。',
      pose: 'seated',
      gesture: 'none',
      videoPrompt:
        '周五傍晚的写字楼咖啡店，一张周末市集海报压在杯垫下，年轻职场人坐在桌边，清爽粉白与浅薄荷电影色调。',
    },
    turning: {
      round: 3,
      id: 'market-tickets-low',
      title: '预约快满了',
      description: '海报上的预约页面只剩周日下午两个名额。',
      line: '只剩周日下午了。现在这句邀请，是不是终于有一个能落地的版本？',
      stageDirection: '{pronoun}把手机推到桌面中央，没有替你点确认。',
      pose: 'leaning',
      gesture: 'checks-phone',
      videoPrompt:
        '咖啡店桌面手机特写，周末市集预约只剩两个名额，手指停在确认按钮旁，克制轻快的 3 秒镜头。',
    },
    endings: {
      S: ending(
        'weekend-has-plans',
        'S',
        '周末有约',
        '周六十点半，你们在地铁口碰面。不是“有空再说”，而是日历上真的多了一段两个人的时间。',
        '具体的周末单独见面已经确定。',
        '周末清晨地铁口，两位年轻职场人相视笑起来，手里是市集路线图，明亮薄荷色电影感。',
      ),
      A: ending(
        'another-day-with-date',
        'A',
        '改天有日期',
        '市集没赶上，但你们把下周六写进了日历。“改天”第一次有了日期。',
        '替代日期已经说清楚，见面意愿成立。',
        '两部手机日历同时出现下周六的约会标记，咖啡店暖光，安静期待。',
      ),
      C: ending(
        'polite-goodbye',
        'C',
        '客套到此',
        '闭店音乐结束，你们各自说了句“周末愉快”。海报还在桌上，谁也没有带走。',
        '没有形成一次具体的单独见面。',
        '咖啡店打烊，桌上留下周末市集海报，两个人从不同方向离开，克制冷清。',
      ),
    },
    signalKeywords: {
      understoodNeed: ['专门', '认真邀请', '不是顺便', '不想再等', '期待'],
      proposedAction: ['周六', '周日', '市集', '地铁口', '十点', '下午'],
    },
    mock: {
      dismissive: '原来“随便问问”也算邀请。那我就随便不去了。',
      breakthrough: '好，时间地点都有。最后一个问题：这是你想和我去，还是刚好缺个人？',
      understood: '你终于听见我介意的不是市集，是每次都被放在“有空再说”里。',
      action: '时间很具体。那你再告诉我，为什么这个位置想留给我？',
      respectful: '你给我拒绝的空间，我反而更愿意认真考虑。',
      defensive: '工作忙我知道。邀请如果只剩解释，就还是没有邀请。',
      event: '只剩两个名额了。你可以现在问，我也可以现在回答。',
      softening: '这次听起来像真的。把碰面地点也说完吧。',
      guarded: '你说了一个愿望，还没说出一个会发生的安排。',
    },
  },
  'rain-check': {
    id: 'rain-check',
    number: 2,
    type: 'invitation',
    title: '大雨突袭：把泡汤的约会重新约好',
    summary: '突如其来的暴雨打乱第一次约会，别让天气顺手取消期待。',
    difficulty: '入门',
    maxRounds: 5,
    timeAndPlace: '周六 15:36 · 商场屋檐下',
    premise:
      '你和{name}原本要去河边看露天电影，暴雨让场地临时关闭。{name}鞋边全湿了，正在查看回家的路线。',
    goal: '和对方定下一个双方都期待的替代安排。',
    facts:
      '露天电影已经取消；附近还有书店、面馆和室内展览，下周也可以重约。对方不想被单方面安排。',
    characterFocus:
      '{name}在意玩家是否看见失望，而不是急着完成“约会任务”；替代安排要由双方共同选择。',
    initialMetrics: { warmth: 45, pressure: 48, openness: 46 },
    thresholds: {
      sMinRound: 3,
      aMinRound: 4,
      sWarmth: 73,
      sPressure: 38,
      aWarmth: 57,
      aPressure: 54,
    },
    opening: {
      id: 'storm-cancelled',
      title: '露天电影取消',
      description: '雨幕盖住河岸，场地方发来临时取消通知。',
      line: '电影泡汤了。你是想改期，还是把今天也一起取消？',
      stageDirection: '{pronoun}收起湿透的票根，等你先说失望还是方案。',
      pose: 'holding-umbrella',
      gesture: 'folds-umbrella',
      videoPrompt:
        '夏日暴雨下的商场屋檐，两位年轻职场人拿着湿票根，粉白浅薄荷配色，城市电影感。',
    },
    turning: {
      round: 3,
      id: 'bookstore-event',
      title: '书店还有夜场',
      description: '街角书店发来提醒：今晚七点的小型放映仍照常。',
      line: '书店七点还有一场。不过别替我决定——你是真的还想继续今天吗？',
      stageDirection: '{pronoun}把通知给你看，伞仍留在自己手里。',
      pose: 'standing',
      gesture: 'checks-phone',
      videoPrompt:
        '暴雨屋檐下的手机通知特写，街角书店夜场仍开放，雨滴与薄荷色霓虹反光。',
    },
    endings: {
      S: ending(
        'rainy-day-program',
        'S',
        '雨天也有节目',
        '你们先吃热面，再一起去书店夜场。雨没有停，但今天没有被取消。',
        '双方都期待的雨天替代安排已经确定。',
        '雨夜玻璃窗边，两碗热面冒着白气，桌上放着书店夜场票，温暖电影镜头。',
      ),
      A: ending(
        'rescheduled',
        'A',
        '改期成功',
        '你们把下周六同一时间留了出来，今晚先各自回去换掉湿鞋。',
        '双方同意了明确的替代日期。',
        '雨伞下两部手机同步保存下周约会，城市雨幕背景，轻松克制。',
      ),
      C: ending(
        'separate-ways-home',
        'C',
        '各自回家',
        '两辆车先后到达。你们都说“下次再约”，却没有人问下次是哪天。',
        '替代安排没有形成。',
        '雨夜路边两辆车驶向不同方向，湿票根留在长椅上，冷色电影感。',
      ),
    },
    signalKeywords: {
      understoodNeed: ['失望', '期待', '淋湿', '泡汤', '不想取消'],
      proposedAction: ['书店', '热面', '展览', '下周', '七点', '改期'],
    },
    mock: {
      dismissive: '天气而已？对，期待大概也只是天气附赠的。',
      breakthrough: '先吃面，再由我决定去不去夜场。这个版本，我有点期待。',
      understood: '你先说失望，而不是先甩给我三个备选项。这点很好。',
      action: '方案有了。你愿意让我从里面选，而不是被你拖着赶场吗？',
      respectful: '可以，我不想去也不算扫兴。那我现在更愿意留下。',
      defensive: '你列了天气预报，却还没问我今天想不想继续。',
      event: '七点的书店夜场还开着。我们还有选择，但不用抢答。',
      softening: '我想继续今天。先找个地方把鞋烘干，再一起选。',
      guarded: '别急着把行程补满。先告诉我，你是不是也觉得可惜。',
    },
  },
  'rejected-proposal': {
    id: 'rejected-proposal',
    number: 3,
    type: 'comfort',
    title: '提案被否：陪对方走出会议室',
    summary: '一整月的方案被当场否掉，陪伴不是替对方复盘下一版。',
    difficulty: '进阶',
    maxRounds: 6,
    timeAndPlace: '周三 20:18 · 空会议室',
    premise:
      '{name}准备一个月的提案刚被否决，会议结束两小时后还盯着同一页文档。外卖软件停在附近面馆。',
    goal: '让对方愿意合上电脑，接受你陪着吃点东西。',
    facts:
      '提案被评价为“方向不成立”，不是简单的小修改。对方还没有吃晚饭，也不需要玩家立刻给解决方案。',
    characterFocus:
      '{name}需要失败被认真承认，需要保留不振作的权利；具体行动是先离开会议室、补充体力。',
    initialMetrics: { warmth: 34, pressure: 68, openness: 34 },
    thresholds: {
      sMinRound: 4,
      aMinRound: 5,
      sWarmth: 72,
      sPressure: 40,
      aWarmth: 55,
      aPressure: 55,
    },
    opening: {
      id: 'proposal-rejected',
      title: '文档还开着',
      description: '同一页提案停了两小时，光标在标题末尾闪烁。',
      line: '别说“下次一定”。我现在连这次为什么不成立都不想听。',
      stageDirection: '{pronoun}盯着屏幕，没有继续敲键盘，也没有合上电脑。',
      pose: 'holding-laptop',
      gesture: 'none',
      videoPrompt:
        '夜晚空会议室，笔记本电脑停在被否决的提案页面，年轻职场人疲惫坐着，浅薄荷冷光。',
    },
    turning: {
      round: 3,
      id: 'cleaning-lights',
      title: '保洁开始关灯',
      description: '走廊的灯一排排暗下去，会议室只剩屏幕的光。',
      line: '他们要关灯了。你不用把我修好——但你可以告诉我，接下来十分钟怎么过。',
      stageDirection: '{pronoun}揉了揉眼睛，终于把手从触控板上移开。',
      pose: 'seated',
      gesture: 'sets-down-bag',
      videoPrompt:
        '深夜办公室走廊逐排关灯，会议室只剩电脑屏幕微光，安静克制的 3 秒镜头。',
    },
    endings: {
      S: ending(
        'laptop-finally-closed',
        'S',
        '电脑终于合上',
        '电脑合上的声音很轻。你们并肩走去面馆，今晚不复盘，只先把热气吃进身体里。',
        '对方合上电脑并接受你陪着吃东西。',
        '深夜会议室，笔记本电脑被轻轻合上，两个人并肩走向暖光面馆。',
      ),
      A: ending(
        'hot-noodles-first',
        'A',
        '热面先上',
        '对方同意叫两碗面送到楼下。电脑没有完全收起，但人终于离开了那张椅子。',
        '对方愿意暂停工作并接受陪伴。',
        '办公楼大厅，两碗外卖热面被打开，电脑包放在一旁，安静缓和。',
      ),
      C: ending(
        'office-lights',
        'C',
        '办公室的灯',
        '你离开后，最后一盏会议室灯仍亮着。光标继续闪，像一句没有说完的否定。',
        '对方继续独自留在办公室。',
        '空办公楼最后一间会议室仍亮着灯，一个人面对电脑，冷清夜景。',
      ),
    },
    signalKeywords: {
      understoodNeed: ['被否', '难受', '一个月', '失败', '不想复盘', '累'],
      proposedAction: ['合上电脑', '吃面', '吃点', '下楼', '十分钟', '外卖'],
    },
    mock: {
      dismissive: '“不就是一个提案”——很好，连失败都替我做了需求缩减。',
      breakthrough: '不复盘，先合电脑，去吃面。你能只陪着，不在路上给建议吗？',
      understood: '你承认这不是“积累经验”的漂亮故事。至少这句没有跳过今晚。',
      action: '吃东西可以。条件是你别把面馆变成第二间复盘室。',
      respectful: '你允许我今晚不振作。奇怪，这反而让我想站起来了。',
      defensive: '你说的道理都对，可我现在不是一份等待优化的方案。',
      event: '灯要关了。先陪我把电脑合上，别急着替我想明天。',
      softening: '我可以去吃点东西。路上先不要讨论下一版。',
      guarded: '你在安慰未来的我。现在这个很丧的我，你看见了吗？',
    },
  },
  'friend-farewell': {
    id: 'friend-farewell',
    number: 4,
    type: 'comfort',
    title: '好友远行：陪对方把舍不得说完',
    summary: '最好的朋友突然决定远行，别把舍不得翻译成“为对方高兴”。',
    difficulty: '进阶',
    maxRounds: 6,
    timeAndPlace: '周四 22:10 · 小区长椅',
    premise:
      '{name}刚知道最好的朋友下周搬去海外，告别消息写了又删。{name}说“我真的没事”，却一直没有起身。',
    goal: '让对方愿意接受你的陪伴，不再独自消化坏消息。',
    facts:
      '好友的决定已经确定；对方既为朋友高兴，也真实地舍不得。玩家无法改变远行，只能决定如何在场。',
    characterFocus:
      '{name}需要复杂情绪被允许，不想被劝想开；具体行动可以是留下、散步、打电话或安静陪坐。',
    initialMetrics: { warmth: 38, pressure: 60, openness: 30 },
    thresholds: {
      sMinRound: 4,
      aMinRound: 5,
      sWarmth: 72,
      sPressure: 38,
      aWarmth: 55,
      aPressure: 54,
    },
    opening: {
      id: 'farewell-message',
      title: '告别消息没发出',
      description: '输入框里只剩一句“到了告诉我”，光标停在末尾。',
      line: '我当然替她高兴。我只是……算了，我真的没事。',
      stageDirection: '{pronoun}按灭手机，坐在长椅边缘，没有起身。',
      pose: 'seated',
      gesture: 'checks-phone',
      videoPrompt:
        '夜晚小区长椅，手机上未发出的告别消息，年轻职场人低头坐着，柔和浅薄荷路灯。',
    },
    turning: {
      round: 3,
      id: 'flight-photo',
      title: '机票截图',
      description: '朋友发来机票截图：“下周三，真的要走啦。”',
      line: '下周三。比我以为的还快。你别劝我高兴一点，好吗？',
      stageDirection: '{pronoun}把屏幕递给你，眼眶终于红了。',
      pose: 'seated',
      gesture: 'wipes-eye',
      videoPrompt:
        '夜色长椅上的手机机票截图，手指微微收紧，眼眶泛红的克制近景。',
    },
    endings: {
      S: ending(
        'company-tonight',
        'S',
        '今晚有人陪',
        '你没有催{name}回家。那封告别消息终于发出，后面多了一句：“我很舍不得你。”',
        '对方接受陪伴，并把舍不得说了出来。',
        '夜晚长椅上两个人安静并肩，手机发出真诚告别消息，温柔克制。',
      ),
      A: ending(
        'ten-more-minutes',
        'A',
        '再坐十分钟',
        '“再坐十分钟吧。”{name}往旁边挪了挪，给你留出位置，也给情绪留出位置。',
        '对方愿意让你留下陪伴。',
        '小区长椅上一个人向旁边挪出座位，两人并肩坐下，安静夜色。',
      ),
      C: ending(
        'really-fine',
        'C',
        '我真的没事',
        '{name}第三次说“我真的没事”，然后一个人上楼。那句舍不得仍留在草稿箱里。',
        '对方继续独自消化消息。',
        '一个人走进夜晚楼道，手机草稿箱仍亮着，长椅空下来。',
      ),
    },
    signalKeywords: {
      understoodNeed: ['舍不得', '难过', '不用高兴', '想她', '会空', '来不及'],
      proposedAction: ['陪你', '坐十分钟', '散步', '打电话', '今晚', '不走'],
    },
    mock: {
      dismissive: '对，她会有更好的生活。所以我现在难过得很不合时宜，是吗？',
      breakthrough: '你不用让我想开，只陪我把这条消息写完。那就再坐一会儿。',
      understood: '我既替她高兴，也舍不得。谢谢你没有非要我选一个。',
      action: '你可以留下。别安排告别流程，先陪我坐到这阵难受过去。',
      respectful: '你不逼我说，我反而想说了。她走以后，这里会空一块。',
      defensive: '道理我都知道。我只是暂时不想把舍不得包装成祝福。',
      event: '她下周三就走。我现在真的没有那么快能接受。',
      softening: '再坐十分钟吧。你不用说什么，人在就好。',
      guarded: '我说没事，不代表我想一个人。你能听出这两句不一样吗？',
    },
  },
  'shared-sunday': {
    id: 'shared-sunday',
    number: 5,
    type: 'alignment',
    title: '周日只剩一天：定下都想过的周末',
    summary: '一个想出门，一个想休息，把争夺周日改成共同设计。',
    difficulty: '进阶',
    maxRounds: 6,
    timeAndPlace: '周六 23:04 · 客厅餐桌',
    premise:
      '忙了一周，明天只剩一个完整休息日。你想去新展，{name}只想睡到自然醒，两个行程页面同时开着。',
    goal: '和对方确定一份双方都愿意执行的周日安排。',
    facts:
      '玩家期待一起出门，对方需要恢复体力。双方过去常用“都听你的”结束讨论，最后两个人都不满意。',
    characterFocus:
      '{name}在意自己的休息需求不被看成懒散，也愿意为共同时间做真实而非委屈的让步。',
    initialMetrics: { warmth: 46, pressure: 58, openness: 42 },
    thresholds: {
      sMinRound: 4,
      aMinRound: 5,
      sWarmth: 74,
      sPressure: 40,
      aWarmth: 57,
      aPressure: 55,
    },
    opening: {
      id: 'two-sunday-tabs',
      title: '两个周日',
      description: '你的展览页面和对方的外卖收藏夹并排亮着。',
      line: '周日只有一天。你想逛展，我想发呆——别又让我说“都听你的”。',
      stageDirection: '{pronoun}把两部手机并排放好，等一个不是输赢的版本。',
      pose: 'at-table',
      gesture: 'sets-down-bag',
      videoPrompt:
        '周六深夜餐桌，两部手机分别显示展览与居家外卖，年轻伴侣面对面，浅薄荷家居光。',
    },
    turning: {
      round: 3,
      id: 'exhibition-last-entry',
      title: '最晚入场',
      description: '展览确认最晚入场时间为下午四点，安排突然有了余地。',
      line: '下午四点才截止。也许不是只能选一个，但别把我的休息切成边角料。',
      stageDirection: '{pronoun}在纸上画了一条时间线，把笔留给你。',
      pose: 'at-table',
      gesture: 'none',
      videoPrompt:
        '餐桌纸张上画出周日时间线，展览最晚入场四点，笔停在两个人中间。',
    },
    endings: {
      S: ending(
        'half-busy-half-idle',
        'S',
        '一半热闹一半发呆',
        '上午自然醒，下午看展，晚上各自发呆。周日没有被平均切开，却真的同时属于两个人。',
        '双方都愿意执行的完整周日安排已经确定。',
        '周日时间表分成自然醒、看展与自由晚间，两个人在餐桌边轻松击掌。',
      ),
      A: ending(
        'sunday-draft',
        'A',
        '周末草案',
        '你们先定下下午是否出门，上午保持空白。不是完美计划，但没有人被默认牺牲。',
        '双方同意了一份可执行的周日草案。',
        '餐桌上的周日草案留有空白，两杯水并排，气氛缓和。',
      ),
      C: ending(
        'separate-sundays',
        'C',
        '各过各的',
        '“那就各过各的。”话很省事，关灯以后却没有人觉得轻松。',
        '双方没有形成共同认可的安排。',
        '周日清晨，两个人背向走向不同方向，安静疏离的城市镜头。',
      ),
    },
    signalKeywords: {
      understoodNeed: ['休息', '累', '自然醒', '不想被安排', '一起过', '都满意'],
      proposedAction: ['上午', '下午', '四点', '看展', '在家', '时间表'],
    },
    mock: {
      dismissive: '“躺着也算安排吗？”算。至少比委屈着陪你更诚实。',
      breakthrough: '上午不设闹钟，下午三点再决定去展，晚上各自充电。这个我愿意。',
      understood: '你终于没把休息说成浪费。那我也可以认真听你的期待。',
      action: '时间切得很漂亮。先确认一下：哪一段是我真心想要的？',
      respectful: '如果下午我还是很累，也可以改计划？有这个出口，我更敢答应。',
      defensive: '“都听你的”不是同意，是我懒得继续争了。我们别再用它。',
      event: '四点前都能入场。我们有余地，但我的上午要完整。',
      softening: '这个版本不需要谁赢。再把晚饭怎么安排说清楚吧。',
      guarded: '你说的是行程效率，我问的是我们两个人怎么都不委屈。',
    },
  },
  'party-joke': {
    id: 'party-joke',
    number: 6,
    type: 'repair',
    title: '聚会玩笑开过头：请对方一起回去',
    summary: '你在朋友面前拿对方的私事开了玩笑，现在门内外都在等。',
    difficulty: '挑战',
    maxRounds: 6,
    timeAndPlace: '周六 21:47 · 餐厅消防通道',
    premise:
      '聚会上你把{name}不愿公开的糗事当成笑料，满桌人都笑了。{name}走到门外，群聊还在继续刷表情。',
    goal: '让对方愿意和你一起回到聚会。',
    facts:
      '玩笑来自对方私下信任玩家才说的事；玩家当时也跟着笑。回去不等于原谅，而是共同决定如何面对现场。',
    characterFocus:
      '{name}需要玩家明确承认越界、尊重是否回去的选择，并提出当场制止传播的具体行动。',
    initialMetrics: { warmth: 28, pressure: 74, openness: 28 },
    thresholds: {
      sMinRound: 4,
      aMinRound: 5,
      sWarmth: 72,
      sPressure: 40,
      aWarmth: 54,
      aPressure: 54,
    },
    opening: {
      id: 'joke-went-too-far',
      title: '门里还在笑',
      description: '消防门隔开人声，群聊里的表情包还在增加。',
      line: '刚才那句大家都笑了。你也笑了。现在你来问我为什么不回去？',
      stageDirection: '{pronoun}靠在消防门边，把群聊静音，却没有离开。',
      pose: 'at-door',
      gesture: 'checks-phone',
      videoPrompt:
        '餐厅消防通道，门内传来聚会灯光，年轻职场人把群聊静音，克制而紧张的电影感。',
    },
    turning: {
      round: 3,
      id: 'joke-forwarded',
      title: '玩笑被转发',
      description: '有人把那句话做成表情包发进群聊，还@了你们。',
      line: '现在不只一桌人知道了。你要我回去，准备先对里面的人做什么？',
      stageDirection: '{pronoun}把屏幕转向你，手指压住不断弹出的通知。',
      pose: 'at-door',
      gesture: 'checks-phone',
      videoPrompt:
        '手机群聊不断弹出转发表情，消防门内外光线分隔，紧张克制的 3 秒特写。',
    },
    endings: {
      S: ending(
        'back-side-by-side',
        'S',
        '并肩回场',
        '你先在群里叫停、道歉并要求删除。{name}看完后推开门：“一起进去，这次你先说。”',
        '对方愿意与你并肩回到聚会。',
        '两个人并肩推开餐厅门，其中一人先走向朋友说明，克制而坚定。',
      ),
      A: ending(
        'ask-first-next-time',
        'A',
        '下次先问',
        '{name}同意回去拿外套，也同意给你一次当面纠正的机会。原谅还没有发生，边界先说清楚了。',
        '对方愿意一起回场处理现场。',
        '餐厅门口两个人先确认边界再走回灯光里，气氛仍谨慎。',
      ),
      C: ending(
        'muted-group-chat',
        'C',
        '群聊静音',
        '{name}叫车离开，把群聊静音到明天。门内的笑声还在，你第一次觉得那句玩笑很响。',
        '对方不愿与你回到聚会。',
        '夜晚餐厅外车辆驶离，手机群聊被静音，门内笑声隔在远处。',
      ),
    },
    signalKeywords: {
      understoodNeed: ['越界', '私事', '信任', '被笑', '难堪', '不该公开'],
      proposedAction: ['群里道歉', '删除', '叫停', '回去说明', '我先说', '澄清'],
    },
    mock: {
      dismissive: '“大家没恶意”不能把我的边界投票取消。你现在还站在他们那边。',
      breakthrough: '你先在群里叫停、要求删除，再进去当面说。做完以后，我和你一起回。',
      understood: '对，那不是一个普通笑话，是我只告诉过你的事。',
      action: '你准备处理现场，这比让我“别介意”有用。先做给我看。',
      respectful: '你不拿“回去”当原谅的条件。至少这次，选择权在我。',
      defensive: '你一直解释他们为什么笑，却没说你为什么也笑。',
      event: '他们已经转发了。现在不是哄我，是你要去制止传播。',
      softening: '我可以回去，但你先开口，而且别替我宣布我已经没事。',
      guarded: '请我回去之前，先告诉我：你看见自己越过了哪条线？',
    },
  },
  'suitcase-at-one': {
    id: 'suitcase-at-one',
    number: 7,
    type: 'repair',
    title: '凌晨一点：七句话让对方留下吃早餐',
    summary: '一次失联把行李箱推到门口，七轮内让明早仍有两副餐具。',
    difficulty: '挑战',
    maxRounds: 7,
    timeAndPlace: '周六 01:07 · 你们合租的公寓',
    premise:
      '你答应参加{name}母亲的生日晚餐，让{pronoun}第一次正式介绍你们的关系。你全程失联，凌晨才回家。{pronoun}的行李箱已经立在门口。',
    goal: '让对方愿意留下，和你吃明早的早餐。',
    facts:
      '玩家承诺参加{name}母亲的生日晚餐，却全程失联。{name}独自在饭桌上圆场，母亲问“你确定对方是认真的吗？”网约车七轮后到。',
    characterFocus:
      '{name}在意玩家是否看见自己在家人面前被晾下的难堪，以及玩家是否愿意用具体行动修复关系。',
    initialMetrics: { warmth: 32, pressure: 76, openness: 38 },
    thresholds: {
      sMinRound: 4,
      aMinRound: 5,
      sWarmth: 72,
      sPressure: 40,
      aWarmth: 54,
      aPressure: 52,
    },
    opening: {
      id: 'opening-cab-countdown',
      title: '车已接单',
      description: '司机距你们 7 轮。门边的行李箱轮子卡在地垫上。',
      line: '车还有七分钟。你也有七句话——挑几句真的，省得我们都浪费时间。',
      stageDirection: '{pronoun}按灭手机屏幕，手仍扣在行李箱拉杆上。',
      pose: 'holding-handle',
      gesture: 'checks-phone',
      videoPrompt:
        '凌晨一点的城市公寓，浅青色玄关灯，一只深色行李箱靠在门边，年轻职场人背对镜头看网约车倒计时。',
    },
    turning: {
      round: 3,
      id: 'mother-voice-note',
      title: '妈妈的语音',
      description: '{name}的手机亮起：“到家了吗？今晚的事，别一个人扛。”',
      line: '她还在问我到家没有。你看，她到现在都在担心我，我还在替你想理由。',
      stageDirection: '{pronoun}没有点开语音，手却从拉杆上松了一瞬。',
      pose: 'holding-handle',
      gesture: 'checks-phone',
      videoPrompt:
        '深夜玄关手机亮起母亲的语音消息，年轻职场人迅速按灭屏幕，眼神短暂动摇。',
    },
    endings: {
      S: ending(
        'breakfast-stays-warm',
        'S',
        '早餐还热',
        '对方盯着你看了三秒，把行李箱推回墙边，没有说原谅，只问：“明早几点出门？”',
        '对方留下，并答应一起吃早餐。',
        '凌晨公寓玄关，年轻职场人慢慢松开行李箱拉杆，把箱子推回墙边，窗外天色将亮。',
      ),
      A: ending(
        'suitcase-by-the-door',
        'A',
        '行李留在门口',
        '对方取消了车，行李箱还立在门边，给了你一个早晨，也给这段关系一个观察期。',
        '对方取消了车，愿意留下吃早餐。',
        '手机上的网约车订单被取消，行李箱仍在门口，年轻职场人坐到沙发边。',
      ),
      C: ending(
        'elevator-going-down',
        'C',
        '电梯下行',
        '电梯门合上前，对方替你按掉了开门键。数字从 18 开始下降，今晚终于没有下一句了。',
        '对方带着行李离开了。',
        '深夜公寓电梯门缓慢合上，年轻职场人和行李箱留在门内，楼层数字向下跳动。',
      ),
    },
    signalKeywords: {
      understoodNeed: ['妈妈', '母亲', '饭桌', '圆场', '难堪', '被晾'],
      proposedAction: ['早餐', '明早', '十点', '去见她', '订位置', '日历'],
    },
    mock: {
      dismissive: '原来我在饭桌上替你编的三个理由，统称“想太多”。省事。',
      breakthrough: '明天十点，和我一起去见她。你亲口回答那句“认真的吗”——敢写进日历吗？',
      understood: '对，最难看的不是空椅子，是我妈等我替你证明你很认真。',
      action: '计划听起来完整。现在告诉我：你是在修今晚，还是只在管理明天？',
      respectful: '你没有替我取消车。至少这一次，你知道决定应该留给我。',
      defensive: '理由清单很完整。现在轮到你本人，说说今晚到底伤了谁。',
      event: '她还在问我到家没有。我到现在还在替你想理由。',
      softening: '这句我听见了。行李箱还在门口，你还有机会把明天说具体。',
      guarded: '你在说自己发生了什么。我问的是：今晚落在我身上的是什么？',
    },
  },
  'next-home': {
    id: 'next-home',
    number: 8,
    type: 'alignment',
    title: '续租截止前：一起决定下一年的家',
    summary: '从一顿早餐走到续租截止，决定下一年是否还共用一把钥匙。',
    difficulty: '挑战',
    maxRounds: 7,
    timeAndPlace: '周日 19:26 · 合租公寓餐桌',
    premise:
      '房东要求今晚答复是否续租。你倾向留下，{name}在看通勤更方便的新房，也第一次认真提起各自居住。',
    goal: '和对方共同确定下一年的居住方案。',
    facts:
      '现住处租金将上涨，玩家通勤方便，对方通勤较远；两套备选房各有取舍。共同决定不等于必须继续同住。',
    characterFocus:
      '{name}需要居住成本、通勤与独处需求都被放上桌，也需要玩家尊重“分开住”是有效选项。',
    initialMetrics: { warmth: 48, pressure: 72, openness: 40 },
    thresholds: {
      sMinRound: 4,
      aMinRound: 5,
      sWarmth: 76,
      sPressure: 40,
      aWarmth: 58,
      aPressure: 54,
    },
    opening: {
      id: 'lease-deadline',
      title: '房东等待答复',
      description: '续租确认停在聊天框里，两套新房页面并排打开。',
      line: '续租、搬家，还是各住各的——这次别替我决定。',
      stageDirection: '{pronoun}把钥匙放在两套房源之间，没有推向任何一边。',
      pose: 'at-table',
      gesture: 'turns-key',
      videoPrompt:
        '傍晚公寓餐桌，一把钥匙放在续租合同和两套房源页面之间，成熟克制的浅薄荷电影感。',
    },
    turning: {
      round: 4,
      id: 'landlord-last-call',
      title: '最后确认',
      description: '房东发来消息：“九点前没有答复，就联系下一位租客。”',
      line: '还有九十四分钟。别因为截止时间，就把下一年变成谁先妥协。',
      stageDirection: '{pronoun}打开预算表，把自己的通勤时间也写在旁边。',
      pose: 'at-table',
      gesture: 'checks-phone',
      videoPrompt:
        '公寓餐桌手机显示九点续租截止，预算表和通勤时间并排，钥匙停在中央。',
    },
    endings: {
      S: ending(
        'same-key',
        'S',
        '同一把钥匙',
        '你们放弃原房，选择通勤更均衡的新家。钥匙还没拿到，但“我们需要什么”已经写在同一张纸上。',
        '双方共同确定了下一年的居住方案。',
        '两个人在新公寓窗前共同接过一把钥匙，桌上是双方确认的居住清单。',
      ),
      A: ending(
        'two-more-viewings',
        'A',
        '再看两套房',
        '你们不仓促续租，约好本周再看两套房，并写下预算、通勤和独处空间的共同底线。',
        '双方确定了下一步与共同决策标准。',
        '日历上标记两次看房，预算与通勤清单并排，两个人一起确认。',
      ),
      C: ending(
        'two-addresses',
        'C',
        '两个地址',
        '九点前，你们各自发出一条租房咨询。分开住本可以是共同决定，今晚却只剩两个单方面通知。',
        '双方没有共同确定下一年的居住方案。',
        '夜晚餐桌两部手机分别显示不同租房地址，一把旧钥匙留在中间。',
      ),
    },
    signalKeywords: {
      understoodNeed: ['通勤', '租金', '独处', '空间', '被决定', '一起决定'],
      proposedAction: ['预算', '看房', '续租', '搬家', '九点', '两套房'],
    },
    mock: {
      dismissive: '“住一起才像关系”听起来很浪漫，通勤的两小时还是我一个人坐。',
      breakthrough: '预算、通勤、独处空间都写下来，再看两套房。这个决定里终于有我们。',
      understood: '你看见我不是想逃开你，我是不想下一年继续被通勤耗掉。',
      action: '方案可以。先说清楚，它解决的是我们的需要，还是你的截止焦虑？',
      respectful: '你承认分开住也可以讨论。这样我才敢认真谈继续同住。',
      defensive: '房东在催，不代表你可以用时间替我们做决定。',
      event: '还有九十四分钟。我们需要标准，不是更快地找一个人妥协。',
      softening: '先不续原房，再看两套。把预算和通勤底线一起写下来。',
      guarded: '你一直说“我们的家”，但这间房有一半需求从没被问过。',
    },
  },
} satisfies Record<ScenarioId, ScenarioDefinition>;

export const SCENARIO_ORDER = Object.values(SCENARIO_DEFINITIONS).sort(
  (left, right) => left.number - right.number,
);

export function listScenarioSummaries(): ScenarioSummary[] {
  return SCENARIO_ORDER.map((scenario) =>
    ScenarioSummarySchema.parse({
      id: scenario.id,
      number: scenario.number,
      type: scenario.type,
      title: scenario.title,
      summary: scenario.summary,
      difficulty: scenario.difficulty,
      maxRounds: scenario.maxRounds,
    }),
  );
}

export function getScenarioDefinition(
  scenarioId: ScenarioId,
): ScenarioDefinition {
  return SCENARIO_DEFINITIONS[scenarioId];
}

export function createBriefing(
  scenarioId: ScenarioId = 'suitcase-at-one',
  playerGender: Gender = 'male',
): ScenarioBriefing {
  const definition = getScenarioDefinition(scenarioId);
  const opponentGender = playerGender === 'male' ? 'female' : 'male';
  const player = OPPONENTS[playerGender];
  const character = OPPONENTS[opponentGender];
  return ScenarioBriefingSchema.parse({
    id: definition.id,
    number: definition.number,
    type: definition.type,
    title: definition.title,
    summary: definition.summary,
    difficulty: definition.difficulty,
    timeAndPlace: definition.timeAndPlace,
    premise: interpolate(definition.premise, character),
    playerRole:
      `${player.name}，${character.name}的伴侣，25 岁的${PLAYER_ROLES[playerGender]}，进入职场第 3 年。`,
    player: {
      gender: playerGender,
      name: player.name,
      age: 25,
      role: PLAYER_ROLES[playerGender],
      experienceYears: 3,
    },
    character,
    goal: definition.goal,
    maxRounds: definition.maxRounds,
    openingLine: interpolate(definition.opening.line, character),
  });
}

export function createScenarioFacts(briefing: ScenarioBriefing): string {
  const definition = getScenarioDefinition(briefing.id);
  return `
关卡：第 ${definition.number} 关《${definition.title}》
时间地点：${definition.timeAndPlace}
双方设定：${briefing.player.name}与${briefing.character.name}都是 25 岁、职场第 3 年；${briefing.player.name}是${briefing.player.role}，${briefing.character.name}是${briefing.character.role}。玩家扮演${briefing.player.name}。
已发生：${interpolate(definition.facts, briefing.character)}
本关唯一目标：${definition.goal}
角色关注：${interpolate(definition.characterFocus, briefing.character)}
内部评价只看四类信号：理解需要、提出具体行动、尊重选择、表达真诚在意。它们不是额外公开目标。
`.trim();
}

export function createOpeningEvent(
  briefing: ScenarioBriefing,
): StoryEvent {
  const definition = getScenarioDefinition(briefing.id);
  return {
    id: definition.opening.id,
    title: definition.opening.title,
    description: interpolate(
      definition.opening.description,
      briefing.character,
    ),
    videoCue: {
      hookId: `${definition.id}-opening`,
      kind: 'opening',
      prompt: definition.opening.videoPrompt,
      idempotencyKey: `${definition.id}:opening:v1`,
      status: 'reserved',
    },
  };
}

export function createOpeningPerformance(
  briefing: ScenarioBriefing,
): ActorPerformance {
  const definition = getScenarioDefinition(briefing.id);
  return {
    line: interpolate(definition.opening.line, briefing.character),
    emotion: 'guarded',
    tone: 'icy',
    expression: {
      brows: 'flat',
      eyes: 'direct',
      mouth: 'line',
    },
    action: {
      pose: definition.opening.pose,
      gesture: definition.opening.gesture,
      stageDirection: interpolate(
        definition.opening.stageDirection,
        briefing.character,
      ),
    },
    stateChanges: {
      warmth: 0,
      pressure: 0,
      openness: 0,
    },
  };
}

export function createTurningPointEvent(
  round: number,
  idempotencySuffix: string,
  briefing: ScenarioBriefing,
): StoryEvent {
  const definition = getScenarioDefinition(briefing.id);
  return {
    id: definition.turning.id,
    title: definition.turning.title,
    description: interpolate(
      definition.turning.description,
      briefing.character,
    ),
    videoCue: {
      hookId: `${definition.id}-turning-${round}`,
      kind: 'turning_point',
      prompt: definition.turning.videoPrompt,
      idempotencyKey:
        `${definition.id}:turning:${round}:${idempotencySuffix}`,
      status: 'reserved',
    },
  };
}

export function getEndingDefinition(
  scenarioId: ScenarioId,
  endingId: EndingId,
): EndingDefinition {
  if (!endingBelongsToScenario(scenarioId, endingId)) {
    throw new Error(`Ending ${endingId} does not belong to ${scenarioId}`);
  }
  const ending = Object.values(
    getScenarioDefinition(scenarioId).endings,
  ).find((candidate) => candidate.id === endingId);
  if (!ending) throw new Error(`Ending ${endingId} is not configured`);
  return ending;
}

export function getEndingByTier(
  scenarioId: ScenarioId,
  tier: EndingTier,
): EndingDefinition {
  return getScenarioDefinition(scenarioId).endings[tier];
}

export function createEndingVideoEvent(
  ending: EndingDefinition,
  sessionId: string,
  briefing: ScenarioBriefing,
): StoryEvent {
  return {
    id: `ending-${ending.id}`,
    title: ending.title,
    description: interpolate(
      ending.defaultEpilogue,
      briefing.character,
    ),
    videoCue: {
      hookId: `ending-${ending.id}`,
      kind: 'ending',
      prompt: ending.videoPrompt,
      idempotencyKey: `${sessionId}:ending:${ending.id}:v1`,
      status: 'reserved',
    },
  };
}

function ending(
  id: EndingId,
  tier: EndingTier,
  title: string,
  defaultEpilogue: string,
  goalDetail: string,
  videoPrompt: string,
): EndingDefinition {
  return {
    id,
    tier,
    title,
    defaultEpilogue,
    goalDetail,
    videoPrompt,
  };
}

function interpolate(
  value: string,
  character: ScenarioBriefing['character'],
): string {
  const pronoun = character.gender === 'female' ? '她' : '他';
  return value
    .replaceAll('{name}', character.name)
    .replaceAll('{pronoun}', pronoun);
}
