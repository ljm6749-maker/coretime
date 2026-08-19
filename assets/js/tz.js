/**
 * 시간대 유틸리티
 * Intl API 만 사용하므로 별도 라이브러리 없이 서머타임(DST)이 자동 반영됩니다.
 */
(function (global) {
  'use strict';

  var partsCache = {};

  function formatter(tz) {
    if (!partsCache[tz]) {
      partsCache[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        weekday: 'short'
      });
    }
    return partsCache[tz];
  }

  var WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  /** UTC 밀리초를 특정 시간대의 벽시계 값으로 분해 */
  function zonedParts(tz, utcMs) {
    var parts = formatter(tz).formatToParts(new Date(utcMs));
    var out = {};
    for (var i = 0; i < parts.length; i++) {
      out[parts[i].type] = parts[i].value;
    }
    return {
      year: +out.year,
      month: +out.month,
      day: +out.day,
      hour: +out.hour,
      minute: +out.minute,
      second: +out.second,
      weekday: WEEKDAY_INDEX[out.weekday],
      /** 자정 기준 경과 시간(소수) — 09:30 → 9.5 */
      decimal: +out.hour + (+out.minute) / 60
    };
  }

  /** 해당 시점의 UTC 대비 오프셋(분). 한국 = +540 */
  function offsetMinutes(tz, utcMs) {
    var p = zonedParts(tz, utcMs);
    var asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUtc - utcMs) / 60000);
  }

  /** 특정 시간대의 벽시계 시각 → UTC 밀리초 (DST 전환 구간 보정 포함) */
  function wallToUtc(tz, year, month, day, hour, minute) {
    var guess = Date.UTC(year, month - 1, day, hour, minute || 0);
    var offset = offsetMinutes(tz, guess);
    var utc = guess - offset * 60000;
    // 오프셋이 바뀌는 경계(서머타임 시작/종료)에서 한 번 더 수렴시킨다.
    var refined = offsetMinutes(tz, utc);
    if (refined !== offset) utc = guess - refined * 60000;
    return utc;
  }

  /** "+09:00" 형태의 오프셋 문자열 */
  function offsetLabel(tz, utcMs) {
    var m = offsetMinutes(tz, utcMs);
    var sign = m < 0 ? '-' : '+';
    var abs = Math.abs(m);
    return 'UTC' + sign + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** 9.5 → "09:30" */
  function hhmm(decimal) {
    var total = Math.round(decimal * 60);
    var h = Math.floor(total / 60) % 24;
    var m = total % 60;
    return pad(h) + ':' + pad(m);
  }

  var DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

  /** 지도/카드용 짧은 날짜 표기: "8월 19일 (화)" */
  function dateLabel(p) {
    return p.month + '월 ' + p.day + '일 (' + DAY_KO[p.weekday] + ')';
  }

  /** 서머타임 적용 여부 (1월/7월 오프셋과 비교) */
  function isDST(tz, utcMs) {
    var d = new Date(utcMs);
    var jan = offsetMinutes(tz, Date.UTC(d.getUTCFullYear(), 0, 1));
    var jul = offsetMinutes(tz, Date.UTC(d.getUTCFullYear(), 6, 1));
    return offsetMinutes(tz, utcMs) > Math.min(jan, jul) && jan !== jul;
  }

  global.TZ = {
    zonedParts: zonedParts,
    offsetMinutes: offsetMinutes,
    offsetLabel: offsetLabel,
    wallToUtc: wallToUtc,
    hhmm: hhmm,
    pad: pad,
    dateLabel: dateLabel,
    isDST: isDST,
    DAY_KO: DAY_KO
  };
})(window);
