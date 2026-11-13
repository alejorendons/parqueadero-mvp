import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { preparePreviewWorkspace } from '../scripts/connector-preview/workspace.mjs';

async function fixture(t) {
  const scratch = path.resolve('.sites-runtime', 'security-tests');
  await mkdir(scratch, { recursive: true });
  const root = await realpath(await mkdtemp(path.join(scratch, 'workspace-')));
  t.after(async () => {
    // The recursive cleanup is limited to the fixture created under this project.
    assert.equal(path.dirname(root), await realpath(scratch));
    await rm(root, { recursive: true, force: true });
  });
  const project = path.join(root, 'project');
  const outside = path.join(root, 'outside');
  await mkdir(project);
  await mkdir(outside);
  await mkdir(path.join(project, '.sites-runtime'));
  const grantsFile = path.join(project, '.sites-runtime', 'connector-preview-grants.json');
  await writeFile(grantsFile, '[]');
  return { root, project, outside, grantsFile };
}

test('preview uses only the script project and its fixed grants file', async (t) => {
  const f = await fixture(t);
  const result = await preparePreviewWorkspace(f.project, f.project, f.grantsFile);
  assert.equal(result.root, path.join(f.project, '.sites-runtime', 'connector-preview'));
  assert.equal(await readFile(result.grantsFile, 'utf8'), '[]');
});
test('faulty CLI project cannot redirect preview writes to another directory', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    preparePreviewWorkspace(f.project, f.outside, f.grantsFile),
    /containing this script/,
  );
});
test('grants cannot be read from outside the project or from an arbitrary project file', async (t) => {
  const f = await fixture(t);
  const external = path.join(f.outside, 'grants.json');
  const other = path.join(f.project, 'other.json');
  await writeFile(external, '[]');
  await writeFile(other, '[]');
  await assert.rejects(preparePreviewWorkspace(f.project, f.project, external), /project file/);
  await assert.rejects(preparePreviewWorkspace(f.project, f.project, other), /project file/);
});
test('a junction or symlink cannot redirect the mailbox outside the project', async (t) => {
  const f = await fixture(t);
  await symlink(
    f.outside,
    path.join(f.project, '.sites-runtime', 'connector-preview'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(
    preparePreviewWorkspace(f.project, f.project, f.grantsFile),
    /real directories/,
  );
});
