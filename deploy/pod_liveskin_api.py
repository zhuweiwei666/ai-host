import os
import time

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

COMFY = os.environ.get("COMFY_URL", "http://127.0.0.1:8188")

app = FastAPI(title="LiveSkin Top Workflow API", version="0.1")


class QueuePromptRequest(BaseModel):
    prompt: dict
    client_id: str | None = None


@app.get("/health")
def health():
    out = {"status": "ok", "time": int(time.time()), "comfy": {"url": COMFY, "ok": False}}
    try:
        r = requests.get(f"{COMFY}/system_stats", timeout=2)
        out["comfy"]["ok"] = bool(r.ok)
        if r.ok:
            js = r.json()
            out["comfy"]["version"] = js.get("system", {}).get("comfyui_version")
    except Exception as e:
        out["comfy"]["error"] = str(e)
    return out


@app.post("/comfy/queue")
def comfy_queue(req: QueuePromptRequest):
    try:
        payload = {"prompt": req.prompt}
        if req.client_id:
            payload["client_id"] = req.client_id
        r = requests.post(f"{COMFY}/prompt", json=payload, timeout=10)
    except Exception as e:
        raise HTTPException(502, f"Failed to reach ComfyUI: {e}")

    if not r.ok:
        raise HTTPException(r.status_code, f"ComfyUI error: {r.text[:500]}")

    return r.json()
