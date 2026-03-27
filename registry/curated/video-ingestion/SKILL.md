---
name: video-ingestion
version: '1.0.0'
description: Video processing for RAG — extract frames via vision pipeline + audio via STT, index into knowledge base.
author: Wunderland
namespace: wunderland
category: productivity
tags: [video, ffmpeg, frames, transcription, multimodal, RAG]
requires_secrets: []
requires_tools: []
metadata:
  agentos:
    emoji: "\U0001F3AC"
---

# Video Ingestion for Multimodal RAG

Use this skill when the user wants to index video content into the agent's knowledge base so it can be searched and recalled during conversation.

Video ingestion works through the `MultimodalMemoryBridge`, which orchestrates two parallel extraction pipelines and feeds the results into both the RAG vector store and (optionally) cognitive memory.

## How It Works

1. **Frame extraction** — ffmpeg samples frames at a configurable interval (default: 1 frame every 5 seconds). Each frame is passed to a vision-capable LLM (e.g. GPT-4o) which generates a text description. That description is embedded and indexed into the vector store with `modality: 'image'` metadata.

2. **Audio extraction** — ffmpeg demuxes the audio track and pipes it to the configured STT provider (e.g. Whisper). The resulting transcript is chunked, embedded, and indexed with `modality: 'audio'` metadata.

3. **Memory traces** — When cognitive memory is enabled, the bridge encodes both visual descriptions and audio transcript chunks as memory traces so the agent can recall video content during future conversations.

## When to Ingest Video vs. Just Extract Audio

- **Ingest full video** when visual content matters: tutorials, screen recordings, product demos, surveillance, presentations with slides, anything where "what is shown" conveys information the transcript alone misses.
- **Extract audio only** when the video is essentially a podcast, voice memo, meeting recording, or phone call where the visual track adds no information. Audio-only ingestion is faster, cheaper (no vision LLM calls), and produces smaller index footprints.

If you are unsure, prefer full video ingestion. The frame extraction is lightweight and the vision descriptions are short — the marginal cost is small compared to the value of not losing visual context.

## Prerequisites

- **ffmpeg** must be installed and on the system PATH. The bridge shells out to `ffmpeg` for frame and audio extraction. Without it, video ingestion will fail with a clear error.
- A **vision-capable LLM** must be configured (OPENAI_API_KEY or equivalent) for frame description.
- An **STT provider** must be configured for audio transcription.

## Usage

Video ingestion is triggered through the `MultimodalMemoryBridge.ingestVideo()` method. When using the HTTP API, POST the video file to:

```
POST /api/agentos/rag/multimodal/documents/ingest
Content-Type: multipart/form-data
```

with the video file in the `document` field. The system auto-detects video MIME types and routes to the video pipeline.

Programmatic usage:

```typescript
import { MultimodalMemoryBridge } from 'agentos/rag/multimodal';

await bridge.ingestVideo(videoBuffer, {
  source: 'user-upload',
  fileName: 'meeting-2024-03-15.mp4',
  extractFrames: true,       // default true
  frameIntervalSeconds: 10,  // sample 1 frame every 10s (default 5)
  language: 'en',            // STT language hint
});
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `extractFrames` | `true` | Set `false` for audio-only ingestion |
| `frameIntervalSeconds` | `5` | Seconds between sampled frames |
| `language` | auto-detect | BCP-47 language code for STT |
| `collection` | `'multimodal'` | Target vector store collection |

## Examples

- "Ingest this tutorial video so I can search it later."
- "Extract the audio from this meeting recording and add it to my knowledge base."
- "Index this product demo video — I need to reference the UI screenshots shown at 2:30."
- "Process all MP4 files in this folder and make them searchable."

## Constraints

- ffmpeg must be installed. The system does not bundle or auto-install it.
- Long videos (>1 hour) produce many frames; consider increasing `frameIntervalSeconds` to 15-30 for very long content.
- Vision LLM calls are billed per frame. A 1-hour video at the default 5-second interval generates ~720 frames.
- Supported container formats: MP4, MKV, WebM, AVI, MOV (anything ffmpeg can demux).
- Video ingestion is not real-time; expect processing time proportional to video length.
