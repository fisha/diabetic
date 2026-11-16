import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markParagraphs, markTextParts, stripBidiControls, directionMark, isolateLtr } from '../src/index.ts';

const RLM = '‏';
const LRM = '‎';

test('a Hebrew paragraph that starts with a Latin word gets an RTL mark (PM-159)', () => {
  assert.equal(markParagraphs('Stedio מבקשת עכשיו.', 'rtl'), `${RLM}Stedio מבקשת עכשיו.`);
  assert.equal(markParagraphs('AI?', 'ltr'), `${LRM}AI?`);
});

test('every paragraph gets a mark, once', () => {
  const once = markParagraphs('שורה\nStedio\n\nסוף', 'rtl');
  assert.equal(once, `${RLM}שורה\n${RLM}Stedio\n${RLM}\n${RLM}סוף`);
  assert.equal(markParagraphs(once, 'rtl'), once);
});

test('"auto" and empty text are left alone', () => {
  assert.equal(markParagraphs('hello', 'auto'), 'hello');
  assert.equal(markParagraphs('', 'rtl'), '');
});

test('text parts: the first part starts the paragraph, later parts only after a new line', () => {
  const el = { type: 'b' };
  assert.deepEqual(markTextParts(['Stedio ', el, ' עוד\nשורה'], 'rtl'), [`${RLM}Stedio `, el, ` עוד\n${RLM}שורה`]);
  assert.deepEqual(markTextParts([el, 'x'], 'rtl'), [RLM, el, 'x']);
  assert.deepEqual(markTextParts([124], 'ltr'), [`${LRM}124`]);
  assert.deepEqual(markTextParts([null], 'rtl'), [null]);
  assert.deepEqual(markTextParts([undefined, false], 'rtl'), [undefined, false]);
});

test('stripBidiControls removes marks and isolates', () => {
  assert.equal(stripBidiControls(`${directionMark('rtl')}${isolateLtr('07:30')}`), '07:30');
});
