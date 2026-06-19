import { Effect, Layer, Schema } from "effect";
import { FileSystem } from "../../src/adapters/filesystem.ts";
import { Tool, Tools } from "../../src/types.ts";

export const name = "read_file_test";

export const Input = Schema.Struct({
	path: Schema.String.annotations({ description: "Path to the file to read" }),
});

export const Output = Schema.Struct({
	content: Schema.String.annotations({ description: "File content" }),
});

export const layer = Layer.effectDiscard(
	Effect.gen(function* () {
		const tools = yield* Tools;
		const fs = yield* FileSystem;
		yield* tools
			.register({
				[name]: Tool.make({
					description: "Reads a file from disk",
					input: Input,
					output: Output,
					execute: (input: { path: string }) =>
						Effect.gen(function* () {
							const content = yield* fs.readFile(input.path);
							return { content };
						}),
					toModelOutput: ({ output }: { output: { content: string } }) => [{ type: "text", text: output.content }],
				}),
			})
			.pipe(Effect.orDie);
	}),
);
