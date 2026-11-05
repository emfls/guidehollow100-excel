const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 20_000;
const MAX_COLUMNS = 100;

function validateHeaders(headers) {
  if (headers.length > MAX_COLUMNS) throw new Error('열은 최대 100개까지 비교할 수 있습니다.');
  if (!headers.length || headers.some(header => typeof header !== 'string' || !header.trim())) {
    throw new Error('첫 번째 행의 모든 열에 이름이 필요합니다.');
  }
  if (new Set(headers.map(header => header.trim())).size !== headers.length) {
    throw new Error('열 이름이 중복되었습니다. 공백을 제외해도 서로 다른 이름이어야 합니다.');
  }
}

export function parseCSV(text) {
  if (typeof text !== 'string') throw new Error('CSV 텍스트가 필요합니다.');
  if (text.length > MAX_BYTES || new TextEncoder().encode(text).length > MAX_BYTES) {
    throw new Error('파일은 UTF-8 기준 5 MB 이하여야 합니다.');
  }
  text = text.replace(/^\uFEFF/, '');
  let headers;
  const rows = [];
  const recordNumbers = [];
  let row = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  let hasContent = false;
  let record = 1;

  function finishRecord() {
    if (hasContent) {
      row.push(field);
      if (!headers) {
        validateHeaders(row);
        headers = row;
      } else {
        if (row.length !== headers.length) throw new Error(`${record}번째 행의 열 수가 제목 행과 다릅니다.`);
        if (rows.length >= MAX_ROWS) throw new Error('파일당 데이터 행은 최대 20,000개입니다.');
        rows.push(row);
        recordNumbers.push(record);
      }
    }
    row = [];
    field = '';
    closedQuote = false;
    hasContent = false;
    record += 1;
  }

  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (quoted) {
      if (character === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else { quoted = false; closedQuote = true; }
      } else field += character;
      continue;
    }
    if (character === '\r' || character === '\n') {
      finishRecord();
      if (character === '\r' && text[i + 1] === '\n') i += 1;
    } else if (character === ',') {
      hasContent = true;
      row.push(field);
      if (row.length >= MAX_COLUMNS) throw new Error('열은 최대 100개까지 비교할 수 있습니다.');
      field = '';
      closedQuote = false;
    } else if (character === '"') {
      if (field || closedQuote) throw new Error(`${record}번째 행의 따옴표 위치가 올바르지 않습니다.`);
      quoted = true;
      hasContent = true;
    } else {
      if (closedQuote) throw new Error(`${record}번째 행에서 닫는 따옴표 뒤에 문자가 있습니다.`);
      field += character;
      hasContent = true;
    }
  }
  if (quoted) throw new Error(`${record}번째 행의 따옴표가 닫히지 않았습니다.`);
  finishRecord();
  if (!headers) throw new Error('파일이 비어 있습니다. 열 이름과 데이터를 확인해 주세요.');
  return { headers, rows, recordNumbers };
}

function cents(value) {
  const text = value.trim();
  // Bound BigInt work; the 64 characters include signs, commas, and the decimal point.
  if (text.length > 64) return null;
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return null;
  const [integer, fraction = ''] = text.replace(/,/g, '').replace(/^-/, '').split('.');
  const amount = BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0'));
  return text.startsWith('-') ? -amount : amount;
}

