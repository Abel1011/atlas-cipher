import { APIError, AzureOpenAI } from 'openai';

type ContentRole = 'developer' | 'system' | 'user' | 'assistant';

type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

interface ContentPart {
  text: string;
}

export interface ContentMessage {
  role: ContentRole;
  parts: ContentPart[];
}

type ContentListUnion = string | ContentMessage[];

interface TextGenerationConfig {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  reasoningEffort?: ReasoningEffort;
}

interface ImageGenerationConfig {
  numberOfImages?: number;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  imageSize?: string;
  outputMimeType?: 'image/png' | 'image/jpeg';
  outputCompressionQuality?: number;
  negativePrompt?: string;
  quality?: 'low' | 'medium' | 'high' | 'standard' | 'hd';
  style?: 'natural' | 'vivid';
  enhancePrompt?: boolean;
  guidanceScale?: number;
  personGeneration?: string;
}

interface AiRequestMeta {
  models: readonly string[];
  apiKey?: string;
  endpoint?: string;
  apiVersion?: string;
  onModelError?: (model: string, error: Error) => void;
}

interface AiBaseRequest extends AiRequestMeta {
  contents: ContentListUnion;
  config?: TextGenerationConfig;
}

export interface AiStructuredRequest<T> extends AiBaseRequest {
  schema: unknown;
  parse: (raw: string) => T;
  validate?: (value: T) => boolean;
}

interface TextResponseCompat {
  raw: AzureChatCompletionResponse;
}

export interface AiTextRequest extends AiBaseRequest {
  transform?: (text: string, response: TextResponseCompat) => string | null;
}

interface ImageResponseCompat {
  generatedImages?: Array<{
    image?: {
      imageBytes?: string;
    };
  }>;
  raw: AzureImageGenerationResponse;
  revisedPrompt?: string | null;
}

export interface AiImageRequest<T> extends AiRequestMeta {
  prompt: string;
  config?: ImageGenerationConfig;
  transform?: (response: ImageResponseCompat) => T | null;
}

interface AzureChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null | Array<{ type?: string; text?: string | null; refusal?: string | null }>;
      refusal?: string | null;
    };
  }>;
  error?: {
    code?: string;
    message?: string;
  };
}

interface AzureImageGenerationResponse {
  data?: Array<{
    b64_json?: string | null;
    url?: string | null;
    revised_prompt?: string | null;
  }>;
  error?: {
    code?: string;
    message?: string;
  };
}

class AzureOpenAIError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AzureOpenAIError';
  }
}

const DEFAULT_TEXT_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
const DEFAULT_IMAGE_API_VERSION = process.env.AZURE_OPENAI_IMAGE_API_VERSION || '2025-04-01-preview';
const DEFAULT_AZURE_OPENAI_MAX_RETRIES = readPositiveInt(process.env.AZURE_OPENAI_MAX_RETRIES, 3);
const DEFAULT_AZURE_OPENAI_RETRY_DELAY_MS = readPositiveInt(process.env.AZURE_OPENAI_RETRY_DELAY_MS, 1000);
const MAX_AZURE_OPENAI_RETRY_DELAY_MS = readPositiveInt(process.env.AZURE_OPENAI_MAX_RETRY_DELAY_MS, 10000);
const azureClientCache = new Map<string, AzureOpenAI>();

export function hasTextGenerationConfig(): boolean {
  return hasAzureOpenAIConfig();
}

export function hasImageGenerationConfig(): boolean {
  return hasAzureOpenAIConfig();
}

export async function generateStructuredContent<T>(request: AiStructuredRequest<T>): Promise<T> {
  return withAzureModelFallback(request, async model => {
    const response = await callChatCompletion({
      model,
      apiKey: request.apiKey,
      endpoint: request.endpoint,
      apiVersion: request.apiVersion,
      contents: request.contents,
      config: request.config,
      schema: request.schema,
    });

    const parsed = request.parse(extractChatText(response));
    if (request.validate && !request.validate(parsed)) {
      throw new Error(`Structured Azure OpenAI response failed validation for ${model}`);
    }

    return parsed;
  });
}

