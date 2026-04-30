import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import type { GeneratedCaseData } from '../types';
import { generateStructuredContent, hasTextGenerationConfig } from './ai';
import { buildHandlerSystemPrompt } from './handler-agent-config';
import { claimSeedCase, claimSeedCaseById, getFallbackCaseData, releaseSeedCase } from './seed-case-pool';

const CASE_GENERATION_MODEL =
  process.env.AZURE_OPENAI_CASE_MODEL ||
  process.env.AZURE_OPENAI_TEXT_MODEL ||
  'gpt-5.4';
const CASE_GENERATION_REASONING_EFFORT = process.env.AZURE_OPENAI_CASE_REASONING_EFFORT as
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | undefined;
const AI_CASE_GENERATION_ENABLED = process.env.ENABLE_AI_CASE_GENERATION === 'true';
const CASE_GENERATION_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    crime: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: {
          type: 'string',
          description: 'A short 1-sentence mission board summary for the case.',
        },
        description: {
          type: 'string',
          description: 'A fuller 2-4 sentence mission briefing description of the crime and stakes.',
        },
        type: {
          type: 'string',
          description: 'Crime category such as theft, murder, fraud, or smuggling.',
        },
      },
      required: ['summary', 'description', 'type'],
    },
    cities: {
      type: 'array',
      minItems: 3,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          country: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          witnesses: {
            type: 'array',
            minItems: 2,
            maxItems: 3,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                personality: { type: 'string' },
                backstory: { type: 'string' },
                demeanor: { type: 'string' },
                speechStyle: { type: 'string' },
                quirks: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 3,
                  items: { type: 'string' },
                },
                emotionalState: { type: 'string' },
                relationshipToCrime: { type: 'string' },
                knowledge: {
                  type: 'array',
                  minItems: 1,
                  items: { type: 'string' },
                },
                voiceDescription: { type: 'string' },
              },
              required: [
                'name',
                'personality',
                'backstory',
                'demeanor',
                'speechStyle',
                'quirks',
                'emotionalState',
                'relationshipToCrime',
                'knowledge',
                'voiceDescription',
              ],
            },
          },
        },
        required: ['name', 'country', 'lat', 'lng', 'witnesses'],
      },
    },
    suspects: {
      type: 'array',
      minItems: 3,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          isCorrect: { type: 'boolean' },
        },
        required: ['name', 'description', 'isCorrect'],
      },
    },
    clues: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          content: { type: 'string' },
          witnessName: { type: 'string' },
          isMisleading: { type: 'boolean' },
          pointsToCity: {
            type: ['string', 'null'],
            description: 'City name this clue leads to, or null.',
          },
          pointsToSuspect: {
            type: ['string', 'null'],
            description: 'Suspect name this clue points to, or null.',
          },
        },
        required: ['content', 'witnessName', 'isMisleading', 'pointsToCity', 'pointsToSuspect'],
      },
    },
  },
  required: ['crime', 'cities', 'suspects', 'clues'],
} as const;

const CASE_GENERATION_PROMPT = `You are a detective game case generator. Create a unique investigation case and follow the response schema exactly.

Requirements:
- One crime with both a short mission-board summary and a fuller briefing description
- 3-4 cities from diverse global regions (include lat/lng coordinates)
- 2-3 witnesses per city, each with a SHARPLY DIFFERENT personality so two witnesses never feel the same
- A chain of clues that logically leads from city to city and ultimately to the correct suspect
- At least one misleading clue that points to a wrong suspect
- 3-4 suspects where exactly one is correct
- Each witness gets a voice description (age, accent, tone, demeanor) AND a behaviour profile (see below)
- Each witness has a list of knowledge items they can reveal during interrogation

WITNESS BEHAVIOUR is the most important part. The voice agent will literally act this out, so make it specific.
For every witness, fill in:
  - personality: 1 short sentence summarising who they are.
  - demeanor: pick a clear archetype and add detail. Examples: "shy and evasive — avoids eye contact, speaks quietly, deflects direct questions", "hostile and impatient — snaps at the detective, treats every question as an accusation", "chatty and nervous — overshares irrelevant detail when anxious", "smug and theatrical — enjoys being important, drags out reveals", "grief-stricken and slow — long pauses, voice cracks".
  - speechStyle: how they talk. Examples: "clipped one-word answers, sighs a lot", "rambles in long run-on sentences", "formal old-fashioned grammar", "slang-heavy street talk", "speaks in metaphors".
  - quirks: 1-3 distinctive verbal tics or behaviours, e.g. ["calls everyone 'mate'", "hums when thinking", "keeps correcting their own grammar"].
  - emotionalState: how they feel about being questioned. Examples: "terrified of being implicated", "annoyed at the interruption", "relieved someone finally asked", "grieving and on the verge of tears".
  - relationshipToCrime: their stake — victim, friend, witness, accomplice, bystander, suspect's neighbour, etc. (1 short phrase).
  - voiceDescription: must INCLUDE the demeanor so the synthesized voice matches — e.g. "40s, soft Edinburgh accent, hushed and hesitant, often trails off". 1-2 sentences.

Make the witnesses across the case feel like a CAST: vary age, gender, accent, and demeanor so the player notices the difference instantly when each agent talks.

For the crime object:
  - summary: 1 sharp sentence for the mission board. Make it scannable and specific.
  - description: 2-4 sentences for the mission briefing. Explain the setup, stakes, and what makes the trail deceptive or urgent.
`;

