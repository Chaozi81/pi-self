import type { Layer } from "effect";
import { Effect } from "effect";
import type { AnyTool } from "./vendor/tool-framework.ts";
import { make, settle, ToolFailure } from "./vendor/tool-framework.ts";

export const Tool = { make };
export { settle, ToolFailure };
export type {
	AnyTool,
	ToolCall,
	ToolContent,
	ToolContext,
	ToolOutput,
} from "./vendor/tool-framework.ts";

export interface ToolsShape {
	readonly register: (tools: Record<string, AnyTool>) => Effect.Effect<void, never>;
}

export class Tools extends Effect.Tag("Tools.Service")<Tools, ToolsShape>() {}

export interface OpenCodeToolModule {
	name: string;
	Input: import("effect").Schema.Schema<any, any, never>;
	Output: import("effect").Schema.Schema<any, any, never>;
	layer: Layer.Layer<any, never, never>;
}
