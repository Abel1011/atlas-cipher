import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { createElevenLabsClient, hasElevenLabsApiKey, readElevenLabsAudioStream } from './elevenlabs';

const DEFAULT_VOICE_ID = 'wKACMzXkVNGvOz027WZg';
const DEFAULT_TTS_MODEL_ID = 'eleven_v3';

function getVoiceId(): string {
  return process.env.ELEVENLABS_HANDLER_VOICE_ID || DEFAULT_VOICE_ID;
}

function storeAsset(type: string, data: Buffer, prompt: string): string {
  const id = uuidv4();
  const stmt = db.prepare(
    'INSERT INTO generated_assets (id, type, data, mime_type, prompt) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(id, type, data, 'audio/mpeg', prompt);
  return id;
}

export async function generateNarration(text: string): Promise<string | null> {
  if (!hasElevenLabsApiKey()) return null;
  try {
    const voiceId = getVoiceId();
    const client = createElevenLabsClient();
    const audioStream = await client.textToSpeech.convert(voiceId, {
      text,
      modelId: DEFAULT_TTS_MODEL_ID,
    });
    const audioData = await readElevenLabsAudioStream(audioStream);
    return storeAsset('narration', audioData, text);
  } catch (err) {
    console.error('TTS generation failed:', err);
    return null;
  }
}

/**
 * Per-turn TTS for the witness interrogation flow. Returns the raw mp3
 * bytes (no DB persistence) so they can be streamed back to the browser
 * as base64 in the same response.
 *
 * Uses eleven_v3 so audio tags like [sighs], [whispers], [nervous]
 * embedded in the text actually colour the delivery. If the tagged request
 * fails, it retries on eleven_v3 with the tags stripped.
 */
export async function synthesizeWitnessSpeech(
  text: string,
  voiceId: string
): Promise<Buffer> {
  const client = createElevenLabsClient();
  const tryRequest = async (body: {
    text: string;
    modelId: 'eleven_v3';
    voiceSettings: {
      stability: number;
      similarityBoost: number;
      style: number;
    };
  }): Promise<Buffer> => {
    const audioStream = await client.textToSpeech.convert(voiceId, body);
    return await readElevenLabsAudioStream(audioStream);
  };

  // Primary: expressive v3 with the audio tags intact.
  try {
    return await tryRequest({
      text,
      modelId: DEFAULT_TTS_MODEL_ID,
      voiceSettings: {
        stability: 0.4,
        similarityBoost: 0.85,
        style: 0.55,
      },
    });
  } catch {
    const stripped = text.replace(/\[[^\]]+\]\s*/g, '').trim() || text;
    return await tryRequest({
      text: stripped,
      modelId: DEFAULT_TTS_MODEL_ID,
      voiceSettings: {
        stability: 0.55,
        similarityBoost: 0.85,
        style: 0.35,
      },
    });
  }
}
