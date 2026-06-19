---
name: pi-devkit-zh
description: 指导创建和配置 pi 扩展、技能、提示模板及使用设置。当用户询问如何创建 pi 扩展、编写技能、制作提示模板或配置 pi 设置/模型/主题时使用。
---

# Pi DevKit — 扩展 · 技能 · 提示模板 · 使用配置

完整参考，涵盖 pi 自定义开发的各个方面。

---

## 第 1 部分 — 扩展

Extensions 是 TypeScript 模块，能自定义工具、拦截事件、注册命令、渲染 UI。扩展运行在用户权限下，可以执行任意代码。

### 1.1 最小扩展

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // 注册一个工具
  pi.registerTool({
    name: "greet",
    label: "Greet",
    description: "向某人打招呼",
    parameters: Type.Object({
      name: Type.String({ description: "要打招呼的名字" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });

  // 注册一个斜杠命令
  pi.registerCommand("hello", {
    description: "say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}!`, "info");
    },
  });

  // 拦截事件
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("危险操作!", "允许执行 rm -rf 吗?");
      if (!ok) return { block: true, reason: "已阻止" };
    }
  });
}
```

测试: `pi -e ./my-ext.ts`

### 1.2 安装位置

| 位置 | 范围 |
|------|------|
| `~/.pi/agent/extensions/*.ts` | 全局 |
| `~/.pi/agent/extensions/*/index.ts` | 全局（目录形式） |
| `.pi/extensions/*.ts` | 项目（需信任） |
| `.pi/extensions/*/index.ts` | 项目（目录形式） |

### 1.3 三种组织方式

**单文件:** `~/.pi/agent/extensions/my-ext.ts`

**目录（多文件）:**
```
~/.pi/agent/extensions/my-ext/
├── index.ts        # 入口，export default function
├── tools.ts        # 工具实现
└── utils.ts        # 工具函数
```

**带 npm 依赖的包:**
```
~/.pi/agent/extensions/my-ext/
├── package.json
├── package-lock.json
├── node_modules/
└── src/
    └── index.ts
