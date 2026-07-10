/**
 * Sync i18n translations
 * Run: bun sync-i18n.ts
 */
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function* walkDir(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      if (!entry.name.endsWith('.d.ts')) {
        yield fullPath;
      }
    }
  }
}

async function extractTranslations(srcDir: string): Promise<Map<string, string>> {
  const translations = new Map<string, string>();
  const idPattern = /id:\s*['"]([^'"]+)['"]\s*,\s*defaultMessage:\s*['"]([^'"]+)['"]/g;
  // Also handle multi-line and reversed order (defaultMessage before id)
  const idPattern2 = /defaultMessage:\s*['"]([^'"]+)['"]\s*,\s*id:\s*['"]([^'"]+)['"]/g;

  for await (const file of walkDir(srcDir)) {
    const content = await readFile(file, 'utf-8');

    let match;
    while ((match = idPattern.exec(content)) !== null) {
      translations.set(match[1], match[2]);
    }
    while ((match = idPattern2.exec(content)) !== null) {
      translations.set(match[2], match[1]);
    }
  }

  return translations;
}

async function main() {
  const srcDir = 'apps/client/src';
  const enPath = 'apps/client/src/locales/en.json';
  const idPath = 'apps/client/src/locales/id.json';

  console.log('Extracting translations from source files...');
  const extracted = await extractTranslations(srcDir);
  console.log(`Found ${extracted.size} unique translation keys in source`);

  const enJson = JSON.parse(await readFile(enPath, 'utf-8'));
  const idJson = JSON.parse(await readFile(idPath, 'utf-8'));

  // Find missing keys
  const missingInEn = [...extracted.keys()].filter(k => !(k in enJson));
  const missingInId = [...extracted.keys()].filter(k => !(k in idJson));

  console.log(`Missing in en.json: ${missingInEn.length}`);
  console.log(`Missing in id.json: ${missingInId.length}`);

  // Find dead keys
  const deadInEn = Object.keys(enJson).filter(k => !extracted.has(k));
  const deadInId = Object.keys(idJson).filter(k => !extracted.has(k));

  console.log(`Dead/unused in en.json: ${deadInEn.length}`);
  console.log(`Dead/unused in id.json: ${deadInId.length}`);

  // Add missing keys
  for (const key of missingInEn) {
    enJson[key] = extracted.get(key);
  }
  for (const key of missingInId) {
    idJson[key] = extracted.get(key);
  }

  // Remove dead keys
  for (const key of deadInEn) {
    delete enJson[key];
  }
  for (const key of deadInId) {
    delete idJson[key];
  }

  // Sort and write
  const enSorted = Object.fromEntries(Object.entries(enJson).sort(([a], [b]) => a.localeCompare(b)));
  const idSorted = Object.fromEntries(Object.entries(idJson).sort(([a], [b]) => a.localeCompare(b)));

  await writeFile(enPath, JSON.stringify(enSorted, null, 2) + '\n', 'utf-8');
  await writeFile(idPath, JSON.stringify(idSorted, null, 2) + '\n', 'utf-8');

  console.log(`\n✓ Sync complete!`);
  console.log(`  en.json: ${Object.keys(enSorted).length} keys`);
  console.log(`  id.json: ${Object.keys(idSorted).length} keys`);
  console.log(`  Added: ${missingInEn.length} keys`);
  console.log(`  Removed: ${deadInEn.length} dead keys`);
  console.log(`\nNote: Indonesian translations use English defaultMessage placeholders.`);
  console.log(`      Translate them manually for production use.`);
}

main().catch(console.error);
