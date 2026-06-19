import { Effect, Layer } from "effect";

export interface ConfigShape {
	readonly entries: () => Effect.Effect<ReadonlyArray<{ type: string; info: Record<string, unknown> }>>;
}

export class Config extends Effect.Tag("Config.Service")<Config, ConfigShape>() {}

export function makeConfigAdapter(): Layer.Layer<Config> {
	return Layer.succeed(Config, {
		entries: () => Effect.succeed([]),
	});
}
