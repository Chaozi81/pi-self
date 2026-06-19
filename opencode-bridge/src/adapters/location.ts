import { Effect, Layer } from "effect";

export interface LocationShape {
	readonly directory: string;
}

export class Location extends Effect.Tag("Location.Service")<Location, LocationShape>() {}

export function makeLocationAdapter(cwd?: string): Layer.Layer<Location> {
	return Layer.succeed(Location, {
		directory: cwd ?? process.cwd(),
	});
}
