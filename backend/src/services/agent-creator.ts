import db from '../db';
import type { ElevenLabs } from '@elevenlabs/elevenlabs-js';
import { buildHandlerFirstMessage, buildHandlerSystemPrompt } from './handler-agent-config';
import { buildBoardHandlerFirstMessage, buildBoardHandlerSystemPrompt } from './handler-board-config';
import { createElevenLabsClient, hasElevenLabsApiKey } from './elevenlabs';
import { ensureWitnessVoiceId } from './voice-design';

const DEFAULT_HANDLER_VOICE_ID = 'MOzcTXRqxY5JuCSQXZk9';
const FALLBACK_WITNESS_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

const DEFAULT_AGENT_TTS_MODEL_ID = 'eleven_v3_conversational';

/* Use Eleven v3 Conversational for every live agent voice, including Vivienne
  and all witness agents. */
const WITNESS_TTS_CONFIG = {
  modelId: DEFAULT_AGENT_TTS_MODEL_ID,
  stability: 0.45,
  similarityBoost: 0.85,
  speed: 1.0,
} satisfies Omit<TtsConfig, 'voiceId'>;

interface PlatformSettings {
  overrides?: {
    conversationConfigOverride?: {
      agent?: {
        prompt?: {
          prompt?: boolean;
        };
      };
    };
  };
}

interface TtsConfig {
  voiceId: string;
  modelId?: ElevenLabs.TtsConversationalModel;
  stability?: number;
  speed?: number;
  similarityBoost?: number;
}

interface SystemToolConfig {
  type: 'system';
  name: 'end_call';
  description?: string;
  params: {
    systemToolType: 'end_call';
  };
}

const HANDLER_TTS_CONFIG = {
  modelId: DEFAULT_AGENT_TTS_MODEL_ID,
  stability: 0.72,
  speed: 0.98,
  similarityBoost: 0.78,
} satisfies Omit<TtsConfig, 'voiceId'>;

function getHandlerVoiceId(): string {
  return process.env.ELEVENLABS_HANDLER_VOICE_ID || DEFAULT_HANDLER_VOICE_ID;
}

async function createElevenLabsAgent(
  name: string,
  systemPrompt: string,
  firstMessage: string,
  ttsConfig: TtsConfig,
  platformSettings?: PlatformSettings,
  tools?: SystemToolConfig[],
): Promise<string | null> {
  if (!hasElevenLabsApiKey()) {
    console.warn('ELEVENLABS_API_KEY not set, skipping agent creation');
    return null;
  }

  try {
    return await requestCreateElevenLabsAgent(
      name,
      systemPrompt,
      firstMessage,
      ttsConfig,
      platformSettings,
      tools,
    );
  } catch (err) {
    console.error(`ElevenLabs agent creation error for ${name}:`, err);
    return null;
  }
}

async function updateElevenLabsAgent(
  agentId: string,
  systemPrompt: string,
  firstMessage: string,
  ttsConfig: TtsConfig,
  platformSettings?: PlatformSettings,
  tools?: SystemToolConfig[],
): Promise<boolean> {
  if (!hasElevenLabsApiKey()) return false;

  try {
    const client = createElevenLabsClient();
    await client.conversationalAi.agents.update(
      agentId,
      buildAgentPayload(null, systemPrompt, firstMessage, ttsConfig, platformSettings, tools),
    );
    return true;
  } catch (err) {
    console.error(`ElevenLabs agent update error for ${agentId}:`, err);
    return false;
  }
}

function getHandlerPlatformSettings(): PlatformSettings {
  return {
    overrides: {
      conversationConfigOverride: {
        agent: {
          prompt: {
            prompt: true,
          },
        },
      },
    },
  };
}

function getHandlerTtsConfig(): TtsConfig {
  return {
    voiceId: getHandlerVoiceId(),
    ...HANDLER_TTS_CONFIG,
  };
}

function createSilentEndCallTool(description: string): SystemToolConfig {
  return {
    type: 'system',
    name: 'end_call',
    description,
    // Omit toolCallSound so ElevenLabs does not play a tool-call sound.
    params: {
      systemToolType: 'end_call',
    },
  };
}

function getVivienneSystemTools(): SystemToolConfig[] {
  return [
    createSilentEndCallTool(
      'Use this only when the user clearly indicates they are done, says goodbye, says they have no more questions, asks to close the channel, or is unavailable after the opening check-in. Never use it just because several questions have been answered. Include a concise reason and the final spoken farewell message.'
    ),
  ];
}

function getWitnessSystemTools(): SystemToolConfig[] {
  return [
    createSilentEndCallTool(
      'Use this only when the detective clearly indicates they are done, says goodbye, says they have no more questions, asks to close the channel, or is unavailable after your opening line. Never use it just because you answered a few questions or revealed a clue. Include a concise reason and the final spoken farewell message in character.'
    ),
  ];
}

