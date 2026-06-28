// Post-recognition filter for silent-segment artifacts. SenseVoice is less
// prone to Whisper-style hallucinations ("Thanks for watching", repetition
// loops), but we keep a lightweight guard: empty output and simple repetition
// loops (model-agnostic failure modes) are still caught.

export function isHallucination(text: string): boolean {
	const normalized = normalize(text);
	if (!normalized) return true;
	if (isRepetitionLoop(normalized)) return true;
	return false;
}

function normalize(text: string): string {
	return text
		.toLowerCase()
		.replace(/[\p{P}\p{S}]/gu, "")
		.replace(/\s+/g, " ")
		.trim();
}

function isRepetitionLoop(normalized: string): boolean {
	const tokens = normalized.split(" ").filter(Boolean);
	if (tokens.length < 4) return false;
	for (let groupSize = 1; groupSize <= 3; groupSize++) {
		const minRepeats = groupSize === 1 ? 4 : 3;
		if (tokens.length < groupSize * minRepeats) continue;
		let allMatch = true;
		for (let i = groupSize; i < tokens.length; i++) {
			if (tokens[i] !== tokens[i % groupSize]) {
				allMatch = false;
				break;
			}
		}
		if (allMatch) return true;
	}
	return false;
}
