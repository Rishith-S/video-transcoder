import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import { Storage } from "@google-cloud/storage";
// import { PubSub } from "@google-cloud/pubsub";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const projectId = process.env.projectId!;
const storageBucketName = process.env.storageBucketName!;
const storageBucketName2 = process.env.storageBucketName2!;

const storage = new Storage({ projectId });
// const pubsub = new PubSub({ projectId });
const bucket = storage.bucket(storageBucketName);
const bucket2 = storage.bucket(storageBucketName2);
// const subscription = pubsub.subscription(subscriptionName);

app.use(cors());
app.use(express.json());

// Use memory storage for multer
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
});

interface UploadRequest extends Request {
  file?: Express.Multer.File;
}

app.post("/api/upload-video", upload.single("video"), async (req: UploadRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No video file provided" });
      return;
    }

    const fileName = `${req.file.originalname}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: req.file.mimetype,
    });

    blobStream.on("error", (err) => {
      console.error("GCS Upload Error:", err);
      res.status(500).json({ error: "Failed to upload to GCS" });
    });

    blobStream.on("finish", async () => {
      res.status(200).json({
        success: true,
        message: "Video uploaded successfully",
        filename: fileName,
      });
    });

    blobStream.end(req.file.buffer);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload video" });
  }
});

app.get("/api/processed-videos/:filename", async (req, res) => {
  const { filename } = req.params;
  const baseName = filename.split(".")[0];
  
  console.log(`Checking for processed video: ${filename}`);
  console.log(`Base name: ${baseName}`);
  console.log(`Bucket: ${storageBucketName2}`);
  
  // Check if all variants exist
  const variants = ["360p", "480p", "720p", "1080p"];
  const variantFiles = variants.map(variant => 
    bucket2.file(`${baseName}/${baseName}-${variant}.mp4`)
  );
  
  // Log the file paths being checked
  variantFiles.forEach((file, index) => {
    console.log(`Checking file ${index + 1}: ${file.name}`);
  });
  
  // Check if all files exist
  const existenceChecks = await Promise.all(
    variantFiles.map(async (file, index) => {
      const [exists] = await file.exists();
      console.log(`File ${index + 1} (${file.name}) exists: ${exists}`);
      return [exists];
    })
  );
  
  const allExist = existenceChecks.every(([exists]) => exists);
  console.log(`All files exist: ${allExist}`);
  
  if (!allExist) {
    res.status(404).json({ 
      error: "File not found", 
      message: "Video is still being processed. Please try again after some time.",
      retryAfter: 30,
    });
    return;
  }
  
  // Generate signed URLs and get metadata for all variants
  const urlAndMetadataPromises = variantFiles.map(async (file, index) => {
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 1000 * 60 * 60 * 24,
      responseDisposition: "attachment",
    });
    
    const [metadata] = await file.getMetadata();
    const sizeInBytes = parseInt(String(metadata.size || '0'));
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(1);
    
    return {
      quality: variants[index],
      url: url,
      size: `${sizeInMB} MB`
    };
  });
  
  const variantData = await Promise.all(urlAndMetadataPromises);
  
  res.json({ variants: variantData });
});

async function configureBucketCors() {
  await storage.bucket(storageBucketName2).setCorsConfiguration([
    {
      maxAgeSeconds: 3600,
      method: ["GET","HEAD"],
      origin: ["http://localhost:5173"],
      responseHeader: ["Content-Type", "Content-Disposition"],
    },
  ]);

  console.log(`Bucket ${storageBucketName2} was updated with a CORS config
      to allow requests from  sharing 
      responses across origins`);
}

configureBucketCors().catch(console.error);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
