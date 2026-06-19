import { Effect, Layer, Schema } from "effect";
import { Tool, Tools } from "../../src/types.ts";

export const name = "simple_test";

export const Input = Schema.Struct({
	message: Schema.String.annotations({ description: "A message to echo" }),
});

export const Output = Schema.Struct({
	echoed: Schema.String.annotations({ description: "The echoed message" }),
});

export const layer = Layer.effectDiscard(
	Effect.gen(function* () {
		const tools = yield* Tools;
		yield* tools
			.register({
				[name]: Tool.make({
					description: "Echoes the input message back",
					input: Input,
					output: Output,
					execute: (input: { message: string }) => Effect.succeed({ echoed: input.message }),
					toModelOutput: ({ output }: { output: { echoed: string } }) => [{ type: "text", text: output.echoed }],
				}),
			})
			.pipe(Effect.orDie);
	}),
);