function money(value) {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function reconcile({ left, right, leftKey, rightKey, leftAmount = null, rightAmount = null }) {
  if ((leftAmount === null) !== (rightAmount === null)) throw new Error('금액을 비교하려면 두 파일에서 모두 금액 열을 선택해 주세요.');
  const withAmounts = leftAmount !== null;
  const summary = { leftCount: 0, rightCount: 0, matched: 0, missing: 0, added: 0,
    amountMismatch: 0, review: 0, invalidAmounts: 0, leftTotal: null, rightTotal: null };

  function prepare(table, keyColumn, amountColumn, side) {
    if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) throw new Error('먼저 두 CSV 파일을 읽어 주세요.');
    validateHeaders(table.headers);
    if (table.rows.length > MAX_ROWS) throw new Error('파일당 데이터 행은 최대 20,000개입니다.');
    const keyIndex = table.headers.indexOf(keyColumn);
    const amountIndex = withAmounts ? table.headers.indexOf(amountColumn) : -1;
    if (keyIndex < 0 || (withAmounts && amountIndex < 0)) throw new Error('선택한 열이 해당 CSV 파일에 없습니다.');
    const counts = new Map();
    let total = 0n;
    const entries = table.rows.map((row, index) => {
      if (!Array.isArray(row) || row.length !== table.headers.length || row.some(value => typeof value !== 'string')) {
        throw new Error('CSV 데이터의 열 수와 텍스트 형식을 확인해 주세요.');
      }
      const key = row[keyIndex];
      const raw = withAmounts ? row[amountIndex] : '';
      const amount = withAmounts ? cents(raw) : null;
      if (withAmounts) {
        if (amount === null) summary.invalidAmounts += 1;
        else total += amount;
      }
      counts.set(key, (counts.get(key) || 0) + 1);
      return { key, row: table.recordNumbers?.[index] ?? index + 2, amount, raw };
    });
    summary[`${side}Count`] = entries.length;
    summary[`${side}Total`] = withAmounts ? money(total) : null;
    return { entries, counts, byKey: new Map(entries.map(entry => [entry.key, entry])) };
  }

  const a = prepare(left, leftKey, leftAmount, 'left');
  const b = prepare(right, rightKey, rightAmount, 'right');
  const rows = [];
  const handledRight = new Set();

  function reviewReason(entry) {
    const reasons = [];
    if (!entry.key.trim()) reasons.push('비교 번호가 비어 있습니다.');
    if ((a.counts.get(entry.key) || 0) > 1 || (b.counts.get(entry.key) || 0) > 1) reasons.push('중복 번호: 같은 번호가 있는 모든 행을 개별 확인해 주세요.');
    if (withAmounts && entry.amount === null) reasons.push('금액 형식 오류: 1234.56처럼 소수 둘째 자리까지, 부호·쉼표·소수점을 포함해 64자 이내로 입력해 주세요.');
    return reasons;
  }

  function emit(status, entryLeft, entryRight, note = '') {
    const display = entry => entry ? (entry.amount === null ? entry.raw : money(entry.amount)) : '';
    rows.push({ status, key: (entryLeft || entryRight).key,
      leftRow: entryLeft?.row ?? null, rightRow: entryRight?.row ?? null,
      leftAmount: display(entryLeft), rightAmount: display(entryRight),
      difference: withAmounts && entryLeft?.amount != null && entryRight?.amount != null ? money(entryRight.amount - entryLeft.amount) : '', note });
    summary[status === 'amount_mismatch' ? 'amountMismatch' : status] += 1;
  }

  for (const entry of a.entries) {
    const reasons = reviewReason(entry);
    const duplicateOrBlank = !entry.key.trim() || (a.counts.get(entry.key) || 0) > 1 || (b.counts.get(entry.key) || 0) > 1;
    if (duplicateOrBlank) { emit('review', entry, null, reasons.join(' ')); continue; }
    const other = b.byKey.get(entry.key);
    if (other) {
      handledRight.add(entry.key);
      const combinedReasons = [...new Set([...reasons, ...reviewReason(other)])];
      if (combinedReasons.length) emit('review', entry, other, combinedReasons.join(' '));
      else emit(withAmounts && entry.amount !== other.amount ? 'amount_mismatch' : 'matched', entry, other);
    } else emit(reasons.length ? 'review' : 'missing', entry, null, reasons.join(' '));
  }
  for (const entry of b.entries) {
    if (handledRight.has(entry.key)) continue;
    const reasons = reviewReason(entry);
    emit(reasons.length ? 'review' : 'added', null, entry, reasons.join(' '));
  }
  return { rows, summary };
}

const STATUS_LABELS = { matched: '일치', missing: '비교 파일에 없음', added: '비교 파일에만 있음', amount_mismatch: '금액 불일치', review: '확인 필요' };

export function resultsCSV(result) {
  function cell(value) {
    let text = String(value ?? '');
    if (/^[\s\u0000-\u001f\u007f]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }
  const records = [['상태', '비교 번호', '기준 파일 행', '비교 파일 행', '기준 금액', '비교 금액', '차이 (비교−기준)', '확인 사유'],
    ...result.rows.map(row => [STATUS_LABELS[row.status] || row.status, row.key, row.leftRow, row.rightRow,
      row.leftAmount, row.rightAmount, row.difference, row.note])];
  return `\uFEFF${records.map(record => record.map(cell).join(',')).join('\r\n')}\r\n`;
}
