import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

export const BACKUP_FILE_INPUT_SELECTOR = 'input[type="file"][accept*="application/json"]';

const DEFAULT_READY_EXPRESSION = `
  document.readyState === 'complete'
    && Boolean(document.querySelector('button[aria-label="About"]'))
    && Boolean(document.querySelector('textarea[aria-label="Chat message draft"]'))
    && Boolean(document.querySelector('input[type="file"]'))
`;

export function getPnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function ensureParentDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function recreateDir(dirPath) {
  await rm(dirPath, { recursive: true, force: true });
  await mkdir(dirPath, { recursive: true });
}

export function runCommand(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

export function taskkillImage(imageName) {
  try {
    execFileSync('taskkill', ['/IM', imageName, '/T', '/F'], { stdio: 'ignore' });
  } catch {
    // Ignore "not found" style failures.
  }
}

export async function waitFor(check, description, timeoutMs = 60000, intervalMs = 500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await check();
    if (result) {
      return result;
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for ${description}`);
}

export async function waitForHttpOk(url, description = `${url} to respond`) {
  await waitFor(async () => {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      return response.ok || response.status === 304;
    } catch {
      return false;
    }
  }, description, 60000, 1000);
}

export async function waitForChildExit(child, timeoutMs = 10000, intervalMs = 500) {
  if (!child) {
    return;
  }

  await waitFor(() => child.exitCode !== null, `process ${child.pid} to exit`, timeoutMs, intervalMs);
}

export async function closeChildProcess(child, imageName) {
  if (!child || child.exitCode !== null) {
    if (imageName) {
      taskkillImage(imageName);
    }
    return;
  }

  try {
    execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    if (imageName) {
      taskkillImage(imageName);
    }
  }

  await sleep(2000);
}

export async function requestGracefulClose(session, child, imageName) {
  if (!session) {
    return;
  }

  try {
    await Promise.race([
      session.send('Browser.close').catch(() => null),
      sleep(2000),
    ]);
  } catch {
    // Fall through to the normal shutdown path.
  }

  session.close();

  try {
    await waitForChildExit(child);
  } catch {
    await closeChildProcess(child, imageName);
  }
}

function lookupOnPath(command) {
  try {
    const output = execFileSync('where', [command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? null;
  } catch {
    return null;
  }
}

export function findBrowserExecutable() {
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.ProgramFiles ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.ProgramFiles ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    lookupOnPath('msedge'),
    lookupOnPath('chrome'),
  ].filter(Boolean);

  const executable = candidates.find(candidate => existsSync(candidate));
  if (!executable) {
    throw new Error('Unable to find Microsoft Edge or Google Chrome for browser smoke automation.');
  }

  return executable;
}

export async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

export async function fetchDebuggerTargets(port) {
  return fetchJson(`http://127.0.0.1:${port}/json/list`);
}

export async function getPageDebuggerUrl(port, matcher = target => target.type === 'page') {
  return waitFor(async () => {
    try {
      const targets = await fetchDebuggerTargets(port);
      const pageTarget = targets.find(target => (
        typeof target.webSocketDebuggerUrl === 'string' &&
        matcher(target)
      ));
      return pageTarget?.webSocketDebuggerUrl ?? null;
    } catch {
      return null;
    }
  }, `page debugger target on port ${port}`, 60000, 1000);
}

export class CdpSession {
  constructor(webSocketUrl) {
    this.id = 0;
    this.pending = new Map();
    this.webSocketUrl = webSocketUrl;
    this.socket = new WebSocket(webSocketUrl);
    this.openPromise = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const payload = JSON.parse(event.data);
      if (!Object.prototype.hasOwnProperty.call(payload, 'id')) {
        return;
      }

      const entry = this.pending.get(payload.id);
      if (!entry) {
        return;
      }
      this.pending.delete(payload.id);

      if (payload.error) {
        entry.reject(new Error(payload.error.message || `CDP error for ${entry.method}`));
      } else {
        entry.resolve(payload.result ?? {});
      }
    });
  }

  async ready() {
    await this.openPromise;
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (exceptionDetails) {
      throw new Error(exceptionDetails.text || 'Runtime evaluation failed');
    }

    return result?.value;
  }

  async setFileInputFiles(selector, files) {
    const { root } = await this.send('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeId } = await this.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) {
      throw new Error(`Unable to locate file input for selector ${selector}`);
    }

    await this.send('DOM.setFileInputFiles', { nodeId, files });
  }

  close() {
    this.socket.close();
  }
}

export async function waitForUiReady(session, expression = DEFAULT_READY_EXPRESSION, description = 'hydrated chat UI') {
  await waitFor(async () => {
    try {
      return await session.evaluate(expression);
    } catch {
      return false;
    }
  }, description, 60000, 1000);
}

export async function connectToPage({ port, matcher, readyExpression = DEFAULT_READY_EXPRESSION, readyDescription }) {
  const debuggerUrl = await getPageDebuggerUrl(port, matcher);
  const session = new CdpSession(debuggerUrl);
  await session.ready();
  await waitForUiReady(session, readyExpression, readyDescription);
  return session;
}

export async function waitForExpression(session, expression, description, timeoutMs = 15000, intervalMs = 500) {
  await waitFor(async () => {
    try {
      return await session.evaluate(expression);
    } catch {
      return false;
    }
  }, description, timeoutMs, intervalMs);
}

export async function waitForExpressionValue(session, expression, description, timeoutMs = 15000, intervalMs = 500) {
  return waitFor(async () => {
    try {
      const value = await session.evaluate(expression);
      return value || null;
    } catch {
      return null;
    }
  }, description, timeoutMs, intervalMs);
}

export async function clickSelector(session, selector) {
  const clicked = await session.evaluate(`
    (() => {
      const target = document.querySelector(${JSON.stringify(selector)});
      if (!target) {
        return false;
      }
      target.click();
      return true;
    })()
  `);

  if (!clicked) {
    throw new Error(`Unable to find element for selector "${selector}"`);
  }
}

export async function clickButtonByText(session, text) {
  const clicked = await session.evaluate(`
    (() => {
      const target = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === ${JSON.stringify(text)});
      if (!target) {
        return false;
      }
      target.click();
      return true;
    })()
  `);

  if (!clicked) {
    throw new Error(`Unable to find button with text "${text}"`);
  }
}

export async function clickButtonContainingText(session, textFragment) {
  const clicked = await session.evaluate(`
    (() => {
      const target = [...document.querySelectorAll('button')].find(button => button.textContent?.includes(${JSON.stringify(textFragment)}));
      if (!target) {
        return false;
      }
      target.click();
      return true;
    })()
  `);

  if (!clicked) {
    throw new Error(`Unable to find button containing "${textFragment}"`);
  }
}

export async function fillInput(session, selector, value) {
  const changed = await session.evaluate(`
    (() => {
      const target = document.querySelector(${JSON.stringify(selector)});
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return false;
      }
      const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
      const setValue = descriptor?.set;
      if (!setValue) {
        return false;
      }
      target.focus();
      setValue.call(target, ${JSON.stringify(value)});
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);

  if (!changed) {
    throw new Error(`Unable to fill field for selector "${selector}"`);
  }
}

export async function removeDirWithRetries(targetPath, attempts = 8) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      await sleep(1000 * attempt);
    }
  }

  throw lastError;
}
