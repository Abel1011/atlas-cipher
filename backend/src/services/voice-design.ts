/**
 * Designs a fresh ElevenLabs voice from a free-form description (age, accent,
 * tone, gender, demeanour…) and persists it as a reusable voice id.
 * Mirrors the Replit `designAndSaveVoice` reference.
 */
import db from '../db';
import { createElevenLabsClient, hasElevenLabsApiKey } from './elevenlabs';

export async function designVoiceFromDescription(
  voiceDescription: string,
  characterName: string
): Promise<string> {
  const client = createElevenLabsClient();
  const design = await client.textToVoice.design({
    voiceDescription,
    autoGenerateText: true,
    guidanceScale: 25,
  });
  const previewId = design.previews?.[0]?.generatedVoiceId;
  if (!previewId) throw new Error('No voice preview returned by ElevenLabs');

  const safeName = characterName.replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  const saved = await client.textToVoice.create({
    generatedVoiceId: previewId,
    voiceName: `AtlasCipher-${safeName}-${Date.now()}`,
    voiceDescription,
  });
  return saved.voiceId;
}

/**
 * Returns a stored voice for the witness, generating and persisting one on
 * first call. Always uses the witness's own voice_description so the gender
 * and demeanour match what the case generator wrote.
 */
export async function ensureWitnessVoiceId(witnessId: string): Promise<string | null> {
  const witness = db
    .prepare('SELECT name, voice_description, voice_id FROM witnesses WHERE id = ?')
    .get(witnessId) as { name: string; voice_description: string; voice_id: string | null } | undefined;
  if (!witness) return null;
  if (witness.voice_id) return witness.voice_id;
  if (!hasElevenLabsApiKey()) return null;

  try {
    const voiceId = await designVoiceFromDescription(witness.voice_description, witness.name);
    db.prepare('UPDATE witnesses SET voice_id = ? WHERE id = ?').run(voiceId, witnessId);
    return voiceId;
  } catch (err) {
    console.error(`Voice design failed for witness ${witnessId}:`, err);
    return null;
  }
}
