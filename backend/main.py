import uuid
from pathlib import Path

import edge_tts
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

AUDIO_DIR = Path(__file__).parent / "static" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="DAI Dubber Pro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


class TTSRequest(BaseModel):
    text: str
    voice: str = "en-US-AriaNeural"
    rate: str = "+0%"
    pitch: str = "+0Hz"
    volume: str = "+0%"


@app.get("/voices")
async def list_voices():
    voices = await edge_tts.list_voices()
    return [
        {
            "name": v["Name"],
            "short_name": v["ShortName"],
            "gender": v["Gender"],
            "locale": v["Locale"],
            "language": v["FriendlyName"],
        }
        for v in voices
    ]


@app.post("/tts")
async def generate_tts(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    filename = f"{uuid.uuid4()}.mp3"
    filepath = AUDIO_DIR / filename

    communicate = edge_tts.Communicate(
        req.text, req.voice,
        rate=req.rate,
        pitch=req.pitch,
        volume=req.volume,
    )
    await communicate.save(str(filepath))

    return {"audio_url": f"/static/audio/{filename}", "filename": filename}


@app.get("/audio/{filename}")
async def get_audio(filename: str):
    filepath = AUDIO_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(filepath, media_type="audio/mpeg")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