export async function generateTextContent(request: AiTextRequest): Promise<string> {
  return withAzureModelFallback(request, async model => {
    const response = await callChatCompletion({
      model,
      apiKey: request.apiKey,
      endpoint: request.endpoint,
      apiVersion: request.apiVersion,
      contents: request.contents,
      config: request.config,
    });

    const rawText = extractChatText(response);
    const text = request.transform
      ? request.transform(rawText, { raw: response })
      : rawText.trim();

    if (!text) {
      throw new Error(`Azure OpenAI text response was empty for ${model}`);
    }

    return text;
  });
}

export async function generateImageContent<T = ImageResponseCompat>(request: AiImageRequest<T>): Promise<T> {
  return withAzureModelFallback(request, async model => {
    const response = await callImageGeneration({
      model,
      apiKey: request.apiKey,
      endpoint: request.endpoint,
      apiVersion: request.apiVersion,
      prompt: request.prompt,
      config: request.config,
    });

    const imageBytes = await extractImageBytes(response);
    const compatResponse: ImageResponseCompat = {
      generatedImages: imageBytes
        ? [{
            image: {
              imageBytes,
            },
          }]
        : [],
      raw: response,
      revisedPrompt: response.data?.[0]?.revised_prompt ?? null,
    };

    if (!request.transform) {
      return compatResponse as T;
    }

    const transformed = request.transform(compatResponse);
    if (transformed == null) {
      throw new Error(`Azure OpenAI image response was empty for ${model}`);
    }

    return transformed;
  });
}

async function withAzureModelFallback<T>(
  request: AiRequestMeta,
  run: (model: string) => Promise<T>,
): Promise<T> {
  if (request.models.length === 0) {
    throw new Error('No Azure OpenAI deployments configured');
  }

  let lastError: Error | null = null;

  for (const model of request.models) {
    try {
      return await withRetries(() => run(model));
    } catch (error) {
      lastError = toError(error);
      request.onModelError?.(model, lastError);
    }
  }

  throw lastError ?? new Error('Azure OpenAI request failed without a concrete error');
}

async function withRetries<T>(run: () => Promise<T>): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= DEFAULT_AZURE_OPENAI_MAX_RETRIES; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = toError(error);
      if (!isRetryableError(lastError) || attempt === DEFAULT_AZURE_OPENAI_MAX_RETRIES) {
        break;
      }

      await delay(resolveRetryDelayMs(lastError, attempt));
    }
  }

  throw lastError ?? new Error('Azure OpenAI request failed without a concrete error');
}

async function callChatCompletion(input: {
  model: string;
  contents: ContentListUnion;
  config?: TextGenerationConfig;
  schema?: unknown;
  apiKey?: string;
  endpoint?: string;
  apiVersion?: string;
}): Promise<AzureChatCompletionResponse> {
  const config = resolveAzureConfig({
    apiKey: input.apiKey,
    endpoint: input.endpoint,
    apiVersion: input.apiVersion,
    fallbackApiVersion: DEFAULT_TEXT_API_VERSION,
  });
  const client = getAzureOpenAIClient(config);

  const isReasoningRequest = Boolean(input.config?.reasoningEffort) || looksLikeReasoningModel(input.model);

  const body = compactObject({
    model: input.model,
    messages: buildMessages(input.contents, input.config?.systemInstruction),
    max_completion_tokens: input.config?.maxOutputTokens,
    reasoning_effort: input.config?.reasoningEffort,
    temperature: isReasoningRequest ? undefined : input.config?.temperature,
    top_p: isReasoningRequest ? undefined : input.config?.topP,
    presence_penalty: isReasoningRequest ? undefined : input.config?.presencePenalty,
    frequency_penalty: isReasoningRequest ? undefined : input.config?.frequencyPenalty,
    response_format: input.schema
      ? {
          type: 'json_schema',
          json_schema: {
            name: 'structured_response',
            strict: true,
            schema: input.schema,
          },
        }
      : undefined,
  });

  try {
    return await client.chat.completions.create(body as never) as AzureChatCompletionResponse;
  } catch (error) {
    throw normalizeAzureSdkError(error);
  }
}

