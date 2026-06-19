import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanTools } from "../src/scanner.ts";

function tempDir() {
	const dir = join(tmpdir(), `pi-bridge-test-${randomUUID()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

describe("scanTools", () => {
	it("returns empty array for empty directory", () => {
		const dir = tempDir();
		try {
			expect(scanTools(dir)).toEqual([]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("finds .ts files at top level", () => {
		const dir = tempDir();
		try {
			writeFileSync(join(dir, "a.ts"), "// a");
			writeFileSync(join(dir, "b.ts"), "// b");
			const result = scanTools(dir);
			expect(result).toHaveLength(2);
			expect(result.every((f: string) => f.endsWith(".ts"))).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("skips non-.ts files", () => {
		const dir = tempDir();
		try {
			writeFileSync(join(dir, "a.ts"), "// a");
			writeFileSync(join(dir, "readme.md"), "// not a tool");
			writeFileSync(join(dir, "config.json"), "{}");
			const result = scanTools(dir);
			expect(result).toHaveLength(1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("recursively finds .ts files in subdirectories", () => {
		const dir = tempDir();
		try {
			mkdirSync(join(dir, "group-a"));
			mkdirSync(join(dir, "group-b"));
			writeFileSync(join(dir, "group-a", "tool1.ts"), "// tool1");
			writeFileSync(join(dir, "group-b", "tool2.ts"), "// tool2");
			const result = scanTools(dir);
			expect(result).toHaveLength(2);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("skips node_modules directories", () => {
		const dir = tempDir();
		try {
			mkdirSync(join(dir, "node_modules", "some-pkg"), { recursive: true });
			writeFileSync(join(dir, "node_modules", "some-pkg", "bad.ts"), "// bad");
			writeFileSync(join(dir, "good.ts"), "// good");
			const result = scanTools(dir);
			expect(result).toHaveLength(1);
			expect(result[0]).toContain("good.ts");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
