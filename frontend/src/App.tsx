import axios from 'axios';
import { Download, Upload, VideoIcon } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';

type Variant = {
  quality: string;
  size: string;
  link: string;
};

type ProcessedVideo = {
  id: number;
  filename: string;
  originalSize: string;
  variants: Variant[];
};

const Header = () => (
  <div className="flex bg-gradient-to-r from-[#181c26] to-[#0c0c0d] w-full items-center justify-center
   h-20 gap-4 border-b border-white/30">
    <div className="flex items-center space-x-3">
      <VideoIcon className="w-10 h-10 text-white" />
    </div>
    <h1 className="text-2xl font-bold text-white select-none">
      VideoTranscode
    </h1>
  </div>
);

const VideoThumbnail = ({ variant }: { variant: Variant }) => {
  return (
    <div className="w-full rounded-t-xl overflow-hidden flex items-center justify-center">
      <video
        className="w-full object-cover"
        src={variant.link}
        controls={true}
      />
    </div>
  );
};

const VideoVariantCard = ({ variant, filename }: { variant: Variant, filename: string }) => {
  const handleDownload = (variant: Variant) => {
    fetch(variant.link)
      .then(response => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename.split(".")[0]}-${variant.quality}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      })
      .catch(() => {
        toast.error("Failed to download video. Please try again.");
      });
  };

  return (
    <div className="flex flex-col gap-4 border border-white/10 rounded-xl shadow-lg flex flex-col mx-auto bg-[#0c0c0d] gap-4">
      <VideoThumbnail variant={variant} />
      <div className="bg-[#10131a] px-4 pb-2">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-white">{variant.quality}</span>
          <span className="text-sm text-white/60 font-semibold">{variant.size}</span>
        </div>
        <button
          className="w-full mt-2 bg-[#18213a] hover:bg-blue-800 text-blue-200 font-semibold py-2 rounded-lg border border-blue-900 transition flex items-center justify-center gap-2 cursor-pointer"
          onClick={() => handleDownload(variant)}
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
};

const ProcessedVideoItem = ({ video }: { video: ProcessedVideo }) => (
  <div className="bg-[#0c0c0d] backdrop-blur-lg rounded-2xl p-8 border border-white/10 shadow-xl flex flex-col gap-6">
    <div className="flex items-center justify-between mb-2">
      <div>
        <h3 className="text-xl font-bold text-white/90">{video.filename}</h3>
        <p className="text-white/60 text-md">Original size: {video.originalSize}</p>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 w-full">
      {video.variants.map((variant, index) => (
        <VideoVariantCard key={index} variant={variant} filename={video.filename} />
      ))}
    </div>
  </div>
);

const ProcessedVideosSection = ({ processedVideos }: { processedVideos: ProcessedVideo[] }) => (
  <div className="flex flex-col px-16 2xl:px-64 gap-6">
    <h2 className="text-3xl font-bold text-white/90">Processed Video</h2>
    {processedVideos.map((video) => (
      <ProcessedVideoItem key={video.id} video={video} />
    ))}

    {processedVideos.length === 0 && (
      <div className="text-center text-cyan-100/60 py-12">
        <p>No processed videos yet. Upload videos to get started.</p>
      </div>
    )}
  </div>
);

const UploadArea = ({ onFileSelect, onDrop, onDragOver }: {
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
}) => (
  <div className="flex justify-center w-full px-32 2xl:px-64">
    <div
      className="px-16 w-full border border-white/20 border-dashed rounded-2xl p-12 text-center bg-[#0c0c0d] transition-colors cursor-pointer flex flex-col items-center"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
          <Upload className="w-8 h-8 text-white" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold text-white/90">Drop your videos here</h2>
          <p className="text-gray-100/60 text-lg font-semibold">or click to browse your files</p>
          <label className="text-white/90 text-lg font-semibold px-6 py-4 rounded-lg cursor-pointer border border-white/25">
            Select Videos
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={onFileSelect}
            />
          </label>
        </div>
      </div>
    </div>
  </div>
);

