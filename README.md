# 关系修炼

一个“好玩优先、学习次要”的 AI 原生互动剧情游戏。秋雾与江影贯穿八关，从第一次邀约、安慰和磨合一路走到关系修复与下一年的家。玩家每关都可选择扮演 25 岁的程序员男生或产品经理女生，互动伴侣自动切换。

当前版本包含：

- 八关类型安全目录、5～7 轮独立会话和每关三个确定性结局。
- 关卡类型与完成进度筛选，所有关卡始终开放。
- 独立的导演、角色、评判三套 Agent、Prompt 与结构化结果。
- 权威服务端状态机：关系温度、对话压力、开放程度、轮次、事件和结局条件。
- 单一清晰关卡目标、三个结局、称号、毒舌点评、关键对话复盘和分享文案。
- 文字输入与语音转写始终可用；文字输出固定保留，语音、图像和视频可以任意组合。
- 秋雾与江影两位角色立绘，随玩家身份选择切换，并由情绪状态驱动演出。
- 火山方舟 Seedream 逐轮剧情图像与可切换形象轨迹、Seedance 结算回忆视频；固定人物原型以内联参考图保持连续并避免回源超时。
- `mock`、`openai`、`deepseek` 三种文本模型模式。
- 每个 Agent 调用的 Token、缓存、延迟、重试、成本估算和阈值告警。
- 内存会话和自动过期机制，每局关系状态保持独立。
- 仅在浏览器本机保存完成记录、男女身份最佳成绩、结局收藏和匿名媒体制品索引；不保存对话正文。

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

`auto` 按“小米 MiMo → OpenAI → 浏览器系统语音”选择可用语音 Provider，并按角色性别选择音色。服务端 TTS 未配置或请求失败时，客户端自动使用浏览器系统语音；文字和立绘流程不受影响。

启用图像与视频生成：

```dotenv
MEDIA_PROVIDER=ark
MEDIA_ACCESS_KEY=...
ARK_API_KEY=...
ARK_IMAGE_MODEL=doubao-seedream-5-0-260128
ARK_VIDEO_MODEL=doubao-seedance-2-0-260128
```

`ARK_API_KEY` 是服务端调用火山方舟的真实凭证；`MEDIA_ACCESS_KEY` 是玩家在设置页输入的产品访问密钥，用来避免公开访客误触发付费生成。两者用途不同。媒体模型会临时接收生成当前画面和整局回忆所需的对话上下文，但应用不长期保存对话正文。访问密钥只保留在当前页面内存，刷新即清除；本机持久化所选模态和匿名制品索引。

内容能力逐层增强：文字对话和字幕是必备主路径；立绘作为随包静态资产始终可用；语音密钥缺失时使用浏览器能力；媒体 Provider 未配置时禁用图像和视频选项。图像和视频模式都逐轮生成 Seedream 图片，结算后视频模式再生成一次 480p、16:9、15 秒无声 Seedance 回忆短片；生成不阻塞文字对话。

真实媒体成功后会复制到 `MEDIA_ARCHIVE_DIR`。生产默认使用 `/var/lib/carrick/relationship-arena/media`，不会写入只读发布目录；已完成关卡可从“查看回忆”打开历次生成的图片和视频。

ChatGPT Plus/Pro 等订阅可用于 Codex 辅助开发。应用运行时的 OpenAI、DeepSeek、MiMo 和火山方舟调用各自使用独立 API 凭证与计费账户；`mock` 模式可直接运行完整游戏、语音回退和全部测试。

## 环境变量与密钥位置

- 本地开发：复制 `.env.example` 为仓库根目录 `.env`；`.env` 已被 Git 忽略。
- 本机服务：文字和语音密钥放在 `/etc/relationship-arena/relationship-arena.env`；媒体密钥可单独放在 `/etc/relationship-arena/relationship-arena-media.env`，systemd 同时读取两者。
- 可提交声明：`.env.example` 与 `deploy/relationship-arena.env.example` 只保留空占位符。

供应商密钥只存在服务端环境中；前端构建和 `/api/capabilities` 只包含 Provider 能力标签。页面输入的媒体访问密钥不会写入 `localStorage`、会话数据或技术用量日志。

## 用量与告警

每局底部和结算页显示模型调用次数、Token 与文字模型估算成本。服务端只把技术计量写入 JSONL，不写玩家或角色正文：

```bash
curl http://127.0.0.1:3100/api/admin/usage
curl http://127.0.0.1:3100/api/admin/metrics
```

默认告警阈值为单局 `$0.25`、单日 `$5`、单局 `120000` Token，以及至少 10 次调用后的 20% 小时错误率。设置 `USAGE_ALERT_WEBHOOK_URL` 可接收 JSON 告警；设置 `USAGE_ADMIN_TOKEN` 后，管理接口要求 `Authorization: Bearer <token>`。

每日窗口按 `USAGE_TIME_ZONE` 切分，本机部署默认使用 `Asia/Shanghai`。

内置价格表覆盖默认的 `gpt-5.4-mini`、`deepseek-v4-flash` 和 `deepseek-v4-pro`。切换其他模型时应在环境变量中显式提供输入、缓存输入和输出的每百万 Token 单价。

## 生产部署

推送到 `main` 后由 `.github/workflows/deploy.yml` 完成验证、打包和原子发布。生产 release 位于 `/srv/carrick/relationship-arena/releases/<git-sha>/`，`current` 软链接只在新 release 就绪后切换；运行时数据位于 `/var/lib/carrick/relationship-arena/`，不会写入只读 release。

共享 Caddy、主机级 systemd 单元、监听端口和监控由私有 `Carrick-K7/carrick-ops` 仓库管理，应用仓库不直接覆盖这些配置。生产构建使用 `/rel-arena/` 作为前端和 API 公共前缀，公开入口为：

```text
https://games.carrick7.com/rel-arena/
```

公网 Caddy 路由代理游戏、会话、语音和媒体接口，并屏蔽 `/rel-arena/api/admin/*`。本机管理接口继续通过 `http://127.0.0.1:3100/api/admin/*` 使用。

对已部署构建运行浏览器测试：

```bash
E2E_MEDIA_ACCESS_KEY=<media-access-key> npm run test:e2e:deployed
```

该套件的媒体用例会触发多张真实图像和一支视频；只做零成本烟雾检查时，应改用不含媒体用例的 Playwright 筛选。

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