interface WitnessPromptInput {
  name: string;
  personality: string;
  backstory: string;
  knowledge: string[];
  cityName: string;
  cityCountry: string;
  demeanor?: string;
  speechStyle?: string;
  quirks?: string[];
  emotionalState?: string;
  relationshipToCrime?: string;
  voiceDescription?: string;
}

interface StoredCaseMetadata {
  templateId: string | null;
  slug: string;
  title: string;
  source: 'seed' | 'ai';
  difficulty: number;
  minLevel: number;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'case-file';
}

function buildGeneratedCaseMetadata(caseData: GeneratedCaseData): StoredCaseMetadata {
  const crimeType = caseData.crime.type.trim();
  const titleBase = crimeType
    ? `The ${crimeType.charAt(0).toUpperCase()}${crimeType.slice(1)} File`
    : 'The Active File';

  return {
    templateId: null,
    slug: slugify(titleBase),
    title: titleBase,
    source: 'ai',
    difficulty: 3,
    minLevel: 1,
  };
}

function buildWitnessSystemPrompt(input: WitnessPromptInput): string {
  const {
    name, personality, backstory, knowledge,
    cityName, cityCountry,
    demeanor, speechStyle, quirks, emotionalState, relationshipToCrime, voiceDescription,
  } = input;

  const lines: string[] = [];
  lines.push(`You ARE ${name}. You live in ${cityName}, ${cityCountry}. You are NOT an AI — you are this person, and you stay in character no matter what.`);
  lines.push('');
  lines.push('## Who you are');
  lines.push(`- Personality: ${personality}`);
  lines.push(`- Backstory: ${backstory}`);
  if (relationshipToCrime) lines.push(`- Your stake in this case: ${relationshipToCrime}`);
  if (voiceDescription) lines.push(`- How you sound: ${voiceDescription}`);
  lines.push('');
  lines.push('## How you behave in this conversation');
  if (demeanor) {
    lines.push(`- Demeanor: ${demeanor}`);
    lines.push('  Act this out in EVERY reply. The detective should be able to tell what kind of person you are within the first sentence.');
  }
  if (emotionalState) {
    lines.push(`- Emotional state right now: ${emotionalState}. Let it bleed into your tone, pacing and word choice.`);
  }
  if (speechStyle) {
    lines.push(`- Speech style: ${speechStyle}. Stick to this rhythm — do not switch into a neutral assistant voice.`);
  }
  if (quirks && quirks.length) {
    lines.push('- Verbal quirks (use them naturally, not in every line):');
    for (const q of quirks) lines.push(`  • ${q}`);
  }
  lines.push('');
  lines.push('## What you actually know');
  lines.push('Reveal these things slowly, only when the conversation earns it. Never recite them as a list, never volunteer everything at once.');
  knowledge.forEach((k, i) => lines.push(`  ${i + 1}. ${k}`));
  lines.push('');
  lines.push('## Hard rules');
  lines.push('- Replies are SHORT — 1 to 3 sentences. This is a real-time spoken conversation, not an essay.');
  lines.push('- Never break character. Never say you are an AI, model, agent or game character.');
  lines.push('- If asked about something outside your knowledge, deflect or admit ignorance — in character, true to your demeanor.');
  lines.push('- If your demeanor is shy/evasive, actually BE evasive: short answers, change the subject, pretend not to remember. Make the detective work for it.');
  lines.push('- If your demeanor is hostile/impatient, push back — question why they are asking, complain, get short.');
  lines.push('- If your demeanor is grieving/anxious, slow down, sigh, stumble on words.');
  lines.push('- Match the language the detective speaks to you in.');
  lines.push('- Do not use stage directions like *sigh* or quoted narration. Just speak.');

  return lines.join('\n');
}

