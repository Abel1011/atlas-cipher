import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const ELEVENLABS_DEFAULT_MAX_RETRIES = readPositiveInt(process.env.ELEVENLABS_MAX_RETRIES, 3);
const ELEVENLABS_DEFAULT_TIMEOUT_SECONDS = readPositiveInt(process.env.ELEVENLABS_TIMEOUT_SECONDS, 60);

export function hasElevenLabsApiKey(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

export function getElevenLabsApiKey(): string {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');
  return apiKey;
}

export function createElevenLabsClient(apiKey = process.env.ELEVENLABS_API_KEY): ElevenLabsClient {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set');

  return new ElevenLabsClient({
    apiKey,
    maxRetries: ELEVENLABS_DEFAULT_MAX_RETRIES,
    timeoutInSeconds: ELEVENLABS_DEFAULT_TIMEOUT_SECONDS,
  });
}

export async function readElevenLabsAudioStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

export async function generateElevenLabsSoundEffect(
  text: string,
  durationSeconds: number,
  apiKey = process.env.ELEVENLABS_API_KEY
): Promise<Buffer> {
  const client = createElevenLabsClient(apiKey);
  const audioStream = await client.textToSoundEffects.convert({
    text,
    durationSeconds,
  });
  return readElevenLabsAudioStream(audioStream);
}

function readPositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}