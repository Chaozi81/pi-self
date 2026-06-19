import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import jiti from "jiti";
import { openCodeToolToPiDefinition } from "./pipeline.ts";
import { scanTools } from "./scanner.ts";
import type { OpenCodeToolModule } from "./types.ts";

const toolsDir = (() => {
	try {
		return resolve(dirname(fileURLToPath(import.meta.url)), "tools");
	} catch {
		return resolve(process.cwd(), "tools");
	}
})();

function isToolModule(mod: unknown): mod is OpenCodeToolModule {
	if (!mod || typeof mod !== "object") return false;
	const m = mod as Record<string, unknown>;
	return typeof m.name === "string" && !!m.Input && !!m.Output && !!m.layer;
}

export default async function (pi: ExtensionAPI): Promise<void> {
	const files = scanTools(toolsDir);
	const load = jiti(import.meta.url, { interopDefault: true });

	for (const file of files) {
		try {
			const mod = await load(file);
			if (!isToolModule(mod)) {
				console.warn(`[opencode-bridge] File "${file}" does not export { name, Input, Output, layer }. Skipping.`);
				continue;
			}

			const cwd = process.cwd();
			const tool = await openCodeToolToPiDefinition(mod, cwd);
			pi.registerTool(tool);
			console.warn(`[opencode-bridge] Registered tool: ${tool.name}`);
		} catch (err: any) {
			console.warn(`[opencode-bridge] Failed to load tool "${file}": ${err?.message ?? String(err)}`);
		}
	}
}
