# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

Open-source alternative to Opus Clip / Vidyo.ai / Klap. Given a YouTube URL (or local video), it:
1. Downloads and transcribes the video
2. Uses an LLM to rank segments by virality
3. Auto-crops top clips to 9:16 (or any aspect ratio) as MP4 shorts

Also ships a Flask web UI (`app.py` + `index.html`) with Khmer-language TTS, dubbing, and video-translation features.

## Running the Project

```bash
# Install (Python 3.10+ required)
python3.10 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt           # API mode + Flask web UI
pip install -r requirements-local.txt     # Also installs yt-dlp, faster-whisper, opencv, etc.
```

```bash
# CLI — API mode (default, needs MUAPI_API_KEY in .env)
python main.py "https://www.youtube.com/watch?v=VIDEO_ID"

# CLI — Local mode (needs LLM key; ffmpeg must be on PATH)
python main.py "https://www.youtube.com/watch?v=VIDEO_ID" --mode local

# CLI — From a local file
python main.py "test_video.mp4" --mode local

# CLI — Cut-only (no download/transcribe; supply timestamps as JSON)
python main.py "video.mp4" --mode cut --timestamps '[{"start_time":10,"end_time":70,"title":"clip1"}]'

# Common flags
python main.py <url> --num-clips 5 --aspect-ratio 9:16 --format 720 --language en --output-json result.json

# Subtitle burning (--subtitle-lang) is currently DISABLED in clipper.py
# (commented out to keep clips clean for CapCut integration)
# python main.py <url> --mode local --subtitle-lang Khmer

# Web UI (Flask)
python app.py   # serves index.html at http://localhost:5000
```

There is no test suite. Manual testing uses `test_video.mp4` in the repo root.

## Architecture

### Three Operating Modes

| Mode | Download | Transcribe | Highlight rank | Crop |
|------|----------|-----------|----------------|------|
| `api` (default) | MuAPI `/youtube-download` | MuAPI `/openai-whisper` | MuAPI `gpt-4o-mini` | MuAPI `/autocrop` |
| `local` | yt-dlp | faster-whisper | OpenAI or Gemini | ffmpeg + OpenCV face tracking |
| `cut` | skipped | skipped | skipped | ffmpeg + OpenCV face tracking |

### Data Flow

```
URL/path
  → pipeline.py:generate_shorts()
      → downloader: mp4 URL or local path
      → transcriber: {duration, segments[{start,end,text}]}
      → highlights.py: chunk if >30min, LLM ranks each chunk → dedupe overlaps >50%
      → clipper: crop top-N highlights to target aspect ratio
  → {mode, source_video_url, transcript, highlights, shorts[{title,start_time,end_time,score,hook_sentence,virality_reason,clip_url}]}
```

### Key Files

- **`main.py`** — argparse CLI; calls `generate_shorts()`, prints results
- **`app.py`** — Flask web server; job management, TTS/dubbing/translation endpoints
- **`index.html`** — Khmer-language SPA (Tailwind + vanilla JS); multi-engine TTS, video translation, YT Shorts tab
- **`jobs_store.json`** — persists job state across server restarts (auto-created)
- **`shorts_generator/pipeline.py`** — main orchestrator; `_run_api()`, `_run_local()`, `_run_cut()`
- **`shorts_generator/highlights.py`** — virality prompt, LLM retry logic, chunking, deduplication
- **`shorts_generator/muapi.py`** — generic submit+poll client for all MuAPI jobs
- **`shorts_generator/local/`** — yt-dlp downloader, faster-whisper transcriber, OpenAI/Gemini LLM dispatcher, ffmpeg+OpenCV clipper, subtitle burner

### Web UI & Job System (app.py)

`app.py` runs the pipeline in background threads and tracks jobs in an in-memory dict (`_JOBS`) protected by a threading lock. Jobs auto-persist to `jobs_store.json`. A cleanup daemon drops jobs older than 2 hours.

**Flask routes:**
- `POST /api/generate-shorts` — accepts `video_url`, `num_clips`, `aspect_ratio`, `download_format`, `language`, `mode`, `subtitle_lang`, `crop_mode`, `out_dir`; spawns a background thread; returns `job_id`
- `GET /api/status/<job_id>` — poll for job state (`queued` → `running` → `done`/`error`) and streamed logs
- `GET /api/config` — advertises which API keys are set and the default mode
- `POST /api/translate-video` — LLM-translates transcript segments to Khmer
- `POST /api/dub-video` — generates Khmer TTS (Gemini), merges audio into video
- `POST /api/generate-gradio-tts` — calls the Gradio Khmer TTS space (`mrrtmob/khmer-tts`)

