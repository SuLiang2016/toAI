import assert from 'node:assert/strict';
import test from 'node:test';
import { importBehaviorModule } from './behavior-test-helpers.mjs';

const { StreamingParseError, consumeSseBuffer, readStreamEventContent } = await importBehaviorModule('streaming.mjs');

test('consumeSseBuffer parses complete data payloads and preserves trailing remainder', () => {
  const buffer = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n' +
    'data: {"choices":[{"delta":{"content":" world"}}]}\n' +
    'data: {"choices":[{"delta":{"content":"incomplete"}}]}';

  const result = consumeSseBuffer(buffer);

  assert.equal(result.done, false);
  assert.equal(result.events.length, 2);
  assert.equal(result.remainder, 'data: {"choices":[{"delta":{"content":"incomplete"}}]}');
  assert.equal(readStreamEventContent(result.events), 'Hello world');
});

test('consumeSseBuffer marks done when DONE marker arrives', () => {
  const result = consumeSseBuffer('data: [DONE]\n');
  assert.equal(result.done, true);
  assert.deepEqual(result.events, []);
  assert.equal(result.remainder, '');
});

test('consumeSseBuffer ignores non-data lines', () => {
  const result = consumeSseBuffer(': ping\nid: 1\nevent: message\ndata: {"choices":[{"delta":{"content":"Hi"}}]}\n');
  assert.equal(result.done, false);
  assert.equal(readStreamEventContent(result.events), 'Hi');
});

test('consumeSseBuffer throws StreamingParseError for invalid JSON payloads', () => {
  assert.throws(() => consumeSseBuffer('data: {not-json}\n'), StreamingParseError);
});

test('readStreamEventContent joins only defined delta content values', () => {
  const content = readStreamEventContent([
    { choices: [{ delta: { content: 'A' } }] },
    { choices: [{ delta: {} }] },
    {},
    { choices: [{ delta: { content: 'B' } }] },
  ]);

  assert.equal(content, 'AB');
});