const VideoTranscode = () => {
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [processedVideos, setProcessedVideos] = useState<ProcessedVideo[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const pollingRefs = useRef<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    return () => {
      pollingRefs.current.forEach((timeoutId) => clearTimeout(timeoutId));
      pollingRefs.current.clear();
    };
  }, []);

  const pollForProcessedVideo = async (filename: string, fileSize: string) => {
    try {
      const response = await axios.get(`http://localhost:3000/api/processed-videos/${filename}`);

      if (response.status === 200) {
        const variants: Variant[] = response.data.variants.map((variant: any) => ({
          quality: variant.quality,
          size: variant.size,
          link: variant.url
        }));

        const newProcessedVideo: ProcessedVideo = {
          id: Date.now(),
          filename: filename,
          originalSize: fileSize,
          variants: variants
        };

        setProcessedVideos(prev => [...prev, newProcessedVideo]);
        setUploadedFiles(prev => prev.filter(f => f !== filename));

        const timeout = pollingRefs.current.get(filename);
        if (timeout) {
          clearTimeout(timeout);
          pollingRefs.current.delete(filename);
        }

        toast.success(`${filename} has been processed successfully!`);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        const timeout = setTimeout(() => pollForProcessedVideo(filename, fileSize), 5000);
        pollingRefs.current.set(filename, timeout);
      } else {
        console.error('Error polling for processed video:', error);
        toast.error(`Error checking status for ${filename}`);

        const timeout = pollingRefs.current.get(filename);
        if (timeout) {
          clearTimeout(timeout);
          pollingRefs.current.delete(filename);
        }
      }
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setLoading(true);
    try {
      const files = Array.from(event.target.files || []) as File[];
      const videoFiles = files.filter(file => file.type.startsWith("video/"));

      if (videoFiles.length > 0) {
        setSelectedVideos([videoFiles[0]]);

        const formData = new FormData();
        formData.append("video", videoFiles[0]);
        try {
          const response = await axios.post("http://localhost:3000/api/upload-video", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });
          console.log(response);
          if (response.status === 200) {
            toast.success("Video uploaded successfully");
            const filename = response.data.filename;
            setUploadedFiles(prev => [...prev, filename]);
            const fileSizeInMB = (videoFiles[0].size / (1024 * 1024)).toFixed(2);
            pollForProcessedVideo(filename, `${fileSizeInMB} MB`);
          } else {
            toast.error("Failed to upload video");
          }
        } catch (error) {
          console.error("Upload failed:", error);
          toast.error("Upload failed");
        }
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files) as File[];
    const videoFiles = files.filter(file => file.type.startsWith('video/'));
    if (videoFiles.length > 0) {
      setSelectedVideos([videoFiles[0]]);

      const formData = new FormData();
      formData.append("video", videoFiles[0]);

      try {
        const response = await axios.post("http://localhost:3000/api/upload-video", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        if (response.status === 200) {
          toast.success("Video uploaded successfully");
          const filename = response.data.filename;
          setUploadedFiles(prev => [...prev, filename]);

          const fileSizeInMB = (videoFiles[0].size / (1024 * 1024)).toFixed(2);
          pollForProcessedVideo(filename, `${fileSizeInMB} MB`);
        } else {
          toast.error("Failed to upload video");
        }
      } catch (error) {
        console.error("Upload failed:", error);
        toast.error("Upload failed");
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white font-sans">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #333',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <div className="mx-auto flex flex-col gap-12">
        <Header />
        {selectedVideos.length === 0 ? <UploadArea
          onFileSelect={handleFileSelect}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        /> : (
          <div className="flex flex-col items-center gap-6 px-16 2xl:px-64">
            <div className="bg-[#0c0c0d] border border-white/10 rounded-2xl p-8 w-full ">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white/90">{selectedVideos[0].name}</h3>
                <button
                  onClick={() => setSelectedVideos([])}
                  className="cursor-pointer text-white/60 hover:text-white/80 transition-colors"
                >
                  ✕
                </button>
              </div>
              <video
                src={URL.createObjectURL(selectedVideos[0])}
                className="w-full h-50 rounded-lg object-cover"
                controls
              />
            </div>
          </div>
        )}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-col px-32 2xl:px-64 gap-6">
            <h2 className="text-3xl font-bold text-white/90">Processing Videos</h2>
            {uploadedFiles.map((filename, index) => (
              <div key={index} className="bg-[#0c0c0d] backdrop-blur-lg rounded-2xl p-8 border border-white/10 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  <div>
                    <h3 className="text-xl font-bold text-white/90">{filename}</h3>
                    <p className="text-white/60">Processing video variants...</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <ProcessedVideosSection processedVideos={processedVideos} />
      </div>
    </div>
  );
};

export default VideoTranscode;