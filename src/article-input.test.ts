import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { resolveArticleInput } from './article-input.ts';
import { InvalidInputError } from './pipeline-error.ts';

test('accepts an https article URL', async () => {
  const input = await resolveArticleInput('https://example.org/news/story?id=4');
  assert.deepEqual(input, { kind: 'url', url: 'https://example.org/news/story?id=4' });
});

test('rejects schemes that are not http or https', async () => {
  await assert.rejects(() => resolveArticleInput('file:///etc/passwd'), InvalidInputError);
  await assert.rejects(() => resolveArticleInput('data://text/plain,hi'), InvalidInputError);
});

test('rejects an empty argument', async () => {
  await assert.rejects(() => resolveArticleInput('  '), InvalidInputError);
});

test('accepts a readable image and reports its media type', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-input-'));
  const path = join(directory, 'clipping.JPG');
  await writeFile(path, 'not really a jpeg, but the pipeline only checks type and size');

  const input = await resolveArticleInput(path);
  assert.equal(input.kind, 'image');
  assert.equal(input.kind === 'image' ? input.mediaType : '', 'image/jpeg');
});

test('rejects a file type it cannot send as an image', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-input-'));
  const path = join(directory, 'clipping.pdf');
  await writeFile(path, 'pdf');

  await assert.rejects(() => resolveArticleInput(path), InvalidInputError);
});

test('rejects a path that does not exist', async () => {
  await assert.rejects(() => resolveArticleInput('/nope/missing-clipping.png'), InvalidInputError);
});
