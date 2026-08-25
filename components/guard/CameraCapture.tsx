"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_VIDEO_SECONDS = 45;

type Props = {
  checkinId: string;
  onDone: (result: { status: string; message: string }) => void;
};

type Mode = "starting" | "camera" | "no-camera" | "preview" | "uploading";

/**
 * Live camera capture for a check-in. Uses getUserMedia (photo via canvas,
 * video via MediaRecorder, both max 45s). If the camera stream is blocked,
 * falls back to <input capture="environment"> which forces the native camera
 * on phones. Plain gallery picks are rejected by the server.
 */
export function CameraCapture({ checkinId, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [mode, setMode] = useState<Mode>("starting");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [preview, setPreview] = useState<{ blob: Blob; url: string; isVideo: boolean; duration: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setMode("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setMode("camera");
    } catch {
      setMode("no-camera");
      setError(
        "Camera stream blocked. Use the button below — it opens your phone's camera app directly. Do NOT pick from the gallery."
      );
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [startCamera, stopStream]);

  // Attach the stream once the <video> is rendered.
  useEffect(() => {
    if (mode === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [mode]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not capture the photo. Try again.");
          return;
        }
        stopStream();
        setPreview({ blob, url: URL.createObjectURL(blob), isVideo: false, duration: null });
        setMode("preview");
      },
      "image/jpeg",
      0.85
    );
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : "";
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      const duration = recordSecondsRef.current;
      stopStream();
      setRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setPreview({ blob, url: URL.createObjectURL(blob), isVideo: true, duration });
      setMode("preview");
    };
    recorder.start(1000);
    setRecording(true);
    setRecordSeconds(0);
    recordSecondsRef.current = 0;
    recordTimerRef.current = setInterval(() => {
      recordSecondsRef.current += 1;
      setRecordSeconds(recordSecondsRef.current);
      if (recordSecondsRef.current >= MAX_VIDEO_SECONDS) {
        recorderRef.current?.stop();
      }
    }, 1000);
  }
  const recordSecondsRef = useRef(0);

  function stopRecording() {
    recorderRef.current?.stop();
  }

  async function retake() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    await startCamera();
  }

  async function upload(blob: Blob, opts: { captureMethod: string; isVideo: boolean; duration: number | null; lastModified: number | null; fileName: string }) {
    setMode("uploading");
    setError(null);
    const form = new FormData();
    form.append("file", new File([blob], opts.fileName, { type: blob.type, lastModified: opts.lastModified ?? Date.now() }));
    form.append("checkinId", checkinId);
    form.append("captureMethod", opts.captureMethod);
    if (opts.duration != null) form.append("durationSeconds", String(opts.duration));
    if (opts.lastModified != null) form.append("clientLastModified", String(opts.lastModified));
    try {
      const res = await fetch("/api/checkin/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed. Try again.");
        setMode(preview ? "preview" : "no-camera");
        return;
      }
      onDone({ status: data.status, message: data.message });
    } catch {
      setError("Network problem during upload. Check your connection and try again.");
      setMode(preview ? "preview" : "no-camera");
    }
  }

  async function onCaptureInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const isVideo = file.type.startsWith("video/");
    let duration: number | null = null;
    if (isVideo) {
      duration = await readVideoDuration(file);
      if (duration != null && duration > MAX_VIDEO_SECONDS) {
        setError(`That video is ${Math.round(duration)} seconds. Maximum is ${MAX_VIDEO_SECONDS} seconds — record a shorter one.`);
        return;
      }
    }
    await upload(file, {
      captureMethod: "capture-input",
      isVideo,
      duration,
      lastModified: file.lastModified,
      fileName: file.name || (isVideo ? "checkin.mp4" : "checkin.jpg"),
    });
  }

  if (mode === "uploading") {
    return (
      <div className="rounded-lg border border-line bg-surface-2 p-6 text-center">
        <p className="text-xl font-bold">Uploading...</p>
        <p className="mt-1 text-sm text-muted">Keep this page open until it finishes.</p>
      </div>
    );
  }

  if (mode === "preview" && preview) {
    return (
      <div className="space-y-3">
        {preview.isVideo ? (
          <video src={preview.url} controls playsInline className="w-full rounded-lg border border-line" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.url} alt="Your check-in capture" className="w-full rounded-lg border border-line" />
        )}
        {error && <ErrorBox text={error} />}
        <button
          type="button"
          onClick={() =>
            upload(preview.blob, {
              captureMethod: "getUserMedia",
              isVideo: preview.isVideo,
              duration: preview.duration,
              lastModified: Date.now(),
              fileName: preview.isVideo ? "checkin.webm" : "checkin.jpg",
            })
          }
          className="w-full rounded-lg bg-accent px-4 py-4 text-xl font-black text-black"
        >
          SEND THIS {preview.isVideo ? "VIDEO" : "PHOTO"}
        </button>
        <button
          type="button"
          onClick={retake}
          className="w-full rounded-lg border border-line bg-surface-2 px-4 py-3 font-semibold"
        >
          Retake
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mode === "camera" && (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full rounded-lg border border-line bg-black"
          />
          {recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="pulse-danger w-full rounded-lg bg-danger px-4 py-4 text-xl font-black text-white"
            >
              STOP RECORDING ({MAX_VIDEO_SECONDS - recordSeconds}s left)
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={takePhoto}
                className="rounded-lg bg-accent px-4 py-4 text-lg font-black text-black"
              >
                TAKE PHOTO
              </button>
              <button
                type="button"
                onClick={startRecording}
                className="rounded-lg border-2 border-accent px-4 py-4 text-lg font-black text-accent"
              >
                RECORD VIDEO
              </button>
            </div>
          )}
          <p className="text-center text-xs text-muted">
            Live video is the strongest proof. Max {MAX_VIDEO_SECONDS} seconds.
          </p>
        </>
      )}

      {mode === "starting" && (
        <div className="rounded-lg border border-line bg-surface-2 p-6 text-center">
          <p className="font-bold">Starting camera...</p>
          <p className="mt-1 text-sm text-muted">Allow camera access when your phone asks.</p>
        </div>
      )}

      {error && <ErrorBox text={error} />}

      {(mode === "no-camera" || mode === "camera") && (
        <label className="block">
          <span className="sr-only">Open phone camera app</span>
          <input
            type="file"
            accept="image/*,video/*"
            capture="environment"
            onChange={onCaptureInput}
            className="hidden"
            id="capture-input"
          />
          <span
            role="button"
            tabIndex={0}
            onClick={() => document.getElementById("capture-input")?.click()}
            onKeyDown={(e) => e.key === "Enter" && document.getElementById("capture-input")?.click()}
            className={`block cursor-pointer rounded-lg px-4 py-4 text-center font-bold ${
              mode === "no-camera"
                ? "bg-accent text-xl text-black"
                : "border border-line bg-surface-2 text-sm text-muted"
            }`}
          >
            {mode === "no-camera" ? "OPEN PHONE CAMERA" : "Camera not working? Use the phone camera app"}
          </span>
        </label>
      )}

      <p className="text-center text-xs font-semibold text-warn">
        Gallery photos and saved files are REJECTED. Use the camera now.
      </p>
    </div>
  );
}

function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(isFinite(v.duration) ? v.duration : null);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-danger bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
      {text}
    </p>
  );
}
