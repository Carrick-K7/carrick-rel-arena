# 《关系修炼》设计系统

前端视觉与动效的单一事实来源。任何 token、动效、组件模式的改动必须先更新本文档，再改 `src/client/styles.css`。

## 1. 设计原则

1. **克制（Substack 式）**：单一 accent 色、充足留白、hairline 分隔、衬线标题唱主角。装饰做减法——一个区块要么靠间距、要么靠分隔线，不同时堆叠。
2. **情绪即可见性**：关系温度、对话压力、角色情绪是玩法核心，必须被视觉编码（颜色、光、动效），不能只停留在数字。
3. **动效有物理感（Apple 式）**：少而准。统一曲线、统一时长、入场有编排、按压有回弹。任何动画不超过约 400ms。
4. **无依赖**：不引外部字体、不引动画库。系统字体栈 + 纯 CSS 动效。

## 2. Token 表

全部 token 定义在 `styles.css` 的 `:root`，组件样式只允许消费 token，不允许新增散值。

### 2.1 色板

| Token | 值 | 用途 |
|---|---|---|
| `--paper` | `#f4fbfa` | 页面底色（含顶部径向光晕，见 `body`） |
| `--surface` | `#ffffff` | 卡片与浮层表面 |
| `--ink` | `#263433` | 主文字 |
| `--muted` | `#607370` | 次要文字 |
| `--faint` | `#879a97` | 辅助/占位文字 |
| `--line` | `#cbdedb` | 分隔线、卡片描边 |
| `--line-soft` | `#e3f0ee` | 弱分隔、轨道底 |
| `--accent` | `#39c5bb` | 唯一主色：主按钮、链接态、焦点 |
| `--accent-dark` | `#168f88` | accent 的加深态（hover/选中文字） |
| `--trust` | `#249d94` | 完成/正向状态 |
| `--anger` | `#d95678` | 压力/失分/紧迫状态 |
| `--soft-orange/green/red` | — | 浅色底（提示块） |

**语义色组**（组件内局部定义，新增成员时同步此处）：

- 情绪色 `--emotion-c`（挂在 `.portrait` 的 `.emotion-*` 上）：guarded `#5f7f8f`、angry `#d95678`、hurt `#8a7fc8`、testing `#d9a03f`、softening `#e08a6c`、warm `#e2a44a`、done `#8a9594`。驱动立绘氛围光与情绪徽章。
- 关卡类型色（`.scenario-card--*` 的首个标签）：邀约 teal、安慰 `#5d6fc0`、磨合 `#a0761f`、修复 `#b84d70`。
- 评级色（`.tier--*`）：S `#bd8a1f`（琥珀金）、A `var(--accent-dark)`、C `var(--muted)`。
- 仪表渐变：温度 `linear-gradient(90deg, #e8b04b, #e0885e)`（暖），压力 `linear-gradient(90deg, #d95678, #c23a5e)`（玫红），配同色微光 `box-shadow`。

### 2.2 字体

- `--font-sans`：Inter → PingFang SC → Microsoft YaHei → system-ui。正文与 UI。
- `--font-serif`：Georgia → Noto Serif CJK SC → Source Han Serif SC → Songti SC → STSong → SimSun。标题、台词、引文、大号数字。
- 全局数字 `font-variant-numeric: tabular-nums`（`body`）。

**字号阶**（新代码必须从阶上取值；存量散值逐步归并）：

| Token | 值 | 用途 |
|---|---|---|
| `--text-xs` | 11px | 徽章、角标、 caption |
| `--text-sm` | 12.5px | 辅助说明 |
| `--text-md` | 14px | 正文/列表 |
| `--text-lg` | 15.5px | 强调正文 |
| `--text-xl` | 17px | 面板标题、输入区 |
| `--text-2xl` | 20px | 卡片标题 |
| `--text-3xl` | 26px | 区块标题 |
| display | `clamp(40px, 5vw, 64px)` | 页面主标题（各屏就地 clamp） |

**字距**：小标签/eyebrow `0.04–0.06em`（中文小字需要呼吸）；display 标题 `-0.01em`（中文大标题不宜收太紧）；引文容器 `hanging-punctuation: first`（引号悬挂，渐进增强）。

### 2.3 间距阶

