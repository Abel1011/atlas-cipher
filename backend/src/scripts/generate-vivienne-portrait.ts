import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImageContent, hasImageGenerationConfig } from '../services/ai';

const DEFAULT_MODEL = process.env.AZURE_OPENAI_IMAGE_MODEL || 'gpt-image-2';
const DEFAULT_OUTPUT_PATH = fileURLToPath(
  new URL('../../../frontend/public/assets/characters/vivienne-ashcroft.jpg', import.meta.url)
);
const IMAGE_OUTPUT_MIME_TYPE = 'image/jpeg';
const OUTPUT_COMPRESSION_QUALITY = 90;
const NEGATIVE_PROMPT = [
  'illustration',
  'painting',
  'cartoon',
  'anime',
  '3d render',
  'watermark',
  'text overlay',
  'collage',
  'glamour retouch',
  'airbrushed skin',
  'fantasy costume',
  'spy catsuit',
  'film grain overload',
  'heavy noir shadows',
  'cyberpunk holograms',
  'sci-fi control room',
  'painterly texture',
].join(', ');
const VIVIENNE_PROMPT = [
  'Create a documentary-style photographic portrait for a modern global investigation game.',
  'Subject: Vivienne Ashcroft, an elite British mission handler in her mid 20s with a striking femme fatale presence.',
  'Appearance: beautiful blonde woman, vivid blue eyes, refined bone structure, poised expression, pageant-level elegance, luxurious but believable contemporary beauty.',
  'She should read like a modern Miss Universe finalist turned intelligence handler: polished, magnetic, dangerous, and impossible to ignore.',
  'Wardrobe: impeccably tailored dark blazer, sleek silk blouse, discreet in-ear comms, understated luxury styling, no visible logos, no excessive jewelry.',
  'Hair and makeup: luminous blonde hair styled with soft volume, immaculate complexion, subtle high-end makeup, defined eyes, sophisticated natural glam.',
  'Framing: head-and-shoulders portrait, eye-level camera, slight three-quarter angle, believable adult subject, premium editorial 85mm lens rendering.',
  'Lighting: flattering cinematic soft light with cool operations-room spill, realistic skin texture, sharp eye detail, premium fashion-editorial photography without looking synthetic.',
  'Background: elegant London operations center with softly blurred glass, maps, and command screens, grounded and upscale rather than futuristic.',
  'Mood: seductive in presence but controlled in expression, intelligent, composed, high-status, operational, modern spy glamour.',
  'This must read as a real photograph, not an illustration. No text, no watermark, no frame, no exaggerated cinematic grading.',
].join(' ');

interface CliOptions {
  outputPath: string;
  force: boolean;
}

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch (error) {
  console.warn('Failed to load backend .env file:', error);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const metadataPath = path.join(path.dirname(options.outputPath), 'vivienne-ashcroft.json');

  if (!hasImageGenerationConfig()) {
    throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are required to generate Vivienne portrait assets.');
  }

  await mkdir(path.dirname(options.outputPath), { recursive: true });

  if (!options.force && await fileExists(options.outputPath)) {
    console.log(`Skipping existing Vivienne portrait at ${options.outputPath}`);
    return;
  }

  const imageData = await generateImageContent({
    models: [DEFAULT_MODEL],
    prompt: VIVIENNE_PROMPT,
    config: {
      numberOfImages: 1,
      aspectRatio: '3:4',
      outputMimeType: IMAGE_OUTPUT_MIME_TYPE,
      outputCompressionQuality: OUTPUT_COMPRESSION_QUALITY,
      quality: 'medium',
      style: 'natural',
      negativePrompt: NEGATIVE_PROMPT,
    },
    transform: response => {
      const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
      return imageBytes ? Buffer.from(imageBytes, 'base64') : null;
    },
    onModelError: (model, error) => {
      console.error(`Vivienne portrait generation failed on ${model}:`, error);
    },
  });

  await writeFile(options.outputPath, imageData);
  await writeFile(
    metadataPath,
    `${JSON.stringify({
      character: 'Vivienne Ashcroft',
      generatedAt: new Date().toISOString(),
      model: DEFAULT_MODEL,
      output: path.basename(options.outputPath),
      prompt: VIVIENNE_PROMPT,
      negativePrompt: NEGATIVE_PROMPT,
    }, null, 2)}\n`,
    'utf8'
  );

  console.log(`Vivienne portrait written to ${options.outputPath}`);
}

function parseArgs(argv: string[]): CliOptions {
  let outputPath = DEFAULT_OUTPUT_PATH;
  let force = false;

  for (const arg of argv) {
    if (arg.startsWith('--out=')) {
      outputPath = path.resolve(arg.slice('--out='.length) || outputPath);
      continue;
    }

    if (arg === '--force') {
      force = true;
    }
  }

  return { outputPath, force };
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
  console.error('Vivienne portrait generation failed:', error);
  process.exitCode = 1;
});