function buildWitnessAgentPrompt(systemPrompt: string, witnessName: string): string {
  return `${systemPrompt}

## Session context
- Detective codename: {{detective_codename}}
- Stored witness memory: {{stored_witness_memory}}
- Previously confirmed details from this witness: {{known_witness_intel}}
- Current visit status: {{witness_visit_status}}

## Memory and clue handling
- Treat stored_witness_memory and known_witness_intel as real context from earlier calls with the same detective.
- If there is prior memory, acknowledge familiarity naturally without quoting the note verbatim.
- The detective can already see generic lead cards outside the call. Use the conversation to reveal the concrete details you personally know behind those leads.
- Answer naturally and in character. Do not dump every detail at once unless the detective asks for a full account.

## Call closing
- Stay available until the detective clearly closes the conversation or becomes unavailable after your opening line.
- Do not end the call just because you answered several questions or revealed a clue.
- If the detective says goodbye, says they are done, says they have no more questions, thanks you and closes the conversation, or asks to end the channel, give a short in-character farewell and call the system tool end_call.
- If there is only silence or unclear audio after your opening line, call the system tool end_call with the reason "detective unavailable" and a short in-character farewell.
- When ending the exchange, call the system tool end_call with a short reason and the final spoken farewell message. Keep the farewell concise and fully in character as ${witnessName}.`;
}

function getHandlerAgentConfig(caseId: string): { systemPrompt: string; firstMessage: string; ttsConfig: TtsConfig } | null {
  const caseRow = db.prepare('SELECT crime_description, correct_suspect_id FROM cases WHERE id = ?').get(caseId) as any;
  if (!caseRow) return null;

  const correctSuspect = db.prepare('SELECT name FROM suspects WHERE id = ?').get(caseRow.correct_suspect_id) as any;
  const cities = db.prepare('SELECT name FROM cities WHERE case_id = ? ORDER BY visit_order').all(caseId) as Array<{ name: string }>;

  const systemPrompt = buildHandlerSystemPrompt({
    crimeDescription: caseRow.crime_description,
    correctSuspectName: correctSuspect?.name || 'Unknown suspect',
    cities: cities.map(city => city.name),
  });

  return {
    systemPrompt,
    firstMessage: buildHandlerFirstMessage(),
    ttsConfig: getHandlerTtsConfig(),
  };
}

export async function createHandlerAgent(caseId: string): Promise<void> {
  const config = getHandlerAgentConfig(caseId);
  if (!config) return;

  const agentId = await createElevenLabsAgent(
    'Vivienne (Handler)',
    config.systemPrompt,
    config.firstMessage,
    config.ttsConfig,
    getHandlerPlatformSettings(),
    getVivienneSystemTools(),
  );

  if (agentId) {
    db.prepare('UPDATE cases SET handler_system_prompt = ? WHERE id = ?').run(config.systemPrompt, caseId);
    db.prepare('UPDATE cases SET handler_agent_id = ? WHERE id = ?').run(agentId, caseId);
  }
}

export async function syncHandlerAgent(caseId: string, agentId: string): Promise<boolean> {
  const config = getHandlerAgentConfig(caseId);
  if (!config) return false;

  const synced = await updateElevenLabsAgent(
    agentId,
    config.systemPrompt,
    config.firstMessage,
    config.ttsConfig,
    getHandlerPlatformSettings(),
    getVivienneSystemTools(),
  );

  if (synced) {
    db.prepare('UPDATE cases SET handler_system_prompt = ? WHERE id = ?').run(config.systemPrompt, caseId);
  }

  return synced;
}

const BOARD_HANDLER_AGENT_SETTING_KEY = 'board_handler_agent_id';

function readSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function writeSetting(key: string, value: string): void {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value);
}

export async function ensureBoardHandlerAgent(): Promise<string | null> {
  const systemPrompt = buildBoardHandlerSystemPrompt();
  const firstMessage = buildBoardHandlerFirstMessage();
  const ttsConfig = getHandlerTtsConfig();
  const platformSettings = getHandlerPlatformSettings();

  const existing = readSetting(BOARD_HANDLER_AGENT_SETTING_KEY);
  if (existing) {
    void updateElevenLabsAgent(existing, systemPrompt, firstMessage, ttsConfig, platformSettings, getVivienneSystemTools());
    return existing;
  }

  const agentId = await createElevenLabsAgent(
    'Vivienne (Board)',
    systemPrompt,
    firstMessage,
    ttsConfig,
    platformSettings,
    getVivienneSystemTools(),
  );

  if (agentId) {
    writeSetting(BOARD_HANDLER_AGENT_SETTING_KEY, agentId);
  }

  return agentId;
}