```

`package.json`:
```json
{
  "name": "my-ext",
  "dependencies": { "chalk": "^5.0.0" },
  "pi": { "extensions": ["./src/index.ts"] }
}
```

### 1.4 可用的 import 包

| 包 | 用途 |
|----|------|
| `@earendil-works/pi-coding-agent` | 类型定义: ExtensionAPI, ExtensionContext, 事件 |
| `typebox` | 工具参数的 schema 定义 |
| `@earendil-works/pi-ai` | AI 工具函数 |
| `@earendil-works/pi-tui` | 自定义 TUI 组件 |

Node.js 内置模块（`node:fs`、`node:path` 等）也可直接 import。

### 1.5 能注册什么

#### `pi.registerTool()` — 注册工具

```typescript
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "工具描述",
  promptSnippet: "一行描述，显示在 Available tools",
  parameters: Type.Object({
    action: Type.String(),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    onUpdate?.({ content: [{ type: "text", text: "处理中..." }] });
    return {
      content: [{ type: "text", text: "完成" }],
      details: {},
    };
  },
});
```

#### `pi.registerCommand()` — 注册命令

```typescript
pi.registerCommand("mycmd", {
  description: "做什么的",
  handler: async (args, ctx) => {
    ctx.ui.notify("执行成功!", "info");
  },
});
```

#### `pi.registerShortcut()` — 注册快捷键

```typescript
pi.registerShortcut("ctrl+shift+y", {
  description: "做某件事",
  handler: async (ctx) => {
    ctx.ui.notify("快捷键触发!", "info");
  },
});
```

#### `pi.registerFlag()` — 注册 CLI 参数

```typescript
pi.registerFlag("my-flag", {
  description: "启用某功能",
  type: "boolean",
  handler: async (value, ctx) => {
    if (value) ctx.ui.notify("Flag 开启", "info");
  },
});
```

#### `pi.registerProvider()` — 注册 Provider

```typescript
pi.registerProvider("my-provider", {
  baseUrl: "http://localhost:1234/v1",
  apiKey: "$MY_API_KEY",
  api: "openai-completions",
  models: [{ id: "my-model", reasoning: false }],
});
```

### 1.6 全部 30 种 Hook — pi.on()

#### 启动/安全（2）

| 事件 | 触发时机 | 可取消 |
|------|---------|--------|
| `project_trust` | 扩展加载前，判断项目目录是否受信任 | — |
| `resources_discover` | session_start 后，提供额外资源路径 | — |

#### 会话生命周期（8）

| 事件 | 触发时机 | 可取消 |
|------|---------|--------|
| `session_start` | 会话创建/加载/重载 | 否 |
| `session_before_switch` | 切换会话前（new/resume） | **是** |
| `session_before_fork` | 分叉前 | **是** |
| `session_before_compact` | 上下文压缩前 | **是** |
| `session_compact` | 压缩完成后 | 否 |
| `session_shutdown` | 扩展销毁时 | 否 |
| `session_before_tree` | 会话树导航前 | **是** |
| `session_tree` | 会话树导航后 | 否 |

#### Agent 生命周期（3）

| 事件 | 触发时机 |
|------|---------|
| `before_agent_start` | 用户提交 prompt 后、agent 循环前，可注入消息或修改 system prompt |
| `agent_start` | agent 循环开始 |
| `agent_end` | agent 循环结束 |

#### Turn 生命周期（2）

| 事件 | 触发时机 |
|------|---------|
| `turn_start` | 每个 turn 开始 |
| `turn_end` | 每个 turn 结束 |

#### 消息生命周期（3）

| 事件 | 触发时机 | 可返回 |
|------|---------|--------|
| `message_start` | 消息开始创建 | — |
| `message_update` | assistant 消息流式更新 | — |
| `message_end` | 消息完成 | 可返回替换消息（相同 role） |

#### Tool 执行生命周期（3）

| 事件 | 触发时机 |
|------|---------|
| `tool_execution_start` | tool 开始执行前 |
| `tool_execution_update` | tool 执行中（流式/部分输出） |
| `tool_execution_end` | tool 执行完成 |

#### Tool 调用/结果拦截（2）

| 事件 | 触发时机 | 可返回 |
|------|---------|--------|
| `tool_call` | tool 执行前 | `{ block: true, reason }` 拦截，或修改 event.input |
| `tool_result` | tool 结果产生后 | 替换 content/details/isError |

#### 模型/思考级别（2）

| 事件 | 触发时机 |
|------|---------|
| `model_select` | 模型切换时 |
| `thinking_level_select` | 思考级别变更时 |

#### 用户输入（2）

| 事件 | 触发时机 | 可返回 |
|------|---------|--------|
| `user_bash` | 用户执行 `!` / `!!` 命令 | 自定义 BashOperations/BashResult |
| `input` | 用户提交文本后 | `continue` / `transform` / `handled` |

#### Provider 中间件（3）

| 事件 | 触发时机 | 可返回 |
|------|---------|--------|
| `context` | LLM 调用前，修改 messages | 修改后的 messages 数组 |
| `before_provider_request` | provider 请求发送前 | 替换 payload |
| `after_provider_response` | provider 响应收到后 | — |

### 1.7 ctx API 速查

| 方法 | 说明 |
|------|------|
| `ctx.ui.notify(msg, type)` | 通知（info/warning/error/success） |
| `ctx.ui.confirm(title, msg)` | 确认弹窗 |
| `ctx.ui.select(title, items)` | 列表选择 |
| `ctx.ui.input(opts)` | 输入框 |
| `ctx.ui.setStatus(id, text)` | 设置底部状态栏文字 |
| `ctx.ui.setWidget(id, lines)` | 编辑器上方显示 widget |
| `ctx.sessionManager` | 只读访问会话状态 |
| `ctx.cwd` | 当前工作目录 |
| `ctx.mode` | 运行模式: tui/rpc/json/print |
| `ctx.hasUI` | 是否有 UI |
| `ctx.signal` | 请求的 AbortSignal |
| `ctx.model` / `ctx.modelRegistry` | 模型和 key 访问 |

### 1.8 调试与加载

```bash
pi -e ./my-ext.ts                          # 临时加载测试
pi --no-extensions                         # 禁用所有扩展
pi --no-extensions -e ./my-ext.ts          # 精确控制
```

自动加载: 放入 `~/.pi/agent/extensions/` 后重启，或 `/reload` 热重载。

### 1.9 完整扩展示例

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // 启动时提示
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("扩展已加载!", "info");
  });

  // 拦截危险 bash
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && /\bsudo\b/.test(event.input.command)) {
      const ok = await ctx.ui.confirm("确认", "允许执行 sudo 命令吗?");
      if (!ok) return { block: true, reason: "已阻止: sudo 需要确认" };
    }
  });

  // 注册 todo 管理工具
  const todos: string[] = [];
  pi.registerTool({
    name: "todo",
    label: "Todo Manager",
    description: "管理待办事项: add/list/done",
    parameters: Type.Object({
      action: Type.String({ description: "add / list / done" }),
      item: Type.Optional(Type.String()),
    }),
    async execute(toolCallId, params) {
      if (params.action === "add" && params.item) {
        todos.push(params.item);
        return { content: [{ type: "text", text: `已添加: ${params.item}` }], details: {} };
      }
      if (params.action === "list") {
        return { content: [{ type: "text", text: todos.join("\n") || "(空)" }], details: {} };
      }
      return { content: [{ type: "text", text: "未知操作" }], details: {} };
    },
  });
}
```

