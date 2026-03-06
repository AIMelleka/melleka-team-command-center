/**
 * Shared Claude Sonnet 4.6 API helper for all edge functions.
 * Replaces all Gemini/GPT calls with direct Anthropic API.
 */

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_RETRIES = 2;

export interface ClaudeOptions {
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** For vision: pass image content blocks in messages */
  messages?: Array<{ role: 'user' | 'assistant'; content: string | any[] }>;
}

/**
 * Call Claude Sonnet 4.6 with a simple prompt string or structured messages.
 * Returns the text response content.
 */
export async function callClaude(
  prompt: string,
  options: ClaudeOptions = {},
): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const {
    system,
    maxTokens = 8192,
    temperature = 0.3,
    messages,
  } = options;

  const msgPayload = messages || [{ role: 'user' as const, content: prompt }];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: maxTokens,
          ...(system ? { system } : {}),
          messages: msgPayload,
          temperature,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        return json.content?.[0]?.text || '';
      }

      if (res.status === 429) {
        console.warn(`[CLAUDE] Rate limited (attempt ${attempt + 1}), waiting 3s...`);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      const errText = await res.text().catch(() => '');
      lastError = new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`);
      console.warn(`[CLAUDE] Attempt ${attempt + 1} failed: ${res.status}`);

      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e: any) {
      lastError = e;
      console.warn(`[CLAUDE] Attempt ${attempt + 1} error:`, e.message);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw lastError || new Error('Claude API failed after retries');
}

/**
 * Call Claude with vision (image analysis).
 * Pass base64 image data and a text prompt.
 */
export async function callClaudeVision(
  prompt: string,
  imageBase64: string,
  mediaType: string = 'image/png',
  options: Omit<ClaudeOptions, 'messages'> = {},
): Promise<string> {
  return callClaude('', {
    ...options,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        { type: 'text', text: prompt },
      ],
    }],
  });
}

/**
 * Fetch an image URL and return a base64 image block for Claude vision.
 * If the input is already base64/data URI, returns it directly.
 */
export async function urlToBase64ImageBlock(
  imageUrl: string,
): Promise<{ type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> {
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    const rawBase64 = imageUrl.startsWith('data:')
      ? imageUrl.split(',')[1] || imageUrl
      : imageUrl;
    return { type: 'image', source: { type: 'base64', media_type: 'image/png', data: rawBase64 } };
  }

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuf);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  const base64 = btoa(binary);

  const contentType = res.headers.get('content-type') || 'image/png';
  const mediaType = contentType.split(';')[0].trim();

  return { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
}
