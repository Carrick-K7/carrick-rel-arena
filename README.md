# 关系修罗场

一个“好玩优先、学习次要”的 AI 原生互动剧情游戏原型。首个场景是《凌晨一点，行李箱在门口》：玩家只有七轮对话，需要在禁用道歉词的条件下，让正在收拾行李的黎岚愿意留下吃早餐。

原型已经包含：

- 独立的导演、角色、评判三套 Agent、Prompt 与结构化结果。
- 权威服务端状态机：情绪、信任、愤怒、隐藏目标、轮次、事件和结局条件。
- 四个结局、称号、毒舌点评、关键对话复盘和分享文案。
- 文字输入、浏览器语音输入、OpenAI TTS 与浏览器语音回退。
- 由情绪和动作数据驱动的 SVG 动态立绘。
- 开场、转折、结局三类生成式短视频 Hook。
- `mock`、`openai`、`deepseek` 三种文本模型模式。
- 内存会话和自动过期机制，每局关系状态保持独立。

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev
```

访问 `http://127.0.0.1:3100`。默认 `mock` 模式可直接完整试玩。

启用真实模型：

```dotenv
AI_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
```

或：

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
DEEPSEEK_MODEL=deepseek-v4-flash
```

DeepSeek 负责文本时，可额外配置 `OPENAI_API_KEY` 生成角色语音。缺少 OpenAI Key 时，客户端使用系统语音合成。

## 验证

```bash
npm run verify
```

## 产品与工程文档

- [完整产品需求](docs/PRODUCT.md)
- [系统架构、状态机、数据结构、选型与计划](docs/ARCHITECTURE.md)
- [模型 Prompt 设计](docs/PROMPTS.md)

## 项目归属

本项目采用独立仓库。Carrick Games 当前是纯静态 Canvas 游戏集合；本产品需要服务端密钥、会话编排、音频代理、模型供应商适配和独立部署节奏。成熟版本可在 Carrick Games 增加一个入口卡片，核心运行时继续保持独立。