---

## 第 2 部分 — Skills

Skill 让 pi 按需加载专项工作流。一个 skill 就是一个目录，里面包含 `SKILL.md` 加辅助脚本。

### 2.1 基本结构

```
my-skill/
├── SKILL.md              # 必选: frontmatter + 指令
├── scripts/              # 辅助脚本
└── references/           # 按需加载的参考文档
```

### 2.2 SKILL.md 格式

```markdown
---
name: my-skill
description: 用一句话说清楚何时使用。越具体越好。
---

# My Skill

## Setup

首次使用前执行一次:
```bash
cd /path/to/skill && npm install
```

## Usage

```bash
./scripts/process.sh <input>
```
```

### 2.3 Frontmatter 完整字段

```yaml
---
name: my-skill
description: 用一句话说清楚何时使用
disable-model-invocation: true
license: MIT
compatibility: Node >= 18
metadata:
  author: me
allowed-tools: read bash
---
```

| 字段 | 标准/pi 特有 | 必填 | 说明 |
|------|-------------|------|------|
| `name` | 标准 | 是 | 1-64 字符，小写字母/数字/连字符。缺省则用目录名 |
| `description` | 标准 | **强必填** | 最多 1024 字符，**为空则 skill 不加载** |
| `disable-model-invocation` | **pi 特有** | 否 | `true` 时模型看不到此 skill，只能 `/skill:name` 手动触发 |
| `license` | 标准 | 否 | 许可证名称或文件引用 |
| `compatibility` | 标准 | 否 | 环境要求，最多 500 字符 |
| `metadata` | 标准 | 否 | 任意 key-value，透传不处理 |
| `allowed-tools` | 标准（实验） | 否 | 空格分隔的预批准工具列表 |

#### `disable-model-invocation` 详解

| 值 | 行为 |
|----|------|
| `false`（默认） | skill 描述出现在 `<available_skills>` 中，模型可自动按需加载 |
| `true` | skill 完全对模型隐藏，只能 `/skill:name` 手动调用 |

适用: 有副作用的操作、不想让模型自作主张调用的工具类 skill。

#### 标准字段的 pi 行为

| 字段 | pi 处理 |
|------|---------|
| `name` | 优先读 frontmatter，没有则回退到父目录名 |
| `description` | 必须非空，否则 skill **不加载**。其他校验问题仅 warning |
| 其他 | 解析但不产生具体行为 |

#### 系统提示中的 skill 渲染

```xml
<available_skills>
  <skill>
    <name>my-skill</name>
    <description>What this skill does</description>
    <location>/path/to/skill/SKILL.md</location>
  </skill>
</available_skills>
```

