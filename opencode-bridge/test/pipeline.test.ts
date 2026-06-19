import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { openCodeToolToPiDefinition } from "../src/pipeline.ts";
import { Tools } from "../src/types.ts";
import { make, ToolFailure } from "../src/vendor/tool-framework.ts";

describe("openCodeToolToPiDefinition", () => {
	it("converts a valid module to a ToolDefinition and executes", async () => {
		const simpleInput = Schema.Struct({ message: Schema.String });
		const simpleOutput = Schema.Struct({ echoed: Schema.String });

		const testLayer = Layer.effectDiscard(
			Effect.gen(function* () {
				const tools = yield* Tools;
				yield* tools
					.register({
						echo: make({
							description: "echoes",
							input: simpleInput,
							output: simpleOutput,
							execute: (input: { message: string }) => Effect.succeed({ echoed: input.message }),
							toModelOutput: ({ output }: { output: { echoed: string } }) => [
								{ type: "text", text: output.echoed },
							],
						}),
					})
					.pipe(Effect.orDie);
			}),
		);

		const mod = {
			name: "echo",
			Input: simpleInput,
			Output: simpleOutput,
			layer: testLayer,
			toolsTag: Tools,
		};

		const def = await openCodeToolToPiDefinition(mod as any, "/tmp");

		expect(def.name).toBe("echo");
		expect(def.label).toBe("echo");
		expect(def.description).toBe("echoes");
		expect(def.parameters).toBeDefined();

		const result = await def.execute("call-1", { message: "hello world" }, undefined, undefined, {
			cwd: "/tmp",
			ui: {},
		} as any);

		expect(result.content).toHaveLength(1);
		expect((result.content[0] as any).text).toBe("hello world");
		expect(result.details).toEqual({ echoed: "hello world" });
	});

	it("returns error content on execution failure", async () => {
		const input = Schema.Struct({ x: Schema.Number });
		const output = Schema.Struct({ y: Schema.Number });

		const testLayer = Layer.effectDiscard(
			Effect.gen(function* () {
				const tools = yield* Tools;
				yield* tools
					.register({
						failer: make({
							description: "always fails",
							input,
							output,
							execute: () => Effect.fail(new ToolFailure({ message: "boom" })),
						}),
					})
					.pipe(Effect.orDie);
			}),
		);

		const mod = {
			name: "failer",
			Input: input,
			Output: output,
			layer: testLayer,
			toolsTag: Tools,
		};

		const def = await openCodeToolToPiDefinition(mod as any, "/tmp");

		const result = await def.execute("c1", { x: 1 }, undefined, undefined, { cwd: "/tmp", ui: {} } as any);
		expect((result.content[0] as any).text).toContain("boom");
	});
});
