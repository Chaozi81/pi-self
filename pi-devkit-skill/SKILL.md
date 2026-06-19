---
name: pi-devkit
description: Guides for creating and configuring pi extensions, skills, prompt templates, and usage settings. Use when the user asks how to create pi extensions, write skills, make prompt templates, or configure pi settings/models/themes.
---

# Pi DevKit — 扩展 · 技能 · 提示模板 · 使用配置

Complete reference for building on pi.

---

## Part 1 — Extensions

Extensions are TypeScript modules that customize tools, intercept events, register commands, and render UI. They run under the user's privileges and can execute arbitrary code.

### 1.1 Minimal Extension

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });

  pi.registerCommand("hello", {
    description: "say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify(`Hello ${args || "world"}!`, "info");
    },
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous operation!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked" };
    }
  });
}
```

Test with `pi -e ./my-ext.ts`.

### 1.2 Installation Locations

| Location | Scope |
|----------|-------|
| `~/.pi/agent/extensions/*.ts` | Global |
| `~/.pi/agent/extensions/*/index.ts` | Global (directory) |
| `.pi/extensions/*.ts` | Project (needs trust) |
| `.pi/extensions/*/index.ts` | Project (directory) |

### 1.3 Extension Organization

**Single file:** `~/.pi/agent/extensions/my-ext.ts`

**Directory (multi-file):**
```
~/.pi/agent/extensions/my-ext/
├── index.ts        # entry, export default function
├── tools.ts        # tool implementations
└── utils.ts
```

**Package with npm dependencies:**
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

### 1.4 Available Imports

| Package | Purpose |
|---------|---------|
| `@earendil-works/pi-coding-agent` | Types: ExtensionAPI, ExtensionContext, events |
| `typebox` | Tool parameter schemas |
| `@earendil-works/pi-ai` | AI utility functions |
| `@earendil-works/pi-tui` | Custom TUI components |

Node built-in modules (`node:fs`, `node:path`, etc.) are also available.

### 1.5 What You Can Register

#### `pi.registerTool()`

```typescript
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "Tool description",
  promptSnippet: "One-liner shown in Available tools",
  parameters: Type.Object({
    action: Type.String(),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    onUpdate?.({ content: [{ type: "text", text: "Processing..." }] });
    return {
      content: [{ type: "text", text: "Done" }],
      details: {},
    };
  },
});
```

#### `pi.registerCommand()`

```typescript
pi.registerCommand("mycmd", {
  description: "What it does",
  handler: async (args, ctx) => {
    ctx.ui.notify("Success!", "info");
  },
});
```

#### `pi.registerShortcut()`

```typescript
pi.registerShortcut("ctrl+shift+y", {
  description: "Do something",
  handler: async (ctx) => {
    ctx.ui.notify("Shortcut triggered!", "info");
  },
});
```

#### `pi.registerFlag()`

```typescript
pi.registerFlag("my-flag", {
  description: "Enable something",
  type: "boolean",
  handler: async (value, ctx) => {
    if (value) ctx.ui.notify("Flag on", "info");
  },
});
```

#### `pi.registerProvider()`

```typescript
pi.registerProvider("my-provider", {
  baseUrl: "http://localhost:1234/v1",
  apiKey: "$MY_API_KEY",
  api: "openai-completions",
  models: [{ id: "my-model", reasoning: false }],
});
```

### 1.6 All 30 Hooks — pi.on()

<details>
<summary><b>Startup / Security (2)</b></summary>

| Event | When | Cancellable |
|-------|------|-------------|
| `project_trust` | Before loading, decide if project dir is trusted | — |
| `resources_discover` | After session_start, provide extra resource paths | — |
</details>

<details>
<summary><b>Session Lifecycle (8)</b></summary>

| Event | When | Cancellable |
|-------|------|-------------|
| `session_start` | Session created/loaded/reloaded | No |
| `session_before_switch` | Before switching sessions (new/resume) | **Yes** |
| `session_before_fork` | Before forking | **Yes** |
| `session_before_compact` | Before context compaction | **Yes** |
| `session_compact` | After compaction | No |
| `session_shutdown` | Extension teardown | No |
| `session_before_tree` | Before tree navigation | **Yes** |
| `session_tree` | After tree navigation | No |
</details>

<details>
<summary><b>Agent Lifecycle (3)</b></summary>

| Event | When |
|-------|------|
| `before_agent_start` | User submits prompt, before agent loop — inject messages or modify system prompt |
| `agent_start` | Agent loop begins |
| `agent_end` | Agent loop ends |
</details>

<details>
<summary><b>Turn Lifecycle (2)</b></summary>

| Event | When |
|-------|------|
| `turn_start` | Each turn begins |
| `turn_end` | Each turn ends |
</details>

<details>
<summary><b>Message Lifecycle (3)</b></summary>

| Event | When | Returns |
|-------|------|---------|
| `message_start` | Message begins (user/assistant/toolResult) | — |
| `message_update` | Assistant streaming token-by-token | — |
| `message_end` | Message complete | Can return replacement (same role) |
</details>

<details>
<summary><b>Tool Execution (3)</b></summary>

| Event | When |
|-------|------|
| `tool_execution_start` | Tool starts execution |
| `tool_execution_update` | Tool streaming output |
| `tool_execution_end` | Tool finishes |
</details>

<details>
<summary><b>Tool Call / Result Intercept (2)</b></summary>

| Event | When | Returns |
|-------|------|---------|
| `tool_call` | Before tool executes | `{ block: true, reason }` or modify `event.input` |
| `tool_result` | After tool result | Replace content/details/isError |
</details>

<details>
<summary><b>Model / Thinking Level (2)</b></summary>

| Event | When |
|-------|------|
| `model_select` | Model switches |
| `thinking_level_select` | Thinking level changes |
</details>

<details>
<summary><b>User Input (2)</b></summary>

| Event | When | Returns |
|-------|------|---------|
| `user_bash` | User runs `!` / `!!` command | Custom BashOperations/BashResult |
| `input` | User submits text | `continue` / `transform` / `handled` |
</details>

<details>
<summary><b>Provider Middleware (3)</b></summary>

| Event | When | Returns |
|-------|------|---------|
| `context` | Before LLM call, modify messages | Modified messages array |
| `before_provider_request` | Before provider request sent | Replacement payload |
| `after_provider_response` | After provider response received | — |
</details>

### 1.7 ctx API Reference

| Method | Description |
|--------|-------------|
| `ctx.ui.notify(msg, type)` | Notification (info/warning/error/success) |
| `ctx.ui.confirm(title, msg)` | Confirmation dialog |
| `ctx.ui.select(title, items)` | List selection |
| `ctx.ui.input(opts)` | Input prompt |
| `ctx.ui.setStatus(id, text)` | Set status bar text |
| `ctx.ui.setWidget(id, lines)` | Show widget above editor |
| `ctx.sessionManager` | Read-only session access |
| `ctx.cwd` | Current working directory |
| `ctx.mode` | Run mode: tui/rpc/json/print |
| `ctx.hasUI` | Whether UI is available |
| `ctx.signal` | Request AbortSignal |
| `ctx.model` / `ctx.modelRegistry` | Model and key access |

### 1.8 Debug & Load

```bash
pi -e ./my-ext.ts                          # Temp load for testing
pi --no-extensions                         # Disable all
pi --no-extensions -e ./my-ext.ts          # Explicit only
```

Auto-load: place in `~/.pi/agent/extensions/` and restart, or `/reload` after changes.

### 1.9 Complete Extension Example

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && /\bsudo\b/.test(event.input.command)) {
      const ok = await ctx.ui.confirm("Confirm", "Allow sudo?");
      if (!ok) return { block: true, reason: "Blocked: sudo needs confirmation" };
    }
  });

  const todos: string[] = [];
  pi.registerTool({
    name: "todo",
    label: "Todo Manager",
    description: "Manage todos: add/list/done",
    parameters: Type.Object({
      action: Type.String({ description: "add / list / done" }),
      item: Type.Optional(Type.String()),
    }),
    async execute(toolCallId, params) {
      if (params.action === "add" && params.item) {
        todos.push(params.item);
        return { content: [{ type: "text", text: `Added: ${params.item}` }], details: {} };
      }
      if (params.action === "list") {
        return { content: [{ type: "text", text: todos.join("\n") || "(empty)" }], details: {} };
      }
      return { content: [{ type: "text", text: "Unknown action" }], details: {} };
    },
  });
}
```

