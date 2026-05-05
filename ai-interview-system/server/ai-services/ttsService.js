/**
 * Text-to-Speech Service
 * Uses ElevenLabs API (primary) with OpenAI TTS as fallback
 */

const axios = require('axios');
const { generateSpeech: openaiTTS } = require('./openaiService');

// ElevenLabs voice IDs
const ELEVENLABS_VOICES = {
  professional: '21m00Tcm4TlvDq8ikWAM', // Rachel - professional female
  friendly: 'AZnzlk1XvdvUeBnXmlld',    // Domi - friendly female
  authoritative: 'ErXwobaYiN019PkySvjV', // Antoni - authoritative male
};

/**
 * Generate speech using ElevenLabs API
 * Falls back to OpenAI TTS if ElevenLabs is unavailable
 */
const generateTTS = async (text, voiceType = 'professional') => {
  // Try ElevenLabs first
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const voiceId = ELEVENLABS_VOICES[voiceType] || ELEVENLABS_VOICES.professional;

      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        },
        {
          headers: {
            'xi-api-key': process.env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
          timeout: 15000,
        }
      );

      return {
        audio: Buffer.from(response.data),
        mimeType: 'audio/mpeg',
        provider: 'elevenlabs',
      };
    } catch (err) {
      console.warn('ElevenLabs TTS failed, falling back to OpenAI:', err.message);
    }
  }

  // Fallback to OpenAI TTS
  try {
    const buffer = await openaiTTS(text, 'nova');
    return {
      audio: buffer,
      mimeType: 'audio/mpeg',
      provider: 'openai',
    };
  } catch (err) {
    console.error('All TTS providers failed:', err.message);
    // Return null - frontend will use browser's Web Speech API
    return null;
  }
};

/**
 * Convert audio buffer to base64 for sending over WebSocket
 */
const audioToBase64 = (audioBuffer, mimeType = 'audio/mpeg') => {
  if (!audioBuffer) return null;
  const base64 = audioBuffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
};

module.exports = { generateTTS, audioToBase64 };
