# IG Reels Downloader — working full-stack version

This project contains the glassmorphism frontend plus a Flask backend that uses yt-dlp to fetch publicly accessible Instagram media.

## Local PC setup

Requirements:
- Python 3.10+
- FFmpeg
- Internet connection

1. Open a terminal in this folder.
2. Install packages:

   `pip install -r requirements.txt`

3. Start the server:

   `python app.py`

4. Open Chrome:

   `http://127.0.0.1:5000`

Paste a public Instagram Reel/post URL and click Download.

## Docker

Build:

`docker build -t ig-downloader .`

Run:

`docker run --rm -p 10000:10000 ig-downloader`

Open:

`http://127.0.0.1:10000`

## Deploy

The included Dockerfile and render.yaml can be used as a starting point for a Docker-capable host. The downloader depends on Instagram's current behavior, so no third-party scraper can guarantee every URL will work forever.

## Important limitations

- Designed for publicly accessible content.
- Private/login-only content will fail.
- Instagram can rate-limit or block server IPs.
- Instagram changes can temporarily break extractors. yt-dlp's official project lists Instagram support but notes that site changes can break extractors.
- Do not use this to download or redistribute content you do not have permission to save.
- No Instagram login credentials are collected by this app.
