import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

export function scanTools(dir: string): string[] {
	const results: string[] = [];
	try {
		const entries = readdirSync(dir);
		for (const entry of entries) {
			if (entry === "node_modules") continue;
			const fullPath = join(dir, entry);
			let stat: ReturnType<typeof statSync>;
			try {
				stat = statSync(fullPath);
			} catch {
				continue;
			}
			if (stat.isDirectory()) {
				results.push(...scanTools(fullPath));
			} else if (stat.isFile() && extname(entry) === ".ts") {
				results.push(fullPath);
			}
		}
	} catch {
		// directory doesn't exist or can't be read, return empty
	}
	return results;
}
