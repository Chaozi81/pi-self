import { join } from "node:path";
import jiti from "jiti";
import { describe, expect, it } from "vitest";
import { openCodeToolToPiDefinition } from "../src/pipeline.ts";
import { Tools } from "../src/types.ts";

describe("E2E: fixture tool loading and execution", () => {
	it("loads simple-tool.ts via jiti and executes successfully", async () => {
		const fixturePath = join(__dirname, "fixtures", "simple-tool.ts");
		const load = jiti(__filename, { interopDefault: false });
		const mod = await load(fixturePath);

		expect(mod.name).toBe("simple_test");
		expect(mod.Input).toBeDefined();
		expect(mod.Output).toBeDefined();
		expect(mod.layer).toBeDefined();

		const modWithTag = { ...mod, toolsTag: Tools };

		const def = await openCodeToolToPiDefinition(modWithTag, "/tmp");

		const result = await def.execute("call-e2e", { message: "e2e works" }, undefined, undefined, {
			cwd: "/tmp",
			ui: {},
		} as any);

		expect(result.content).toHaveLength(1);
		expect((result.content[0] as any).text).toBe("e2e works");
		expect(result.details).toEqual({ echoed: "e2e works" });
	});

	it("loads fs-tool.ts via jiti and reads a file", async () => {
		const { writeFileSync, rmSync } = await import("node:fs");
		const { join } = await import("node:path");
		const tmpFile = join(__dirname, "..", "_e2e_test_file.txt");
		writeFileSync(tmpFile, "hello fs adapter", "utf-8");

		try {
			const fixturePath = join(__dirname, "fixtures", "fs-tool.ts");
			const load = jiti(__filename, { interopDefault: false });
			const mod = await load(fixturePath);

			const modWithTag = { ...mod, toolsTag: Tools };

			const def = await openCodeToolToPiDefinition(modWithTag, "/tmp");

			const result = await def.execute("call-fs", { path: tmpFile }, undefined, undefined, {
				cwd: "/tmp",
				ui: {},
			} as any);

			expect((result.content[0] as any).text).toBe("hello fs adapter");
		} finally {
			try {
				rmSync(tmpFile);
			} catch {
				/* ignore */
			}
		}
	});
});
