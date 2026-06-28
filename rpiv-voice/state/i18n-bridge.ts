/**
 * i18n bridge for rpiv-voice -- single thin import surface so every translation
 * call site routes through one place. Backed by `@juicesharp/rpiv-i18n`'s SDK
 * when available; loads zh.json as fallback when not.
 *
 * - `t(key, fallback)` is `scope("@juicesharp/rpiv-voice")` if the SDK is
 *   installed (live locale updates propagate). If the SDK is missing
 *   (standalone install without rpiv-i18n), `t` returns the Chinese
 *   translation from locales/zh.json, falling back to the English literal.
 * - `getActiveLocale()` exposes the current locale string ("en", "zh", etc.)
 *   so the STT engine can pre-set SenseVoice's `language` field.
 *   Returns `undefined` if rpiv-i18n isn't installed or no locale is active
 *   in which case voice-command defaults to "zh".
 *
 * Strings are registered ONCE at extension load (see ../index.ts). Call sites
 * MUST use this module at render time -- never bake the result into a top-level
 * `const X = t(...)`.
 */

export const I18N_NAMESPACE = "@juicesharp/rpiv-voice";

type ScopeFn = (key: string, fallback: string) => string;
type LocaleFn = () => string | undefined;
type I18nSDK = {
	scope: (namespace: string) => ScopeFn;
	getActiveLocale: LocaleFn;
};

// Prefer the live SDK if installed: closures it returned track the active
// locale. If the SDK isn't installed, load zh.json directly as fallback.
let scopeImpl: ScopeFn;
let activeLocaleImpl: LocaleFn;
try {
	const sdk = (await import("@juicesharp/rpiv-i18n")) as I18nSDK;
	scopeImpl = sdk.scope(I18N_NAMESPACE);
	activeLocaleImpl = sdk.getActiveLocale;
} catch {
	let localeMap: Record<string, string> | undefined;
	try {
		const url = new URL("../locales/zh.json", import.meta.url);
		localeMap = (await (await fetch(url)).json()) as Record<string, string>;
	} catch {
		localeMap = undefined;
	}
	scopeImpl = (key, fallback) => localeMap?.[key] ?? fallback;
	activeLocaleImpl = () => undefined;
}

export const t: ScopeFn = scopeImpl;
export const getActiveLocale: LocaleFn = activeLocaleImpl;
