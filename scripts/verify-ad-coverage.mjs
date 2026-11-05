import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

async function check(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { count += await check(path); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const html = await readFile(path, 'utf8');
    const banner = '<iframe src="https://ads-partners.coupang.com/widgets.html';
    assert.equal(html.split(banner).length - 1, 1, `${path}: expected one Coupang banner`);
    assert.ok(html.includes('쿠팡 파트너스 활동의 일환'), `${path}: missing disclosure`);
    if (path.endsWith('tools/csv-compare/index.html')) {
      assert.ok(html.indexOf(banner) < html.indexOf('id="results"'), 'Tool banner must appear before hidden results');
    }
    count++;
  }
  return count;
}
const count = await check('dist');
assert.ok(count > 0, 'No HTML pages found');
console.log(`Coupang coverage: ${count} HTML pages, one banner each`);
