import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toBriefSlug } from './brief-slug.ts';
import { InvalidInputError } from './pipeline-error.ts';

test('lowercases and hyphenates a title', () => {
  assert.equal(toBriefSlug('Berlin Wall Opening'), 'berlin-wall-opening');
});

test('strips accents and punctuation', () => {
  assert.equal(toBriefSlug('Bandung: Conférence, 1955'), 'bandung-conference-1955');
});

test('refuses path separators and traversal', () => {
  assert.equal(toBriefSlug('../../etc/passwd'), 'etc-passwd');
  assert.throws(() => toBriefSlug('../..'), InvalidInputError);
  assert.throws(() => toBriefSlug('/'), InvalidInputError);
});

test('refuses a slug with nothing usable in it', () => {
  assert.throws(() => toBriefSlug('   '), InvalidInputError);
  assert.throws(() => toBriefSlug('日本語'), InvalidInputError);
});

test('truncates without leaving a trailing hyphen', () => {
  const slug = toBriefSlug(`${'a'.repeat(78)} bcdefg`);
  assert.equal(slug.length <= 80, true);
  assert.equal(slug.endsWith('-'), false);
});
