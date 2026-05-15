/**
 * useMediaDevices Hook
 * Manages webcam and microphone permissions, streams, and recording
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface MediaState {
  hasCamera: boolean | null;
  hasMicrophone: boolean | null;
  cameraError: string | null;
  micError: string | null;
  stream: MediaStream | null;
  isReady: boolean;
}

interface RecordingState {
  isRecording: boolean;
  audioBlob: Blob | null;
  duration: number;
  audioLevel: number;
}

export const useMediaDevices = (videoRef?: React.RefObject<HTMLVideoElement>) => {
  const [mediaState, setMediaState] = useState<MediaState>({
    hasCamera: null,
    hasMicrophone: null,
    cameraError: null,
    micError: null,
    stream: null,
    isReady: false,
  });

  const [recording, setRecording] = useState<RecordingState>({
    isRecording: false,
    audioBlob: null,
    duration: 0,
    audioLevel: 0,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');
  const requestDataIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Request camera + microphone permissions
  const requestPermissions = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      // Validate audio tracks exist
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();

      console.log('getUserMedia succeeded:', {
        audioTracks: audioTracks.length,
        videoTracks: videoTracks.length,
      });

      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available. Please check microphone permissions.');
      }

      if (videoTracks.length === 0) {
        throw new Error('No video tracks available. Please check camera permissions.');
      }

      // Ensure tracks are enabled
      audioTracks.forEach((track, i) => {
        track.enabled = true;
        console.log(`Audio track ${i} enabled:`, {
          enabled: track.enabled,
          readyState: track.readyState,
          settings: track.getSettings(),
        });
      });
      videoTracks.forEach((track, i) => {
        track.enabled = true;
        console.log(`Video track ${i} enabled:`, {
          enabled: track.enabled,
          readyState: track.readyState,
        });
      });

      // Attach stream to video element
      if (videoRef?.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video playback warning:', playErr);
        }
      }

      // Setup audio analyser for live level monitoring
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyserRef.current = analyser;
        audioContextRef.current = audioContext;
      } catch (audioErr) {
        console.warn('Audio context setup warning:', audioErr);
      }

      setMediaState({
        hasCamera: true,
        hasMicrophone: true,
        cameraError: null,
        micError: null,
        stream,
        isReady: true,
      });

      // Start monitoring audio level
      monitorAudioLevel();

      return { success: true, stream };
    } catch (err: any) {
      const error = err as DOMException;
      let cameraError = null;
      let micError = null;

      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        cameraError = 'Camera permission denied. Please allow camera access in your browser settings.';
        micError = 'Microphone permission denied. Please allow microphone access.';
      } else if (error.name === 'NotFoundError') {
        cameraError = 'No camera found. Please connect a camera to continue.';
        micError = 'No microphone found. Please connect a microphone.';
      } else if (error.name === 'NotReadableError') {
        cameraError = 'Camera is in use by another application.';
      } else {
        cameraError = `Media error: ${error.message}`;
        micError = `Media error: ${error.message}`;
      }

      setMediaState({
        hasCamera: false,
        hasMicrophone: false,
        cameraError,
        micError,
        stream: null,
        isReady: false,
      });

      return { success: false, error: error.message };
    }
  }, [videoRef]);

  // Monitor real-time audio level
  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const level = Math.round((avg / 255) * 100);

      setRecording(prev => ({ ...prev, audioLevel: level }));
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  };

  // Start recording audio
  const startRecording = useCallback(() => {
    const { stream } = mediaState;
    if (!stream || recording.isRecording) return;

    try {
      // Validate that stream has audio tracks
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        console.error('No audio tracks available in stream');
        setMediaState(prev => ({
          ...prev,
          micError: 'No audio tracks available. Please check microphone permissions.',
        }));
        return;
      }

      console.log('Available audio tracks:', audioTracks.length);
      audioTracks.forEach((track, i) => {
        console.log(`Audio track ${i}:`, {
          enabled: track.enabled,
          readyState: track.readyState,
          kind: track.kind,
          settings: track.getSettings(),
        });
      });

      // Ensure all audio tracks are enabled
      audioTracks.forEach(track => {
        if (!track.enabled) {
          console.log('Enabling audio track');
          track.enabled = true;
        }
      });

      chunksRef.current = [];
      durationRef.current = 0;

      // Create audio-only stream for more reliable recording
      const audioOnlyStream = new MediaStream();
      audioTracks.forEach(track => audioOnlyStream.addTrack(track));

      console.log('Created audio-only stream with', audioOnlyStream.getAudioTracks().length, 'tracks');

      // Determine supported MIME type - try simpler types first
      let mimeType = 'audio/webm';
      const supportedTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/wav',
        '', // Let browser choose
      ];

      for (const type of supportedTypes) {
        if (type === '' || MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }
      mimeTypeRef.current = mimeType;
      console.log('Using MIME type:', mimeType || 'default');

      // Create MediaRecorder without timeslice to use default behavior
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(audioOnlyStream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setMediaState(prev => ({
          ...prev,
          micError: `Recording error: ${event.error}`,
        }));
      };

      let dataEvents = 0;
      let totalDataSize = 0;
      mediaRecorder.ondataavailable = (e) => {
        dataEvents++;
        totalDataSize += e.data.size;
        console.log(`Data available event #${dataEvents}:`, e.data.size, 'bytes, Total:', totalDataSize);
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('MediaRecorder started successfully');
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped. Total events:', dataEvents, 'Total chunks:', chunksRef.current.length, 'Total data:', totalDataSize);
        if (requestDataIntervalRef.current) clearInterval(requestDataIntervalRef.current);
      };

      mediaRecorder.start(); // Start without timeslice for better compatibility
      console.log('Recording started');

      // Periodically request data to flush pending data
      requestDataIntervalRef.current = setInterval(() => {
        if (mediaRecorder.state === 'recording') {
          console.log('Requesting data...');
          mediaRecorder.requestData();
        }
      }, 500);

      // Timer for duration
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setRecording(prev => ({ ...prev, duration: durationRef.current }));
      }, 1000);

      setRecording(prev => ({ ...prev, isRecording: true, audioBlob: null, duration: 0 }));
    } catch (err) {
      console.error('Error starting recording:', err);
      setMediaState(prev => ({
        ...prev,
        micError: `Failed to start recording: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    }
  }, [mediaState, recording.isRecording]);

  // Stop recording audio
  const stopRecording = useCallback((): Promise<{ blob: Blob; duration: number }> => {
    return new Promise((resolve) => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (requestDataIntervalRef.current) clearInterval(requestDataIntervalRef.current);

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        console.warn('MediaRecorder is not recording', { state: recorder?.state });
        resolve({ blob: new Blob(), duration: 0 });
        return;
      }

      console.log('Stopping recording...');

      // Set a timeout to ensure completion even if onstop doesn't fire
      const timeoutId = setTimeout(() => {
        console.log('Stop timeout triggered. Chunks collected:', chunksRef.current.length);
        const mimeType = mimeTypeRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('Final blob size from timeout:', blob.size, 'bytes', 'Chunks:', chunksRef.current.length);
        const duration = durationRef.current;
        setRecording(prev => ({ ...prev, isRecording: false }));
        resolve({ blob, duration });
      }, 2000); // Increased timeout

      recorder.onstop = () => {
        clearTimeout(timeoutId);
        const mimeType = mimeTypeRef.current;
        console.log('MediaRecorder onstop fired. Chunks collected:', chunksRef.current.length);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log('Final blob size from onstop:', blob.size, 'bytes', 'Chunks:', chunksRef.current.length);
        const duration = durationRef.current;
        setRecording(prev => ({ ...prev, isRecording: false }));
        resolve({ blob, duration });
      };

      // Request any pending data before stopping
      if (recorder.state === 'recording') {
        console.log('State is recording, requesting final data and stopping...');
        recorder.requestData();
        
        // Give it a moment to process the requestData call
        setTimeout(() => {
          recorder.stop();
        }, 100);
      }
    });
  }, []);

  // Stop all media tracks
  const stopStream = useCallback(() => {
    if (mediaState.stream) {
      mediaState.stream.getTracks().forEach(track => track.stop());
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
  }, [mediaState.stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (requestDataIntervalRef.current) clearInterval(requestDataIntervalRef.current);
    };
  }, []);

  return {
    mediaState,
    recording,
    requestPermissions,
    startRecording,
    stopRecording,
    stopStream,
  };
};

export default useMediaDevices;
