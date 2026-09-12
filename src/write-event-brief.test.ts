import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import type { EventBrief } from './event-brief.ts';
import { InvalidInputError } from './pipeline-error.ts';
import { writeEventBrief } from './write-event-brief.ts';

function buildBrief(overrides: Partial<EventBrief> = {}): EventBrief {
  return {
    slug: 'tilbury-arrival',
    schemaVersion: 1,
    title: 'Arrival at Tilbury',
    eventDateIso: '1948-06-22',
    eventDateDisplay: '22 June 1948',
    primaryScene: 'Tilbury Docks',
    summary: 'A summary.',
    fullArticle: 'An article.',
    narrative: 'A narrative.',
    eventContext: { before: 'a', sameDayElsewhere: 'b', after: 'c', whyItMatters: 'd' },
    pressPerspectives: [
      { outlet: 'The Guardian', coverageType: 'contemporary reporting', roleInStory: 'a', storyBeat: 'b' },
    ],
    worldPrompt: {
      title: 'Tilbury, 22 June 1948',
      timeWindow: 'morning',
      place: 'Tilbury Docks',
      pointOfView: 'quayside observer',
      builtEnvironment: 'dockside sheds',
      crowdLevel: 'moderate',
      sensoryModel: 'estuary light',
      hotspots: ['passenger list panel'],
      accessibility: 'captions and transcript',
      exclusions: ['invented dialogue'],
      fullPrompt: 'Generate one evidence-led world…',
    },
    caveat: 'Not the disembarkation itself.',
    uncertainFacts: ['passenger count'],
    suggestedImageQueries: ['Empire Windrush Tilbury 1948'],
    origin: {
      inputKind: 'url',
      reference: 'https://example.org/story',
      headline: 'Arrival at Tilbury',
      outlet: 'example.org',
      publishedDateText: '',
      byline: '',
      excerpt: 'An excerpt.',
      wordCount: 2,
      retrievedAtUtc: '2026-09-12T00:00:00.000Z',
      readConfidence: 'high',
      unreadablePassages: [],
    },
    corroboratingSources: [],
    imageCandidates: [],
    verification: {
      status: 'unverified',
      generatedAtUtc: '2026-09-12T00:00:00.000Z',
      composedByModel: 'gpt-5.5',
      uncertainFactCount: 1,
    },
    ...overrides,
  };
}

test('writes the brief as pretty JSON named after the slug', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-briefs-'));
  const written = await writeEventBrief(buildBrief(), { directory, overwrite: false });

  assert.equal(written.path, join(directory, 'tilbury-arrival.json'));
  assert.equal(written.overwritten, false);

  const parsed: unknown = JSON.parse(await readFile(written.path, 'utf8'));
  assert.equal((parsed as EventBrief).verification.status, 'unverified');
});

test('refuses to clobber an existing brief unless told to', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-briefs-'));
  await writeEventBrief(buildBrief(), { directory, overwrite: false });

  await assert.rejects(
    () => writeEventBrief(buildBrief({ summary: 'Rewritten.' }), { directory, overwrite: false }),
    InvalidInputError,
  );

  const written = await writeEventBrief(buildBrief({ summary: 'Rewritten.' }), {
    directory,
    overwrite: true,
  });
  assert.equal(written.overwritten, true);

  const parsed: unknown = JSON.parse(await readFile(written.path, 'utf8'));
  assert.equal((parsed as EventBrief).summary, 'Rewritten.');
});

test('rejects a brief whose slug could escape the output directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-briefs-'));
  await assert.rejects(
    () => writeEventBrief(buildBrief({ slug: '../escaped' }), { directory, overwrite: false }),
    (error: unknown) => error instanceof Error && error.name === 'ZodError',
  );
});
