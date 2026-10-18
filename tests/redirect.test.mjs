import test from 'node:test';
import assert from 'node:assert/strict';
import {safeReturnPath} from '../lib/safe-redirect.ts';
test('Authentication redirects stay on this application',()=>{assert.equal(safeReturnPath('/redefinir-senha'),'/redefinir-senha');for(const value of ['https://evil.example','//evil.example','/\\evil.example','\\evil.example',null])assert.equal(safeReturnPath(value),'/');});
