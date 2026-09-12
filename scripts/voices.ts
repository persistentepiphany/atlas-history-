import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error('ELEVENLABS_API_KEY is required');

const voice = JSON.parse(await readFile(join(root, 'voices.json'), 'utf8')) as { narrator: { voiceId: string }; model: string };
const lines: Record<string, string> = {
  apollo11: 'July 21, 1969. Humanity wakes to a new world. A man has walked on the Moon, and the front page fixes that impossible distance in ink.',
  berlin1989: 'November 10, 1989. The border is open. Berliners move through the Wall as a divided city discovers, almost at once, that history has changed direction.',
  armistice1918: 'November 11, 1918. Germany accepts the armistice. The guns fall quiet, while newspapers carry the first uncertain words of peace across a wounded world.',
  titanic1912: 'April 16, 1912. The Titanic has struck an iceberg and gone beneath the Atlantic. Early reports reach the page in fragments, before the scale of the loss is known.',
  lindbergh1927: 'May 1927. Charles Lindbergh lands in Paris after crossing the Atlantic alone. The young pilot becomes, in a single night, the hero of the hour.',
  crash1929: 'October 30, 1929. Markets convulse after another day of selling. The columns record bank pressure, collapsing prices, and the first outline of a crisis still unfolding.',
};

for (const [event, text] of Object.entries(lines)) {
  const directory = join(root, 'walkthrough', 'assets', event, 'audio');
  const output = join(directory, 'narration.mp3');
  const manifestPath = join(directory, 'narration.json');
  const hash = createHash('sha256').update(`${voice.narrator.voiceId}\n${voice.model}\n${text}`).digest('hex');
  const previous = await readFile(manifestPath, 'utf8').then(JSON.parse).catch(() => null);
  if (previous?.hash === hash) {
    console.log(`Unchanged ${event}`);
    continue;
  }
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.narrator.voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'xi-api-key': key },
    body: JSON.stringify({ text, model_id: voice.model, voice_settings: { stability: 0.55, similarity_boost: 0.78, style: 0.12, use_speaker_boost: true } }),
  });
  if (!response.ok) throw new Error(`${event} failed with ${response.status} ${await response.text()}`);
  await mkdir(directory, { recursive: true });
  await writeFile(output, Buffer.from(await response.arrayBuffer()));
  await writeFile(manifestPath, JSON.stringify({ hash, model: voice.model, voiceId: voice.narrator.voiceId, text }, null, 2) + '\n');
  console.log(`Generated ${event}`);
}
