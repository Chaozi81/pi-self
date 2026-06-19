import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { createToolRuntime, makeMockToolsService } from "../src/runtime.ts";
import { Tools } from "../src/types.ts";
import type { ToolContext, ToolOutput } from "../src/vendor/tool-framework.ts";
import { make, settle, type ToolFailure } from "../src/vendor/tool-framework.ts";

describe("makeMockToolsService", () => {
	it("captures registered tools", async () => {
		const { layer, captured } = makeMockToolsService(Tools);

		const testTool = make({
			description: "test tool",
			input: Schema.Struct({ msg: Schema.String }),
			output: Schema.Struct({ echo: Schema.String }),
			execute: (input: { msg: string }) => Effect.succeed({ echo: input.msg }),
		});

		const registerLayer = Layer.effectDiscard(
			Effect.gen(function* () {
				const tools = yield* Tools;
				yield* tools.register({ test_tool: testTool });
			}),
		);

		const live = Layer.provide(registerLayer, layer as any);
		const runtime = ManagedRuntime.make(live as any);
		await runtime.runPromise(Effect.void);

		expect(captured.has("test_tool")).toBe(true);
	});
});

describe("createToolRuntime", () => {
	it("builds a runtime and executes a tool via settle", async () => {
		const { layer: mockLayer, captured } = makeMockToolsService(Tools);

		const toolName = "echo_tool";
		const toolLayer = Layer.effectDiscard(
			Effect.gen(function* () {
				const tools = yield* Tools;
				yield* tools.register({
					[toolName]: make({
						description: "echoes input",
						input: Schema.Struct({ msg: Schema.String }),
						output: Schema.Struct({ echoed: Schema.String }),
						execute: (input: { msg: string }) => Effect.succeed({ echoed: input.msg }),
						toModelOutput: ({ output }: { output: { echoed: string } }) => [
							{ type: "text", text: output.echoed },
						],
					}),
				});
			}),
		);

		const fullLayer = Layer.provideMerge(toolLayer, mockLayer as any);
		const runtime = ManagedRuntime.make(fullLayer as any);
		await runtime.runPromise(Effect.void);

		const tool = captured.get(toolName);
		expect(tool).toBeDefined();

		const run = createToolRuntime<ToolOutput, ToolFailure>(fullLayer as any);
		const context: ToolContext = {
			sessionID: "test",
			agent: "test-agent",
			assistantMessageID: "msg-1",
			toolCallID: "call-1",
		};
		const output = await run(settle(tool!, { input: { msg: "hello" } }, context));

		expect(output.content).toHaveLength(1);
		expect((output.content[0] as any).text).toBe("hello");
	});
});
