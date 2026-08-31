import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const FILE_PATH = path.join(process.cwd(), "data", "websites.json");

async function readAll() {
  try {
    const raw = await readFile(FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeAll(data) {
  await mkdir(path.dirname(FILE_PATH), { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(data, null, 2));
}

export async function get(url) {
  const data = await readAll();
  if (url in data) {
    return data[url];
  }
  return null;
}

export async function set(key, fields) {
  const data = await readAll();
  data[key] = { ...data[key], ...fields };
  await writeAll(data);
}

export async function has(url) {
  const data = await readAll();
  return url in data;
}

export async function remove(url) {
  const data = await readAll();
  delete data[url];
  await writeAll(data);
}

export async function all() {
  return Object.values(await readAll());
}