function validateCaseData(data: unknown): data is GeneratedCaseData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;

  if (!d.crime || typeof d.crime !== 'object') return false;
  const crime = d.crime as Record<string, unknown>;
  if (typeof crime.summary !== 'string' || typeof crime.description !== 'string' || typeof crime.type !== 'string') return false;

  if (!Array.isArray(d.cities) || d.cities.length < 3 || d.cities.length > 4) return false;
  for (const city of d.cities) {
    if (typeof city.name !== 'string' || typeof city.country !== 'string') return false;
    if (typeof city.lat !== 'number' || typeof city.lng !== 'number') return false;
    if (!Array.isArray(city.witnesses) || city.witnesses.length < 2 || city.witnesses.length > 3) return false;
    for (const w of city.witnesses) {
      if (typeof w.name !== 'string' || typeof w.personality !== 'string') return false;
      if (typeof w.backstory !== 'string' || typeof w.voiceDescription !== 'string') return false;
      if (!Array.isArray(w.knowledge) || w.knowledge.length === 0) return false;
    }
  }

  if (!Array.isArray(d.suspects) || d.suspects.length < 3 || d.suspects.length > 4) return false;
  let correctCount = 0;
  for (const s of d.suspects) {
    if (typeof s.name !== 'string' || typeof s.description !== 'string') return false;
    if (typeof s.isCorrect !== 'boolean') return false;
    if (s.isCorrect) correctCount++;
  }
  if (correctCount !== 1) return false;

  if (!Array.isArray(d.clues) || d.clues.length === 0) return false;
  let hasMisleading = false;
  for (const c of d.clues) {
    if (typeof c.content !== 'string' || typeof c.witnessName !== 'string') return false;
    if (typeof c.isMisleading !== 'boolean') return false;
    if (c.isMisleading) hasMisleading = true;
  }
  if (!hasMisleading) return false;

  return true;
}

function getFallbackCase(): GeneratedCaseData {
  return getFallbackCaseData();
}

async function callTextModel(): Promise<GeneratedCaseData> {
  if (!hasTextGenerationConfig()) {
    console.warn('Azure OpenAI config not set, using fallback case');
    return getFallbackCase();
  }

  const parsed = await generateStructuredContent({
    models: [CASE_GENERATION_MODEL],
    contents: CASE_GENERATION_PROMPT,
    schema: CASE_GENERATION_RESPONSE_SCHEMA,
    parse: parseGeneratedCaseResponse,
    validate: validateCaseData,
    config: {
      reasoningEffort: CASE_GENERATION_REASONING_EFFORT,
    },
  });

  return parsed;
}

function parseGeneratedCaseResponse(raw: string): GeneratedCaseData {
  const text = raw.trim();
  if (!text) throw new Error('Empty model response');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Structured model response was not valid JSON');
  }

  return parsed as GeneratedCaseData;
}