`disable-model-invocation: true` 的 skill 不在此清单中。

### 2.4 Name 规则

- 仅小写字母、数字、连字符
- 不以连字符开头/结尾
- 无连续连字符
- 合法: `pdf-processing`、`code-review`、`web-search`

### 2.5 Description 要点

描述必须让模型知道"什么时候该用这个 skill":

好的:
```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents.
```
差的:
```yaml
description: Helps with PDFs.
```

### 2.6 安装位置

| 位置 | 范围 |
|------|------|
| `~/.pi/agent/skills/` | 全局生效 |
| `~/.agents/skills/` | 全局生效（其他 agent 共用） |
| `.pi/skills/` | 项目内生效（需信任） |
| `.agents/skills/` | 项目祖先目录（到 git 根目录） |

额外路径 via `settings.json`:
```json
{ "skills": ["~/.claude/skills"] }
```

命令行:
```bash
pi --skill /path/to/my-skill
```

### 2.7 发现规则

- `~/.pi/agent/skills/` 和 `.pi/skills/` 下，根 `.md` 文件也会被识别
- 所有位置中，含 `SKILL.md` 的目录会被递归发现
- `~/.agents/skills/` 下，根 `.md` 文件**不会**被发现

### 2.8 使用方式

```text
/skill:name           # 加载并执行 skill
/skill:name arg1      # 带参数加载
```

系统提示中会自动包含可用 skills 列表，模型发现任务匹配时会自行通过 `read` 加载 `SKILL.md` 内容。`/skill:name` 可强制触发。

### 2.9 快速创建

> pi 帮我创建一个 skill，功能是 XXXX

---

## 第 3 部分 — Prompt Templates

Prompt template 是 Markdown 片段，输入 `/name` 时自动展开为完整提示。

### 3.1 基本文件

文件名不带 `.md` 就变成命令名:
```
~/.pi/agent/prompts/
├── review.md        # 使用 /review
├── component.md     # 使用 /component
└── fix.md           # 使用 /fix
```

### 3.2 文件格式

```markdown
---
description: 审查暂存的 git 变更
---

Review the staged changes (`git diff --cached`). Focus on:
- Bugs and logic errors
- Security issues
- Error handling gaps
```

- 文件名变命令名: `review.md` → `/review`
- `description` 可选，用于自动补全提示文字

### 3.3 参数占位符

| 语法 | 说明 |
|------|------|
| `$1`, `$2`, ... | 第 N 个参数 |
| `$@` / `$ARGUMENTS` | 所有参数拼接 |
| `${1:-default}` | 有参数时用，否则用默认值 |
| `${@:N}` | 从第 N 个参数开始 |
| `${@:N:L}` | 从 N 开始取 L 个 |

```markdown
---
description: 创建 React 组件
---

Create a React component named $1 with features: $@
```

使用: `/component Button "onClick handler"` → "Create a React component named Button with features: onClick handler"

带默认值:
```markdown
Summarize the current state in ${1:-7} bullet points.
```

### 3.4 Argument Hint（可选）

```markdown
---
description: Review PRs from URLs with structured issue and code analysis
argument-hint: "<PR-URL>"
---
```

`<angle brackets>` 表示必填，`[square brackets]` 表示可选。

### 3.5 安装位置

| 位置 | 范围 |
|------|------|
| `~/.pi/agent/prompts/*.md` | 全局生效 |
| `.pi/prompts/*.md` | 项目内（需信任） |

via `settings.json`:
```json
{ "prompts": ["/path/to/prompts"] }
```

命令行:
```bash
pi --prompt-template /path/to/fix.md
```

### 3.6 发现规则

- `prompts/` 目录下仅平铺扫描，不递归子目录
- 如需子目录内的模板，通过 `prompts` 设置或包清单显式添加

### 3.7 快速创建

> pi 帮我创建一个 prompt template，用于 code review

### 3.8 实用示例

**code-review.md:**
```markdown
---
description: Review code changes for bugs, security, and style
---

Review the following code with focus on:
1. Logic errors and edge cases
2. Security vulnerabilities
3. Error handling
4. Code style and maintainability

Use `read` to inspect the full file context where needed.
```

