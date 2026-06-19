import type { TextContent } from "@earendil-works/pi-ai";
import type { AgentToolResult, ExtensionContext, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { type Context, Effect, Layer, ManagedRuntime } from "effect";
import { makeAllAdapters } from "./adapters/index.ts";
import { createToolRuntime, makeMockToolsService } from "./runtime.ts";
import { effectSchemaToTypeBox } from "./schema.ts";
import type { OpenCodeToolModule } from "./types.ts";
import { Tools } from "./types.ts";
import type { AnyTool, ToolContext, ToolOutput } from "./vendor/tool-framework.ts";
import { settle, type ToolFailure } from "./vendor/tool-framework.ts";

interface OpenCodeToolModuleInternal extends OpenCodeToolModule {
	toolsTag?: Context.Tag<any, any>;
}

function extractDescription(mod: OpenCodeToolModuleInternal, tool: AnyTool): string {
	const toolDesc = (tool as any)._description as string | undefined;
	if (toolDesc) return toolDesc;

	try {
		const annotations = (mod.Input as any).ast?.annotations;
		const descKey = Symbol.for("effect/annotation/Description");
		if (annotations) return annotations[descKey] ?? mod.name;
	} catch {
		/* fall through */
	}
	return mod.name;
}

function buildContext(ctx: ExtensionContext, toolCallId: string): ToolContext {
	return {
		sessionID: (ctx as any).sessionId ?? "pi-bridge",
		agent: "pi-agent",
		assistantMessageID: `msg-${toolCallId}`,
		toolCallID: toolCallId,
	};
}

export async function openCodeToolToPiDefinition(
	mod: OpenCodeToolModuleInternal,
	cwd: string,
): Promise<ToolDefinition> {
	const toolsTag = mod.toolsTag ?? Tools;

	const { layer: mockLayer, captured } = makeMockToolsService(toolsTag);
	const adapters = makeAllAdapters(cwd);
	const fullLayer = Layer.provideMerge(
		mod.layer as Layer.Layer<never>,
		Layer.mergeAll(mockLayer, adapters) as Layer.Layer<never>,
	);

	const runtime = ManagedRuntime.make(fullLayer as any);
	await runtime.runPromise(Effect.void);

	const tool = captured.get(mod.name);
	if (!tool) throw new Error(`Tool "${mod.name}" was not captured during layer initialization`);

	const run = createToolRuntime<ToolOutput, ToolFailure>(fullLayer as any);
	const description = extractDescription(mod, tool);
	const parameters = effectSchemaToTypeBox(mod.Input as any);

	return {
		name: mod.name,
		label: mod.name,
		description,
		parameters,
		async execute(
			toolCallId: string,
			params: any,
			_signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext,
		): Promise<AgentToolResult<any>> {
			try {
				const context = buildContext(ctx, toolCallId);
				const output: ToolOutput = await run(settle(tool, { input: params }, context));

				const content: TextContent[] = output.content
					.filter((c: any) => c.type === "text" || c.type === "file")
					.map((c: any) => {
						if (c.type === "text") return { type: "text" as const, text: c.text };
						return { type: "text" as const, text: `[file: ${c.name ?? "unnamed"} ${c.mime}]` };
					});

				return {
					content:
						content.length > 0 ? content : [{ type: "text" as const, text: JSON.stringify(output.structured) }],
					details: output.structured,
				};
			} catch (err: any) {
				return {
					content: [{ type: "text" as const, text: `Tool execution error: ${err?.message ?? String(err)}` }],
					details: {},
				};
			}
		},
	};
}
