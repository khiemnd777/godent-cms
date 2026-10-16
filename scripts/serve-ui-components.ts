import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Disposable browser fixture of the real shell components; never a product route.
const root = resolve(import.meta.dir, '..');
const dir = resolve(root, 'apps/admin/.local');
await mkdir(dir, { recursive: true });
const entry = resolve(dir, 'state-fixture.tsx');
await Bun.write(entry, `import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ShellState } from '../components/shell-state';
import Loading from '../app/cms/loading';
import ErrorPage from '../app/cms/error';
function Fixture(){const [attempt,setAttempt]=useState(0);return <main className="main" style={{margin:0}}>
<h1>Shell component verification</h1><section className="panel"><Loading/></section>
<section className="panel"><ShellState title="Nội dung chưa khả dụng" description="Chưa kết nối dữ liệu."/></section>
<section className="panel"><ErrorPage error={new Error('fixture')} reset={()=>setAttempt(n=>n+1)}/><p id="attempt">Retry count: {attempt}</p></section>
<section className="panel"><ShellState kind="denied" title="Bạn chưa có quyền truy cập" description="Liên hệ quản trị viên để kiểm tra quyền."/></section>
</main>};createRoot(document.getElementById('root')!).render(<Fixture/>);`);
const build = await Bun.build({ entrypoints: [entry], target: 'browser', define: { 'process.env.NODE_ENV': '"production"' } });
if (!build.success) throw new Error('Component fixture bundle failed.');
const script = await build.outputs[0]!.text();
const css = await Bun.file(resolve(root, 'apps/admin/app/globals.css')).text();
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === '/fixture.js') return new Response(script, { headers: { 'Content-Type': 'text/javascript' } });
  if (path === '/fixture.css') return new Response(css, { headers: { 'Content-Type': 'text/css' } });
  if (path !== '/') return new Response('Not found', { status: 404 });
  return new Response('<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shell component verification</title><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script type="module" src="/fixture.js"></script></html>', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
} });
console.log(`Disposable component fixture: http://127.0.0.1:${server.port}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void server.stop(true); });
