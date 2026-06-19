import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { Effect, Layer } from "effect";

export interface FileSystemShape {
	readonly readFile: (path: string) => Effect.Effect<string, Error>;
	readonly writeFile: (path: string, content: string) => Effect.Effect<void, Error>;
	readonly stat: (path: string) => Effect.Effect<{ type: "File" | "Directory" }, Error>;
	readonly readDir: (path: string) => Effect.Effect<string[], Error>;
	readonly exists: (path: string) => Effect.Effect<boolean>;
}

export class FileSystem extends Effect.Tag("FileSystem.Service")<FileSystem, FileSystemShape>() {}

export function makeFileSystemAdapter(): Layer.Layer<FileSystem> {
	return Layer.succeed(FileSystem, {
		readFile: (path) =>
			Effect.try({
				try: () => readFileSync(path, "utf-8"),
				catch: (e) => new Error(`Failed to read file: ${path}`, { cause: e }),
			}),
		writeFile: (path, content) =>
			Effect.try({
				try: () => {
					writeFileSync(path, content, "utf-8");
				},
				catch: (e) => new Error(`Failed to write file: ${path}`, { cause: e }),
			}),
		stat: (path) =>
			Effect.try({
				try: () => {
					const s = statSync(path);
					return { type: s.isDirectory() ? ("Directory" as const) : ("File" as const) };
				},
				catch: (e) => new Error(`Failed to stat: ${path}`, { cause: e }),
			}),
		readDir: (path) =>
			Effect.try({
				try: () => readdirSync(path),
				catch: (e) => new Error(`Failed to read dir: ${path}`, { cause: e }),
			}),
		exists: (path) => Effect.succeed(existsSync(path)),
	});
}
