import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { generateImageContent, hasImageGenerationConfig } from './ai';
import { buildCityPanoramaPrompt, buildCityScenePrompt } from './image-prompts';

const IMAGE_MODEL = process.env.AZURE_OPENAI_IMAGE_MODEL || 'gpt-image-2';
const PANORAMA_IMAGE_QUALITY = 'medium';
const SCENE_IMAGE_QUALITY = 'medium';
const PORTRAIT_IMAGE_QUALITY = 'low';
const IMAGE_OUTPUT_MIME_TYPE = 'image/jpeg';
const SCENE_OUTPUT_COMPRESSION_QUALITY = 86;
const PORTRAIT_OUTPUT_COMPRESSION_QUALITY = 88;
const PANORAMA_OUTPUT_COMPRESSION_QUALITY = 82;
const BASE_NEGATIVE_PROMPT = 'illustration, painting, cartoon, anime, 3d render, watermark, text overlay, collage';
const PANORAMA_NEGATIVE_PROMPT = `${BASE_NEGATIVE_PROMPT}, fisheye distortion, tiny planet projection, visible stitching line, hard seam, mirrored edges, warped horizon, repeated landmark`;
const PORTRAIT_NEGATIVE_PROMPT = `${BASE_NEGATIVE_PROMPT}, glamour retouch, airbrushed skin, painterly texture, fantasy costume`;

const DEFAULT_CASE_SUMMARY = 'A global investigation moving through layered evidence and contested handoffs.';

interface LoadedCityPromptContext {
  caseTemplateId: string | null;
  caseSummary: string;
  witnessBackstories: string[];
  evidenceFacts: string[];
}

async function generateImage(prompt: string, kind: 'portrait' | 'scene' | 'panorama'): Promise<Buffer | null> {
  if (!hasImageGenerationConfig()) return null;

  try {
    return await generateImageContent({
      models: [IMAGE_MODEL],
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
        console.error(`image-generator ${model} failed:`, error);
      },
    });
  } catch {
    return null;
  }
}

function storeAsset(type: string, data: Buffer, mimeType: string, prompt: string): string {
  const id = uuidv4();
  const stmt = db.prepare(
    'INSERT INTO generated_assets (id, type, data, mime_type, prompt) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(id, type, data, mimeType, prompt);
  return id;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function dedupeFacts(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = collapseWhitespace(value).replace(/[.]+$/g, '');
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function parseKnowledgeList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').map(item => collapseWhitespace(item)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function resolveCaseSummary(rawCaseJson: string | null | undefined, crimeDescription: string | null | undefined): string {
  const raw = typeof rawCaseJson === 'string' ? rawCaseJson.trim() : '';
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { crime?: { summary?: unknown; description?: unknown } };
      if (typeof parsed?.crime?.summary === 'string' && parsed.crime.summary.trim()) {
        return parsed.crime.summary.trim();
      }
      if (typeof parsed?.crime?.description === 'string' && parsed.crime.description.trim()) {
        return parsed.crime.description.trim();
      }
    } catch {
      // Fall back to the stored description below.
    }
  }

  if (typeof crimeDescription === 'string' && crimeDescription.trim()) {
    return crimeDescription.trim();
  }

  return DEFAULT_CASE_SUMMARY;
}

