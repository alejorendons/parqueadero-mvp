import { lstat, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';

async function privateDirectory(parent, name) {
  const directory = path.join(parent, name);
  await mkdir(directory, { mode: 0o700 }).catch((error) => {
    if (error.code !== 'EEXIST') throw error;
  });
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory() || (await realpath(directory)) !== directory) {
    throw new Error('Preview directories must be real directories inside this project.');
  }
  return directory;
}

// The caller supplies the script's own project directory, not a CLI-derived root.
// Grants use one fixed file; CLI arguments can select neither a write destination
// nor an arbitrary file to read. Reject junctions/symlinks before creating mailboxes.
export async function preparePreviewWorkspace(scriptProject, requestedProject, requestedGrants) {
  const project = await realpath(scriptProject);
  if (!path.isAbsolute(requestedProject) || (await realpath(requestedProject)) !== project) {
    throw new Error('Connector preview must run in the project containing this script.');
  }
  const runtime = await privateDirectory(project, '.sites-runtime');
  const grantsFile = path.join(runtime, 'connector-preview-grants.json');
  const info = await lstat(grantsFile);
  if (info.isSymbolicLink() || !info.isFile() || (await realpath(requestedGrants)) !== grantsFile) {
    throw new Error('Use the project file .sites-runtime/connector-preview-grants.json.');
  }
  return { grantsFile, root: await privateDirectory(runtime, 'connector-preview') };
}
