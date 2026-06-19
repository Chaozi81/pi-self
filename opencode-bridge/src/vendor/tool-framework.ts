import { Effect, Either, Schema } from "effect";

export class ToolFailure {
	readonly message: string;
	constructor(opts: { message: string }) {
		this.message = opts.message;
	}
}

export interface ToolContext {
	readonly sessionID: string;
	readonly agent: string;
	readonly assistantMessageID: string;
	readonly toolCallID: string;
}

export type ToolContent =
	| { readonly type: "text"; readonly text: string }
	| { readonly type: "file"; readonly data: string; readonly mime: string; readonly name?: string };

export interface ToolCall {
	readonly input: unknown;
}

export interface ToolOutput {
	readonly structured: unknown;
	readonly content: ReadonlyArray<
		| { readonly type: "text"; readonly text: string }
		| { readonly type: "file"; readonly uri: string; readonly mime: string; readonly name?: string }
	>;
}

export interface ToolConfig<
	Input extends Schema.Schema<any, any, never>,
	Output extends Schema.Schema<any, any, never>,
> {
	readonly description: string;
	readonly input: Input;
	readonly output: Output;
	readonly execute: (input: Input["Type"], context: ToolContext) => Effect.Effect<Output["Type"], ToolFailure>;
	readonly toModelOutput?: (opts: {
		readonly input: Input["Type"];
		readonly output: Output["Encoded"];
	}) => ReadonlyArray<ToolContent>;
}

declare const TypeId: unique symbol;

export interface ToolDefinition<
	Input extends Schema.Schema<any, any, never>,
	Output extends Schema.Schema<any, any, never>,
> {
	readonly [TypeId]: {
		readonly _Input: Input;
		readonly _Output: Output;
	};
}

export type AnyTool = ToolDefinition<any, any>;

type Runtime = {
	readonly settle: (call: ToolCall, context: ToolContext) => Effect.Effect<ToolOutput, ToolFailure>;
};

const runtimeKey = Symbol.for("opencode-bridge.tool-framework.runtime");

export function make<Input extends Schema.Schema<any, any, never>, Output extends Schema.Schema<any, any, never>>(
	config: ToolConfig<Input, Output>,
): ToolDefinition<Input, Output> {
	const tool = { _description: config.description } as ToolDefinition<Input, Output> & { _description: string };
	const runtime: Runtime = {
		settle: (call: ToolCall, context: ToolContext) =>
			Effect.suspend(() =>
				Either.match(Schema.decodeUnknownEither(config.input)(call.input), {
					onLeft: (error) => Effect.fail(error),
					onRight: (input) => Effect.succeed(input),
				}),
			).pipe(
				Effect.mapError((error) => new ToolFailure({ message: `Invalid tool input: ${error.message}` })),
				Effect.flatMap((input) =>
					config.execute(input, context).pipe(
						Effect.flatMap((output) =>
							Effect.suspend(() =>
								Either.match(Schema.encodeUnknownEither(config.output)(output), {
									onLeft: (error) => Effect.fail(error),
									onRight: (encoded) => Effect.succeed(encoded),
								}),
							).pipe(
								Effect.mapError(
									(error) =>
										new ToolFailure({
											message: `Tool returned an invalid value for its output schema: ${error.message}`,
										}),
								),
							),
						),
						Effect.map((output) => ({
							structured: output,
							content:
								config.toModelOutput?.({ input, output }).map((part) =>
									part.type === "text"
										? { type: "text" as const, text: part.text }
										: {
												type: "file" as const,
												uri: `data:${part.mime};base64,${part.data}`,
												mime: part.mime,
												name: part.name,
											},
								) ?? (typeof output === "string" ? [{ type: "text" as const, text: output }] : []),
						})),
					),
				),
			),
	};
	(tool as any)[runtimeKey] = runtime;
	return Object.freeze(tool);
}

export function settle(tool: AnyTool, call: ToolCall, context: ToolContext): Effect.Effect<ToolOutput, ToolFailure> {
	const runtime = (tool as any)[runtimeKey] as Runtime | undefined;
	if (!runtime) throw new Error("Invalid tool: not created via Tool.make()");
	return runtime.settle(call, context);
}