**commit.md:**
```markdown
---
description: Generate a concise git commit message
argument-hint: "<type> [scope]"
---

Generate a git commit message for the staged changes.
Format: `$1${2:+(}$2${2:+)}: <description>`

Example: feat(api): add user authentication endpoint
```

---

## 附录 A — 使用配置参考

### A.1 配置文件总览

| 文件 | 位置 | 用途 |
|------|------|------|
| `settings.json` | `~/.pi/agent/`（全局）/ `.pi/`（项目） | 主设置 |
| `auth.json` | `~/.pi/agent/` | API Key / OAuth 凭证 |
| `models.json` | `~/.pi/agent/` | 自定义 Provider 和模型 |
| `keybindings.json` | `~/.pi/agent/` | 自定义快捷键 |
| `trust.json` | `~/.pi/agent/` | 项目信任决策 |
| `AGENTS.md` | 项目 / `~/.pi/agent/` | 上下文指令 |
| `SYSTEM.md` | `.pi/` / `~/.pi/agent/` | 自定义系统提示 |
| `APPEND_SYSTEM.md` | `.pi/` / `~/.pi/agent/` | 追加系统提示 |

项目设置覆盖全局设置，嵌套对象合并。

### A.2 settings.json 关键字段

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "theme": "dark",
  "quietStartup": false,
  "defaultProjectTrust": "ask",
  "doubleEscapeAction": "tree",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "baseDelayMs": 2000
  },
  "steeringMode": "one-at-a-time",
  "followUpMode": "one-at-a-time",
  "enabledModels": ["claude-*", "gpt-4o"],
  "packages": ["pi-skills"],
  "extensions": [],
  "skills": [],
  "prompts": [],
  "themes": [],
  "enableSkillCommands": true
}
```

| 模块 | 关键字段 |
|------|---------|
| 模型 | `defaultProvider` / `defaultModel` |
| 思考 | `defaultThinkingLevel` / `thinkingBudgets` |
| UI | `theme` / `quietStartup` |
| 信任 | `defaultProjectTrust`（ask/always/never）|
| 压缩 | `compaction.enabled` / `reserveTokens` / `keepRecentTokens` |
| 重试 | `retry.enabled` / `maxRetries` / `baseDelayMs` |
| 投递 | `steeringMode` / `followUpMode` |
| 模型循环 | `enabledModels`（Ctrl+P 切换） |
| 资源路径 | `extensions` / `skills` / `prompts` / `themes` |

### A.3 models.json — 自定义模型

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

| Provider 字段 | 说明 |
|---------------|------|
| `baseUrl` | API 端点 URL |
| `api` | 类型: `openai-completions` / `openai-responses` / `anthropic-messages` / `google-generative-ai` |
| `apiKey` | 支持 `$VAR`、`!cmd`、`$$`/`$!` 转义 |
| `headers` | 自定义请求头 |
| `authHeader` | 自动添加 `Authorization: Bearer` |
| `models` | 模型数组 |
| `compat` | `supportsDeveloperRole` / `supportsReasoningEffort` / `supportsUsageInStreaming` / `maxTokensField` |

覆盖内置 Provider:
```json
{
  "providers": {
    "anthropic": { "baseUrl": "https://my-proxy.example.com/v1" }
  }
}
```

### A.4 auth.json — 凭证存储

位于 `~/.pi/agent/auth.json`（权限 `0600`）。

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." },
  "openai": { "type": "api_key", "key": "sk-..." },
  "github-copilot": { "type": "oauth", "provider": "github-copilot", ... }
}
```

值解析与 models.json 相同: `$VAR`、`!cmd`、`$$`、`$!`。`auth.json` **优先于**环境变量。

### A.5 keybindings.json — 快捷键

```json
{
  "tui.input.submit": ["enter"],
  "tui.input.newLine": ["shift+enter"],
  "app.interrupt": ["escape"],
  "app.model.select": ["ctrl+l"],
  "app.model.cycleForward": ["ctrl+p"],
  "app.model.cycleBackward": ["shift+ctrl+p"],
  "app.thinking.cycle": ["shift+tab"],
  "app.thinking.toggle": ["ctrl+t"]
}
```

