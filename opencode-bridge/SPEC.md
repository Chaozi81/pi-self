# OpenCode Tool Bridge — Extension Schema

## What This Extension Does

Loads OpenCode tool `.ts` files from `src/tools/` at runtime and registers them as piAgent tools. Bridges the gap between OpenCode's Effect.ts tool model and piAgent's TypeBox + Promise model.

## File Map

```
src/
  index.ts       — Entry. Scans tools/, loads each .ts, converts, registers.
  pipeline.ts    — openCodeToolToPiDefinition(): module → ToolDefinition
  runtime.ts     — createToolRuntime(): builds Effect ManagedRuntime
  schema.ts      — effectSchemaToTypeBox(): Effect Schema → TypeBox
  scanner.ts     — scanTools(dir): recursive .ts file discovery
  types.ts       — Shared types (OpenCodeToolModule, etc.)
  adapters/
    index.ts     — makeAllAdapters(): assembles all adapter layers
    filesystem.ts— FileSystem.Service → Node fs
    config.ts    — Config.Service → env / empty
    location.ts  — Location.Service → process.cwd()
    permission.ts— PermissionV2.Service → always allow
    ...          — Add new adapters here
  tools/         — User drops OpenCode .ts tool files here
```

## Core Pipeline (the only flow)

```
scanTools("src/tools/")
  → for each .ts file:
    → jiti.import(file) → { name, Input, Output, layer }
    → validate exports
    → effectSchemaToTypeBox(Input) → TypeBox schema
    → makeMockToolsService() → { layer, captured: Map }
    → createToolRuntime(toolLayer, mockLayer, adapters)
    → runtime.init() → triggers tool registration → captured.set(name, tool)
    → build ToolDefinition { name, parameters, execute }
    → pi.registerTool(toolDef)
```

## Tool Invocation Flow

```
piAgent calls ToolDefinition.execute(toolCallId, params, signal, onUpdate, ctx)
  → buildContext(ctx, toolCallId) → OpenCode Context
  → settle(tool, { input: params }, context)  // decode→execute→encode
  → runtime.runPromise(effect)
  → { content: Content[], structured: output } → AgentToolResult
```

## Key Interfaces

### Input: OpenCode tool module (what src/tools/*.ts must export)
```typescript
interface OpenCodeToolModule {
  name: string                    // tool identifier
  Input: Schema.Schema<any>       // Effect Schema for params
  Output: Schema.Schema<any>      // Effect Schema for result
  layer: Layer<any, never, any>   // Effect Layer that registers the tool
}
```

### Output: piAgent ToolDefinition (what pi.registerTool receives)
```typescript
// packages/coding-agent/src/core/extensions/types.ts:435
interface ToolDefinition<TParams, TDetails, TState> {
  name: string
  label: string
  description: string
  parameters: TSchema              // TypeBox schema
  execute(toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult>
}
```

### OpenCode settle() — the execution proxy
```typescript
// from @opencode-ai/llm
settle(tool: AnyTool, call: ToolCall, context: Context): Effect<ToolOutput, ToolFailure>
// ToolCall = { input: unknown }
// ToolOutput = { structured: unknown, content: Content[] }
// Context = { sessionID, agent, assistantMessageID, toolCallID }
```

## Schema Conversion (src/schema.ts)

Maps Effect Schema combinators to TypeBox equivalents. See the conversion table below. Unmapped combinators degrade to `Type.Any()` with warning.

| Effect Schema | TypeBox |
|---|---|
| `Schema.String` | `Type.String()` |
| `Schema.Number` | `Type.Number()` |
| `Schema.Boolean` | `Type.Boolean()` |
| `Schema.Array(T)` | `Type.Array(recursiveConvert(T))` |
| `Schema.Struct({k: T})` | `Type.Object({k: recursiveConvert(T)})` |
| `Schema.Union([A,B])` | `Type.Union([recursiveConvert(A), recursiveConvert(B)])` |
| `Schema.optional` / `.pipe(Schema.optional)` | `Type.Optional(...)` |
| `Schema.Literal(x)` | `Type.Literal(x)` |
| `Schema.Null` | `Type.Null()` |
| `.annotate({ description })` | `{ description }` option |

To add a new mapping: edit `src/schema.ts`, add a branch in the recursive visitor.

## Service Adapters (src/adapters/)

Each adapter is an Effect Layer that provides an OpenCode service interface backed by piAgent/Node APIs. The adapter index assembles them into a merged layer.

To add a new adapter:
1. Create `src/adapters/<name>.ts`
2. Implement `make<Name>Adapter(): Layer<XxxService>`
3. Add to `src/adapters/index.ts` `makeAllAdapters()`
4. If the service interface differs across OpenCode versions, check `@opencode-ai/llm` types

Current adapters and their strategies:

| Adapter | File | Strategy |
|---|---|---|
| FileSystem | filesystem.ts | `fs.readFileSync`, `fs.writeFileSync`, etc. |
| Config | config.ts | `process.env`, empty defaults |
| Location | location.ts | `process.cwd()` or `ctx.cwd` |
| Permission | permission.ts | Always passthrough |

## Dependencies

- `effect` — runtime dependency (tools import from it)
- `@opencode-ai/llm` — runtime dependency (provides settle(), Tool.make types)
- `@earendil-works/pi-coding-agent` — workspace dependency (ExtensionAPI types)
- `@earendil-works/pi-ai` — workspace dependency (Tool base type)
- `typebox` — dev dependency (types only; piAgent provides at runtime)
- `jiti` — inherited from piAgent root devDependencies (dynamic .ts import)

## Error Handling Rules

All errors in the loading/conversion pipeline are caught and logged. A single broken tool file must not crash the extension or prevent other tools from loading.

- scan: skip non-.ts
- import: catch, warn, next
- validate: warn, next
- schema: degrade, warn, continue
- runtime: empty adapter, warn, continue
- execute: catch → result with error text

## Testing

```
test/
  schema.test.ts    — schema conversion: all types, edge cases, degrade
  scanner.test.ts   — directory scanning: empty, nested, filtered
  pipeline.test.ts  — end to end: module → ToolDefinition → execute
  runtime.test.ts   — runtime build with adapters
  e2e.test.ts       — fixture files through full pipeline
  fixtures/
    simple-tool.ts   — minimal tool, no service deps
    fs-tool.ts       — tool using FileSystem service
```

Run: `node ../../node_modules/vitest/dist/cli.js --run test/` from package root.

## Common Tasks

**Add a new OpenCode tool:** Drop `.ts` file into `src/tools/`. Must export `{ name, Input, Output, layer }`.

**Add a new service adapter:** Create `src/adapters/<name>.ts`, follow the pattern in `filesystem.ts`. Export a `make*Adapter()` returning `Layer<ServiceType>`. Register in `adapters/index.ts`.

**Add a new schema mapping:** In `src/schema.ts`, find the recursive converter function, add a branch for the new Schema combinator.

**Upgrade to a new OpenCode version:** Check `@opencode-ai/llm` for breaking changes. Verify `settle()` signature unchanged. Update pinned version in package.json.

**Debug a tool not loading:** Check piAgent logs for warnings. Common causes: missing exports, unsupported Schema combinators, missing service dependencies (unrecognized adapter needed).
