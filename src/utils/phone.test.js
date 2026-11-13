import test from 'node:test';
import assert from 'node:assert/strict';
import { toBrainPhone } from './phone.js';

test('every way of writing one mobile number gives the same Brain phone', () => {
  const ways = [
    '01712345678', ' 01712-345678 ', // as people type it
    '+8801712345678', '+880 1712-345678', '8801712345678', '008801712345678', // with the country code
    '1712345678', '+88 1712345678', // first 0 left out
  ];
  for (const written of ways) {
    assert.equal(toBrainPhone(written), '+8801712345678', `input: "${written}"`);
  }
});

test('a number that already has the country code is not prefixed twice', () => {
  assert.equal(toBrainPhone('8801733333333'), '+8801733333333');
  assert.equal(toBrainPhone('+880 2 9876543'), '+88029876543'); // land line
});

test('nothing in, nothing out', () => {
  for (const empty of ['', '   ', null, undefined, 'N/A']) assert.equal(toBrainPhone(empty), '');
});