async function callImageGeneration(input: {
  model: string;
  prompt: string;
  config?: ImageGenerationConfig;
  apiKey?: string;
  endpoint?: string;
  apiVersion?: string;
}): Promise<AzureImageGenerationResponse> {
  const config = resolveAzureConfig({
    apiKey: input.apiKey,
    endpoint: input.endpoint,
    apiVersion: input.apiVersion,
    fallbackApiVersion: DEFAULT_IMAGE_API_VERSION,
  });
  const client = getAzureOpenAIClient(config);

  const outputFormat = input.config?.outputMimeType === 'image/jpeg' ? 'jpeg' : 'png';
  const prompt = buildImagePrompt(input.prompt, input.config);
  const body = compactObject({
    model: input.model,
    prompt,
    n: input.config?.numberOfImages ?? 1,
    size: resolveImageSize(input.config),
    quality: mapImageQuality(input.config?.quality),
    style: supportsImageStyle(input.model) ? (input.config?.style ?? 'natural') : undefined,
    output_format: outputFormat,
    output_compression: input.config?.outputCompressionQuality,
  });

  try {
    return await client.images.generate(body as never) as AzureImageGenerationResponse;
  } catch (error) {
    throw normalizeAzureSdkError(error);
  }
}

function resolveAzureConfig(input: {
  apiKey?: string;
  endpoint?: string;
  apiVersion?: string;
  fallbackApiVersion: string;
}): { apiKey: string; endpoint: string; apiVersion: string } {
  const apiKey = input.apiKey ?? process.env.AZURE_OPENAI_API_KEY;
  const endpoint = normalizeEndpoint(input.endpoint ?? process.env.AZURE_OPENAI_ENDPOINT);
  const apiVersion = input.apiVersion ?? input.fallbackApiVersion;

  if (!apiKey) {
    throw new Error('AZURE_OPENAI_API_KEY not set');
  }

  if (!endpoint) {
    throw new Error('AZURE_OPENAI_ENDPOINT not set');
  }

  return { apiKey, endpoint, apiVersion };
}

function hasAzureOpenAIConfig(): boolean {
  return Boolean(process.env.AZURE_OPENAI_API_KEY && normalizeEndpoint(process.env.AZURE_OPENAI_ENDPOINT));
}

function getAzureOpenAIClient(config: { apiKey: string; endpoint: string; apiVersion: string }): AzureOpenAI {
  const cacheKey = `${config.endpoint}|${config.apiVersion}|${config.apiKey}`;
  const cached = azureClientCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const client = new AzureOpenAI({
    apiKey: config.apiKey,
    apiVersion: config.apiVersion,
    endpoint: config.endpoint,
    maxRetries: 0,
  });

  azureClientCache.set(cacheKey, client);
  return client;
}

function buildMessages(contents: ContentListUnion, systemInstruction?: string): Array<{ role: ContentRole; content: string }> {
  const messages: Array<{ role: ContentRole; content: string }> = [];

  if (systemInstruction?.trim()) {
    messages.push({ role: 'developer', content: systemInstruction.trim() });
  }

  if (typeof contents === 'string') {
    const content = contents.trim();
    if (content) {
      messages.push({ role: 'user', content });
    }
    return messages;
  }

  for (const message of contents) {
    const content = message.parts
      .map(part => part.text.trim())
      .filter(Boolean)
      .join('\n');

    if (content) {
      messages.push({ role: message.role, content });
    }
  }

  return messages;
}

function extractChatText(response: AzureChatCompletionResponse): string {
  const message = response.choices?.[0]?.message;
  if (!message) {
    throw new Error('Azure OpenAI chat response did not include a message');
  }

  if (typeof message.content === 'string') {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    const joined = message.content
      .map(part => part.text ?? part.refusal ?? '')
      .join('\n')
      .trim();

    if (joined) {
      return joined;
    }
  }

  if (message.refusal?.trim()) {
    return message.refusal.trim();
  }

  throw new Error('Azure OpenAI chat response did not include text content');
}

