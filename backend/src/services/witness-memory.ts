import { randomUUID } from 'crypto';
import db from '../db';
import { generateStructuredContent, hasTextGenerationConfig } from './ai';

export interface WitnessMemoryTranscriptEntry {
  role: 'agent' | 'user';
  text: string;
}

const MAX_NOTE_LENGTH = 320;
const MAX_NOTES_PER_WITNESS = 6;
const MEMORY_MODEL =
  process.env.AZURE_OPENAI_WITNESS_MEMORY_MODEL ||
  process.env.AZURE_OPENAI_TEXT_MODEL ||
  'gpt-5.4-nano';
const FALLBACK_MEMORY_MODEL =
  process.env.AZURE_OPENAI_WITNESS_MEMORY_FALLBACK_MODEL ||
  process.env.AZURE_OPENAI_CASE_MODEL ||
  process.env.AZURE_OPENAI_TEXT_MODEL ||
  'gpt-5.4';
const WITNESS_MEMORY_REASONING_EFFORT = process.env.AZURE_OPENAI_WITNESS_MEMORY_REASONING_EFFORT as
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | undefined;
const WITNESS_MEMORY_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    note: {
      type: 'string',
      description: 'A short durable memory note in English, max 280 characters, focused on what this witness and detective established.',
    },
  },
  required: ['note'],
} as const;

export function listWitnessCallMemory(caseId: string, userId: string, witnessId: string, limit = 4): string[] {
  const rows = db.prepare(`
    SELECT note
    FROM witness_call_memory
    WHERE user_id = ? AND case_id = ? AND witness_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, caseId, witnessId, Math.max(1, limit)) as Array<{ note: string }>;

  return rows.map(row => row.note).filter(Boolean);
}

export async function saveWitnessCallMemory(
  caseId: string,
  userId: string,
  witnessId: string,
  witnessName: string,
  transcript: WitnessMemoryTranscriptEntry[],
): Promise<string | null> {
  const note = await summarizeWitnessCall(witnessName, transcript);
  if (!note) return null;

  const normalized = normalizeTranscript(transcript);
  const transcriptJson = normalized.length > 0 ? JSON.stringify(normalized) : null;

  db.prepare(`
    INSERT INTO witness_call_memory (id, user_id, case_id, witness_id, note, transcript)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), userId, caseId, witnessId, note, transcriptJson);

  pruneWitnessCallMemory(caseId, userId, witnessId);
  return note;
}

async function summarizeWitnessCall(
  witnessName: string,
  transcript: WitnessMemoryTranscriptEntry[],
): Promise<string | null> {
  const normalized = normalizeTranscript(transcript);
  if (normalized.length === 0) {
    return null;
  }

  if (!hasTextGenerationConfig()) {
    console.warn('Azure OpenAI config not set, skipping witness memory save');
    return null;
  }

  const prompt = buildSummarizationPrompt(witnessName, normalized);

  try {
    const note = await generateStructuredContent({
      models: [MEMORY_MODEL, FALLBACK_MEMORY_MODEL],
      contents: prompt,
      schema: WITNESS_MEMORY_RESPONSE_SCHEMA,
      parse: parseStructuredMemoryNote,
      config: {
        reasoningEffort: WITNESS_MEMORY_REASONING_EFFORT,
        maxOutputTokens: 800,
      },
      onModelError: (model, error) => {
        console.warn(`witness-memory ${model} failed:`, error);
      },
    });

    return truncate(note, MAX_NOTE_LENGTH);
  } catch {
    return null;
  }
}

function normalizeTranscript(transcript: WitnessMemoryTranscriptEntry[]): WitnessMemoryTranscriptEntry[] {
  return transcript
    .map(entry => ({
      role: entry.role,
      text: normalizeLine(entry.text),
    }))
    .filter(entry => entry.text.length > 0);
}

function buildSummarizationPrompt(
  witnessName: string,
  transcript: WitnessMemoryTranscriptEntry[],
): string {
  const conversation = transcript
    .map(entry => `${entry.role === 'user' ? 'Detective' : witnessName}: ${entry.text}`)
    .join('\n');

  return [
    `Summarize this detective call with witness ${witnessName} into one short memory note for future follow-up calls.`,
    'Rules:',
    '- Write in English.',
    '- Put the result in the schema field `note`.',
    '- Maximum 280 characters inside note.',
    '- Capture only durable witness-specific context: facts already disclosed, promises, denials, contradictions, emotional state, relationship clues, or open questions the detective may revisit.',
    '- Omit greetings, signoffs, filler, and verbal tics.',
    '- If the call produced no durable witness context, set note to "Brief contact; no durable witness update.".',
    '',
    'Conversation:',
    conversation,
  ].join('\n');
}

function parseStructuredMemoryNote(raw: string): string {
  const text = raw.trim();
  if (!text) {
    throw new Error('Empty structured witness memory response');
  }

  let parsed: { note?: unknown };
  try {
    parsed = JSON.parse(text) as { note?: unknown };
  } catch {
    throw new Error('Structured witness memory response was not valid JSON');
  }

  if (typeof parsed.note !== 'string') {
    throw new Error('Structured witness memory response missing note');
  }

  const note = normalizeLine(parsed.note);
  if (!note) {
    throw new Error('Structured witness memory response note was empty');
  }

  return note;
}

function normalizeLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function pruneWitnessCallMemory(caseId: string, userId: string, witnessId: string): void {
  db.prepare(`
    DELETE FROM witness_call_memory
    WHERE user_id = ?
      AND case_id = ?
      AND witness_id = ?
      AND id NOT IN (
        SELECT id
        FROM witness_call_memory
        WHERE user_id = ? AND case_id = ? AND witness_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      )
  `).run(userId, caseId, witnessId, userId, caseId, witnessId, MAX_NOTES_PER_WITNESS);
}