export async function createWitnessAgent(witnessId: string): Promise<string | null> {
  const witness = db
    .prepare('SELECT id, name, system_prompt, agent_id FROM witnesses WHERE id = ?')
    .get(witnessId) as { id: string; name: string; system_prompt: string; agent_id: string | null } | undefined;
  if (!witness) return null;
  if (witness.agent_id) return witness.agent_id;

  // 1) Make sure the witness has a designed voice that matches their description.
  let designedVoiceId: string | null = null;
  try {
    designedVoiceId = await ensureWitnessVoiceId(witnessId);
  } catch (err) {
    console.error(`Voice design failed for witness ${witnessId}:`, err);
  }
  const voiceId = designedVoiceId || FALLBACK_WITNESS_VOICE_ID;

  // 2) Create the ConvAI agent bound to that voice + the witness's system prompt.
  //    Uses the strict creator so failures surface to the caller.
  const agentId = await createElevenLabsAgentStrict(
    witness.name,
    buildWitnessAgentPrompt(witness.system_prompt, witness.name),
    buildWitnessFirstMessage(witness.name),
    {
      voiceId,
      ...WITNESS_TTS_CONFIG,
    },
    getWitnessPlatformSettings(),
    getWitnessSystemTools(),
  );

  db.prepare('UPDATE witnesses SET agent_id = ? WHERE id = ?').run(agentId, witnessId);
  return agentId;
}

/* Throws on failure (vs createElevenLabsAgent which returns null).
   Used for the witness lazy-provisioning path so the API can surface the real error. */
async function createElevenLabsAgentStrict(
  name: string,
  systemPrompt: string,
  firstMessage: string,
  ttsConfig: TtsConfig,
  platformSettings?: PlatformSettings,
  tools?: SystemToolConfig[],
): Promise<string> {
  if (!hasElevenLabsApiKey()) throw new Error('ELEVENLABS_API_KEY is not set on the server');

  return await requestCreateElevenLabsAgent(
    name,
    systemPrompt,
    firstMessage,
    ttsConfig,
    platformSettings,
    tools,
  );
}

/* In-flight dedupe so two simultaneous calls to ensureWitnessAgentId
   don't both create an ElevenLabs agent for the same witness. */
const pendingWitnessAgents = new Map<string, Promise<string | null>>();

export async function syncWitnessAgent(witnessId: string, agentId: string): Promise<boolean> {
  const witness = db
    .prepare('SELECT name, system_prompt FROM witnesses WHERE id = ?')
    .get(witnessId) as { name: string; system_prompt: string } | undefined;
  if (!witness) return false;

  const voiceId = (await ensureWitnessVoiceId(witnessId)) || FALLBACK_WITNESS_VOICE_ID;

  return await updateElevenLabsAgent(
    agentId,
    buildWitnessAgentPrompt(witness.system_prompt, witness.name),
    buildWitnessFirstMessage(witness.name),
    {
      voiceId,
      ...WITNESS_TTS_CONFIG,
    },
    getWitnessPlatformSettings(),
    getWitnessSystemTools(),
  );
}

/** Lazy: returns an existing agent_id, otherwise designs a voice + creates one.
 *  Concurrent callers for the same witness share a single in-flight promise. */
export async function ensureWitnessAgentId(witnessId: string): Promise<string | null> {
  const row = db.prepare('SELECT agent_id FROM witnesses WHERE id = ?').get(witnessId) as { agent_id: string | null } | undefined;
  if (!row) return null;
  if (row.agent_id) return row.agent_id;
  if (!hasElevenLabsApiKey()) {
    throw new Error('ELEVENLABS_API_KEY is not set on the server');
  }

  const inFlight = pendingWitnessAgents.get(witnessId);
  if (inFlight) return inFlight;

  const promise = createWitnessAgent(witnessId)
    .then(agentId => {
      if (!agentId) {
        throw new Error('ElevenLabs agent creation returned no id (check backend logs).');
      }
      return agentId;
    })
    .finally(() => {
      pendingWitnessAgents.delete(witnessId);
    });

  pendingWitnessAgents.set(witnessId, promise);
  return promise;
}

function buildWitnessFirstMessage(name: string): string {
  return `Yes? I'm ${name}. What do you want to ask me?`;
}

function buildAgentPayload(
  name: string | null,
  systemPrompt: string,
  firstMessage: string,
  ttsConfig: TtsConfig,
  platformSettings?: PlatformSettings,
  tools?: SystemToolConfig[],
) {
  return {
    ...(name ? { name: `Atlas Cipher - ${name}` } : {}),
    conversationConfig: {
      agent: {
        prompt: {
          prompt: systemPrompt,
          ...(tools?.length ? { tools } : {}),
        },
        firstMessage,
      },
      tts: ttsConfig,
    },
    platformSettings,
  };
}

async function requestCreateElevenLabsAgent(
  name: string,
  systemPrompt: string,
  firstMessage: string,
  ttsConfig: TtsConfig,
  platformSettings?: PlatformSettings,
  tools?: SystemToolConfig[],
): Promise<string> {
  const client = createElevenLabsClient();
  const data = await client.conversationalAi.agents.create(
    buildAgentPayload(name, systemPrompt, firstMessage, ttsConfig, platformSettings, tools),
  );

  if (!data.agentId) {
    throw new Error(`ElevenLabs returned no agent_id for ${name}`);
  }

  return data.agentId;
}

function getWitnessPlatformSettings(): PlatformSettings {
  return {
    overrides: {
      conversationConfigOverride: {
        agent: {
          prompt: { prompt: true },
        },
      },
    },
  };
}
