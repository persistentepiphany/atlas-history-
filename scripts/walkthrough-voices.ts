import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generates one narrator file per walkthrough segment with the cinematic narrator voice named
 * in the walkthrough file. Files are cached by a hash of voice, model and text so reruns only
 * generate what changed. The key is read from the environment and is never written anywhere.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error('ELEVENLABS_API_KEY is required');
const event = process.argv[2] ?? 'apollo11';
const spec = JSON.parse(await readFile(join(root, 'walkthrough', 'scenarios', event + '.walkthrough.json'), 'utf8')) as { voice: { narrator: string; model: string }; segments: { id: string; audio?: string; text: string }[] };

for (const segment of spec.segments) {
  if (!segment.audio || !segment.audio.includes('/w-')) continue;
  const output = join(root, 'walkthrough', segment.audio); const manifestPath = output.replace(/\.mp3$/, '.json');
  const hash = createHash('sha256').update(spec.voice.narrator + '\n' + spec.voice.model + '\n' + segment.text).digest('hex');
  const previous = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => null);
  if (previous?.hash === hash) { console.log('Unchanged ' + segment.id); continue; }
  const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + spec.voice.narrator + '?output_format=mp3_44100_128', {
    method: 'POST', headers: { 'content-type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify({ text: segment.text, model_id: spec.voice.model, voice_settings: { stability: 0.62, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true } }),
  });
  if (!response.ok) throw new Error(segment.id + ' failed with ' + response.status + ' ' + await response.text());
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(await response.arrayBuffer()));
  await writeFile(manifestPath, JSON.stringify({ hash, model: spec.voice.model, voiceId: spec.voice.narrator, text: segment.text }, null, 2) + '\n');
  console.log('Generated ' + segment.id);
}