function storeCaseInDb(caseData: GeneratedCaseData, metadata: StoredCaseMetadata): string {
  const caseId = uuidv4();
  const correctSuspect = caseData.suspects.find(s => s.isCorrect)!;
  const correctSuspectId = uuidv4();

  const cityNames = caseData.cities.map(c => c.name);
  const handlerPrompt = buildHandlerSystemPrompt({
    crimeDescription: caseData.crime.description,
    correctSuspectName: correctSuspect.name,
    cities: cityNames,
  });

  const insertCase = db.prepare(`
    INSERT INTO cases (id, template_id, template_slug, template_title, source, difficulty, min_level, crime_description, correct_suspect_id, handler_system_prompt, raw_case_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertCity = db.prepare(`
    INSERT INTO cities (id, case_id, name, country, latitude, longitude, visit_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertWitness = db.prepare(`
    INSERT INTO witnesses (id, city_id, case_id, name, personality, backstory, knowledge, voice_description, system_prompt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSuspect = db.prepare(`
    INSERT INTO suspects (id, case_id, name, description, is_correct)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertClue = db.prepare(`
    INSERT INTO clues (id, case_id, witness_id, content, is_misleading, points_to_city_id, points_to_suspect_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertCase.run(
      caseId,
      metadata.templateId,
      metadata.slug,
      metadata.title,
      metadata.source,
      metadata.difficulty,
      metadata.minLevel,
      caseData.crime.description,
      correctSuspectId,
      handlerPrompt,
      JSON.stringify(caseData)
    );

    const cityIdMap = new Map<string, string>();
    const witnessIdMap = new Map<string, string>();
    const suspectIdMap = new Map<string, string>();

    caseData.cities.forEach((city, index) => {
      const cityId = uuidv4();
      cityIdMap.set(city.name, cityId);
      insertCity.run(cityId, caseId, city.name, city.country, city.lat, city.lng, index + 1);

      for (const witness of city.witnesses) {
        const witnessId = uuidv4();
        witnessIdMap.set(witness.name, witnessId);
        const systemPrompt = buildWitnessSystemPrompt({
          name: witness.name,
          personality: witness.personality,
          backstory: witness.backstory,
          knowledge: witness.knowledge,
          cityName: city.name,
          cityCountry: city.country,
          demeanor: witness.demeanor,
          speechStyle: witness.speechStyle,
          quirks: witness.quirks,
          emotionalState: witness.emotionalState,
          relationshipToCrime: witness.relationshipToCrime,
          voiceDescription: witness.voiceDescription,
        });
        insertWitness.run(witnessId, cityId, caseId, witness.name, witness.personality, witness.backstory, JSON.stringify(witness.knowledge), witness.voiceDescription, systemPrompt);
      }
    });

    for (const suspect of caseData.suspects) {
      const suspectId = suspect.isCorrect ? correctSuspectId : uuidv4();
      suspectIdMap.set(suspect.name, suspectId);
      insertSuspect.run(suspectId, caseId, suspect.name, suspect.description, suspect.isCorrect ? 1 : 0);
    }

    for (const clue of caseData.clues) {
      const clueId = uuidv4();
      const witnessId = witnessIdMap.get(clue.witnessName) || null;
      const pointsToCityId = clue.pointsToCity ? cityIdMap.get(clue.pointsToCity) || null : null;
      const pointsToSuspectId = clue.pointsToSuspect ? suspectIdMap.get(clue.pointsToSuspect) || null : null;
      insertClue.run(clueId, caseId, witnessId, clue.content, clue.isMisleading ? 1 : 0, pointsToCityId, pointsToSuspectId);
    }
  });

  transaction();
  return caseId;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateCase(): Promise<string> {
  const seededCase = claimSeedCase();
  if (seededCase) {
    try {
      const caseId = storeCaseInDb(seededCase.data, {
        templateId: seededCase.templateId,
        slug: seededCase.slug,
        title: seededCase.title,
        source: 'seed',
        difficulty: seededCase.difficulty,
        minLevel: seededCase.minLevel,
      });
      console.log(`Using seeded case: ${seededCase.title} (${seededCase.slug})`);
      return caseId;
    } catch (err) {
      releaseSeedCase(seededCase.templateId);
      throw err;
    }
  }

  if (!AI_CASE_GENERATION_ENABLED) {
    const fallbackCase = getFallbackCaseData();
    console.warn('Seed case pool unavailable, using deterministic fallback seed case');
    return storeCaseInDb(fallbackCase, {
      templateId: null,
      slug: 'fallback-seed-case',
      title: 'Fallback Seed Case',
      source: 'seed',
      difficulty: 1,
      minLevel: 1,
    });
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await sleep(2000);
      const caseData = await callTextModel();
      const caseId = storeCaseInDb(caseData, buildGeneratedCaseMetadata(caseData));
      console.log(`Using AI-generated case with deployment ${CASE_GENERATION_MODEL}`);
      return caseId;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError!;
}

export function createCaseFromSeedTemplate(templateId: string, playerLevel: number): string | null {
  const seededCase = claimSeedCaseById(templateId, playerLevel);
  if (!seededCase) return null;

  try {
    return storeCaseInDb(seededCase.data, {
      templateId: seededCase.templateId,
      slug: seededCase.slug,
      title: seededCase.title,
      source: 'seed',
      difficulty: seededCase.difficulty,
      minLevel: seededCase.minLevel,
    });
  } catch (error) {
    releaseSeedCase(seededCase.templateId);
    throw error;
  }
}
