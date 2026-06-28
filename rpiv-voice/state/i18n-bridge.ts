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

// ── Fallback translations (embedded) ────────────────────────────────────────
const ZH: Record<string, string> = {
	"command.description": "用语音输入文字——本地 STT，无需云端",
	"error.requires_interactive": "/voice 需要交互模式",
	"error.model_download_failed": "STT 模型下载失败，请检查网络连接。",
	"error.model_extract_failed": "下载的 STT 模型压缩包已损坏，请重试。",
	"error.model_verify_failed": "STT 模型文件下载不完整，请重试。",
	"error.model_stale_install": "STT 模型文件已被删除或损坏，下次启动时将重新下载。",
	"error.engine_load_failed": "STT 模型加载失败。",
	"error.mic_unavailable": "麦克风不可用。请检查是否连接了输入设备，以及 Pi 是否有麦克风权限。",
	"splash.preparing": "正在准备模型……",
	"splash.downloading": "正在下载 SenseVoice……",
	"splash.extracting": "正在解压模型文件……",
	"splash.verifying": "正在校验模型文件……",
	"splash.loading_engine": "正在加载语音模型……",
	"splash.initializing_mic": "正在初始化麦克风……",
	"footer.enter_paste": "回车粘贴",
	"footer.space_pause": "空格暂停",
	"footer.space_resume": "空格继续",
	"footer.tab_settings": "Tab 设置",
	"footer.esc_cancel": "Esc 取消",
	"footer.esc_back": "Esc 返回",
	"footer.ctrl_s_save": "Ctrl-S 保存",
	"footer.enter_toggle": "回车切换",
	"footer.up_down_select": "↑↓ 选择",
	"transcript.placeholder": "正在聆听……",
	"notify.settings_saved": "语音设置已保存",
	"status.recording": "录制中",
	"status.paused": "已暂停",
	"settings.microphone_label": "麦克风",
	"settings.microphone_value_default": "系统默认输入设备",
	"settings.language_label": "语言",
	"settings.language_value_auto": "自动检测",
	"settings.language_hint": "默认识别语言。",
	"settings.hallucination_filter_label": "过滤 Whisper 噪声",
	"settings.hallucination_filter_hint": "丢弃静音段伪影。单词语音转写时可关闭。",
	"settings.equalizer_label": "均衡器",
	"settings.equalizer_hint": "在转录文本下方显示实时音频波形。默认关闭。",
};

// Prefer the live SDK if installed; fall back to embedded Chinese map.
let scopeImpl: ScopeFn;
let activeLocaleImpl: LocaleFn;
try {
	const sdk = (await import("@juicesharp/rpiv-i18n")) as I18nSDK;
	scopeImpl = sdk.scope(I18N_NAMESPACE);
	activeLocaleImpl = sdk.getActiveLocale;
} catch {
	scopeImpl = (key, fallback) => ZH[key] ?? fallback;
	activeLocaleImpl = () => undefined;
}

export const t: ScopeFn = scopeImpl;
export const getActiveLocale: LocaleFn = activeLocaleImpl;
