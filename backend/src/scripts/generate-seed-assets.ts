import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImageContent, hasImageGenerationConfig } from '../services/ai';
import { buildCityPanoramaPrompt, buildCityScenePrompt } from '../services/image-prompts';
import { getSeedCaseTemplateById } from '../services/seed-case-pool';

const DEFAULT_TEMPLATE_ID = 'seed-star-of-carthage';
const DEFAULT_MODEL = process.env.AZURE_OPENAI_IMAGE_MODEL || 'gpt-image-2';
const GENERATION_BATCH_SIZE = 5;
const PANORAMA_IMAGE_QUALITY = 'medium';
const SCENE_IMAGE_QUALITY = 'medium';
const PORTRAIT_IMAGE_QUALITY = 'low';
const IMAGE_OUTPUT_MIME_TYPE = 'image/jpeg';
const IMAGE_OUTPUT_EXTENSION = 'jpg';
const SCENE_OUTPUT_COMPRESSION_QUALITY = 86;
const PORTRAIT_OUTPUT_COMPRESSION_QUALITY = 88;
const PANORAMA_OUTPUT_COMPRESSION_QUALITY = 82;
const DEFAULT_OUTPUT_ROOT = fileURLToPath(new URL('../../../frontend/public/assets/seeds/', import.meta.url));
const BASE_NEGATIVE_PROMPT = [
  'illustration',
  'painting',
  'realistic painting',
  'digital painting',
  'oil painting',
  'acrylic painting',
  'brush strokes',
  'matte painting',
  'cartoon',
  'anime',
  '3d render',
  'cgi',
  'text overlay',
  'caption',
  'logo',
  'watermark',
  'blurry face',
  'extra fingers',
  'deformed anatomy',
  'duplicate person',
  'low detail',
].join(', ');
const PANORAMA_NEGATIVE_PROMPT = [
  BASE_NEGATIVE_PROMPT,
  'fisheye distortion',
  'tiny planet projection',
  'hard seam',
  'visible stitching line',
  'mirrored edges',
  'duplicate landmark',
  'repeated people',
  'warped horizon',
  'broken perspective',
].join(', ');
const PORTRAIT_NEGATIVE_PROMPT = [
  BASE_NEGATIVE_PROMPT,
  'beauty retouch',
  'airbrushed skin',
  'plastic skin',
  'porcelain skin',
  'glamour illustration',
  'concept art',
  'fantasy lighting',
  'game art',
  'stylized face',
  'over-sharpened',
  'oversmoothed skin',
].join(', ');

interface CliOptions {
  templateId: string;
  outputRoot: string;
  overwrite: boolean;
  portraitsOnly: boolean;
  panoramasOnly: boolean;
  cityVisualsOnly: boolean;
}

interface ManifestEntry {
  type: 'scene' | 'panorama' | 'portrait';
  city: string;
  witness?: string;
  relativePath: string;
  publicUrl: string;
  prompt: string;
  status: 'generated' | 'skipped';
}

interface AssetJob {
  kind: 'scene' | 'panorama' | 'portrait';
  diskPath: string;
  prompt: string;
  logLabel: string;
  entry: Omit<ManifestEntry, 'status'>;
}

