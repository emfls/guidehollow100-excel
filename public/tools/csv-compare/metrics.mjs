const EVENTS = new Set(['tool_sample', 'file_ready', 'compare_complete', 'result_download', 'tool_error', 'tool_feedback']);
const ENUMS = {
  mode: ['sample', 'files', 'mixed'],
  reason: ['encoding', 'csv_format', 'file_type', 'size', 'columns', 'other', 'helpful', 'confusing', 'results', 'download'],
  stage: ['file', 'compare'],
};
let metrics;

export function buildEvent(name, params = {}) {
  if (!EVENTS.has(name)) return null;
  const safe = {};
  for (const [key, values] of Object.entries(ENUMS)) {
    if (values.includes(params?.[key])) safe[key] = params[key];
  }
  if (typeof params?.has_review === 'boolean') safe.has_review = params.has_review;
  return { name, params: safe };
}

export function track(name, params) {
  const event = buildEvent(name, params);
  if (event && metrics?.granted && !metrics.qa) window.gtag('event', event.name, event.params);
}

export function initMetrics({ measurementId, qa = false }) {
  const validId = /^G-[A-Z0-9]+$/.test(measurementId);
  metrics = { granted: false, qa: qa === true, active: false };
  const status = document.getElementById('metrics-status');
  const show = text => { if (status) status.textContent = text; };
  const consent = analytics_storage => ({ analytics_storage, ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });

  function allow() {
    if (metrics.qa) { show('테스트 모드: 통계를 전송하지 않습니다.'); return; }
    if (!validId) { show('이용 통계가 연결되지 않았습니다. 파일 내용은 전송하지 않습니다.'); return; }
    if (metrics.granted) return;
    metrics.granted = true;
    window[`ga-disable-${measurementId}`] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', consent('denied'));
    window.gtag('consent', 'update', consent('granted'));
    if (!metrics.active) {
      metrics.active = true;
      const page = { page_location: window.location.origin + window.location.pathname, page_referrer: '' };
      try {
        const referrer = new URL(document.referrer);
        if (['https:', 'http:'].includes(referrer.protocol)) page.page_referrer = referrer.origin;
      } catch { /* An absent or invalid referrer stays empty. */ }
      window.gtag('js', new Date());
      window.gtag('config', measurementId, { ...page, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
      window.gtag('event', 'page_view', page);
      if (!document.getElementById('gh-csv-gtag')) {
        const script = document.createElement('script');
        script.id = 'gh-csv-gtag';
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        document.head.appendChild(script);
      }
    }
    show('선택 통계 허용: 이용 통계용 쿠키를 사용합니다. 파일 내용은 전송하지 않습니다.');
  }

  document.getElementById('metrics-allow')?.addEventListener('click', () => {
    if (metrics.qa) { allow(); return; }
    try { window.localStorage.setItem('gh-csv-analytics', 'granted'); }
    catch { show('선택을 저장할 수 없어 통계를 켜지 않았습니다. 파일 내용은 전송하지 않습니다.'); return; }
    allow();
  });
  document.getElementById('metrics-deny')?.addEventListener('click', () => {
    metrics.granted = false;
    if (metrics.qa) { show('테스트 모드: 통계를 전송하지 않습니다.'); return; }
    let saved = true;
    try { window.localStorage.setItem('gh-csv-analytics', 'denied'); } catch { saved = false; }
    if (!metrics.qa && validId) {
      window[`ga-disable-${measurementId}`] = true;
      if (metrics.active) window.gtag('consent', 'update', consent('denied'));
      const domains = [''];
      const parts = window.location.hostname.split('.');
      while (parts.length > 1) { domains.push(`; Domain=${parts.join('.')}`); parts.shift(); }
      for (const name of ['_ga', `_ga_${measurementId.slice(2)}`]) {
        for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax`;
      }
    }
    show(saved ? '선택 통계 거부: 추가 전송을 중지했습니다. 완전히 적용하려면 새로고침해 주세요. 파일 내용은 전송하지 않습니다.'
      : '거부 선택을 저장하지 못했습니다. 현재 페이지의 통계는 중지했지만 다음 방문에는 이전 선택이 유지될 수 있습니다.');
  });
  show('이용 통계는 선택 사항입니다. 허용 전에는 통계 쿠키를 사용하지 않으며 파일 내용은 전송하지 않습니다.');
  if (metrics.qa) { show('테스트 모드: 통계를 전송하지 않습니다.'); return; }
  try { if (window.localStorage.getItem('gh-csv-analytics') === 'granted') allow(); }
  catch { show('선택을 읽을 수 없어 통계는 꺼져 있습니다. 파일 내용은 전송하지 않습니다.'); }
}