function loadCityPromptContext(cityId: string): LoadedCityPromptContext {
  const cityRow = db.prepare(
    `SELECT cities.case_id AS case_id, cases.template_id AS template_id, cases.crime_description AS crime_description, cases.raw_case_json AS raw_case_json
     FROM cities
     JOIN cases ON cases.id = cities.case_id
     WHERE cities.id = ?`
  ).get(cityId) as {
    case_id?: string;
    template_id?: string | null;
    crime_description?: string | null;
    raw_case_json?: string | null;
  } | undefined;

  if (!cityRow?.case_id) {
    return {
      caseTemplateId: null,
      caseSummary: DEFAULT_CASE_SUMMARY,
      witnessBackstories: [],
      evidenceFacts: [],
    };
  }

  const witnessRows = db.prepare(
    'SELECT backstory, knowledge FROM witnesses WHERE city_id = ?'
  ).all(cityId) as Array<{ backstory: string; knowledge: string }>;
  const clueRows = db.prepare(
    `SELECT content, is_misleading
     FROM clues
     WHERE case_id = ?
       AND (
         points_to_city_id = ?
         OR witness_id IN (SELECT id FROM witnesses WHERE city_id = ?)
       )`
  ).all(cityRow.case_id, cityId, cityId) as Array<{ content: string; is_misleading: number }>;

  const clueFacts = clueRows
    .filter(row => row.is_misleading !== 1)
    .map(row => row.content);
  const knowledgeFacts = witnessRows.flatMap(row => parseKnowledgeList(row.knowledge));

  return {
    caseTemplateId: typeof cityRow.template_id === 'string' && cityRow.template_id.trim() ? cityRow.template_id.trim() : null,
    caseSummary: resolveCaseSummary(cityRow.raw_case_json, cityRow.crime_description),
    witnessBackstories: witnessRows.map(row => collapseWhitespace(row.backstory)).filter(Boolean),
    evidenceFacts: dedupeFacts(clueFacts.length > 0 ? clueFacts : knowledgeFacts),
  };
}

export async function generateWitnessPortrait(
  witnessId: string,
  name: string,
  personality: string
): Promise<void> {
  const prompt = [
    `Photographic portrait of ${name}.`,
    `Personality cues: ${personality}.`,
    'Head-and-shoulders framing, believable adult subject, neutral background, natural skin texture, realistic lens rendering, contemporary editorial photography.',
    'No text, no frame, no watermark.',
  ].join(' ');

  const imageData = await generateImage(prompt, 'portrait');
  if (!imageData) {
    console.error(`Failed to generate portrait for witness ${witnessId} (${name})`);
    return;
  }

  const assetId = storeAsset('portrait', imageData, IMAGE_OUTPUT_MIME_TYPE, prompt);
  db.prepare('UPDATE witnesses SET portrait_image_id = ? WHERE id = ?').run(assetId, witnessId);
}

export async function generateCityScene(
  cityId: string,
  cityName: string,
  country: string
): Promise<void> {
  const promptContext = loadCityPromptContext(cityId);
  const prompt = buildCityScenePrompt({
    caseTemplateId: promptContext.caseTemplateId,
    cityName,
    country,
    witnessBackstories: promptContext.witnessBackstories,
  });

  const imageData = await generateImage(prompt, 'scene');
  if (!imageData) {
    console.error(`Failed to generate scene for city ${cityId} (${cityName})`);
    return;
  }

  const assetId = storeAsset('scene', imageData, IMAGE_OUTPUT_MIME_TYPE, prompt);
  db.prepare('UPDATE cities SET scene_image_id = ? WHERE id = ?').run(assetId, cityId);
}

export async function generateCityPanorama(
  cityId: string,
  cityName: string,
  country: string,
): Promise<void> {
  const promptContext = loadCityPromptContext(cityId);
  const prompt = buildCityPanoramaPrompt({
    caseTemplateId: promptContext.caseTemplateId,
    cityName,
    country,
    caseSummary: promptContext.caseSummary,
    witnessBackstories: promptContext.witnessBackstories,
    evidenceFacts: promptContext.evidenceFacts,
  });

  const imageData = await generateImage(prompt, 'panorama');
  if (!imageData) {
    console.error(`Failed to generate panorama for city ${cityId} (${cityName})`);
    return;
  }

  const assetId = storeAsset('panorama', imageData, IMAGE_OUTPUT_MIME_TYPE, prompt);
  db.prepare('UPDATE cities SET panorama_image_id = ? WHERE id = ?').run(assetId, cityId);
}
