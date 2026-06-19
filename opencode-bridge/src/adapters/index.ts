import { Layer } from "effect";
import { Config, makeConfigAdapter } from "./config.ts";
import { FileSystem, makeFileSystemAdapter } from "./filesystem.ts";
import { Location, makeLocationAdapter } from "./location.ts";
import { makePermissionAdapter, Permission } from "./permission.ts";

export function makeAllAdapters(cwd?: string) {
	return Layer.mergeAll(
		makeFileSystemAdapter(),
		makeConfigAdapter(),
		makeLocationAdapter(cwd),
		makePermissionAdapter(),
	);
}

export { FileSystem, Config, Location, Permission };