---

## Part 2 — Skills

A skill is a directory with a `SKILL.md` that pi loads on demand for specialized workflows.

### 2.1 Directory Structure

```
my-skill/
├── SKILL.md              # Required: frontmatter + instructions
├── scripts/              # Helper scripts
└── references/           # On-demand reference docs
```

### 2.2 SKILL.md Format

```markdown
---
name: my-skill
description: One sentence saying when to use this skill. Be specific.
---

# My Skill

## Setup

Run once before first use:
```bash
cd /path/to/skill && npm install
```

## Usage

```bash
./scripts/process.sh <input>
```
```

### 2.3 Full Frontmatter Reference

```yaml
---
name: my-skill
description: When to use this skill
disable-model-invocation: true
license: MIT
compatibility: Node >= 18
metadata:
  author: me
allowed-tools: read bash
---
```

| Field | Standard/Pi | Required | Description |
|-------|-------------|----------|-------------|
| `name` | Standard | Yes | 1-64 chars, lowercase/numbers/hyphens. Falls back to dir name |
| `description` | Standard | **Strongly required** | Max 1024 chars. **Skill won't load if empty** |
| `disable-model-invocation` | **Pi-only** | No | `true` hides skill from model, only `/skill:name` triggers it |
| `license` | Standard | No | License name or file ref |
| `compatibility` | Standard | No | Environment requirements, max 500 chars |
| `metadata` | Standard | No | Arbitrary key-value passthrough |
| `allowed-tools` | Standard (experimental) | No | Space-separated pre-approved tools |

