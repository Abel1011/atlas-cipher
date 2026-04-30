import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { generateElevenLabsSoundEffect, hasElevenLabsApiKey } from './elevenlabs';

async function generateSound(prompt: string, durationSeconds: number): Promise<Buffer | null> {
  if (!hasElevenLabsApiKey()) return null;
  try {
    return await generateElevenLabsSoundEffect(prompt, durationSeconds);
  } catch (err) {
    console.error('Sound generation failed:', err);
    return null;
  }
}

function storeAsset(type: string, data: Buffer, prompt: string): string {
  const id = uuidv4();
  const stmt = db.prepare(
    'INSERT INTO generated_assets (id, type, data, mime_type, prompt) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(id, type, data, 'audio/mpeg', prompt);
  return id;
}

export async function generateCityAmbientSound(
  cityId: string,
  cityName: string,
  country: string
): Promise<string | null> {
  const prompt = `Ambient street sounds of ${cityName}, ${country}. Gentle background noise, distant traffic, local atmosphere.`;

  const audioData = await generateSound(prompt, 10);
  if (!audioData) {
    console.error(`Failed to generate ambient sound for city ${cityId} (${cityName})`);
    return null;
  }

  const assetId = storeAsset('ambient_sound', audioData, prompt);
  db.prepare('UPDATE cities SET ambient_sound_id = ? WHERE id = ?').run(assetId, cityId);
  return assetId;
}

export async function generateTravelSound(): Promise<string | null> {
  const prompt = 'Airport terminal ambiance with distant announcements, rolling luggage, and airplane engine hum transitioning to takeoff.';

  const audioData = await generateSound(prompt, 5);
  if (!audioData) {
    console.error('Failed to generate travel transition sound');
    return null;
  }

  return storeAsset('transition_sound', audioData, prompt);
}

export async function generateHandlerOpenSound(): Promise<string | null> {
  const prompt = 'Short radio communication channel opening, static crackle followed by a clear connection beep.';

  const audioData = await generateSound(prompt, 2);
  if (!audioData) {
    console.error('Failed to generate handler open sound');
    return null;
  }

  return storeAsset('transition_sound', audioData, prompt);
}
