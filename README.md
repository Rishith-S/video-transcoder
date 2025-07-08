# Video Transcoding Pipeline
This project is a backend-driven video transcoding pipeline that automates video upload, processing, and delivery. It is designed for scalability and reliability, leveraging GCP’s storage, messaging, and database services, and uses FFMPEG for high-quality transcoding.

# Project Preview
https://github.com/user-attachments/assets/bd92c648-3fa5-4409-b292-0a2b19fb4335

# Architecture Overview
<img width="600" height="600" alt="Screenshot 2025-07-08 at 9 47 35 AM" src="https://github.com/user-attachments/assets/ab636f6d-51f1-424a-ae9f-cd21ad469da2" />

Workflow
1. Upload Server (Backend)
Receives video files from clients (e.g., via a REST API endpoint).
Uploads the raw video to a Google Cloud Storage bucket (e.g., temp-video-bucket).
2. Cloud Storage (temp-video-bucket)
Stores the uploaded raw video files.
Triggers a Pub/Sub event when a new video is uploaded.
4. Transcoder (Container)
Picks up videos from the task queue.
Downloads the video from Cloud Storage.
Transcodes the video into multiple resolutions (360p, 480p, 720p, 1080p) using FFMPEG.
Uploads the transcoded .mp4 files to a separate Cloud Storage bucket (e.g., output-video-bucket).

# Technologies Used
* Google Cloud Storage: For storing both raw and transcoded video files.
* Google Cloud Pub/Sub: For event-driven processing of video uploads and transcoding tasks.
* FFMPEG: For transcoding videos into multiple resolutions.
* Node.js/TypeScript: For backend logic and worker processes.
* React: To upload videos

# Summary
This pipeline automates the end-to-end process of video ingestion, transcoding, and publishing using GCP’s scalable infrastructure. It ensures that uploaded videos are processed efficiently, stored securely, and made available in multiple resolutions.