#### `disable-model-invocation` Details

| Value | Behavior |
|-------|----------|
| `false` (default) | Skill appears in `<available_skills>`, model loads on demand |
| `true` | Hidden from model, only `/skill:name` works |

Use for: operations with side effects, tool-like skills the model shouldn't auto-invoke.

#### Skill Rendering in System Prompt

```xml
<available_skills>
  <skill>
    <name>my-skill</name>
    <description>What this skill does</description>
    <location>/path/to/skill/SKILL.md</location>
  </skill>
</available_skills>
```

Skills with `disable-model-invocation: true` are excluded.

### 2.4 Name Rules

- Lowercase letters, numbers, hyphens only
- No leading/trailing hyphens
- No consecutive hyphens
- Valid: `pdf-processing`, `code-review`, `web-search`

### 2.5 Description Guidelines

Must let the model know "when to use this skill":

Good:
```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents.
```

Bad:
```yaml
description: Helps with PDFs.
```

### 2.6 Installation Locations

| Location | Scope |
|----------|-------|
| `~/.pi/agent/skills/` | Global |
| `~/.agents/skills/` | Global (shared with other agents) |
| `.pi/skills/` | Project (needs trust) |
| `.agents/skills/` | Project ancestor (up to git root) |

Extra paths via `settings.json`:
```json
{ "skills": ["~/.claude/skills"] }
```

Or CLI:
```bash
pi --skill /path/to/my-skill
```

### 2.7 Discovery Rules

- `~/.pi/agent/skills/` and `.pi/skills/`: root `.md` files ARE recognized as skills
- All locations: directories containing `SKILL.md` are recursively discovered
- `~/.agents/skills/`: root `.md` files are NOT discovered

### 2.8 Usage

Interactive mode:
```text
/skill:name           # Load and execute skill
/skill:name arg1      # Load with arguments
```

The model sees available skills in system prompt and can auto-load matching ones via `read`. `/skill:name` forces manual load.

### 2.9 Quick Create

Ask pi directly:
> pi, create a skill for me that does X

---

## Part 3 — Prompt Templates

Prompt templates are Markdown snippets that expand when you type `/name`.

