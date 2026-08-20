/**
 * 조회수 카운터 (오늘 · 누적)
 *
 * 정적 사이트라 방문 횟수를 저장할 곳이 필요합니다. 두 가지 방식 중 하나를 씁니다.
 *
 *   mode: 'countapi'  설치 없이 바로 사용 (공개 무료 서비스 api.countapi.xyz)
 *   mode: 'worker'    직접 만든 Cloudflare Worker 사용 (worker/view-counter.js 참고, 권장)
 *   mode: 'off'       카운터 숨김
 *
 * 어떤 이유로든 호출이 실패하면 카운터는 표시되지 않습니다. (화면은 그대로 동작)
 */
window.VIEW_COUNTER = {
  mode: 'countapi',
  namespace: 'hanwhavision-coretime',   // countapi 네임스페이스 (다른 사이트와 겹치지 않게)
  workerUrl: ''                          // 예: 'https://coretime-counter.<계정>.workers.dev'
};

(function (global) {
  'use strict';

  var SESSION_KEY = 'hv-coretime:counted';

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** 같은 세션에서 새로고침할 때마다 숫자가 오르지 않도록 한 번만 집계 */
  function firstVisitInSession() {
    try {
      if (global.sessionStorage.getItem(SESSION_KEY)) return false;
      global.sessionStorage.setItem(SESSION_KEY, '1');
      return true;
    } catch (err) {
      return true;
    }
  }

  function getJSON(url) {
    return global.fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    });
  }

  function countApi(config, counting) {
    var base = 'https://api.countapi.xyz/' + (counting ? 'hit' : 'get') + '/' + config.namespace + '/';
    return Promise.all([getJSON(base + 'total'), getJSON(base + todayKey())])
      .then(function (results) {
        return { total: results[0].value || 0, today: results[1].value || 0 };
      });
  }

  function worker(config, counting) {
    return getJSON(config.workerUrl + (counting ? '?hit=1' : ''));
  }

  global.ViewCounter = {
    /** @param {Function} onCount  { today, total } 를 받아 화면에 표시 */
    load: function (onCount) {
      var config = global.VIEW_COUNTER || {};
      if (config.mode === 'off') return;
      if (config.mode === 'worker' && !config.workerUrl) return;
      if (!global.fetch || !global.Promise) return;

      var counting = firstVisitInSession();
      var request = config.mode === 'worker' ? worker(config, counting) : countApi(config, counting);

      request.then(function (data) {
        if (data && typeof data.total === 'number') onCount(data);
      }).catch(function () {
        /* 서비스 장애 · 사내망 차단 등 — 카운터를 표시하지 않는다 */
      });
    }
  };
})(window);
