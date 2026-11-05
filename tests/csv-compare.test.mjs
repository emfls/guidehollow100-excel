import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, reconcile, resultsCSV } from '../public/tools/csv-compare/core.mjs';

function compare(left, right, amounts = true) {
  return reconcile({ left: parseCSV(left), right: parseCSV(right), leftKey: 'id', rightKey: 'id',
    leftAmount: amounts ? 'amount' : null, rightAmount: amounts ? 'amount' : null });
}

test('CSV preserves quoted commas, escaped quotes, newlines, whitespace, and literal HTML', () => {
  const parsed = parseCSV('\uFEFFid,note\r\n001,"a,b"\r\n002,"a""b\r\nc"\r\n003, <img onerror=alert(1)> \r\n');
  assert.deepEqual(parsed.headers, ['id', 'note']);
  assert.deepEqual(parsed.rows, [['001', 'a,b'], ['002', 'a"b\r\nc'], ['003', ' <img onerror=alert(1)> ']]);
});

test('CSV rejects corrupt records and ambiguous headers instead of guessing', () => {
  for (const input of ['', '\uFEFF\r\n', 'id,id\na,b', 'id, id \na,b', 'id,\na,b',
    'id,note\na', 'id,note\na,b,c', 'id,note\na,"unfinished', 'id,note\na,b"c',
    'id,note\na,"b"oops', 'id,note\na, "b"']) {
    assert.throws(() => parseCSV(input), Error, JSON.stringify(input));
  }
});

test('blank physical records are skipped but quoted or whitespace records remain data', () => {
  const parsed = parseCSV('\nid\n\n""\n \nA\n');
  assert.deepEqual(parsed.rows, [[''], [' '], ['A']]);
  const result = reconcile({ left: parsed, right: parseCSV('id\nA'), leftKey: 'id', rightKey: 'id' });
  assert.deepEqual(result.rows.map(row => [row.status, row.leftRow]), [['review', 4], ['review', 5], ['matched', 6]]);
});

test('limits reject oversized UTF-8 files, too many columns, and too many data records', () => {
  assert.throws(() => parseCSV(`id\n${'가'.repeat(1_800_000)}`), /5 MB/);
  assert.throws(() => parseCSV(Array.from({ length: 101 }, (_, i) => `c${i}`).join(',')), /100/);
  assert.equal(parseCSV(`id\n${'x\n'.repeat(20_000)}`).rows.length, 20_000);
  assert.throws(() => parseCSV(`id\n${'x\n'.repeat(20_001)}`), /20,000/);
});

