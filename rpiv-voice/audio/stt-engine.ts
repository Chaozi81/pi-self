/**
 * stt-engine — thin typed wrapper around sherpa-onnx-node.
 *
 * Type model: sherpa-onnx-node ships no .d.ts files; ambient types live in
 * ./sherpa-onnx-node.d.ts. Config keys are camelCase; the binding maps to
 * snake_case C structs internally.
 *
 * Model layout: SenseVoice — single `modelConfig.senseVoice.model` file
 * (not split encoder/decoder like Whisper). The int8 quantized variant
 * (`model.int8.onnx`) keeps CPU latency low.
 *
 * Language pre-set: optional `language` (ISO 639-1 like "zh", "en") biases
 * SenseVoice toward that language for accuracy. Threaded from
 * `getActiveLocale()` in voice-command. When undefined, the model auto-detects.
 *
 * Decode path: SYNCHRONOUS `recognizer.decode(stream)` + `getResult(stream)`,
 * same as sherpa-onnx-node's canonical example.
 */

import type { Config } from "sherpa-onnx-node";

// ── Fixed input contract ────────────────────────────────────────────────────
// 16 kHz mono PCM. featureDim 80 matches the model's mel-spectrogram output.
const SAMPLE_RATE = 16000;
const FEATURE_DIM = 80;

// ── Defaults ─────────────────────────────────────────────────────────────────
// 4 threads is a good balance for SenseVoice on modern multi-core CPUs.
// More than 4 shows diminishing returns and can starve other Pi work.
const DEFAULT_NUM_THREADS = 4;
const DEFAULT_PROVIDER = "cpu";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SttEngineConfig {
	modelPath: string;
	tokensPath: string;
	/** ISO 639-1 hint (e.g. "zh", "en"). Undefined → auto-detect. */
	language?: string;
	numThreads?: number;
	provider?: string;
}

export interface SttEngine {
	recognize(samples: Float32Array, sampleRate: number): Promise<string>;
	release(): void;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export async function createSttEngine(config: SttEngineConfig): Promise<SttEngine> {
	const ns = await loadSherpaNamespace();
	const recognizer = new ns.OfflineRecognizer(buildRecognizerConfig(config));

	return {
		async recognize(samples: Float32Array, sampleRate: number): Promise<string> {
			if (samples.length === 0) return "";
			const stream = recognizer.createStream();
			stream.acceptWaveform({ samples, sampleRate });
			recognizer.decode(stream);
			return recognizer.getResult(stream).text.trim();
		},
		release(): void {
			// sherpa-onnx-node@1.13.0 exposes no destructor; the native handle is
			// GC-managed. Kept as a no-op so the lifecycle contract is stable for
			// callers and tests.
		},
	};
}

// ── Internal ─────────────────────────────────────────────────────────────────

// sherpa-onnx-node ships as CJS; under ESM dynamic import only
// `OnlineRecognizer` is auto-detected as a named export. Everything else
// (including `OfflineRecognizer`) lives on `.default`. We fall back to the
// namespace itself in case a future ESM build flattens the shape.
async function loadSherpaNamespace(): Promise<{
	OfflineRecognizer: typeof import("sherpa-onnx-node").OfflineRecognizer;
}> {
	const mod = (await import("sherpa-onnx-node")) as Record<string, unknown> & {
		default?: Record<string, unknown>;
	};
	return (mod.default ?? mod) as { OfflineRecognizer: typeof import("sherpa-onnx-node").OfflineRecognizer };
}

function buildRecognizerConfig(config: SttEngineConfig): Config {
	return {
		featConfig: {
			sampleRate: SAMPLE_RATE,
			featureDim: FEATURE_DIM,
		},
		modelConfig: {
			senseVoice: {
				model: config.modelPath,
				useITN: 1,
				...(config.language ? { language: config.language } : {}),
			},
			tokens: config.tokensPath,
			numThreads: config.numThreads ?? DEFAULT_NUM_THREADS,
			provider: config.provider ?? DEFAULT_PROVIDER,
		},
	};
}
