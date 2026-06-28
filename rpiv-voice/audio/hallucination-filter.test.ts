import { describe, expect, it } from "vitest";
import { isHallucination } from "./hallucination-filter.js";

describe("isHallucination", () => {
	it("flags empty / whitespace-only output", () => {
		expect(isHallucination("")).toBe(true);
		expect(isHallucination("   ")).toBe(true);
		expect(isHallucination("♪")).toBe(true);
	});

	it("passes common dictation through (SenseVoice is not Whisper)", () => {
		expect(isHallucination("Thanks for watching!")).toBe(false);
		expect(isHallucination("  Thank you. ")).toBe(false);
	});

	it("flags single-token repetition loops", () => {
		expect(isHallucination("1/2 1/2 1/2 1/2")).toBe(true);
		expect(isHallucination("ok ok ok ok ok")).toBe(true);
	});

	it("flags multi-token repetition loops", () => {
		expect(isHallucination("yes no yes no yes no")).toBe(true);
		expect(isHallucination("a b c a b c a b c a b c")).toBe(true);
	});

	it("passes legitimate dictation through", () => {
		expect(isHallucination("write a function that returns the user id")).toBe(false);
		expect(isHallucination("Refactor the pipeline runner.")).toBe(false);
		expect(isHallucination("ok now add a test case")).toBe(false);
	});
});
