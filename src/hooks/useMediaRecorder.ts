import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaKind } from '@/lib/types';

export interface RecordedMedia {
  blob: Blob;
  extension: string;
  kind: MediaKind;
}

const VOICE_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'];
const CIRCLE_TYPES = ['video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm'];

function pickMimeType(kind: MediaKind): string {
  const candidates = kind === 'voice' ? VOICE_TYPES : CIRCLE_TYPES;
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function extensionFor(mimeType: string): string {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useMediaRecorder() {
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState<MediaKind | null>(null);
  const previewRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const closeCamera = useCallback(() => {
    stopStream(previewRef.current);
    previewRef.current = null;
    setPreviewStream(null);
  }, []);

  const openCamera = useCallback(async (): Promise<MediaStream> => {
    if (previewRef.current) return previewRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { facingMode: 'user', width: 480, height: 480 },
    });
    previewRef.current = stream;
    setPreviewStream(stream);
    return stream;
  }, []);

  const start = useCallback(
    async (kind: MediaKind): Promise<string | null> => {
      try {
        const stream =
          kind === 'circle'
            ? await openCamera()
            : await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const mimeType = pickMimeType(kind);
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        streamRef.current = stream;
        recorderRef.current = recorder;
        recorder.start();
        setRecording(kind);
        return null;
      } catch {
        return 'Нет доступа к микрофону или камере. Разрешите доступ в браузере.';
      }
    },
    [openCamera]
  );

  const finish = useCallback((): Promise<RecordedMedia | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setRecording(null);
      return Promise.resolve(null);
    }
    const kind: MediaKind = recorder.stream.getVideoTracks().length > 0 ? 'circle' : 'voice';
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || (kind === 'voice' ? 'audio/webm' : 'video/webm');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        recorderRef.current = null;
        if (kind === 'voice') stopStream(streamRef.current);
        streamRef.current = null;
        setRecording(null);
        resolve(blob.size > 0 ? { blob, extension: extensionFor(mimeType), kind } : null);
      };
      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    if (streamRef.current !== previewRef.current) stopStream(streamRef.current);
    streamRef.current = null;
    setRecording(null);
  }, []);

  useEffect(() => {
    return () => {
      cancel();
      closeCamera();
    };
  }, [cancel, closeCamera]);

  return { previewStream, recording, openCamera, closeCamera, start, finish, cancel };
}