### 3.1 Basic File

Filename without `.md` becomes the command name:
```
~/.pi/agent/prompts/
├── review.md        # Use /review
├── component.md     # Use /component
└── fix.md           # Use /fix
```

### 3.2 File Format

```markdown
---
description: Review staged git changes
---

Review the staged changes (`git diff --cached`). Focus on:
- Bugs and logic errors
- Security issues
- Error handling gaps
```

- Filename → command name: `review.md` → `/review`
- `description` is optional, used for autocomplete hints

### 3.3 Parameter Placeholders

| Syntax | Description |
|--------|-------------|
| `$1`, `$2`... | Nth argument |
| `$@` / `$ARGUMENTS` | All arguments joined |
| `${1:-default}` | Use param or default |
| `${@:N}` | From param N onwards |
| `${@:N:L}` | N to N+L-1 |

```markdown
---
description: Create a React component
---

Create a React component named $1 with features: $@
```

Usage: `/component Button "onClick handler"` → "Create a React component named Button with features: onClick handler"

With default value:
```markdown
Summarize the current state in ${1:-7} bullet points.
```

### 3.4 Argument Hint

```markdown
---
description: Review PRs from URLs with structured issue and code analysis
argument-hint: "<PR-URL>"
---
```

`<angle brackets>` = required, `[square brackets]` = optional.

### 3.5 Installation

| Location | Scope |
|----------|-------|
| `~/.pi/agent/prompts/*.md` | Global |
| `.pi/prompts/*.md` | Project (needs trust) |

Via `settings.json`:
```json
{ "prompts": ["/path/to/prompts"] }
```

CLI:
```bash
pi --prompt-template /path/to/fix.md
```

### 3.6 Discovery

- Only flat scan in `prompts/` directories, no recursion
- For subdirectory templates, use `prompts` setting or package manifest

### 3.7 Quick Create

> pi, create a prompt template for code review

### 3.8 Useful Examples

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

## Appendix A — Usage Configuration Reference

### A.1 Config Files Overview

| File | Location | Purpose |
|------|----------|---------|
| `settings.json` | `~/.pi/agent/` (global) / `.pi/` (project) | Main settings |
| `auth.json` | `~/.pi/agent/` | API keys / OAuth |
| `models.json` | `~/.pi/agent/` | Custom providers and models |
| `keybindings.json` | `~/.pi/agent/` | Custom keybindings |
| `trust.json` | `~/.pi/agent/` | Project trust decisions |
| `AGENTS.md` | Project / `~/.pi/agent/` | Context instructions |
| `SYSTEM.md` | `.pi/` / `~/.pi/agent/` | Custom system prompt |
| `APPEND_SYSTEM.md` | `.pi/` / `~/.pi/agent/` | Append to system prompt |

Project settings override global settings; nested objects merge.

### A.2 settings.json Key Fields

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

| Module | Key Fields |
|--------|------------|
| Model | `defaultProvider` / `defaultModel` |
| Thinking | `defaultThinkingLevel` / `thinkingBudgets` |
| UI | `theme` / `quietStartup` |
| Trust | `defaultProjectTrust` (ask/always/never) |
| Compaction | `compaction.enabled` / `reserveTokens` / `keepRecentTokens` |
| Retry | `retry.enabled` / `maxRetries` / `baseDelayMs` |
| Delivery | `steeringMode` / `followUpMode` |
| Model Cycle | `enabledModels` for Ctrl+P |
| Resources | `extensions` / `skills` / `prompts` / `themes` paths |

### A.3 models.json — Custom Providers

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

| Field | Description |
|-------|-------------|
| `baseUrl` | API endpoint URL |
| `api` | Type: `openai-completions` / `openai-responses` / `anthropic-messages` / `google-generative-ai` |
| `apiKey` | Supports `$VAR`, `!cmd`, `$$`/`$!` escaping |
| `headers` | Custom request headers |
| `authHeader` | Auto-add `Authorization: Bearer` |
| `models` | Model array |
| `compat` | `supportsDeveloperRole` / `supportsReasoningEffort` / `supportsUsageInStreaming` / `maxTokensField` |