`_LogCapture` redirects `sys.stdout` to capture pipeline `print()` output per-job (handles Windows UTF-8 encoding).

### Patterns Worth Knowing

**MuAPI submit+poll**: Every API job follows `submit(endpoint, payload) → request_id → poll(request_id) → result`. See `muapi.py`. Retries 3× on transient failures with 2s backoff; 5-minute hard timeout for LLM calls.

**Long-video chunking**: Videos >30 min are split into overlapping 20-min windows (60s overlap) so cross-boundary highlights aren't lost. Offsets are adjusted and results are deduped post-merge.

**LLM pluggability**: `highlights.py:rank_highlights()` takes an `llm_fn` callable so the same prompt logic works for both MuAPI and local LLMs. JSON retry: on bad output, appends `"Return ONLY valid JSON with top-level 'highlights' array"` and retries up to 3×; strips markdown fences via `_parse_json_loose()`.

**Caching (local mode)**: Transcriptions are cached as `.srt` files (invalidated by media mtime) and downloaded videos as `source_<video_id>.mp4` in `LOCAL_OUTPUT_DIR`. Re-running skips expensive operations.

**ffmpeg discovery**: `clipper.py:_ffmpeg_exe()` first checks PATH, then falls back to `imageio_ffmpeg.get_ffmpeg_exe()` (bundled with the pip package). This means ffmpeg is not strictly required on PATH when `imageio-ffmpeg` is installed.

**Clip re-encoding**: The local clipper re-encodes output clips with `-c:v libx264 -preset fast -crf 23` (not stream-copy). This is intentional: stream-copy can produce unplayable files when trimming mid-GOP. The re-encode cost is acceptable for short clips.

**Face tracking (local clipper)**: OpenCV Haar cascade detects faces; smoothing factor 0.15 damps jitter. Falls back to center crop if detection fails. `crop_mode="center"` skips face detection entirely.

**Subtitle burning** (`local/subtitles.py`): LLM translates segments, writes SRT, burns via ffmpeg `subtitles` filter (Khmer UI font, size 18). Windows paths require colon-prefixed drive escaping for ffmpeg. Falls back to original video on failure. **Currently disabled** (commented out in `clipper.py:crop_highlights_local`) to keep clips clean for CapCut integration — re-enable by uncommenting the block. The `--subtitle-lang` CLI flag and `subtitle_lang` API param still exist but have no effect until re-enabled.

**Path normalization** (local mode): `_run_local()` converts absolute output paths to relative POSIX paths (e.g. `output/short_01.mp4`) so they are web-safe for the Flask UI's static file serving. API mode similarly converts downloaded clips to relative paths when `out_dir` is set.

**Virality criteria** (`VIRALITY_CRITERIA` in `highlights.py`): 8 ranked signals (hook, emotional peak, opinion bomb, revelation, conflict, quotable, story peak, practical value). Edit here to tune clip selection.

**Content-type detection** (`highlights.py:detect_content_type()`): Classifies transcript as podcast/interview/tutorial/lecture/commentary/debate/vlog/other and estimates density (low/medium/high) to tune the LLM prompt.

## Configuration (`.env`)

```bash
# API mode
MUAPI_API_KEY=...
MUAPI_BASE_URL=https://api.muapi.ai/api/v1   # optional override
MUAPI_POLL_INTERVAL=5                          # seconds between polls
MUAPI_POLL_TIMEOUT=600                         # give up after N seconds

# Local mode
LLM_PROVIDER=openai           # "openai" or "gemini"
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=...           # optional: use Ollama (http://localhost:11434/v1) or LM Studio; OPENAI_API_KEY can be omitted when this is set
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
LOCAL_WHISPER_MODEL=base      # tiny/base/small/medium/large-v3
LOCAL_WHISPER_DEVICE=auto     # auto/cpu/cuda
LOCAL_OUTPUT_DIR=output
```

## Python API

```python
from shorts_generator import generate_shorts

result = generate_shorts(
    youtube_url="https://...",
    num_clips=3,
    aspect_ratio="9:16",
    download_format="720",
    language=None,        # None = auto-detect
    mode="api",           # "api", "local", or "cut"
    timestamps=None,      # required for mode="cut"
    out_dir=None,         # if set, downloads/saves clips to this directory
    crop_mode="face",     # "face" (OpenCV tracking) or "center" (static)
)
# result["shorts"] → list of clips with clip_url
```
