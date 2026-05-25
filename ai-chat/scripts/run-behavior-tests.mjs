import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const repoRoot = process.cwd();
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'ai-chat-behavior-'));

const moduleSpecs = [
  ['src/types/chat.ts', 'chat-types.mjs'],
  ['src/lib/streaming.ts', 'streaming.mjs'],
  ['src/i18n/messages/zh-CN.ts', 'i18n-messages-zh-CN.mjs'],
  ['src/i18n/messages/en.ts', 'i18n-messages-en.mjs'],
  ['src/i18n/types.ts', 'i18n-types.mjs'],
  ['src/i18n/catalog.ts', 'i18n-catalog.mjs'],
  ['src/i18n/browser.ts', 'i18n-browser.mjs'],
  ['src/lib/storage.ts', 'storage.mjs'],
  ['src/content/in-app-help.ts', 'in-app-help.mjs'],
  ['src/content/in-app-help.zh-CN.ts', 'in-app-help.zh-CN.mjs'],
  ['src/content/in-app-help.en.ts', 'in-app-help.en.mjs'],
  ['src/server/ai/config.ts', 'provider-config.mjs'],
];

try {
  for (const [sourcePath, outputName] of moduleSpecs) {
    compileModule(sourcePath, outputName);
  }

  writeFileSync(
    path.join(tempRoot, 'i18n-lite.mjs'),
    [
      "export { getMessage, messagesByLocale } from './i18n-catalog.mjs';",
      "export { applyLocaleToDocument, getBootstrapScript, readLocaleFromBrowser, readLocaleFromCookie } from './i18n-browser.mjs';",
      "export { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES } from './i18n-types.mjs';",
    ].join('\n')
  );

  const result = spawnSync(
    process.execPath,
    [
      '--test',
      'scripts/streaming.behavior.test.mjs',
      'scripts/i18n.behavior.test.mjs',
      'scripts/storage.behavior.test.mjs',
      'scripts/help-content.behavior.test.mjs',
      'scripts/provider-config.behavior.test.mjs',
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        BEHAVIOR_MODULE_ROOT: tempRoot,
      },
    }
  );

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

function compileModule(sourcePath, outputName) {
  const source = readFileSync(path.join(repoRoot, sourcePath), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      isolatedModules: true,
    },
    fileName: sourcePath,
  });

  const outputPath = path.join(tempRoot, outputName);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rewriteImports(transpiled.outputText));
}

function rewriteImports(code) {
  return code
    .replaceAll("'@/types/chat'", "'./chat-types.mjs'")
    .replaceAll('"@/types/chat"', '"./chat-types.mjs"')
    .replaceAll("'@/lib/storage'", "'./storage.mjs'")
    .replaceAll('"@/lib/storage"', '"./storage.mjs"')
    .replaceAll("'@/i18n'", "'./i18n-lite.mjs'")
    .replaceAll('"@/i18n"', '"./i18n-lite.mjs"')
    .replaceAll("'./messages/zh-CN'", "'./i18n-messages-zh-CN.mjs'")
    .replaceAll('"./messages/zh-CN"', '"./i18n-messages-zh-CN.mjs"')
    .replaceAll("'./messages/en'", "'./i18n-messages-en.mjs'")
    .replaceAll('"./messages/en"', '"./i18n-messages-en.mjs"')
    .replaceAll("'./types'", "'./i18n-types.mjs'")
    .replaceAll('"./types"', '"./i18n-types.mjs"')
    .replaceAll("'./catalog'", "'./i18n-catalog.mjs'")
    .replaceAll('"./catalog"', '"./i18n-catalog.mjs"')
    .replaceAll("'./browser'", "'./i18n-browser.mjs'")
    .replaceAll('"./browser"', '"./i18n-browser.mjs"')
    .replaceAll("'./in-app-help.en'", "'./in-app-help.en.mjs'")
    .replaceAll('"./in-app-help.en"', '"./in-app-help.en.mjs"')
    .replaceAll("'./in-app-help.zh-CN'", "'./in-app-help.zh-CN.mjs'")
    .replaceAll('"./in-app-help.zh-CN"', '"./in-app-help.zh-CN.mjs"')
    .replaceAll("'./in-app-help'", "'./in-app-help.mjs'")
    .replaceAll('"./in-app-help"', '"./in-app-help.mjs"');
}
