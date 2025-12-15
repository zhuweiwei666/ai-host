import os, uuid, torch, numpy as np, cv2
from PIL import Image
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI(title="AI Video Generation API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

OUTPUT = Path("/workspace/wan21/outputs")
OUTPUT.mkdir(exist_ok=True)
app.mount("/outputs", StaticFiles(directory=str(OUTPUT)), name="outputs")

pipe = None

@app.on_event("startup")
async def load_model():
    global pipe
    print("[startup] loading SVD pipeline...")
    try:
        from diffusers import StableVideoDiffusionPipeline

        pipe = StableVideoDiffusionPipeline.from_pretrained(
            "/workspace/wan21/models/svd",
            torch_dtype=torch.float16,
            variant="fp16",
        )
        pipe.to("cuda")
        print("[startup] model loaded")
    except Exception as e:
        pipe = None
        print(f"[startup] model load failed: {e}")

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": pipe is not None, "gpu": torch.cuda.is_available()}


def _center_crop_to_ar(img: Image.Image, target_ar: float) -> Image.Image:
    w, h = img.size
    cur_ar = w / h
    if cur_ar > target_ar:
        new_w = int(h * target_ar)
        left = (w - new_w) // 2
        return img.crop((left, 0, left + new_w, h))
    else:
        new_h = int(w / target_ar)
        top = (h - new_h) // 2
        return img.crop((0, top, w, top + new_h))


@app.post("/generate")
async def generate_video(
    image: UploadFile = File(...),
    motion: int = Form(60),
    fps: int = Form(12),
    frames: int = Form(24),
    loop: bool = Form(True),
    seed: int = Form(0),
    steps: int = Form(25),
    min_guidance: float = Form(1.0),
    max_guidance: float = Form(3.0),
    noise_aug: float = Form(0.02),
):
    if pipe is None:
        raise HTTPException(500, "模型未加载")

    job_id = str(uuid.uuid4())[:8]
    input_path = OUTPUT / f"{job_id}_input.png"
    output_path = OUTPUT / f"{job_id}.mp4"

    with open(input_path, "wb") as f:
        f.write(await image.read())

    img = Image.open(input_path).convert("RGB")

    # Always produce vertical 9:16 (good for iOS LiveSkin)
    img = _center_crop_to_ar(img, 9 / 16)
    out_w, out_h = 576, 1024
    img = img.resize((out_w, out_h), Image.LANCZOS)

    # clamp params
    steps = int(max(10, min(60, steps)))
    fps = int(max(6, min(24, fps)))
    frames = int(max(12, min(72, frames)))
    motion = int(max(1, min(255, motion)))

    if seed == 0:
        seed = int(np.random.randint(1, 2**31 - 1))

    gen = torch.Generator(device="cuda").manual_seed(int(seed))

    print(f"[generate] job={job_id} seed={seed} motion={motion} fps={fps} frames={frames} steps={steps}")

    with torch.inference_mode():
        result = pipe(
            image=img,
            width=out_w,
            height=out_h,
            num_frames=frames,
            num_inference_steps=steps,
            min_guidance_scale=float(min_guidance),
            max_guidance_scale=float(max_guidance),
            fps=fps,
            motion_bucket_id=motion,
            noise_aug_strength=float(noise_aug),
            decode_chunk_size=4,
            generator=gen,
            output_type="pil",
        )

    video_frames = result.frames[0]

    # Loop blending: append extra frames to smooth seam
    if loop and len(video_frames) >= 2:
        blended = [np.array(f) for f in video_frames]
        first = blended[0]
        last = blended[-1]
        for i in range(10):
            alpha = (i + 1) / 10
            frame = cv2.addWeighted(last, 1 - alpha, first, alpha, 0)
            blended.append(frame.astype(np.uint8))
        video_frames = [Image.fromarray(f) for f in blended]

    # Encode with iOS-friendly mp4 settings
    import imageio

    writer = imageio.get_writer(
        str(output_path),
        fps=fps,
        format="FFMPEG",
        codec="libx264",
        output_params=[
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-preset",
            "slow",
            "-tune",
            "animation",
            "-crf",
            "12",
            "-g",
            str(fps),
            "-keyint_min",
            str(fps),
        ],
    )
    for frame in video_frames:
        writer.append_data(np.array(frame))
    writer.close()

    return JSONResponse(
        {
            "success": True,
            "job_id": job_id,
            "video_url": f"/outputs/{job_id}.mp4",
            "frames": len(video_frames),
            "seed": int(seed),
            "width": out_w,
            "height": out_h,
            "steps": steps,
        }
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
