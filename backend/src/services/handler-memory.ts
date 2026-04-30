import { randomUUID } from 'crypto';
import db from '../db';
import { generateStructuredContent, hasTextGenerationConfig } from './ai';

export interface HandlerMemoryTranscriptEntry {
  role: 'agent' | 'user';
  text: string;
}

const MAX_NOTE_LENGTH = 320;
const MAX_NOTES_PER_CASE = 8;
const MEMORY_MODEL =
  process.env.AZURE_OPENAI_HANDLER_MEMORY_MODEL ||
  process.env.AZURE_OPENAI_TEXT_MODEL ||
  'gpt-5.4-nano';
const FALLBACK_MEMORY_MODEL =
  process.env.AZURE_OPENAI_HANDLER_MEMORY_FALLBACK_MODEL ||
  process.env.AZURE_OPENAI_CASE_MODEL ||
  process.env.AZURE_OPENAI_TEXT_MODEL ||
  'gpt-5.4';
const HANDLER_MEMORY_REASONING_EFFORT = process.env.AZURE_OPENAI_HANDLER_MEMORY_REASONING_EFFORT as
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | undefined;
const HANDLER_MEMORY_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    note: {
      type: 'string',
      description: 'A short durable mission-memory note in English, max 280 characters, excluding greetings and signoffs.',
    },
  },
  required: ['note'],
} as const;

export function listHandlerCallMemory(caseId: string, userId: string, limit = 5): string[] {
  const rows = db.prepare(`
    SELECT note
    FROM handler_call_memory
    WHERE user_id = ? AND case_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, caseId, Math.max(1, limit)) as Array<{ note: string }>;

  return rows.map(row => row.note).filter(Boolean);
}

export async function saveHandlerCallMemory(
  caseId: string,
  userId: string,
  transcript: HandlerMemoryTranscriptEntry[],
): Promise<string | null> {
  const note = await summarizeHandlerCall(transcript);
  if (!note) return null;

  db.prepare(`
    INSERT INTO handler_call_memory (id, user_id, case_id, note)
    VALUES (?, ?, ?, ?)
  `).run(randomUUID(), userId, caseId, note);

  pruneHandlerCallMemory(caseId, userId);
  return note;
}

async function summarizeHandlerCall(transcript: HandlerMemoryTranscriptEntry[]): Promise<string | null> {
  const normalized = normalizeTranscript(transcript);
  if (normalized.length === 0) {
    return null;
  }

  if (!hasTextGenerationConfig()) {
    console.warn('Azure OpenAI config not set, skipping handler memory save');
    return null;
  }

  const prompt = buildSummarizationPrompt(normalized);

  try {
    const note = await generateStructuredContent({
      models: [MEMORY_MODEL, FALLBACK_MEMORY_MODEL],
      contents: prompt,
      schema: HANDLER_MEMORY_RESPONSE_SCHEMA,
      parse: parseStructuredMemoryNote,
      config: {
        reasoningEffort: HANDLER_MEMORY_REASONING_EFFORT,
        maxOutputTokens: 800,
      },
      onModelError: (model, error) => {
        console.warn(`handler-memory ${model} failed:`, error);
      },
    });

    return truncate(note, MAX_NOTE_LENGTH);
  } catch {
    return null;
  }
}

function normalizeTranscript(transcript: HandlerMemoryTranscriptEntry[]): HandlerMemoryTranscriptEntry[] {
  return transcript
    .map(entry => ({
      role: entry.role,
      text: normalizeLine(entry.text),
    }))
    .filter(entry => entry.text.length > 0);
}

function buildSummarizationPrompt(transcript: HandlerMemoryTranscriptEntry[]): string {
  const conversation = transcript
    .map(entry => `${entry.role === 'user' ? 'Detective' : 'Vivienne'}: ${entry.text}`)
    .join('\n');

  return [
    'Summarize this detective-handler call into one short memory note for future mission continuity.',
    'Rules:',
    '- Write in English.',
    '- Put the result in the schema field `note`.',
    '- Maximum 280 characters inside note.',
    '- Capture only durable mission-relevant context: decisions, leads, objectives, suspect or witness details, travel plans, constraints, or open questions.',
    '- Omit greetings, small talk, signoffs, and filler.',
    '- If the call produced no durable mission context, set note to "Routine check-in; no durable mission update.".',
    '',
    'Conversation:',
    conversation,
  ].join('\n');
}

function parseStructuredMemoryNote(raw: string): string {
  const text = raw.trim();
  if (!text) {
    throw new Error('Empty structured handler memory response');
  }

  let parsed: { note?: unknown };
  try {
    parsed = JSON.parse(text) as { note?: unknown };
  } catch {
    throw new Error('Structured handler memory response was not valid JSON');
  }

  if (typeof parsed.note !== 'string') {
    throw new Error('Structured handler memory response missing note');
  }

  const note = normalizeLine(parsed.note);
  if (!note) {
    throw new Error('Structured handler memory response note was empty');
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

function pruneHandlerCallMemory(caseId: string, userId: string): void {
  db.prepare(`
    DELETE FROM handler_call_memory
    WHERE user_id = ?
      AND case_id = ?
      AND id NOT IN (
        SELECT id
        FROM handler_call_memory
        WHERE user_id = ? AND case_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      )
  `).run(userId, caseId, userId, caseId, MAX_NOTES_PER_CASE);
}