async function extractImageBytes(response: AzureImageGenerationResponse): Promise<string | null> {
  const firstImage = response.data?.[0];
  if (!firstImage) {
    return null;
  }

  if (firstImage.b64_json) {
    return firstImage.b64_json;
  }

  if (!firstImage.url) {
    return null;
  }

  const downloadResponse = await fetch(firstImage.url);
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download generated image: ${downloadResponse.status}`);
  }

  const bytes = Buffer.from(await downloadResponse.arrayBuffer());
  return bytes.toString('base64');
}

function buildImagePrompt(prompt: string, config?: ImageGenerationConfig): string {
  const instructions = [prompt.trim()];

  if (config?.negativePrompt?.trim()) {
    instructions.push(`Avoid the following visual traits: ${config.negativePrompt.trim()}.`);
  }

  return instructions.join(' ');
}

function resolveImageSize(config?: ImageGenerationConfig): string {
  if (config?.imageSize) {
    return config.imageSize;
  }

  switch (config?.aspectRatio) {
    case '3:4':
    case '9:16':
      return '1024x1536';
    case '4:3':
    case '16:9':
      return '1536x1024';
    default:
      return '1024x1024';
  }
}

function mapImageQuality(quality?: ImageGenerationConfig['quality']): 'low' | 'medium' | 'high' | undefined {
  switch (quality) {
    case 'low':
    case 'medium':
    case 'high':
      return quality;
    case 'hd':
      return 'high';
    case 'standard':
      return 'medium';
    default:
      return undefined;
  }
}

function supportsImageStyle(model: string): boolean {
  return /^dall-e-3$/i.test(model.trim());
}

function buildAzureError(status: number, message?: string, code?: string, retryAfterMs?: number): AzureOpenAIError {
  return new AzureOpenAIError(
    message ?? `Azure OpenAI request failed with status ${status}`,
    status,
    code,
    retryAfterMs,
  );
}

function normalizeAzureSdkError(error: unknown): Error {
  if (error instanceof AzureOpenAIError) {
    return error;
  }

  if (error instanceof APIError) {
    const errorPayload = asObject(error.error);
    const message = readString(errorPayload?.message) ?? error.message;
    const code = readString(errorPayload?.code) ?? error.code ?? undefined;
    return buildAzureError(error.status ?? 500, message, code, readRetryAfterMs(error));
  }

  return toError(error);
}

function normalizeEndpoint(rawEndpoint: string | undefined): string | null {
  if (!rawEndpoint?.trim()) {
    return null;
  }

  return rawEndpoint.trim().replace(/\/+$/, '');
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
  return Object.fromEntries(entries) as T;
}

function isRetryableError(error: Error): boolean {
  if (!(error instanceof AzureOpenAIError)) {
    return true;
  }

  const status = error.status;
  return status == null || status === 408 || status === 409 || status === 429 || status >= 500;
}

function resolveRetryDelayMs(error: Error, attempt: number): number {
  if (error instanceof AzureOpenAIError && typeof error.retryAfterMs === 'number' && error.retryAfterMs > 0) {
    return clampRetryDelayMs(error.retryAfterMs);
  }

  const exponentialDelay = DEFAULT_AZURE_OPENAI_RETRY_DELAY_MS * 2 ** attempt;
  return clampRetryDelayMs(exponentialDelay);
}

function clampRetryDelayMs(value: number): number {
  return Math.max(DEFAULT_AZURE_OPENAI_RETRY_DELAY_MS, Math.min(MAX_AZURE_OPENAI_RETRY_DELAY_MS, Math.round(value)));
}

function readRetryAfterMs(error: APIError): number | undefined {
  const retryAfterHeader = readHeaderValue(error, 'retry-after-ms') ?? readHeaderValue(error, 'retry-after');
  if (!retryAfterHeader) {
    return undefined;
  }

  const retryAfterSeconds = Number.parseFloat(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    const multiplier = /retry-after-ms/i.test(retryAfterHeader) ? 1 : 1000;
    return retryAfterSeconds * multiplier;
  }

  const retryAt = Date.parse(retryAfterHeader);
  if (Number.isFinite(retryAt)) {
    return retryAt - Date.now();
  }

  return undefined;
}

function readHeaderValue(error: APIError, headerName: string): string | undefined {
  const headers = asObject((error as APIError & { headers?: unknown }).headers);
  if (!headers) {
    return undefined;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== headerName.toLowerCase()) {
      continue;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      const firstString = value.find(entry => typeof entry === 'string');
      if (typeof firstString === 'string') {
        return firstString;
      }
    }
  }

  return undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function looksLikeReasoningModel(model: string): boolean {
  return /^(gpt-5(?:[.-]|$)|o1(?:[.-]|$)|o3(?:[.-]|$)|o4(?:[.-]|$)|codex-mini$)/i.test(model);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readPositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}