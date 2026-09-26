import assert from 'node:assert';
import { getMatmConfig, processMatm, checkMatmStatus, getMatmHistory } from './matm.controller.js';

console.log('matm.controller: PaySprint MATM unit test starting...');

assert.strictEqual(typeof getMatmConfig, 'function');
assert.strictEqual(typeof processMatm, 'function');
assert.strictEqual(typeof checkMatmStatus, 'function');
assert.strictEqual(typeof getMatmHistory, 'function');

console.log('matm.controller: all PaySprint MATM assertions passed OK');