Override built-in providers:
```json
{
  "providers": {
    "anthropic": { "baseUrl": "https://my-proxy.example.com/v1" }
  }
}
```

### A.4 auth.json — Credentials

Located at `~/.pi/agent/auth.json` (permissions `0600`).

```json
{
  "anthropic": { "type": "api_key", "key": "sk-ant-..." },
  "openai": { "type": "api_key", "key": "sk-..." },
  "github-copilot": { "type": "oauth", "provider": "github-copilot", ... }
}
```

Key value resolution (same as models.json): `$VAR`, `!cmd`, `$$`, `$!`. Auth.json takes precedence over environment variables.

### A.5 keybindings.json

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

Format: `modifier+key` (ctrl/shift/alt, combinable). Supports letters, digits, F1-F12, arrows, escape, enter, tab, backspace, delete, home, end, pageUp, pageDown, symbols.

### A.6 Themes

Built-in: `dark` (default), `light`. Custom themes at `~/.pi/agent/themes/my-theme.json`:
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
51 color tokens required (no optionals). Supports hex, 256-color, variable references, empty string (terminal default).

### A.7 AGENTS.md — Context

| Location | Scope |
|----------|-------|
| `~/.pi/agent/AGENTS.md` | Global, all projects |
| `./AGENTS.md` or `./CLAUDE.md` | Project, walks up from cwd |
| `.pi/SYSTEM.md` | Replaces default system prompt |
| `.pi/APPEND_SYSTEM.md` | Appends to default system prompt |

### A.8 Session Management

Storage: `~/.pi/agent/sessions/` (JSONL format, organized by working directory).

| Command | Description |
|---------|-------------|
| `/new` | New session |
| `/resume` | Pick historical session |
| `/name <name>` | Set session name |
| `/session` | Show current session info |
| `/tree` | Visual session tree |
| `/fork` | Fork from history node |
| `/clone` | Copy current branch |
| `/compact [prompt]` | Manual compaction |
| `/export [file]` | Export to HTML |
| `/share` | Upload as GitHub Gist |

### A.9 Environment Variables

| Variable | Description |
|----------|-------------|
| `PI_CODING_AGENT_DIR` | Override config dir (default `~/.pi/agent`) |
| `PI_CODING_AGENT_SESSION_DIR` | Override session dir |
| `PI_PACKAGE_DIR` | Override package dir |
| `PI_OFFLINE` | Disable network on startup |
| `PI_SKIP_VERSION_CHECK` | Skip update check |
| `PI_TELEMETRY` | Control telemetry (`1`/`0`) |
| `PI_CACHE_RETENTION` | `long` enables extended prompt caching |
| `VISUAL` / `EDITOR` | External editor (Ctrl+G) |

### A.10 Directory Structure

```
~/.pi/agent/                     # Global config (override via PI_CODING_AGENT_DIR)
├── settings.json                 # Global settings
├── auth.json                     # Credentials (0600)
├── models.json                   # Custom models
├── keybindings.json              # Keybindings
├── trust.json                    # Project trust decisions
├── AGENTS.md                     # Global context
├── SYSTEM.md                     # Global system prompt
├── APPEND_SYSTEM.md              # Global append prompt
├── sessions/                     # Session files (JSONL)
├── extensions/                   # Global extensions (*.ts)
├── themes/                       # Custom themes (*.json)
├── skills/                       # Skills
├── prompts/                      # Prompt templates
├── npm/                          # User-level npm packages
└── tmp/                          # Temp directory (.gitignore)

.                               # Project directory
├── AGENTS.md / CLAUDE.md         # Project context
├── .pi/
│   ├── settings.json             # Project settings
│   ├── SYSTEM.md                 # Project system prompt
│   ├── APPEND_SYSTEM.md          # Project append prompt
│   ├── extensions/               # Project extensions
│   ├── skills/                   # Project skills
│   ├── prompts/                  # Project prompt templates
│   ├── themes/                   # Project themes
│   └── npm/                      # Project npm packages
└── .agents/skills/               # Alternative skill dir
```
