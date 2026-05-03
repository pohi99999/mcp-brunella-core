/**
 * Text-to-Speech Service
 *
 * Uses OpenAI TTS API with "nova" voice (same as AnythingLLM)
 * to provide Brunella's signature sultry voice experience.
 */

import { logInfo, logError } from './logger.js';

export type VoiceOption = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export type TTSModel = 'tts-1' | 'tts-1-hd';

export interface TTSOptions {
  voice?: VoiceOption;
  model?: TTSModel;
  speed?: number; // 0.25 to 4.0
}

const DEFAULT_OPTIONS: Required<TTSOptions> = {
  voice: 'nova', // Brunella's signature voice! 🎙️
  model: 'tts-1',
  speed: 1.0,
};

/**
 * Generate speech audio from text using OpenAI TTS API
 *
 * @param text - Text to convert to speech (max ~4096 chars)
 * @param options - TTS configuration options
 * @returns Audio blob (MP3 format)
 */
export async function textToSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<Blob> {
  const { voice, model, speed } = { ...DEFAULT_OPTIONS, ...options };

  // Prefer dedicated TTS key if configured, fall back to general OpenAI key
  const openaiApiKey = process.env.OPENAI_TTS_API_KEY || process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured (OPENAI_TTS_API_KEY or OPENAI_API_KEY)');
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  // Truncate if too long (OpenAI TTS limit ~4096 chars)
  const maxLength = 4096;
  const truncatedText = text.length > maxLength
    ? text.slice(0, maxLength) + '...'
    : text;

  logInfo('TTS', `Generating speech: "${truncatedText.slice(0, 50)}..." (voice: ${voice}, model: ${model})`);

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: truncatedText,
        voice,
        speed,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI TTS API error (${response.status}): ${errorText}`);
    }

    const audioBlob = await response.blob();
    logInfo('TTS', `Speech generated successfully (${audioBlob.size} bytes)`);

    return audioBlob;
  } catch (error: any) {
    logError('TTS', `Failed to generate speech: ${error.message}`);
    throw error;
  }
}

/**
 * Play audio blob in browser
 *
 * @param audioBlob - Audio blob to play
 * @returns Promise that resolves when audio finishes playing
 */
export function playAudio(audioBlob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };

    audio.onerror = (e) => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error('Audio playback failed'));
    };

    audio.play().catch(reject);
  });
}

/**
 * Text-to-Speech convenience function
 * Generates speech and plays it immediately
 *
 * @param text - Text to speak
 * @param options - TTS options
 */
export async function speak(text: string, options: TTSOptions = {}): Promise<void> {
  const audioBlob = await textToSpeech(text, options);
  await playAudio(audioBlob);
}

// Export for backend API endpoint
export default {
  textToSpeech,
  playAudio,
  speak,
};
