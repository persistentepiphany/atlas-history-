import type { TavilyClient } from '@tavily/core';
import { z } from 'zod';

import type { CorroboratingSource, ImageCandidate } from './event-brief.ts';
import { InvalidInputError, UpstreamServiceError } from './pipeline-error.ts';

/**
 * The SDK's types are a claim about the wire, not a check. Its optional fields arrive as
 * explicit nulls in practice, which is what `nullish` covers.
 */
const searchResultSchema = z.object({
  title: z.string(),
  url: z.url(),
  content: z.string(),
  score: z.number(),
  publishedDate: z.string().nullish(),
});

const searchImageSchema = z.object({
  url: z.url(),
  description: z.string().nullish(),
});

export type Corroboration = {
  readonly sources: readonly CorroboratingSource[];
  readonly imageCandidates: readonly ImageCandidate[];
  /** Tavily's own synthesis of the coverage. Context for composition, never quoted as fact. */
  readonly coverageAnswer: string;
};

export async function findCorroboratingSources(
  tavily: TavilyClient,
  query: string,
  limits: { readonly maxSources: number; readonly timeoutSeconds: number },
): Promise<Corroboration> {
  const response = await tavily
    .search(query, {
      searchDepth: 'advanced',
      maxResults: limits.maxSources,
      includeAnswer: 'advanced',
      includeImages: true,
      includeImageDescriptions: true,
      timeout: limits.timeoutSeconds,
    })
    .catch((cause: unknown) => {
      throw new UpstreamServiceError('tavily.search', `Source search failed for "${query}"`, { cause });
    });

  const results = parseSearchField(searchResultSchema, response.results, 'results');
  const images = parseSearchField(searchImageSchema, response.images ?? [], 'images');

  return {
    sources: results.map(
      (result): CorroboratingSource => ({
        title: result.title,
        url: result.url,
        publishedDate: result.publishedDate ?? '',
        relevanceScore: result.score,
        snippet: result.content,
      }),
    ),
    imageCandidates: images.map(
      (image): ImageCandidate => ({
        url: image.url,
        description: image.description ?? '',
        rightsStatus: 'needs-review',
      }),
    ),
    coverageAnswer: response.answer ?? '',
  };
}

function parseSearchField<Item>(
  itemSchema: z.ZodType<Item>,
  received: unknown,
  fieldName: string,
): Item[] {
  const parsed = z.array(itemSchema).safeParse(received);
  if (!parsed.success) {
    throw new UpstreamServiceError(
      'tavily.search',
      `Search response field "${fieldName}" did not match the expected shape`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

/** Search needs a handle on the event. The headline is best; failing that, the opening line. */
export function buildSearchQuery(article: {
  readonly headline: string;
  readonly bodyText: string;
}): string {
  const headline = article.headline.trim();
  if (headline.length >= 12) {
    return headline;
  }
  const opening = article.bodyText.replace(/\s+/g, ' ').trim().split(' ').slice(0, 18).join(' ');
  if (opening.length === 0) {
    throw new InvalidInputError('The article carries neither a headline nor body text to search on');
  }
  return opening;
}
