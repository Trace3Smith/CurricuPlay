// Re-encode reviewed originals without changing their artwork. Requires ffmpeg/libwebp.
// Usage: node scripts/optimize-spelling-bee-images.mjs /path/to/original-png-directory
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const originals = process.argv[2];
if (!originals) throw new Error('Supply the directory of reviewed original PNGs.');
const manifestPath = resolve('content/spelling-bee/photo-assets.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const asset of manifest.assets) {
  if (!/^[a-z]+$/.test(asset.name)) throw new Error('Invalid asset name.');
  const input = join(resolve(originals), `${asset.name}.png`);
  const output = `public/spelling-bee/photos/${asset.name}.webp`;
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', input,
    '-vf', 'scale=1024:1024:force_original_aspect_ratio=decrease:flags=lanczos', '-c:v', 'libwebp',
    '-q:v', '88', '-compression_level', '6', '-y', output], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'Image encoding failed.');
  asset.path = output;
  asset.originalBytes = statSync(input).size;
  asset.bytes = statSync(output).size;
  asset.sourceSha256 = createHash('sha256').update(readFileSync(input)).digest('hex');
}
manifest.optimization = { format: 'WebP', maxDimension: 1024, quality: 88,
  encoder: 'ffmpeg libwebp', artwork: 'Only igloo was edited; other approved artwork preserved.' };
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ images: manifest.assets.length,
  originalBytes: manifest.assets.reduce((n, a) => n + a.originalBytes, 0),
  optimizedBytes: manifest.assets.reduce((n, a) => n + a.bytes, 0) }));