`--sp-1:4 · --sp-2:8 · --sp-3:12 · --sp-4:16 · --sp-5:20 · --sp-6:28 · --sp-7:40 · --sp-8:56`

### 2.4 圆角与阴影

- 圆角：`--r-sm:6`（按钮/小标签）、`--r-md:10`（卡片）、`--r-lg:16`（立绘/弹层/战报卡）、`--r-pill:999`。
- 阴影三级：`--shadow-1` 卡片静置、`--shadow-2` 浮起/hover/主视觉、`--shadow-3` 模态。阴影色固定低饱和青灰，不允许彩色阴影（按钮上的 accent 投影除外）。
- 焦点：`--focus-ring`（`color-mix` 30% accent），统一 `:focus-visible`，禁用 outline。

### 2.5 动效 token

| Token | 值 | 用途 |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.32, 0.72, 0, 1)` | 一切交互与入场（Apple 式缓出） |
| `--ease-spring` | `cubic-bezier(0.34, 1.32, 0.4, 1)` | 需要轻回弹的入场（评级、模态、delta） |
| `--dur-1` | 120ms | 微反馈（按压） |
| `--dur-2` | 200ms | hover/状态过渡 |
| `--dur-3` | 360ms | 入场动画上限 |

无限循环动画（呼吸、脉冲、shimmer）使用 `ease-in-out` 或 `linear`，不受三时长约束，但幅度必须小。

## 3. 动效规范

**入场编排**：

- 屏切换：`.level-screen / .briefing-screen / .game-screen / .result-screen` 统一 `screen-in`（fade + 8px 上浮）。
- 选关卡片 stagger：`nth-child` 40ms 步进延迟，`fill-mode: backwards`（让位 hover transform——带 hover 位移的元素禁止 `both`）。
- 对话消息：挂载即 `message-in`（转录只增不减，天然只播新消息）。
- 结算评级 `grade-in`、模态 `panel-in`、delta `delta-pop` 用 spring 曲线。

**交互反馈**：

- 可点元素统一 `:active { transform: scale(0.97) }`，卡片 `0.99`。
- hover = 位移 ≤2px + 阴影升一级，不换底色大变。

**降级**：`prefers-reduced-motion` 媒体查询把全部 animation/transition 压到 1ms（已有全局规则），新增动画无需单独处理。

**不做的事**：无视差滚动、无 >400ms 动画、无 JS 驱动计数器/物理库、不为动效加依赖。

## 4. 组件模式

- **卡片**：`--surface` + `1px var(--line)` + `--r-md` + `--shadow-1`；hover 上浮 2px + `--shadow-2` + 左侧 accent 内条。
- **按钮**：主按钮 accent 实心 + `--r-sm` + accent 投影；次按钮白底描边 ghost；三态齐全（hover 加深/上浮、active scale、disabled 降透明度）。
- **徽章**：`--r-pill` + 语义色浅底深字（delta、impact、情绪、类型标签）。
- **气泡**：玩家消息右侧 accent 浅底（`14px 14px 4px` 圆角）；角色消息左侧无底色；开场白 blockquote 带小三角。
- **仪表条**：6px pill 轨道 + 语义渐变 + 同色微光，`width` 过渡 650ms。
- **时间线**：左竖线 + 圆点 + 末项断线（结算复盘）。
- **浮层**：`--shadow-3` + `--r-lg` + 背景 blur；触发器右下角固定 pill。
- **立绘舞台**：`--emotion-c` 径向氛围光 + 圆角相框；softening/warm 呼吸影、angry 入场轻颤一次。

## 5. 决策记录

- **不引 webfont**：中文字体子集数 MB、CDN 在国内不稳定；系统衬线栈（含 Linux 的 Noto/思源宋体）覆盖足够好，零成本零闪烁。
- **立绘情绪切换无交叉淡化**：`<img src>` 瞬切无法用纯 CSS 交叉淡化；以 filter/scale 过渡 + 氛围光变色补偿。Live2D 适配层落地时再评估。
- **浅色单主题**：品牌即"纸感浅青"，深色剧场风已评估放弃（用户决策）。
- **hairline 降噪**：游戏屏右列以间距分區为主，只保留台词区下方一条 ink 主线作为视觉锚。
