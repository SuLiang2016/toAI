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
  ['src/lib/storage.ts', 'storage.mjs'],
  ['src/server/ai/config.ts', 'provider-config.mjs'],
];

try {
  for (const [sourcePath, outputName] of moduleSpecs) {
    compileModule(sourcePath, outputName);
  }

  const result = spawnSync(
    process.execPath,
    [
      '--test',
      'scripts/streaming.behavior.test.mjs',
      'scripts/storage.behavior.test.mjs',
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
    .replaceAll('"@/lib/storage"', '"./storage.mjs"');
}