interface AssetManifest {
  templateId: string;
  slug: string;
  title: string;
  generatedAt: string;
  model: string;
  style: string;
  entries: ManifestEntry[];
}

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch (error) {
  console.warn('Failed to load backend .env file:', error);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const template = getSeedCaseTemplateById(options.templateId);

  if (!template) {
    throw new Error(`Unknown seed template: ${options.templateId}`);
  }

  if (!hasImageGenerationConfig()) {
    throw new Error('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are required to generate seed assets.');
  }

  const targetRoot = path.join(options.outputRoot, template.slug);
  const sceneDir = path.join(targetRoot, 'cities');
  const panoramaDir = path.join(targetRoot, 'panoramas');
  const portraitDir = path.join(targetRoot, 'witnesses');

  await mkdir(sceneDir, { recursive: true });
  await mkdir(panoramaDir, { recursive: true });
  await mkdir(portraitDir, { recursive: true });

  const manifest: AssetManifest = {
    templateId: template.templateId,
    slug: template.slug,
    title: template.title,
    generatedAt: new Date().toISOString(),
    model: DEFAULT_MODEL,
    style: 'Photorealistic editorial stills and immersive 360 evidence panoramas for a contemporary global investigation game.',
    entries: [],
  };

  const jobs: AssetJob[] = [];
  const includeScenes = !options.portraitsOnly && !options.panoramasOnly;
  const includePanoramas = !options.portraitsOnly;
  const includePortraits = !options.panoramasOnly && !options.cityVisualsOnly;

  for (const [cityIndex, city] of template.data.cities.entries()) {
    const cityWitnessNames = new Set(city.witnesses.map(witness => witness.name));
    const cityWitnessBackstories = city.witnesses.map(witness => witness.backstory);
    const cityClueFacts = template.data.clues
      .filter(clue => !clue.isMisleading && (clue.pointsToCity === city.name || cityWitnessNames.has(clue.witnessName)))
      .map(clue => clue.content);
    const cityEvidenceFacts = cityClueFacts.length > 0
      ? cityClueFacts
      : city.witnesses.flatMap(witness => witness.knowledge);

    if (includeScenes) {
      const sceneFileName = `${String(cityIndex + 1).padStart(2, '0')}-${slugify(city.name)}-scene.${IMAGE_OUTPUT_EXTENSION}`;
      const sceneRelativePath = path.posix.join('cities', sceneFileName);
      const sceneDiskPath = path.join(sceneDir, sceneFileName);
      const scenePrompt = buildCityScenePrompt({
        caseTemplateId: template.templateId,
        cityName: city.name,
        country: city.country,
        witnessBackstories: cityWitnessBackstories,
      });
      jobs.push({
        kind: 'scene',
        diskPath: sceneDiskPath,
        prompt: scenePrompt,
        logLabel: `scene ${city.name}`,
        entry: {
          type: 'scene',
          city: city.name,
          relativePath: sceneRelativePath,
          publicUrl: toPublicUrl(template.slug, sceneRelativePath),
          prompt: scenePrompt,
        },
      });
    }

    if (includePanoramas) {
      const panoramaFileName = `${String(cityIndex + 1).padStart(2, '0')}-${slugify(city.name)}-panorama.${IMAGE_OUTPUT_EXTENSION}`;
      const panoramaRelativePath = path.posix.join('panoramas', panoramaFileName);
      const panoramaDiskPath = path.join(panoramaDir, panoramaFileName);
      const panoramaPrompt = buildCityPanoramaPrompt({
        caseTemplateId: template.templateId,
        cityName: city.name,
        country: city.country,
        caseSummary: template.data.crime.summary || template.data.crime.description,
        witnessBackstories: cityWitnessBackstories,
        evidenceFacts: cityEvidenceFacts,
      });
      jobs.push({
        kind: 'panorama',
        diskPath: panoramaDiskPath,
        prompt: panoramaPrompt,
        logLabel: `panorama ${city.name}`,
        entry: {
          type: 'panorama',
          city: city.name,
          relativePath: panoramaRelativePath,
          publicUrl: toPublicUrl(template.slug, panoramaRelativePath),
          prompt: panoramaPrompt,
        },
      });
    }

    if (includePortraits) {
      for (const witness of city.witnesses) {
        const portraitFileName = `${slugify(city.name)}-${slugify(witness.name)}-portrait.${IMAGE_OUTPUT_EXTENSION}`;
        const portraitRelativePath = path.posix.join('witnesses', portraitFileName);
        const portraitDiskPath = path.join(portraitDir, portraitFileName);
        const portraitPrompt = buildWitnessPrompt(city.name, city.country, witness.name, witness.personality, witness.backstory, witness.voiceDescription);
        jobs.push({
          kind: 'portrait',
          diskPath: portraitDiskPath,
          prompt: portraitPrompt,
          logLabel: `portrait ${witness.name}`,
          entry: {
            type: 'portrait',
            city: city.name,
            witness: witness.name,
            relativePath: portraitRelativePath,
            publicUrl: toPublicUrl(template.slug, portraitRelativePath),
            prompt: portraitPrompt,
          },
        });
      }
    }
  }

  for (let batchStart = 0; batchStart < jobs.length; batchStart += GENERATION_BATCH_SIZE) {
    const batch = jobs.slice(batchStart, batchStart + GENERATION_BATCH_SIZE);
    const statuses = await Promise.all(batch.map((job, batchIndex) => generateAsset({
      kind: job.kind,
      diskPath: job.diskPath,
      prompt: job.prompt,
      overwrite: options.overwrite,
      logLabel: job.logLabel,
      total: jobs.length,
      itemNumber: batchStart + batchIndex + 1,
    })));

    for (const [batchIndex, job] of batch.entries()) {
      const status = statuses[batchIndex];
      if (!status) {
        throw new Error(`Missing generation result for ${job.logLabel}`);
      }

      manifest.entries.push({
        ...job.entry,
        status,
      });
    }
  }

  const manifestPath = path.join(targetRoot, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const generatedCount = manifest.entries.filter(entry => entry.status === 'generated').length;
  const skippedCount = manifest.entries.length - generatedCount;
  console.log(`Seed asset manifest written to ${manifestPath}`);
  console.log(`Finished ${template.title}: generated=${generatedCount}, skipped=${skippedCount}, total=${manifest.entries.length}`);
}

function parseArgs(argv: string[]): CliOptions {
  let templateId = DEFAULT_TEMPLATE_ID;
  let outputRoot = DEFAULT_OUTPUT_ROOT;
  let overwrite = false;
  let portraitsOnly = false;
  let panoramasOnly = false;
  let cityVisualsOnly = false;

  for (const arg of argv) {
    if (arg.startsWith('--template=')) {
      templateId = arg.slice('--template='.length) || templateId;
      continue;
    }

    if (arg.startsWith('--out=')) {
      outputRoot = path.resolve(arg.slice('--out='.length) || outputRoot);
      continue;
    }

    if (arg === '--force') {
      overwrite = true;
      continue;
    }

    if (arg === '--portraits-only') {
      portraitsOnly = true;
      continue;
    }

    if (arg === '--panoramas-only') {
      panoramasOnly = true;
      continue;
    }

    if (arg === '--city-visuals-only') {
      cityVisualsOnly = true;
    }
  }

  if ([portraitsOnly, panoramasOnly, cityVisualsOnly].filter(Boolean).length > 1) {
    throw new Error('Use only one selective mode: --portraits-only, --panoramas-only, or --city-visuals-only.');
  }

  return { templateId, outputRoot, overwrite, portraitsOnly, panoramasOnly, cityVisualsOnly };
}

function buildWitnessPrompt(
  cityName: string,
  country: string,
  witnessName: string,
  personality: string,
  backstory: string,
  voiceDescription: string,
): string {
  return [
    'Create a documentary-style photographic portrait.',
    `Subject: ${witnessName}.`,
    `Location context: ${cityName}, ${country}.`,
    `Personality: ${personality}.`,
    `Backstory: ${backstory}.`,
    `Voice and age cues: ${voiceDescription}.`,
    'Head-and-shoulders framing, single believable adult subject, authentic editorial photography, DSLR or medium-format camera look, 85mm lens, shallow depth of field, realistic skin pores, subtle asymmetry, natural eye detail, unretouched newsroom portrait, practical lighting, true-to-life fabric texture, subtle environmental background.',
    'This must read as a real photograph, not an illustration or painted image.',
    'No text, no frame, no watermark, no exaggerated stylization, no fantasy costume, no painterly texture, no synthetic cinematic grading.',
  ].join(' ');
}

async function generateAsset(input: {
  kind: 'scene' | 'panorama' | 'portrait';
  diskPath: string;
  prompt: string;
  overwrite: boolean;
  logLabel: string;
  total: number;
  itemNumber: number;
}): Promise<'generated' | 'skipped'> {
  if (!input.overwrite && await fileExists(input.diskPath)) {
    console.log(`[${input.itemNumber}/${input.total}] Skipping existing ${input.logLabel}`);
    return 'skipped';
  }

  console.log(`[${input.itemNumber}/${input.total}] Generating ${input.logLabel}`);
  const imageData = await generateImageBuffer(input.prompt, input.kind);
  await writeFile(input.diskPath, imageData);
  return 'generated';
}

async function generateImageBuffer(prompt: string, kind: 'scene' | 'panorama' | 'portrait'): Promise<Buffer> {
  return generateImageContent({
    models: [DEFAULT_MODEL],
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio: kind === 'scene' ? '16:9' : kind === 'portrait' ? '3:4' : undefined,
      imageSize: kind === 'panorama' ? '3840x1920' : undefined,
      outputMimeType: IMAGE_OUTPUT_MIME_TYPE,
      outputCompressionQuality: kind === 'scene'
        ? SCENE_OUTPUT_COMPRESSION_QUALITY
        : kind === 'panorama'
          ? PANORAMA_OUTPUT_COMPRESSION_QUALITY
          : PORTRAIT_OUTPUT_COMPRESSION_QUALITY,
      quality: kind === 'scene'
        ? SCENE_IMAGE_QUALITY
        : kind === 'panorama'
          ? PANORAMA_IMAGE_QUALITY
          : PORTRAIT_IMAGE_QUALITY,
      style: 'natural',
      negativePrompt: kind === 'portrait'
        ? PORTRAIT_NEGATIVE_PROMPT
        : kind === 'panorama'
          ? PANORAMA_NEGATIVE_PROMPT
          : BASE_NEGATIVE_PROMPT,
    },
    transform: response => {
      const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
      return imageBytes ? Buffer.from(imageBytes, 'base64') : null;
    },
    onModelError: (model, error) => {
      console.error(`Seed asset generation failed on ${model}:`, error);
    },
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const file = await stat(filePath);
    return file.isFile();
  } catch {
    return false;
  }
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toPublicUrl(seedSlug: string, relativePath: string): string {
  return `/assets/seeds/${seedSlug}/${relativePath.replace(/\\/g, '/')}`;
}

await main().catch(error => {
  console.error('Seed asset generation failed:', error);
  process.exitCode = 1;
});