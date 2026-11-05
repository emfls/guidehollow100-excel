import { parseCSV, reconcile, resultsCSV } from './core.mjs';

const $ = (id) => document.getElementById(id);
const labels = { matched: '일치', missing: '비교 파일에 없음', added: '비교 파일에만 있음', amount_mismatch: '금액 다름', review: '직접 확인 필요' };
const state = { left: null, right: null, leftName: '', rightName: '', result: null };
const revision = { left: 0, right: 0 };
const samples = {
  left: '주문번호,금액\r\nA100,10000\r\nA200,20000\r\nA300,30000\r\nA400,40000\r\nA400,40000\r\n',
  right: '주문번호,정산금액\r\nA100,10000\r\nA200,19000\r\nA400,40000\r\nA500,5000\r\n',
};
function displayMoney(value) {
  if (!/^-?\d+\.\d{2}$/.test(value || '')) return value;
  const [integer, fraction] = value.split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + fraction;
}
function clearError() { $('error').hidden = true; $('error').textContent = ''; }
function showError(message) { $('error').textContent = message; $('error').hidden = false; $('error').focus(); }
function invalidate() { state.result = null; $('results').hidden = true; clearError(); }
function readiness() {
  const ready = !!state.left && !!state.right;
  $('compare').disabled = !ready;
  $('ready').textContent = ready ? '준비됐습니다. 번호 열을 확인하고 ‘차이 찾기’를 누르세요.' : '파일 두 개를 선택하면 비교할 수 있습니다.';
}
function setTable(side, table, name) {
  state[side] = table; state[side + 'Name'] = name;
  for (const type of ['key', 'amount']) {
    const select = $(side + '-' + type); select.replaceChildren();
    if (type === 'amount') select.append(new Option('금액 비교 안 함', ''));
    if (table) table.headers.forEach((header) => select.append(new Option(header, header)));
    else if (type === 'key') select.append(new Option('파일을 먼저 선택하세요', ''));
    select.disabled = !table;
  }
  $(side + '-info').textContent = table ? `${name} · ${table.rows.length.toLocaleString('ko-KR')}행 · ${table.headers.length}열` : '아직 선택한 파일이 없습니다.';
  readiness();
}
for (const side of ['left', 'right']) {
  $(side + '-file').addEventListener('change', async (event) => {
    const ticket = ++revision[side]; invalidate(); setTable(side, null, '');
    const file = event.target.files[0]; if (!file) return;
    $(side + '-info').textContent = '파일을 읽고 있습니다…';
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('파일이 5MB보다 큽니다. 비교할 범위를 줄여 저장해 주세요.');
      if (!/\.csv$/i.test(file.name)) throw new Error('CSV 파일을 선택해 주세요. XLSX 파일은 엑셀에서 CSV UTF-8로 저장할 수 있습니다.');
      let text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
      catch { throw new Error('UTF-8로 읽을 수 없습니다. 엑셀에서 ‘CSV UTF-8(쉼표로 분리)’로 다시 저장해 주세요.'); }
      if (ticket !== revision[side]) return;
      setTable(side, parseCSV(text), file.name);
    } catch (error) {
      if (ticket !== revision[side]) return;
      setTable(side, null, ''); $(side + '-info').textContent = '파일을 읽지 못했습니다. 다른 파일을 선택해 주세요.';
      $(side + '-file').value = '';
      showError(`${side === 'left' ? '기준' : '비교'} 파일: ${error.message}`);
    }
  });
  for (const type of ['key', 'amount']) $(side + '-' + type).addEventListener('change', invalidate);
}
function renderRows() {
  const chosen = $('filter').value;
  const rows = state.result.rows.filter((row) => chosen === 'all' || (chosen === 'differences' ? row.status !== 'matched' : row.status === chosen));
  const body = $('rows'); body.replaceChildren();
  for (const row of rows.slice(0, 200)) {
    const tr = document.createElement('tr');
    for (const value of [labels[row.status], row.key || '(빈 번호)', row.leftRow ?? '—', row.rightRow ?? '—', displayMoney(row.leftAmount) || '—', displayMoney(row.rightAmount) || '—', displayMoney(row.difference) || '—', row.note]) {
      const td = document.createElement('td'); td.textContent = String(value ?? ''); tr.append(td);
    }
    body.append(tr);
  }
  $('shown').textContent = rows.length ? `${rows.length.toLocaleString('ko-KR')}건 중 ${Math.min(rows.length, 200)}건 표시` : '이 조건에 해당하는 항목이 없습니다.';
}
function compare() {
  invalidate();
  if (!state.left || !state.right) { showError('기준 파일과 비교 파일을 모두 선택해 주세요.'); return; }
  const leftAmount = $('left-amount').value || null, rightAmount = $('right-amount').value || null;
  if (!!leftAmount !== !!rightAmount) { showError('금액을 비교하려면 양쪽의 금액 열을 모두 골라 주세요. 번호만 비교하려면 양쪽 모두 ‘금액 비교 안 함’으로 바꿔 주세요.'); return; }
  try {
    state.result = reconcile({ left: state.left, right: state.right, leftKey: $('left-key').value, rightKey: $('right-key').value, leftAmount, rightAmount });
    const summary = state.result.summary;
    $('result-context').textContent = `기준: ${state.leftName} (${summary.leftCount}행) ↔ 비교: ${state.rightName} (${summary.rightCount}행)`;
    $('summary').replaceChildren();
    for (const [key, label] of [['matched', leftAmount ? '번호·금액 일치' : '번호 일치'], ['missing', labels.missing], ['added', labels.added], ['amountMismatch', labels.amount_mismatch], ['review', labels.review]]) {
      const card = document.createElement('div'); card.className = 'stat'; const count = document.createElement('strong'); count.textContent = `${summary[key]}건`; const text = document.createElement('span'); text.textContent = label; card.append(count, text); $('summary').append(card);
    }
    $('totals').textContent = leftAmount ? `${summary.invalidAmounts ? '읽을 수 있는 금액만 더한 일부 합계' : '파일별 금액 합계'} — 기준 ${displayMoney(summary.leftTotal)} / 비교 ${displayMoney(summary.rightTotal)} (중복 행 포함)` : '번호만 비교했습니다. 다른 열의 값은 일치 여부에 포함하지 않았습니다.';
    $('review-note').hidden = !summary.review;
    $('review-note').textContent = `직접 확인 필요 ${summary.review}건은 일치·누락으로 단정하지 않았습니다. 중복 번호는 양쪽 파일의 관련 행을 모두 표시합니다.${summary.invalidAmounts ? ` 잘못된 금액 ${summary.invalidAmounts}개는 합계에서 제외했습니다.` : ''}`;
    $('filter').value = 'differences'; $('results').hidden = false; renderRows(); $('results-title').focus();
  } catch (error) { state.result = null; showError(error.message); }
}
$('compare').addEventListener('click', compare);
$('filter').addEventListener('change', () => { if (state.result) renderRows(); });
$('sample').addEventListener('click', () => {
  invalidate();
  for (const side of ['left', 'right']) { ++revision[side]; $(side + '-file').value = ''; setTable(side, parseCSV(samples[side]), side === 'left' ? '샘플 주문 목록' : '샘플 정산 내역'); }
  $('left-amount').value = '금액'; $('right-amount').value = '정산금액'; compare();
});
$('reset').addEventListener('click', () => {
  invalidate();
  for (const side of ['left', 'right']) { ++revision[side]; $(side + '-file').value = ''; setTable(side, null, ''); }
  $('sample').focus();
});
$('download').addEventListener('click', () => {
  if (!state.result) return;
  const url = URL.createObjectURL(new Blob([resultsCSV(state.result)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'csv-비교-결과.csv'; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
