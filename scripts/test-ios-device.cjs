const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const source = fs.readFileSync('src/lib/ios-device.ts', 'utf8');
const mod = new Module('ios-device');
mod._compile(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, 'ios-device');
const {isIOSDevice} = mod.exports;
for (const [userAgent, platform, maxTouchPoints, expected] of [
 ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5, true],
 ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 'iPad', 5, true],
 ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Safari', 'MacIntel', 5, true],
 ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Safari', 'MacIntel', 0, false],
 ['Mozilla/5.0 (Linux; Android 15)', 'Linux armv8l', 5, false],
 ['Mozilla/5.0 (Windows NT 10.0)', 'Win32', 10, false],
]) assert.equal(isIOSDevice({userAgent, platform, maxTouchPoints}), expected, userAgent);
console.log('PASS: iPhone, iPad, iPadOS desktop mode; no mobile-original button on Mac, Android or Windows.');

const returnPathModule = new Module('auth-return-path');
returnPathModule._compile(ts.transpileModule(fs.readFileSync('src/lib/auth-return-path.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, 'auth-return-path');
const {authReturnPath} = returnPathModule.exports;
for (const value of [undefined, null, ['//external.test'], 'https://external.test', '//external.test', '/\\external.test', '/%5cexternal.test', '/\nexternal.test']) assert.equal(authReturnPath(value), '/dashboard');
assert.equal(authReturnPath('/project/test/selection?view=grid'), '/project/test/selection?view=grid');
console.log('PASS: authenticated login return accepts local routes and rejects external redirect destinations.');
