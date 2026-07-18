# 关系修罗场

一个“好玩优先、学习次要”的 AI 原生互动剧情游戏原型。首个场景是《凌晨一点，行李箱在门口》：玩家选择扮演 25 岁的程序员男生或产品经理女生，在七轮对话内尝试让正在收拾行李的对手留下吃早餐。

原型已经包含：

- 独立的导演、角色、评判三套 Agent、Prompt 与结构化结果。
- 权威服务端状态机：情绪、信任、愤怒、轮次、事件和结局条件。
- 单一清晰关卡目标、三个结局、称号、毒舌点评、关键对话复盘和分享文案。
- 文字输入、浏览器语音输入、小米 MiMo/OpenAI TTS 与浏览器语音回退。
- 黎岚与周叙两位对手立绘，随玩家角色选择切换，并由情绪状态驱动演出。
- 开场、转折、结局三类生成式短视频 Hook。
- `mock`、`openai`、`deepseek` 三种文本模型模式。
- 每个 Agent 调用的 Token、缓存、延迟、重试、成本估算和阈值告警。
- 内存会话和自动过期机制，每局关系状态保持独立。

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev
```

开发模式访问 `http://127.0.0.1:3100`。默认 `mock` 模式可直接完整试玩。

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

DeepSeek 负责文本时，可独立配置小米 MiMo TTS：

```dotenv
TTS_PROVIDER=auto
MIMO_API_KEY=...
MIMO_TTS_MODEL=mimo-v2.5-tts
MIMO_TTS_FEMALE_VOICE=冰糖
MIMO_TTS_MALE_VOICE=白桦
```

`auto` 按“小米 MiMo → OpenAI → 浏览器系统语音”选择可用语音 Provider，并按对手性别选择音色。服务端 TTS 未配置或请求失败时，客户端自动使用浏览器系统语音；文字和立绘流程不受影响。

内容能力遵循“文字 → 立绘 → 语音 → 视频”的逐层增强：文字对话是必备主路径，立绘作为随包静态资产始终可用；语音密钥缺失时使用浏览器能力；视频仅保留 Hook，未配置生成服务时不会发起请求。

ChatGPT Plus/Pro 等订阅可用于 Codex 辅助开发。服务运行时通过 OpenAI API Platform 的 `OPENAI_API_KEY` 调用真实 GPT；`mock` 模式可直接运行完整游戏、语音回退和全部测试。

Codex 中内置的 `gpt-image-2` 可在开发阶段生成并提交静态美术资产，消耗 Codex/ChatGPT 订阅用量。让已部署应用在玩家请求时动态生成图片属于 API 调用，需要独立的 OpenAI API Key、API 计费和相应组织权限。

## 环境变量与密钥位置

- 本地开发：复制 `.env.example` 为仓库根目录 `.env`；`.env` 已被 Git 忽略。
- 本机服务：实际密钥放在 `/etc/relationship-arena/relationship-arena.env`，systemd 读取该文件。
- 可提交声明：`.env.example` 与 `deploy/relationship-arena.env.example` 只保留空占位符。

密钥只存在服务端环境中；前端构建和 `/api/capabilities` 只包含 Provider 能力标签。

## 用量与告警

每局底部和结算页显示模型调用次数、Token 与文字模型估算成本。服务端只把技术计量写入 JSONL，不写玩家或角色正文：

```bash
curl http://127.0.0.1:3100/api/admin/usage
curl http://127.0.0.1:3100/api/admin/metrics
```

默认告警阈值为单局 `$0.25`、单日 `$5`、单局 `120000` Token，以及至少 10 次调用后的 20% 小时错误率。设置 `USAGE_ALERT_WEBHOOK_URL` 可接收 JSON 告警；设置 `USAGE_ADMIN_TOKEN` 后，管理接口要求 `Authorization: Bearer <token>`。

每日窗口按 `USAGE_TIME_ZONE` 切分，本机部署默认使用 `Asia/Shanghai`。

内置价格表覆盖默认的 `gpt-5.4-mini`、`deepseek-v4-flash` 和 `deepseek-v4-pro`。切换其他模型时应在环境变量中显式提供输入、缓存输入和输出的每百万 Token 单价。

## 本机生产服务

仓库包含 [systemd 单元](deploy/relationship-arena.service) 和 [生产环境模板](deploy/relationship-arena.env.example)。构建后安装到本机：

```bash
sudo install -d -m 0750 /etc/relationship-arena
sudo install -m 0640 deploy/relationship-arena.env.example /etc/relationship-arena/relationship-arena.env
sudo install -m 0644 deploy/relationship-arena.service /etc/systemd/system/relationship-arena.service
sudo systemctl daemon-reload
sudo systemctl enable --now relationship-arena.service
curl -fsS http://127.0.0.1:3100/api/health
```

生产构建使用 `/rel-arena/` 作为前端和 API 公共前缀，服务继续监听回环地址。将 [Caddy 示例](deploy/relationship-arena.caddy.example) 合并到现有 `games.carrick7.com` 站点后，公开入口为：

```text
https://games.carrick7.com/rel-arena/
```

公网 Caddy 路由只代理游戏与语音接口，并屏蔽 `/rel-arena/api/admin/*`。本机管理接口继续通过 `http://127.0.0.1:3100/api/admin/*` 使用。

对已部署构建运行浏览器测试：

```bash
npm run test:e2e:deployed
```

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
