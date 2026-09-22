import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file, after_this_request

app = Flask(__name__)

INSTAGRAM_HOSTS = {"instagram.com", "www.instagram.com", "m.instagram.com"}
MAX_BYTES = 500 * 1024 * 1024

def valid_instagram_url(url: str) -> bool:
    return bool(re.match(r"^https?://(www\.)?(m\.)?instagram\.com/(reel|p|tv|stories)/", url, re.I))

def safe_name(name: str) -> str:
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._")
    return name[:100] or "instagram-download"

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/api/download")
def download():
    data = request.get_json(silent=True) or {}
    url = str(data.get("url", "")).strip()

    if not valid_instagram_url(url):
        return jsonify(error="Only valid Instagram post/reel/story URLs are supported."), 400

    if shutil.which("yt-dlp") is None:
        return jsonify(error="yt-dlp is not installed on the server."), 500

    workdir = Path(tempfile.mkdtemp(prefix="igdl-"))
    output_template = str(workdir / "%(title).80s-%(id)s.%(ext)s")

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--no-part",
        "--restrict-filenames",
        "--max-filesize", str(MAX_BYTES),
        "-f", "best[ext=mp4]/best",
        "-o", output_template,
        url,
    ]

    try:
        completed = subprocess.run(
            cmd, cwd=workdir, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            timeout=180
        )

        if completed.returncode != 0:
            log = completed.stdout[-2500:]
            if "login" in log.lower() or "cookies" in log.lower():
                msg = "Instagram requires login for this post, or the server IP was rate-limited. Try a public Reel/post."
            elif "not available" in log.lower():
                msg = "This Instagram content is unavailable or private."
            else:
                msg = "Instagram could not provide downloadable media for this URL."
            app.logger.warning("yt-dlp failed: %s", log)
            shutil.rmtree(workdir, ignore_errors=True)
            return jsonify(error=msg), 502

        files = [p for p in workdir.iterdir() if p.is_file() and not p.name.endswith((".part", ".ytdl"))]
        if not files:
            shutil.rmtree(workdir, ignore_errors=True)
            return jsonify(error="No downloadable media was returned."), 502

        media = max(files, key=lambda p: p.stat().st_size)
        if media.stat().st_size > MAX_BYTES:
            shutil.rmtree(workdir, ignore_errors=True)
            return jsonify(error="The file is larger than the 500 MB server limit."), 413

        filename = safe_name(media.stem) + media.suffix

        @after_this_request
        def cleanup(response):
            shutil.rmtree(workdir, ignore_errors=True)
            return response

        return send_file(
            media,
            as_attachment=True,
            download_name=filename,
            mimetype="application/octet-stream",
            max_age=0
        )

    except subprocess.TimeoutExpired:
        shutil.rmtree(workdir, ignore_errors=True)
        return jsonify(error="Download timed out. Instagram may be rate-limiting the server."), 504
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        app.logger.exception("Downloader error")
        return jsonify(error="Server error while downloading."), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
