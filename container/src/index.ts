import Ffmpeg from "fluent-ffmpeg";
import dotenv from "dotenv";
import { Storage } from "@google-cloud/storage";
import { PubSub } from "@google-cloud/pubsub";

dotenv.config();

const RESOLUTIONS = [
  { name: "360p", width: 640, height: 360 },
  { name: "480p", width: 854, height: 480 },
  { name: "720p", width: 1280, height: 720 },
  { name: "1080p", width: 1920, height: 1080 },
];

// Creates a client
const storage = new Storage();

async function transcodeAndUpload(
  inputBucketName: string,
  inputFileName: string,
  outputBucketName: string,
  resolution: { name: string; width: number; height: number }
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const inputStream = storage
        .bucket(inputBucketName)
        .file(inputFileName)
        .createReadStream();
      const outputFileName = `${inputFileName.replace(
        ".mp4",
        ""
      )}/${inputFileName.replace(".mp4", "")}-${resolution.name}.mp4`;
      const outputStream = storage
        .bucket(outputBucketName)
        .file(outputFileName)
        .createWriteStream({
          metadata: {
            contentType: "video/mp4",
          },
        });
      const ffmpegCommand = Ffmpeg()
        .input(inputStream)
        .output(outputStream)
        .outputOptions([
          "-f",
          "mp4",
          "-movflags",
          "frag_keyframe+empty_moov",
          "-preset",
          "medium",
          "-crf",
          "23",
        ])
        .withVideoCodec("libx264")
        .withAudioCodec("aac")
        .withSize(`${resolution.width}x${resolution.height}`)
        .format("mp4")
        .on("start", (commandLine) => {
          console.log(`FFmpeg command for ${resolution.name}: ${commandLine}`);
        })
        .on("progress", (progress) => {
          console.log(
            `Processing ${resolution.name}: ${Math.round(
              progress.percent || 0
            )*100}% done`
          );
        })
        .on("end", () => {
          console.log(
            `Transcoding completed for ${resolution.name} and uploaded to GCP`
          );
          resolve();
        })
        .on("error", (err) => {
          console.error(`Error transcoding ${resolution.name}:`, err);
          reject(err);
        });

      // Handle stream errors
      inputStream.on("error", (err) => {
        console.error(`Input stream error for ${resolution.name}:`, err);
        reject(err);
      });
      outputStream.on("error", (err) => {
        console.error(`Output stream error for ${resolution.name}:`, err);
        reject(err);
      });

      outputStream.on("finish", () => {
        console.log(`Upload completed for ${resolution.name}`);
      });

      // Start the transcoding process
      ffmpegCommand.run();
    } catch (error) {
      console.error(`Setup error for ${resolution.name}:`, error);
      reject(error);
    }
  });
}

const pubsub = new PubSub({});

const subscriptionName = process.env.subscriptionName!;

// Reference the subscription
const subscription = pubsub.subscription(subscriptionName);

// Listen for new messages

async function init() {
  try {
    const inputBucketName = process.env.inputBucketName!;
    const outputBucketName = process.env.outputBucketName!;
    subscription.on("message", async (message) => {
      console.log("Received message:");
      console.log(`ID: ${message.id}`);
      console.log(`Data: ${message.data}`);
      // Parse message data
      let parsedData: { name: string };
      try {
        parsedData = JSON.parse(message.data.toString());
      } catch (error) {
        console.error("Failed to parse message data:", error);
        message.nack();
        return;
      }
      const fileName = parsedData.name;
      // Acknowledge the message
      try {
        const [exists] = await storage
          .bucket(inputBucketName)
          .file(fileName)
          .exists();
        if (!exists) {
          throw new Error(
            `Input file gs://${inputBucketName}/${fileName} does not exist`
          );
        }
        console.log("Input file verified successfully");
      } catch (error) {
        console.error("Error checking input file:", error);
        return;
      }

      // Process all resolutions concurrently
      const transcodePromises = RESOLUTIONS.map((resolution) =>
        transcodeAndUpload(
          inputBucketName,
          fileName,
          outputBucketName,
          resolution
        )
      );

      // Wait for all transcoding to complete
      await Promise.all(transcodePromises);
      console.log("All transcoding and uploads completed successfully!");
      message.ack();
    });

    // Handle errors
    subscription.on("error", (error) => {
      console.error("Received error:", error);
    });
  } catch (error) {
    console.error("Error in init function:", error);
  }
}

init();
