import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeSectionsOutsideTarget, measureBriefSections } from './brief-shape-report.ts';
import type { EventBrief } from './event-brief.ts';

function buildBriefWithLengths(lengths: {
  summary: number;
  fullArticle: number;
  narrative: number;
}): EventBrief {
  const words = (count: number): string => Array.from({ length: count }, () => 'word').join(' ');
  const partial = {
    summary: words(lengths.summary),
    fullArticle: words(lengths.fullArticle),
    narrative: words(lengths.narrative),
  };
  // Only the three measured sections matter here; the report reads nothing else.
  return partial as unknown as EventBrief;
}

test('reports nothing when all three sections sit inside their targets', () => {
  const brief = buildBriefWithLengths({ summary: 95, fullArticle: 640, narrative: 275 });
  assert.equal(describeSectionsOutsideTarget(brief), '');
});

test('names each section that missed its target and by how much', () => {
  const brief = buildBriefWithLengths({ summary: 95, fullArticle: 461, narrative: 181 });
  const report = describeSectionsOutsideTarget(brief);

  assert.match(report, /fullArticle 461w \(want 500-800\)/);
  assert.match(report, /narrative 181w \(want 200-350\)/);
  assert.doesNotMatch(report, /summary/);
});

test('treats an overlong section as out of target too', () => {
  const brief = buildBriefWithLengths({ summary: 400, fullArticle: 640, narrative: 275 });
  const measured = measureBriefSections(brief);

  assert.deepEqual(
    measured.map((section) => section.withinTarget),
    [false, true, true],
  );
});
