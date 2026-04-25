import fs from "node:fs";
import path from "node:path";

const ENV_FILE = path.join(process.cwd(), ".env.local");

function parseLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

export function readLocalEnvValue(name: string) {
  const runtimeValue = process.env[name]?.trim();
  if (runtimeValue) return runtimeValue;

  try {
    const content = fs.readFileSync(ENV_FILE, "utf8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed || parsed.key !== name) continue;
      return parsed.value;
    }
  } catch {
    return "";
  }

  return "";
}
