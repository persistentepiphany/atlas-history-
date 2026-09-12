import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url);
const APP = new URL('walkthrough/', ROOT);
const CATALOGUE = new URL('catalogue.json', APP);
const REVIEW = new URL('REVIEW.md', ROOT);
const IA = 'https://archive.org';
const NEWSPAPER = /newspaper|times|herald|gazette|daily|sun|telegraph|review|star|chronicle|press|mail|free press/i;

const searchTerms: Record<string, string[]> = {
  armistice1918: ['armistice', 'war ends'],
  titanic1912: ['titanic'],
  lindbergh1927: ['lindbergh', 'paris'],
  crash1929: ['stock market', 'wall street', 'crash'],
  hindenburg1937: ['hindenburg', 'lakehurst'],
  dday1944: ['normandy', 'invasion', 'allies'],
  hiroshima1945: ['hiroshima', 'atomic bomb'],
  everest1953: ['everest', 'hillary'],
  sputnik1957: ['sputnik', 'satellite'],
  kennedy1963: ['kennedy', 'dallas', 'assassination'],
};

type Cluster = {
  id: string;
  date: string;
  label: string;
  country: string;
  event?: string;
  pageCount?: number;
};

type SearchDoc = {
  identifier: string;
  title?: string;
  description?: string | string[];
  date?: string;
  collection?: string | string[];
};

function day(date: string, offset: number) {
  const value = new Date(date + 'T12:00:00Z');
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function words(value: unknown) {
  return Array.isArray(value) ? value.join(' ') : String(value || '');
}

function documentText(doc: SearchDoc) {
  return `${doc.title || ''} ${words(doc.description)} ${words(doc.collection)}`;
}

function newspaperIdentity(doc: SearchDoc) {
  return NEWSPAPER.test(`${doc.title || ''} ${words(doc.collection)}`);
}

function score(doc: SearchDoc, cluster: Cluster) {
  const haystack = documentText(doc).toLowerCase();
  const terms = searchTerms[cluster.id] || cluster.label.toLowerCase().split(/\s+/);
  let value = terms.reduce((total, term) => total + (haystack.includes(term) ? 8 : 0), 0);
  if (NEWSPAPER.test(haystack)) value += 12;
  if ((doc.date || '').slice(0, 10) === cluster.date) value += 5;
  return value;
}

async function json(url: string) {
  const response = await fetch(url, { headers: { 'user-agent': 'Front Pages catalogue fetcher/1.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

async function candidates(cluster: Cluster): Promise<SearchDoc[]> {
  const terms = (searchTerms[cluster.id] || [cluster.label]).map(term => `(${term})`).join(' OR ');
  const query = `mediatype:texts AND date:[${day(cluster.date, -2)} TO ${day(cluster.date, 3)}] AND (${terms})`;
  const params = new URLSearchParams({
    q: query,
    'fl[]': 'identifier,title,description,date,collection',
    rows: '30',
    page: '1',
    output: 'json',
  });
  const result = await json(`${IA}/advancedsearch.php?${params}`);
  return (result.response?.docs || [])
    .filter(newspaperIdentity)
    .sort((a: SearchDoc, b: SearchDoc) => score(b, cluster) - score(a, cluster));
}

async function fetchPage(identifier: string) {
  const widths = [2000, 1600, 1200];
  for (const width of widths) {
    const source = `${IA}/download/${encodeURIComponent(identifier)}/page/n0_w${width}.jpg`;
    const response = await fetch(source, { headers: { 'user-agent': 'Front Pages catalogue fetcher/1.0' } });
    if (!response.ok) continue;
    const type = response.headers.get('content-type') || '';
    const bytes = Buffer.from(await response.arrayBuffer());
    if (type.startsWith('image/') && bytes.length > 20_000) return { bytes, source };
  }
  throw new Error(`No first-page image was available for ${identifier}`);
}

async function fetchEvent(cluster: Cluster) {
  const docs = await candidates(cluster);
  const failures: string[] = [];
  for (const doc of docs.slice(0, 10)) {
    try {
      const metadata = await json(`${IA}/metadata/${encodeURIComponent(doc.identifier)}`);
      const md = metadata.metadata || {};
      const licence = words(md.licenseurl || md.license || md.rights);
      if (Number(cluster.date.slice(0, 4)) > 1929 && !licence) {
        failures.push(`${doc.identifier} had no licence metadata`);
        continue;
      }
      const page = await fetchPage(doc.identifier);
      const relativePage = `assets/${cluster.id}/pages/page-01.jpg`;
      const directory = join(new URL('.', APP).pathname, 'assets', cluster.id, 'pages');
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, 'page-01.jpg'), page.bytes);
      const manifest = {
        event: cluster.id,
        fetchedAt: new Date().toISOString(),
        sourceUrl: `${IA}/details/${doc.identifier}`,
        pageSourceUrl: page.source,
        identifier: doc.identifier,
        title: doc.title || md.title || cluster.label,
        date: doc.date || md.date || cluster.date,
        licence: licence || 'No licence field supplied. Publication date is 1929 or earlier.',
      };
      const eventDirectory = join(new URL('.', APP).pathname, 'assets', cluster.id);
      await writeFile(join(eventDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
      return { relativePage, manifest };
    } catch (error) {
      failures.push(`${doc.identifier}: ${(error as Error).message}`);
    }
  }
  throw new Error(failures.length ? failures.join('; ') : 'No matching items were found');
}

async function main() {
  const catalogue = JSON.parse(await readFile(CATALOGUE, 'utf8'));
  const requested = process.argv.includes('--event') ? process.argv[process.argv.indexOf('--event') + 1] : null;
  const targets = (catalogue.clusters as Cluster[]).filter(cluster => !cluster.event && (!requested || cluster.id === requested));
  if (requested && targets.length === 0) throw new Error(`Unknown or already playable event ${requested}`);

  const review: string[] = ['# Internet Archive review', '', `Fetch run ${new Date().toISOString()}.`, ''];
  for (const cluster of targets) {
    try {
      const result = await fetchEvent(cluster);
      cluster.thumb = result.relativePage;
      cluster.archive = {
        title: result.manifest.title,
        sourceUrl: result.manifest.sourceUrl,
        licence: result.manifest.licence,
      };
      console.log(`Fetched ${cluster.id} from ${result.manifest.identifier}`);
    } catch (error) {
      review.push(`## ${cluster.label}`, '', String((error as Error).message), '');
      console.warn(`Skipped ${cluster.id}: ${(error as Error).message}`);
    }
  }
  await writeFile(CATALOGUE, JSON.stringify(catalogue, null, 2) + '\n');
  await writeFile(REVIEW, review.join('\n'));
}

await main();
