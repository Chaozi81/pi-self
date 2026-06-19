import { type Context, Effect, Layer, ManagedRuntime } from "effect";
import type { AnyTool } from "./vendor/tool-framework.ts";

export function makeMockToolsService<Tag extends Context.Tag<any, any>>(
	tag: Tag,
): {
	layer: Layer.Layer<Context.Tag.Service<Tag>>;
	captured: Map<string, AnyTool>;
} {
	const captured = new Map<string, AnyTool>();
	const layer = Layer.succeed(tag, {
		register: (tools: Record<string, AnyTool>) =>
			Effect.sync(() => {
				for (const [name, tool] of Object.entries(tools)) {
					captured.set(name, tool);
				}
			}),
	} as Context.Tag.Service<Tag>);
	return { layer, captured };
}

export function createToolRuntime<A, E>(layer: Layer.Layer<never>): (effect: Effect.Effect<A, E>) => Promise<A> {
	const runtime = ManagedRuntime.make(layer);
	return (effect) => runtime.runPromise(effect);
}
