import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { MODELS } from '../src/models.mjs';

const metadataSchema = z.object({
  id: z.string(),
  downloads: z.number().int().nonnegative().nullable().optional(),
  downloadsAllTime: z.number().int().nonnegative().nullable().optional(),
  likes: z.number().int().nonnegative().nullable().optional(),
});
const repoSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/);

export async function readUsage(repo, request = fetch) {
  const safeRepo = repoSchema.parse(repo);
  const url = new URL(`https://huggingface.co/api/models/${safeRepo}`);
  for (const field of ['downloads', 'downloadsAllTime', 'likes']) url.searchParams.append('expand[]', field);
  const response = await request(url, { signal: AbortSignal.timeout(20_000), redirect: 'error' });
  if (!response.ok) throw new Error(`Hugging Face metadata returned HTTP ${response.status}`);
  const metadata = metadataSchema.parse(await response.json());
  if (metadata.id !== safeRepo) throw new Error('The returned model identity does not match the request.');
  return {
    model: metadata.id,
    countedDownloadsLastMonth: metadata.downloads ?? null,
    countedDownloadsAllTime: metadata.downloadsAllTime ?? null,
    likes: metadata.likes ?? null,
  };
}

async function main() {
  const repositories = process.argv.slice(2);
  const rows = [];
  for (const repo of repositories.length ? repositories : MODELS.map((model) => model.repo)) rows.push(await readUsage(repo));
  process.stdout.write(`${JSON.stringify({
    observedAt: new Date().toISOString(),
    meaning: 'Hub-counted requests to designated download files, not unique users or active inference. Missing counters remain unknown (null).',
    countingRules: 'https://huggingface.co/docs/hub/models-download-stats',
    rows,
  }, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
