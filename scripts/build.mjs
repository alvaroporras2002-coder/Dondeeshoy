import { readFile, writeFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { resolve, join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'dist');
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const files = {};
async function addFile(path) {
  const bytes = await readFile(path);
  files['/' + relative(root, path).replaceAll('\\', '/')] = {
    body: bytes.toString('base64'), type: contentTypes[extname(path)] || 'application/octet-stream',
    etag: '"' + createHash('sha256').update(bytes).digest('hex').slice(0, 24) + '"',
  };
}
async function addDirectory(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) await addDirectory(full);
    else if (entry.isFile()) await addFile(full);
  }
}
for (const name of ['index.html', 'styles.css', 'app.js', 'data.js']) await addFile(join(root, name));
for (const name of ['manifest.webmanifest', 'favicon.svg']) {
  if (await stat(join(root, name)).catch(() => null)) await addFile(join(root, name));
}
await addDirectory(join(root, 'assets'));
const seed = (await readFile(join(root, 'data.js'), 'utf8')).replace(/^export (?=(?:const|async function|function)\b)/gm, '');
const api = (await readFile(join(root, 'worker/api.js'), 'utf8'))
  .replace(/^import \{ EVENTS \} from '\.\.\/data\.js';\n/m, '')
  .replace(/^export (?=(?:const|async function|function)\b)/gm, '');
const hosting = JSON.parse(await readFile(join(root, '.openai/hosting.json'), 'utf8'));
if (!hosting.project_id || hosting.d1 !== 'DB' || hosting.static != null) throw new Error('Worker hosting requires project_id, d1: "DB", and no static declaration.');
const worker = seed + '\n' + api + '\nconst staticFiles = ' + JSON.stringify(files) + `;
export default {
  async fetch(request, env) {
    const apiResponse = await handleApi(request, env);
    if (apiResponse) return apiResponse;
    const url = new URL(request.url);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const entry = staticFiles[path];
    if (!entry) return new Response('Página no encontrada', {status:404,headers:securityHeaders});
    if (!['GET','HEAD'].includes(request.method)) return new Response('Método no permitido', {status:405,headers:securityHeaders});
    const headers = {...securityHeaders, 'Content-Type':entry.type, 'ETag':entry.etag,
      'Cache-Control':path.startsWith('/assets/') ? 'public, max-age=3600, must-revalidate' : 'no-cache'};
    if (request.headers.get('if-none-match') === entry.etag) return new Response(null,{status:304,headers});
    if (request.method === 'HEAD') return new Response(null,{headers});
    const bytes = Uint8Array.from(atob(entry.body), char=>char.charCodeAt(0));
    return new Response(bytes,{headers});
  }
};
`;
await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'server'), { recursive: true });
await mkdir(join(out, '.openai'), { recursive: true });
await writeFile(join(out, 'server/index.js'), worker);
await writeFile(join(out, '.openai/hosting.json'), JSON.stringify(hosting, null, 2) + '\n');
console.log(`Built ${Object.keys(files).length} static resources and D1 API (${Math.round(Buffer.byteLength(worker) / 1024)} KB Worker).`);
