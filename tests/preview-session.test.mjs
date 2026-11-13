import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdir, open, readFile, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';

test(
  'preview CLI creates and removes its own session without touching other files',
  { timeout: 15000 },
  async (t) => {
    const project = process.cwd();
    const runtime = path.join(project, '.sites-runtime');
    const grantsFile = path.join(runtime, 'connector-preview-grants.json');
    const root = path.join(runtime, 'connector-preview');
    const descriptor = path.join(root, 'session.json');
    await mkdir(runtime, { recursive: true });
    try {
      await access(descriptor);
      t.skip('A developer already has an active connector preview session.');
      return;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    let grants;
    try {
      grants = await open(grantsFile, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      t.skip('Preserve an existing developer grants file.');
      return;
    }
    const identity = await grants.stat();
    await grants.writeFile('[]');
    await grants.close();
    t.after(async () => {
      const current = await stat(grantsFile).catch(() => null);
      if (current?.ino === identity.ino) await unlink(grantsFile);
    });
    const script = path.join(
      project,
      'scripts',
      'connector-preview',
      'connector-preview-session.mjs',
    );
    const child = spawn(process.execPath, [script, project, grantsFile, '--lifetime-ms', '10000'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    t.after(() => {
      if (child.exitCode === null) child.kill('SIGTERM');
    });
    const exited = once(child, 'exit');
    const lines = createInterface({ input: child.stdout });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const messages = [];
    for await (const line of lines) {
      const message = JSON.parse(line);
      messages.push(message.method);
      if (message.method === 'ready') {
        const session = JSON.parse(await readFile(descriptor, 'utf8'));
        assert.match(session.id, /^[0-9a-f-]{36}$/);
        assert.equal(session.maxCalls, undefined);
        assert.deepEqual(session.connectorIds, []);
        assert.equal((await stat(path.join(root, session.id))).isDirectory(), true);
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'stop' })}\n`);
      }
    }
    const [code] = await exited;
    assert.equal(code, 0, stderr);
    assert.deepEqual(messages, ['ready', 'closed']);
    await assert.rejects(access(descriptor), { code: 'ENOENT' });
    assert.deepEqual(
      (await readdir(root)).filter((name) => /^[0-9a-f-]{36}$/.test(name)),
      [],
    );
  },
);
