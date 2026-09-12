import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSearchQuery } from './find-corroborating-sources.ts';
import { InvalidInputError } from './pipeline-error.ts';

test('uses a full headline on its own', () => {
  const headline = 'Ukraine marks 40th anniversary of Chernobyl disaster';
  assert.equal(buildSearchQuery({ headline, bodyText: 'Ceremonies were held.' }), headline);
});

test('pads a fragment of a headline with the opening of the body', () => {
  const query = buildSearchQuery({
    headline: 'NAMES AND DESCRIPTIONS',
    bodyText: 'Name of Ship Empire Windrush, port of arrival Tilbury, June 1948.',
  });

  assert.match(query, /^NAMES AND DESCRIPTIONS Name of Ship Empire Windrush/);
});

test('falls back to the body when there is no headline at all', () => {
  const query = buildSearchQuery({ headline: '   ', bodyText: 'Crowds gathered at the quayside.' });
  assert.equal(query, 'Crowds gathered at the quayside.');
});

test('caps the body contribution so the query stays a query', () => {
  const bodyText = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');
  const query = buildSearchQuery({ headline: '', bodyText });

  assert.equal(query.split(' ').length, 18);
});

test('refuses an article with nothing to search on', () => {
  assert.throws(() => buildSearchQuery({ headline: '', bodyText: '   ' }), InvalidInputError);
});
