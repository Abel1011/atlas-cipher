import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateElevenLabsSoundEffect, hasElevenLabsApiKey } from '../services/elevenlabs';

const DEFAULT_OUTPUT_DIR = fileURLToPath(
  new URL('../../../frontend/public/assets/audio', import.meta.url)
);

const SOUND_DEFINITIONS = [
  {
    slug: 'travel-transition',
    description: 'Air travel transition',
    durationSeconds: 5,
    prompt: [
      'Airplane in full flight for a modern global investigation game.',
      'Steady jet engine rumble, pressurized cabin air, smooth cruising altitude, confident travel momentum.',
      'No takeoff, no landing, no airport announcements, no music, no voices, no distortion.',
    ].join(' '),
  },
  {
    slug: 'comms-loading',
    description: 'Phone communication loading loop',
    durationSeconds: 4,
    prompt: [
      'Loopable telephone communication loading sound for a modern intelligence control room.',
      'Subtle phone line ringback pulses, soft telecom hiss, secure call setup feeling, clean and restrained.',
      'No voice, no music, no busy signal, no harsh static, seamless loop.',
    ].join(' '),
  },
  {
    slug: 'handler-open',
    description: 'Handler comms open',
    durationSeconds: 2,
    prompt: [
      'Short secure comms channel open.',
      'Soft radio static crackle followed by one clean connection beep.',
      'Modern intelligence control room tone. No voice, no music.',
    ].join(' '),
  },
  {
    slug: 'clue-reveal',
    description: 'Clue reveal accent',
    durationSeconds: 2,
    prompt: [
      'Short clue discovery sound for a detective interface.',
      'Crisp digital pulse with subtle metallic detail and a confident finish.',
      'Modern, elegant, no music, no voice.',
    ].join(' '),
  },
  {
    slug: 'mission-alert',
    description: 'Mission alert sting',
    durationSeconds: 3,
    prompt: [
      'Brief mission alert sting for a global operations room.',
      'Controlled urgency, modern tech pulse, subtle low-end impact.',
      'No melody, no voice, no music bed.',
    ].join(' '),
  },
] as const;

interface CliOptions {
  outputDir: string;
  force: boolean;
  only: Set<string> | null;
}

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch (error) {
  console.warn('Failed to load backend .env file:', error);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const definitions = selectDefinitions(options.only);

  if (!hasElevenLabsApiKey()) {
    throw new Error('ELEVENLABS_API_KEY is required to generate sound assets.');
  }

  await mkdir(options.outputDir, { recursive: true });

  const manifestEntries: Array<{
    slug: string;
    description: string;
    durationSeconds: number;
    output: string;
    prompt: string;
  }> = [];

  for (const definition of definitions) {
    const outputFileName = `${definition.slug}.mp3`;
    const outputPath = path.join(options.outputDir, outputFileName);

    if (!options.force && await fileExists(outputPath)) {
      console.log(`Skipping existing sound asset at ${outputPath}`);
    } else {
      console.log(`Generating ${definition.slug}...`);
      const audio = await generateElevenLabsSoundEffect(
        definition.prompt,
        definition.durationSeconds
      );
      await writeFile(outputPath, audio);
      console.log(`Wrote ${outputPath}`);
    }

    manifestEntries.push({
      slug: definition.slug,
      description: definition.description,
      durationSeconds: definition.durationSeconds,
      output: outputFileName,
      prompt: definition.prompt,
    });
  }

  const manifestPath = path.join(options.outputDir, 'manifest.json');
  await writeFile(
    manifestPath,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      provider: 'ElevenLabs',
      assets: manifestEntries,
    }, null, 2)}\n`,
    'utf8'
  );

  console.log(`Sound asset manifest written to ${manifestPath}`);
}

function parseArgs(argv: string[]): CliOptions {
  let outputDir = DEFAULT_OUTPUT_DIR;
  let force = false;
  let only: Set<string> | null = null;

  for (const arg of argv) {
    if (arg.startsWith('--out-dir=')) {
      outputDir = path.resolve(arg.slice('--out-dir='.length) || outputDir);
      continue;
    }

    if (arg.startsWith('--only=')) {
      const values = arg
        .slice('--only='.length)
        .split(',')
        .map(value => value.trim())
        .filter(Boolean);

      only = values.length > 0 ? new Set(values) : null;
      continue;
    }

    if (arg === '--force') {
      force = true;
    }
  }

  return { outputDir, force, only };
}

function selectDefinitions(only: Set<string> | null) {
  if (!only) return [...SOUND_DEFINITIONS];

  const selected = SOUND_DEFINITIONS.filter(definition => only.has(definition.slug));
  const missing = [...only].filter(
    slug => !SOUND_DEFINITIONS.some(definition => definition.slug === slug)
  );

  if (missing.length > 0) {
    throw new Error(`Unknown sound asset slug(s): ${missing.join(', ')}`);
  }

  return selected;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const file = await stat(filePath);
    return file.isFile();
  } catch {
    return false;
  }
}

await main().catch(error => {
  console.error('Sound asset generation failed:', error);
  process.exitCode = 1;
});