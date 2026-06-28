# 模型文件说明

## 自动下载（默认）

首次调用 `/voice` 时，系统会自动从 sherpa-onnx 的 GitHub Releases 下载模型压缩包（~47MB）并解压到 `~/.pi/models/sense-voice/`。

## 手动下载（自动下载失败时）

如果自动下载失败，可以手动下载并放置模型文件。

### 下载地址

https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2

### 放置方式

将下载的压缩包解压后，把以下两个文件放到 `~/.pi/models/sense-voice/` 目录下：

| 文件 | 说明 |
|------|------|
| `model.int8.onnx` | SenseVoice 模型（int8 量化，~239MB） |
| `tokens.txt` | 词表文件 |

并在该目录下创建一个空文件 `.download-complete`，表示模型已就绪：

```
~/.pi/models/sense-voice/
├── model.int8.onnx
├── tokens.txt
└── .download-complete
```

### 验证

放置完成后，目录结构如上所示即可。再次调用 `/voice` 会跳过下载，直接使用本地模型。
