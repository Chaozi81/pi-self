# pi-self

## opencode-bridge

将 OpenCode 工具文件桥接到 piAgent，无需修改直接使用。

### 安装

扩展通过 piAgent 扩展机制加载。将此仓库克隆后，运行：

```bash
cd opencode-bridge
npm install --ignore-scripts
```

然后在 piAgent 中通过 `-e` 参数指定扩展路径，或通过 `.pi/` 配置加载。

### 使用

1. 把你的 OpenCode 工具 `.ts` 文件放入 `opencode-bridge/src/tools/`
2. 工具文件需导出 `{ name, Input(Schema), Output(Schema), layer }`
3. piAgent 启动时自动扫描、转换、注册

### 工具文件示例

```typescript
import { Effect, Schema, Layer } from "effect"
import { Tool, Tools } from "@earendil-works/pi-opencode-bridge"

export const name = "my_tool"
export const Input = Schema.Struct({
  message: Schema.String({ description: "Input message" }),
})
export const Output = Schema.Struct({
  echoed: Schema.String({ description: "Echoed message" }),
})

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools
    yield* tools.register({
      [name]: Tool.make({
        description: "Echoes input",
        input: Input,
        output: Output,
        execute: (input) => Effect.succeed({ echoed: input.message }),
        toModelOutput: ({ output }) => [{ type: "text", text: output.echoed }],
      }),
    }).pipe(Effect.orDie)
  }),
)
```

### SPEC

详见 `opencode-bridge/SPEC.md`。