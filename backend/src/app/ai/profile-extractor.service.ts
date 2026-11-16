import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { LlmClient } from './llm.client';
import { TripProfile, TripProfileSchema } from './schemas';

const SYSTEM_PROMPT = readFileSync(join(__dirname, 'prompts', 'extract-profile.md'), 'utf-8');

@Injectable()
export class ProfileExtractorService {
  private readonly logger = new Logger(ProfileExtractorService.name);

  constructor(private readonly llmClient: LlmClient) {}

  // Free text (FR/EN/AR/Darija) → TripProfile, per guide §8 Étape A.
  // Low temperature, strict JSON — any parse/schema failure surfaces as a
  // 400 rather than silently falling back to invented defaults (§2 rule 2).
  async extract(text: string): Promise<TripProfile> {
    const res = await this.llmClient.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      undefined,
      { temperature: 0.1, maxTokens: 1024 },
    );

    const content = res.choices[0]?.message?.content ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(content));
    } catch (error) {
      this.logger.warn(`Profile extraction returned non-JSON content: ${content.slice(0, 200)}`);
      throw new BadRequestException(
        "L'IA n'a pas pu extraire un profil valide depuis ce texte. Réessayez ou utilisez le questionnaire.",
      );
    }

    const result = TripProfileSchema.safeParse(parsed);
    if (!result.success) {
      throw new BadRequestException(
        "L'IA n'a pas pu extraire un profil valide depuis ce texte. Réessayez ou utilisez le questionnaire.",
      );
    }
    return result.data;
  }
}

// The model may wrap its JSON in prose or a code fence despite instructions
// (guide §6.1 — "thinking" mode can add reasoning text before the JSON).
// Take the outermost {...} block rather than trusting content to be bare JSON.
function extractJson(content: string): string {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return content;
  return content.slice(start, end + 1);
}
