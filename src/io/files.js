import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDirectory(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function writeJsonFile(filePath, value) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeTextFile(filePath, content) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, content, 'utf8');
}

export async function readJsonFile(filePath) {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content);
}

export async function readJsonFileIfExists(filePath) {
  const exists = await fileExists(filePath);
  if (!exists) {
    return null;
  }

  return readJsonFile(filePath);
}

export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
