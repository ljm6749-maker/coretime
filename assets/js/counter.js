/**
 * 조회수 카운터 (오늘 · 누적)
 *
 * 정적 사이트라 방문 횟수를 저장할 곳이 따로 필요합니다.
 *
 *   mode: 'auto'    workerUrl 이 있으면 Worker, 없으면 공개 무료 카운터를 차례로 시도 (기본값)
 *   mode: 'worker'  직접 배포한 Cloudflare Worker 만 사용 (worker/view-counter.js 참고, 가장 안정적)
 *   mode: 'off'     카운터 숨김
 *
 * ※ worker/view-counter.js 는 GitHub 에 올리는 것만으로는 동작하지 않습니다.
 *    Cloudflare Workers 에 '배포'한 뒤 발급된 주소를 아래 workerUrl 에 넣어야 합니다.
 *
 * 숫자가 보이지 않으면 브라우저 개발자도구(F12) Console 에 남는
 * [view-counter] 로그로 어느 단계에서 막혔는지 확인할 수 있습니다.
 */
window.VIEW_COUNTER = {
  mode: 'auto',
  namespace: 'hanwhavision-coretime',   // 다른 사이트와 겹치지 않는 이름
  workerUrl: 'https://coretime-counter.ljm6749.workers.dev',   // 배포한 Cloudflare Worker 주소
  timeoutMs: 6000
};

(function (global) {
  'use strict';

  var SESSION_KEY = 'hv-coretime:counted';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  function log(msg, extra) {
    try { global.console.warn('[view-counter] ' + msg, extra === undefined ? '' : extra); } catch (err) { /* noop */ }
  }

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

  /** 응답이 없어도 화면이 멈추지 않도록 제한 시간을 둔다 */
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = global.setTimeout(function () {
        if (!done) { done = true; reject(new Error('timeout ' + ms + 'ms')); }
      }, ms);
      promise.then(function (value) {
        if (!done) { done = true; global.clearTimeout(timer); resolve(value); }
      }, function (err) {
        if (!done) { done = true; global.clearTimeout(timer); reject(err); }
      });
    });
  }

  function getJSON(url, ms) {
    return withTimeout(
      global.fetch(url, { cache: 'no-store', mode: 'cors' }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }),
      ms
    );
  }

  /** 서비스마다 값을 담는 키 이름이 달라 하나로 맞춰준다 */
  function valueOf(payload) {
    if (!payload || typeof payload !== 'object') return null;
    var candidates = [payload.value, payload.count, payload.data && payload.data.up_count, payload.data && payload.data.count];
    for (var i = 0; i < candidates.length; i += 1) {
      if (typeof candidates[i] === 'number') return candidates[i];
    }
    return null;
  }

  function pairRequest(totalUrl, todayUrl, ms) {
    return Promise.all([getJSON(totalUrl, ms), getJSON(todayUrl, ms)]).then(function (results) {
      var total = valueOf(results[0]);
      var today = valueOf(results[1]);
      if (total === null || today === null) throw new Error('unexpected payload');
      return { total: total, today: today };
    });
  }

  /* ── 제공자 목록 (앞에서부터 시도하고 실패하면 다음으로 넘어간다) ───────── */

  var PROVIDERS = [
    {
      name: 'worker',
      available: function (cfg) { return !!cfg.workerUrl; },
      run: function (cfg, counting, ms) {
        var base = String(cfg.workerUrl).replace(/\/+$/, '');   // 끝의 / 는 떼고 붙인다
        return getJSON(base + (counting ? '/?hit=1' : '/'), ms).then(function (data) {
          if (!data || typeof data.total !== 'number') throw new Error('unexpected payload');
          return { total: data.total, today: typeof data.today === 'number' ? data.today : 0 };
        });
      }
    },
    {
      name: 'abacus',
      available: function () { return true; },
      run: function (cfg, counting, ms) {
        var base = 'https://abacus.jasoncameron.dev/' + (counting ? 'hit' : 'get') + '/' + cfg.namespace + '/';
        return pairRequest(base + 'total', base + todayKey(), ms);
      }
    },
    {
      name: 'counterapi',
      available: function () { return true; },
      run: function (cfg, counting, ms) {
        var base = 'https://api.counterapi.dev/v1/' + cfg.namespace + '/';
        var tail = counting ? '/up' : '';
        return pairRequest(base + 'total' + tail, base + todayKey() + tail, ms);
      }
    }
  ];

  function runChain(list, cfg, counting, ms) {
    if (!list.length) return Promise.reject(new Error('no provider left'));
    var provider = list[0];
    return provider.run(cfg, counting, ms).then(function (data) {
      return { data: data, provider: provider.name };
    }, function (err) {
      log(provider.name + ' 실패 → ' + (err && err.message ? err.message : err));
      return runChain(list.slice(1), cfg, counting, ms);
    });
  }

  global.ViewCounter = {
    /** @param {Function} onCount  { today, total } 를 받아 화면에 표시 */
    load: function (onCount) {
      var cfg = global.VIEW_COUNTER || {};
      if (cfg.mode === 'off') return;
      if (!global.fetch || !global.Promise) {
        log('이 브라우저는 fetch 를 지원하지 않습니다.');
        return;
      }

      var chain = PROVIDERS.filter(function (p) {
        if (cfg.mode === 'worker') return p.name === 'worker' && p.available(cfg);
        return p.available(cfg);
      });

      if (!chain.length) {
        log("mode 가 'worker' 인데 workerUrl 이 비어 있습니다.");
        return;
      }

      var counting = firstVisitInSession();
      var ms = cfg.timeoutMs || 6000;

      runChain(chain, cfg, counting, ms).then(function (result) {
        onCount(result.data);
      }).catch(function () {
        log('모든 카운터 서비스 호출에 실패했습니다. 사내망 차단이거나 서비스 장애일 수 있습니다. '
          + 'worker/view-counter.js 를 Cloudflare 에 배포한 뒤 workerUrl 을 지정하면 가장 안정적입니다.');
      });
    }
  };
})(window);