格式: `modifier+key`（ctrl/shift/alt，可组合）。支持字母、数字、F1-F12、方向键、escape、enter、tab、backspace、delete、home、end、pageUp、pageDown、符号。

### A.6 主题配置

内置: `dark`（默认）、`light`。自定义主题在 `~/.pi/agent/themes/my-theme.json`:
```json
{
  "name": "my-theme",
  "vars": { "primary": "#00aaff", "gray": 242 },
  "colors": {
    "accent": "primary",
    "border": "primary",
    "success": "#00ff00",
    "error": "#ff0000"
  }
}
```
需定义 51 个颜色 token（无可选）。支持 hex、256 色、变量引用、空字符串（终端默认色）。

### A.7 AGENTS.md — 上下文文件

| 位置 | 范围 | 说明 |
|------|------|------|
| `~/.pi/agent/AGENTS.md` | 全局 | 所有项目生效 |
| `./AGENTS.md` 或 `./CLAUDE.md` | 项目 | 当前目录向上查找 |
| `.pi/SYSTEM.md` | 项目 | 替换默认系统提示 |
| `.pi/APPEND_SYSTEM.md` | 项目 | 追加到默认系统提示 |

### A.8 Session 与会话管理

存储: `~/.pi/agent/sessions/`（JSONL 格式，按工作目录组织）。

| 命令 | 说明 |
|------|------|
| `/new` | 新建 session |
| `/resume` | 选择历史 session |
| `/name <name>` | 设置 session 名称 |
| `/session` | 显示当前 session 信息 |
| `/tree` | 可视化会话树 |
| `/fork` | 从历史节点创建新 session |
| `/clone` | 复制当前分支为新 session |
| `/compact [prompt]` | 手动压缩上下文 |
| `/export [file]` | 导出为 HTML |
| `/share` | 上传为 GitHub Gist |

### A.9 环境变量参考

| 变量 | 说明 |
|------|------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录（默认 `~/.pi/agent`） |
| `PI_CODING_AGENT_SESSION_DIR` | 覆盖 session 目录 |
| `PI_PACKAGE_DIR` | 覆盖 package 目录 |
| `PI_OFFLINE` | 禁用启动时网络操作 |
| `PI_SKIP_VERSION_CHECK` | 跳过版本更新检查 |
| `PI_TELEMETRY` | 控制匿名遥测（`1`/`0`） |
| `PI_CACHE_RETENTION` | `long` 启用扩展提示缓存 |
| `VISUAL` / `EDITOR` | 外部编辑器（Ctrl+G 使用） |

### A.10 目录结构速查

```
~/.pi/agent/                     # 全局配置目录（可被 PI_CODING_AGENT_DIR 覆盖）
├── settings.json                 # 全局设置
├── auth.json                     # 凭证 (0600)
├── models.json                   # 自定义模型
├── keybindings.json              # 快捷键
├── trust.json                    # 项目信任决策
├── AGENTS.md                     # 全局上下文指令
├── SYSTEM.md                     # 全局系统提示
├── APPEND_SYSTEM.md              # 全局追加提示
├── sessions/                     # 会话文件 (JSONL)
├── extensions/                   # 全局扩展 (*.ts)
├── themes/                       # 自定义主题 (*.json)
├── skills/                       # 技能
├── prompts/                      # 提示模板
├── npm/                          # 用户级 npm packages
└── tmp/                          # 临时目录 (.gitignore)

.                               # 项目目录
├── AGENTS.md / CLAUDE.md         # 项目上下文指令
├── .pi/
│   ├── settings.json             # 项目设置
│   ├── SYSTEM.md                 # 项目系统提示
│   ├── APPEND_SYSTEM.md          # 项目追加提示
│   ├── extensions/               # 项目扩展
│   ├── skills/                   # 项目技能
│   ├── prompts/                  # 项目提示模板
│   ├── themes/                   # 项目主题
│   └── npm/                      # 项目级 npm packages
└── .agents/skills/               # 替代技能目录
```