test('unique rows reconcile with exact decimal money including unsafe-integer-sized values', () => {
  const result = compare('id,amount\nA,0.10\nB,0.20\nC,9007199254740993.01\nD,-1.20\nE,"1,234.56"',
    'id,amount\nA,0.10\nB,0.21\nC,9007199254740993.02\nD,-1.21\nF,3.00');
  assert.deepEqual(result.rows.map(row => [row.key, row.status, row.difference]), [
    ['A', 'matched', '0.00'], ['B', 'amount_mismatch', '0.01'], ['C', 'amount_mismatch', '0.01'],
    ['D', 'amount_mismatch', '-0.01'], ['E', 'missing', ''], ['F', 'added', '']]);
  assert.equal(result.summary.leftTotal, '9007199254742226.67');
  assert.equal(result.summary.rightTotal, '9007199254740995.12');
  assert.equal(result.summary.matched, 1);
  assert.equal(result.summary.amountMismatch, 3);
  assert.equal(result.summary.missing, 1);
  assert.equal(result.summary.added, 1);
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('duplicate keys mark every source row for review even when opposite order suggests a pairing', () => {
  const result = compare('id,amount\nA,1\nA,2\nB,3', 'id,amount\nA,2\nA,1\nB,3');
  assert.equal(result.summary.matched, 1);
  assert.equal(result.summary.review, 4);
  assert.deepEqual(result.rows.filter(row => row.key === 'A').map(row => [row.status, row.leftRow, row.rightRow]),
    [['review', 2, null], ['review', 3, null], ['review', null, 2], ['review', null, 3]]);
  const oneDuplicate = compare('id,amount\nA,1\nA,1', 'id,amount\nA,1');
  assert.equal(oneDuplicate.summary.review, 3);
  assert.equal(oneDuplicate.summary.matched, 0);
});

test('invalid amounts and blank keys never become matches and totals disclose rejected cells', () => {
  for (const invalid of ['', '1.234', '1e3', '12,34', 'NaN', 'Infinity', '+1', '$1', '1 000', '--1']) {
    const left = `id,amount\nA,"${invalid}"`;
    const result = compare(left, 'id,amount\nA,2');
    assert.equal(result.rows[0].status, 'review', invalid);
    assert.equal(result.summary.invalidAmounts, 1);
    assert.equal(result.summary.leftTotal, '0.00');
    assert.equal(result.summary.rightTotal, '2.00');
  }
  const blank = compare('id,amount\n ,1\n,2', 'id,amount\n ,1\n,2');
  assert.equal(blank.summary.review, 4);
  assert.equal(blank.summary.matched, 0);
});

test('key identity retains spaces and leading zeros and column names validate per file', () => {
  const result = compare('id,amount\n001,1\n A,2\nA,3', 'id,amount\n1,1\nA,3', false);
  assert.deepEqual(result.rows.map(row => row.status), ['missing', 'missing', 'matched', 'added']);
  assert.equal(result.summary.leftTotal, null);
  assert.equal(result.summary.invalidAmounts, 0);
  const left = parseCSV('left,value\nX,1');
  const right = parseCSV('right,total\nX,1');
  assert.equal(reconcile({left, right, leftKey:'left', rightKey:'right', leftAmount:'value', rightAmount:'total'}).summary.matched, 1);
  assert.throws(() => reconcile({left, right, leftKey:'right', rightKey:'right'}));
  assert.throws(() => reconcile({left, right, leftKey:'left', rightKey:'right', leftAmount:'value'}));
  assert.throws(() => reconcile({left, right, leftKey:'left', rightKey:'right', leftAmount:'missing', rightAmount:'total'}));
});

test('record numbers count CSV records rather than physical quoted lines', () => {
  const result = compare('id,note\nA,"first\nsecond"\nB,last', 'id,note\nB,last', false);
  assert.deepEqual(result.rows.map(row => [row.key, row.leftRow, row.rightRow]), [['A', 2, null], ['B', 3, 2]]);
});

test('equivalent money spellings compare equally and empty data files retain zero totals', () => {
  const result = compare('id,amount\n__proto__," 1,234.50 "\nconstructor,-0\n01,0001.2',
    'id,amount\n__proto__,1234.5\nconstructor,0.00\n01,1.20');
  assert.equal(result.summary.matched, 3);
  assert.equal(result.summary.leftTotal, '1235.70');
  assert.deepEqual(result.rows.map(row => row.difference), ['0.00', '0.00', '0.00']);
  const empty = compare('id,amount', 'id,amount');
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.summary.leftTotal, '0.00');
});

test('public reconciliation rejects malformed table objects and parser rejects nontext input', () => {
  assert.throws(() => parseCSV(null));
  const right = parseCSV('id\nA');
  for (const left of [null, {}, {headers:['id'], rows:[['A','extra']]},
    {headers:['id'], rows:[[42]]}, {headers:['id','id'], rows:[]},
    {headers:['id'], rows:Array.from({length:20_001}, () => ['A'])}]) {
    assert.throws(() => reconcile({left, right, leftKey:'id', rightKey:'id'}));
  }
});

test('download CSV has Korean headings, BOM, CRLF, escaping, and formula injection protection', () => {
  const keys = ['=1+1', '+SUM(A1)', '-1', '@A1', ' \t=1', '\r=1', '"comma,quote"'];
  const result = { rows: keys.map(key => ({ status:'review', key, leftRow:2, rightRow:null,
    leftAmount:'-2.00', rightAmount:'', difference:'-0.01', note:'line\n"quoted"' })) };
  const csv = resultsCSV(result);
  assert.ok(csv.startsWith('\uFEFF"상태","비교 번호"'));
  assert.ok(csv.includes('\r\n'));
  const parsed = parseCSV(csv);
  assert.equal(parsed.rows[0][0], '확인 필요');
  assert.deepEqual(parsed.rows.map(row => row[1]), ["'=1+1", "'+SUM(A1)", "'-1", "'@A1", "' \t=1", "'\r=1", '"comma,quote"']);
  assert.equal(parsed.rows[0][4], "'-2.00");
  assert.equal(parsed.rows[0][6], "'-0.01");
  assert.equal(parsed.rows[0][7], 'line\n"quoted"');
});
