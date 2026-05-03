/**
 * useTTS Hook
 *
 * React hook for Text-to-Speech with Brunella's Nova voice
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { logError } from '../utils/logger.js';

export type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface TTSOptions {
  voice?: VoiceOption;
  autoPlay?: boolean;
}

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  /**
   * Stop current speech playback
   */
  const stop = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setIsSpeaking(false);
    }
  }, [currentAudio]);

  /**
   * Speak text using OpenAI TTS API (Nova voice)
   *
   * @param text - Text to speak
   * @param options - TTS options
   */
  const speak = useCallback(
    async (text: string, options: TTSOptions = {}) => {
      const { voice = 'nova', autoPlay = true } = options;

      // Stop any currently playing audio
      if (currentAudio) {
        stop();
      }

      if (!text || text.trim().length === 0) {
        toast.error('Nincs mit mondani');
        return;
      }

      setIsSpeaking(true);

      try {
        // Call backend TTS API – relative URL works via Vite proxy in dev and
        // is served from the same origin in production.
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text.trim(),
            voice,
            model: 'tts-1',
            speed: 1.0,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `TTS failed: ${response.status}`);
        }

        // Convert response to audio blob
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Create and play audio
        const audio = new Audio(audioUrl);
        setCurrentAudio(audio);

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          setIsSpeaking(false);
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
          setIsSpeaking(false);
          toast.error('Hanglejátszási hiba');
        };

        if (autoPlay) {
          await audio.play();
          toast.success(`🎙️ Brunella beszél...`, {
            description: `Hang: ${voice === 'nova' ? 'Nova (női hang)' : voice}`,
          });
        }

        return audio;
      } catch (error: any) {
        logError('useTTS', `TTS error: ${error instanceof Error ? error.message : String(error)}`);
        setIsSpeaking(false);
        toast.error('TTS hiba', {
          description: error.message || 'Nem sikerült a hangot generálni',
        });
        throw error;
      }
    },
    [currentAudio, stop]
  );

  return {
    speak,
    stop,
    isSpeaking,
  };
}
