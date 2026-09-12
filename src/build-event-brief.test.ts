import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { TavilyClient } from '@tavily/core';
import type OpenAI from 'openai';

import { buildEventBrief, type BriefServices } from './build-event-brief.ts';
import type { ComposedBrief } from './event-brief.ts';
import { eventBriefSchema } from './event-brief.ts';
import type { PipelineConfig } from './pipeline-config.ts';

const config: PipelineConfig = {
  llmApiKey: 'test-key',
  llmBaseUrl: 'https://api.groq.com/openai/v1',
  tavilyApiKey: 'test-key',
  scan: { model: 'test-scan-model', maxOutputTokens: 900 },
  compose: { model: 'test-compose-model', maxOutputTokens: 4_000 },
  briefsDirectory: 'briefs',
  requestTimeoutMs: 1_000,
  tavilyTimeoutSeconds: 30,
  maxRetries: 0,
  maxCorroboratingSources: 3,
};

const composed: ComposedBrief = {
  slug: 'Harbour Bridge Opening',
  title: 'The Harbour Bridge Opens',
  eventDateIso: '1932-03-19',
  eventDateDisplay: '19 March 1932',
  primaryScene: 'southern approach',
  summary: 'A summary.',
  fullArticle: 'An article.',
  narrative: 'A narrative.',
  eventContext: { before: 'a', sameDayElsewhere: 'b', after: 'c', whyItMatters: 'd' },
  pressPerspectives: [
    { outlet: 'The Herald', coverageType: 'contemporary reporting', roleInStory: 'a', storyBeat: 'b' },
  ],
  worldPrompt: {
    title: 'Sydney, 19 March 1932',
    timeWindow: 'late morning',
    place: 'southern approach',
    pointOfView: 'crowd barrier',
    builtEnvironment: 'steel arch, tram tracks',
    crowdLevel: 'dense',
    sensoryModel: 'harbour glare',
    hotspots: ['ribbon-cutting evidence panel'],
    accessibility: 'captions, transcript, uncertainty marker',
    exclusions: ['invented dialogue'],
    fullPrompt: 'Generate one evidence-led world…',
  },
  caveat: 'Not the later fireworks.',
  uncertainFacts: ['attendance estimate'],
  suggestedImageQueries: ['Sydney Harbour Bridge opening 1932'],
};

// Narrow stand-ins for the two vendor clients. Casting is confined to this test file.
function buildServices(): BriefServices {
  const tavilyStub = {
    extract: () =>
      Promise.resolve({
        results: [
          { url: 'https://www.example.org/story', title: 'Bridge opens', rawContent: 'Body text here.' },
        ],
        failedResults: [],
        responseTime: 1,
        requestId: 'extract-1',
      }),
    search: () =>
      Promise.resolve({
        query: 'Bridge opens',
        answer: 'Coverage summary.',
        responseTime: 1,
        requestId: 'search-1',
        results: [
          {
            title: 'Crowds cross the bridge',
            url: 'https://example.net/report',
            content: 'Snippet.',
            score: 0.9,
            publishedDate: '1932-03-20',
            id: 'r1',
          },
        ],
        images: [{ url: 'https://example.net/photo.jpg', description: 'Arch under construction' }],
      }),
  } as unknown as TavilyClient;

  const openAiStub = {
    responses: { parse: () => Promise.resolve({ output_parsed: composed, status: 'completed' }) },
  } as unknown as OpenAI;

  return { openai: openAiStub, tavily: tavilyStub, config };
}

test('builds a schema-valid brief from a URL and attaches provenance', async () => {
  const brief = await buildEventBrief(buildServices(), { kind: 'url', url: 'https://www.example.org/story' }, () => {});

  const parsed = eventBriefSchema.parse(brief);
  assert.equal(parsed.slug, 'harbour-bridge-opening');
  assert.equal(parsed.origin.inputKind, 'url');
  assert.equal(parsed.origin.outlet, 'example.org');
  assert.equal(parsed.origin.excerpt, 'Body text here.');
  assert.equal(parsed.origin.readConfidence, 'high');
  assert.deepEqual(parsed.origin.unreadablePassages, []);
  assert.equal(parsed.corroboratingSources.length, 1);
  assert.equal(parsed.corroboratingSources[0]?.url, 'https://example.net/report');
});

test('leaves every generated brief unverified with its uncertain facts counted', async () => {
  const brief = await buildEventBrief(buildServices(), { kind: 'url', url: 'https://www.example.org/story' }, () => {});

  assert.equal(brief.verification.status, 'unverified');
  assert.equal(brief.verification.uncertainFactCount, 1);
  assert.equal(brief.verification.composedByModel, 'test-compose-model');
});

test('marks every image candidate as needing a rights check', async () => {
  const brief = await buildEventBrief(buildServices(), { kind: 'url', url: 'https://www.example.org/story' }, () => {});

  assert.equal(brief.imageCandidates.length, 1);
  assert.deepEqual(
    brief.imageCandidates.map((candidate) => candidate.rightsStatus),
    ['needs-review'],
  );
});
