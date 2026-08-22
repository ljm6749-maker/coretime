/**
 * 코어타임 판정 엔진
 *
 * 글로벌 코어타임은 "같은 절대 시각"을 가리키는 창이므로,
 * 한국 19:00~22:00 이 코어타임이면 북미 동부의 06:00~09:00 도 같은 순간이라
 * 시간표에서 같은 열이 붉게 칠해집니다.
 */
(function (global) {
  'use strict';

  var STATUS_LABEL = {
    core: '코어타임',
    partial: '코어타임 일부 벗어남',   // 코어타임에 시작하지만 종료가 창을 넘어감
    agree: '협의 편성',      // 코어타임이 현지 새벽 — 당사자 협의 대상
    work: '근무시간',
    out: '근무시간 외',
    off: '휴무'
  };

  function quarterOf(month) { return 'Q' + Math.ceil(month / 3); }

  function dateKey(parts) {
    return parts.year + '-' + global.TZ.pad(parts.month) + '-' + global.TZ.pad(parts.day);
  }

  function policyFor(year, month) {
    var q = quarterOf(month);
    var p = global.CORE_TIME_POLICY[q];
    return {
      quarter: q, year: year,
      label: p.label, note: p.note, rotation: p.rotation,
      windows: p.windows,
      baseTz: global.CORE_TIME_BASE_TZ
    };
  }

  function nextQuarterOf(policy) {
    var n = +policy.quarter.slice(1);
    var q = n === 4 ? 'Q1' : 'Q' + (n + 1);
    var year = n === 4 ? policy.year + 1 : policy.year;
    var p = global.CORE_TIME_POLICY[q];
    return {
      quarter: q, year: year, label: p.label, note: p.note, rotation: p.rotation,
      windows: p.windows, baseTz: policy.baseTz
    };
  }

  /**
   * 코어타임 창이 회의 '시작 시각'을 담고 있는가 (창은 정책 기준 시간대로 정의)
   * 빨간 띠는 소요시간과 무관하게 창 전체(예: 한국 19~22시)로 고정되어야 하므로
   * 색을 정하는 판정에는 시작 시각만 쓴다.
   */
  function windowCovers(win, from) {
    if (win.to <= 24) return from >= win.from && from < win.to;
    return from >= win.from || from < win.to - 24;          // 자정을 넘기는 창
  }

  /** 창이 기준으로 삼는 시간대 — 고정 추천시간처럼 창 자체가 시간대를 가질 수 있다 */
  function windowTz(policy, win) { return win.tz || policy.baseTz; }

  /** 회의 구간이 창 안에서 시작해 창 안에서 끝나는가 — 메모 문구를 가르는 기준 */
  function windowContains(win, from, to) {
    if (!windowCovers(win, from)) return false;
    if (win.to <= 24) return to <= win.to;
    return from >= win.from ? to <= win.to : to + 24 <= win.to;
  }

  /** 회의가 시작되는 시점에 열려 있는 코어타임 창 */
  function activeWindows(policy, utcMs) {
    return (policy.effectiveWindows || policy.windows).filter(function (win) {
      return windowCovers(win, global.TZ.zonedParts(windowTz(policy, win), utcMs).decimal);
    });
  }

  /**
   * 3자 회의 예외 — 한국 · HVA · HVE(또는 HVME) 회의는 교대 운영에서 빠지고
   * Q1·Q3 시간대로 고정된다. (Ground Rules 1.1 각주)
   */
  function isTrilateral(entityIds) {
    var rule = global.TRILATERAL_RULE;
    if (!rule || !entityIds || !entityIds.length) return false;
    var hasRequired = rule.required.every(function (id) { return entityIds.indexOf(id) !== -1; });
    var hasOneOf = rule.oneOf.some(function (id) { return entityIds.indexOf(id) !== -1; });
    return hasRequired && hasOneOf;
  }

  /** 참여 법인이 고정 추천시간 규칙과 정확히 일치하는가 */
  function fixedRuleFor(entityIds) {
    var rules = global.MEETING_RULES || [];
    if (!entityIds || !entityIds.length) return null;
    var picked = entityIds.slice().sort().join(',');
    for (var i = 0; i < rules.length; i++) {
      for (var j = 0; j < rules[i].sets.length; j++) {
        if (rules[i].sets[j].slice().sort().join(',') === picked) return rules[i];
      }
    }
    return null;
  }

  /* ── 보완 원칙 — 규칙에 없는 조합의 추천시간 자동 편성 ─────────────
   *
   *   1) 참여 법인의 근무시간이 모두 겹치는 구간이 있으면 그 안에서 편성한다.
   *      겹치는 시간이 길면 최대 4시간, 짧으면 2~3시간으로 줄인다.
   *   2) 겹치는 구간이 없으면 근무시간에 가장 가까운 2시간으로 편성한다.
   *   3) 모든 법인이 현지 07:00–21:00 안에 들어오는 시각이 아예 없으면
   *      추천시간을 표시하지 않는다.
   * ──────────────────────────────────────────────────────────────── */
  var AUTO_MIN_LOCAL = 7;      // 현지 허용 하한
  var AUTO_MAX_LOCAL = 21;     // 현지 허용 상한
  var AUTO_LENGTHS = [4, 3.5, 3, 2.5, 2];

  /** 후보 시작 시각(한국 기준 소수 시각)을 훑어 조건을 만족하는 구간을 모은다 */
  function autoCandidates(entities, dateStr, length, requireWork) {
    var TZ = global.TZ;
    var p = dateStr.split('-');
    var hits = [];
    // 창은 기준 시간대(한국) 벽시계로 매일 반복되므로 하루치만 훑으면 된다
    for (var k = 0; k < 24; k += 0.5) {
      var utc = TZ.wallToUtc(global.CORE_TIME_BASE_TZ, +p[0], +p[1], +p[2], 0, k * 60);
      var ok = true, overlap = 0;
      for (var i = 0; i < entities.length; i++) {
        var e = entities[i];
        var ls = TZ.zonedParts(e.tz, utc).decimal;
        var le = ls + length;
        if (ls < AUTO_MIN_LOCAL || le > AUTO_MAX_LOCAL) { ok = false; break; }
        if (requireWork && (ls < e.work[0] || le > e.work[1])) { ok = false; break; }
        overlap += Math.max(0, Math.min(le, e.work[1]) - Math.max(ls, e.work[0]));
      }
      if (ok) hits.push({ start: k, utc: utc, overlap: overlap });
    }
    return hits;
  }

  /** 후보 중 하나를 골라 창으로 만든다 (근무시간 겹침이 큰 쪽, 같으면 가운데) */
  function pickWindow(hits, length, kind) {
    if (!hits.length) return null;
    var best = hits.reduce(function (a, b) { return b.overlap > a.overlap ? b : a; });
    var tied = hits.filter(function (h) { return h.overlap === best.overlap; });
    var whole = tied.filter(function (h) { return h.start % 1 === 0; });   // 정시 시작을 우선한다
    if (whole.length) tied = whole;
    var mid = tied[Math.floor((tied.length - 1) / 2)];
    return {
      id: 'auto-' + kind, name: '회의 추천시간', tz: global.CORE_TIME_BASE_TZ,
      from: mid.start, to: mid.start + length, auto: kind
    };
  }

  /** 참여 법인만으로 추천시간을 계산한다 — 없으면 null */
  function autoWindow(entities, dateStr) {
    if (!entities.length || !dateStr) return null;
    for (var i = 0; i < AUTO_LENGTHS.length; i++) {
      var w = pickWindow(autoCandidates(entities, dateStr, AUTO_LENGTHS[i], true), AUTO_LENGTHS[i], 'work');
      if (w) return w;
    }
    return pickWindow(autoCandidates(entities, dateStr, 2, false), 2, 'adjacent');
  }

  /** 참여 법인에 따라 실제 적용되는 추천시간 창을 확정한다 */
  function resolvePolicy(policy, entityIds, dateStr) {
    var fixed = fixedRuleFor(entityIds);
    var fixedWindow = fixed && (fixed.window || (fixed.byRotation || {})[policy.rotation]);
    var auto = null;
    if (!fixedWindow) {
      var list = (entityIds || []).map(function (id) { return byEntityId(id); })
        .filter(function (e) { return !!e; });
      auto = autoWindow(list, dateStr);
    }
    return {
      quarter: policy.quarter, year: policy.year,
      label: policy.label, note: policy.note, rotation: policy.rotation,
      windows: policy.windows,
      effectiveWindows: fixedWindow ? [fixedWindow] : (auto ? [auto] : []),
      fixedRule: fixedWindow ? fixed : null,
      autoWindow: auto,
      baseTz: policy.baseTz
    };
  }

  function byEntityId(id) {
    var list = global.ENTITIES || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function overlaps(aFrom, aTo, bFrom, bTo) { return aFrom < bTo && bFrom < aTo; }

  /**
   * 한 법인이 특정 시각에 회의를 시작할 때의 상태
   * core > work > out > off 순으로 좋은 상태입니다.
   */
  function evaluateEntity(entity, policy, utcStart, durationMin) {
    var TZ = global.TZ;
    var start = TZ.zonedParts(entity.tz, utcStart);
    var end = TZ.zonedParts(entity.tz, utcStart + durationMin * 60000);
    var holiday = global.holidayOf(entity, dateKey(start));
    var s = start.decimal;
    var e = s + durationMin / 60;
    var notes = [];
    var status;

    var windows = activeWindows(policy, utcStart);
    var coreFrom = TZ.zonedParts(policy.baseTz, utcStart).decimal;
    var coreTo = coreFrom + durationMin / 60;
    var fullyInCore = windows.some(function (w) { return windowContains(w, coreFrom, coreTo); });
    var excludedReason = null;
    windows.forEach(function (w) {
      if (w.excluded && w.excluded[entity.id]) excludedReason = w.excluded[entity.id];
    });
    /*
     * 근무시간 음영은 '회의 시작 시각'이 근무시간 안에 있는지로 판단한다.
     * 종료 시각까지 따지면 09~18시 근무라도 마지막 칸이 17시에서 끊겨,
     * 시간표에서 근무시간이 한 시간 짧아 보인다. 끝 시각은 경계로 포함한다.
     */
    var inWork = entity.workdays.indexOf(start.weekday) !== -1 &&
                 s >= entity.work[0] && s <= entity.work[1];

    if (entity.workdays.indexOf(start.weekday) === -1) {
      status = 'off';
      notes.push('주말');
    } else if (holiday) {
      status = 'off';
      notes.push('공휴일 · ' + holiday.name + (holiday.tentative ? ' (잠정)' : ''));
    } else if (windows.length && excludedReason) {
      status = 'agree';
      notes.push('코어타임 적용 제외 — ' + excludedReason);
    } else if (windows.length) {
      status = fullyInCore ? 'core' : 'partial';
      notes.push(windows.map(function (w) { return w.name; }).join(' · '));
      if (!fullyInCore) notes.push('회의 종료 시각이 코어타임을 넘어감');
      if (!inWork) notes.push('현지 정규 근무시간 밖');
    } else if (inWork) {
      status = 'work';
      if (e > entity.work[1]) notes.push('현지 근무 종료 시각 이후까지 이어짐');
    } else {
      status = 'out';
      notes.push(s < 6 ? '심야' : '근무시간 밖');
    }

    if (entity.shortDay && start.weekday === entity.shortDay.weekday &&
        e > entity.shortDay.until && status !== 'off') {
      notes.push(entity.shortDay.reason);
    }
    if (entity.lunch && status !== 'off' && overlaps(s, e, entity.lunch[0], entity.lunch[1])) {
      notes.push('현지 점심시간');
    }

    /*
     * 메모 문구는 '적합 / 협의 필요' 두 가지뿐이다.
     *   적합      회의 전체가 현지 근무시간 또는 코어타임 안에 들어옴
     *   협의 필요 휴무일이거나, 그 밖의 시간이 조금이라도 포함됨
     *
     * 근무시간과 코어타임 사이에 한 시간 이하의 틈이 있으면 이어진 것으로 본다.
     * 한국 Q1·Q3 의 18~19시가 그런 경우로, 규칙에서는 벗어나지만 퇴근 직후 저녁이라
     * 회의 참여에 무리가 없다고 보고 '적합'으로 처리한다.
     * 코어타임 적용 제외 시간(현지 새벽·심야)은 규정상 협의 대상이라 구간에서 뺀다.
     */
    var BRIDGE_MS = 60 * 60000;
    var utcEnd = utcStart + durationMin * 60000;
    var spans = [];

    /** 소수 시각(9.5 → 09:30)을 그 날짜의 절대 시각으로 */
    function wallAt(tz, parts, decimal) {
      return TZ.wallToUtc(tz, parts.year, parts.month, parts.day,
        Math.floor(decimal), Math.round((decimal % 1) * 60));
    }

    // 회의가 자정을 넘길 수 있으므로 전날 · 당일 · 다음날 구간을 모두 만들어 둔다
    [-1, 0, 1].forEach(function (offset) {
      var at = utcStart + offset * 86400000;

      var day = TZ.zonedParts(entity.tz, at);
      if (entity.workdays.indexOf(day.weekday) !== -1) {
        var workStart = wallAt(entity.tz, day, entity.work[0]);
        spans.push([workStart, workStart + (entity.work[1] - entity.work[0]) * 3600000]);
      }

      (policy.effectiveWindows || policy.windows).forEach(function (w) {
        if (w.excluded && w.excluded[entity.id]) return;
        var tz = windowTz(policy, w);
        var coreStart = wallAt(tz, TZ.zonedParts(tz, at), w.from);
        spans.push([coreStart, coreStart + (w.to - w.from) * 3600000]);
      });
    });

    spans.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    spans.forEach(function (sp) {
      var last = merged[merged.length - 1];
      if (last && sp[0] - last[1] <= BRIDGE_MS) last[1] = Math.max(last[1], sp[1]);
      else merged.push([sp[0], sp[1]]);
    });

    var fit = status !== 'off' && merged.some(function (m) {
      return utcStart >= m[0] && utcEnd <= m[1];
    });

    return {
      id: entity.id,
      entity: entity,
      status: status,
      fit: fit,
      statusLabel: STATUS_LABEL[status],
      start: start,
      end: end,
      holiday: holiday,
      windows: windows,
      excludedReason: excludedReason,
      notes: notes
    };
  }

  /** 여러 법인의 상태를 한 번에 */
  function evaluateSlot(entities, policy, utcStart, durationMin) {
    var rows = entities.map(function (entity) {
      return evaluateEntity(entity, policy, utcStart, durationMin);
    });
    var counts = { core: 0, partial: 0, agree: 0, work: 0, out: 0, off: 0 };
    rows.forEach(function (r) { counts[r.status] += 1; });
    return {
      utcStart: utcStart,
      durationMin: durationMin,
      rows: rows,
      counts: counts,
      allCore: counts.core === rows.length,
      anyCore: counts.core > 0,
      feasible: counts.out === 0 && counts.off === 0
    };
  }

  /**
   * 홈 법인 기준으로 24시간을 1시간 단위로 평가한다.
   * startHour 를 주면 그 시각부터 24칸을 만든다. (코어타임을 가운데 두기 위한 용도)
   * @param {Object} opts date / baseTz / entities / durationMin / startHour
   */
  function planDay(opts) {
    var TZ = global.TZ;
    var p = opts.date.split('-');
    var year = +p[0], month = +p[1], day = +p[2];
    var policy = resolvePolicy(policyFor(year, month),
      opts.entities.map(function (e) { return e.id; }), opts.date);
    var startHour = opts.startHour || 0;
    var slots = [];

    /*
     * 첫 칸의 절대 시각만 벽시계로 구하고, 나머지 23칸은 정확히 1시간씩 더한다.
     * 칸마다 벽시계 시각을 다시 변환하면 서머타임이 시작되는 날(없는 시각 02:00 등)에
     * 같은 순간이 두 칸에 겹쳐 찍히므로, 절대 시각을 기준으로 24시간을 이어 붙인다.
     * 각 법인 행에 표시되는 숫자는 그 순간을 해당 시간대로 환산한 값이라
     * 나라별 서머타임 적용 기간이 달라도 자동으로 맞는다.
     */
    var anchorUtc = TZ.wallToUtc(opts.baseTz, year, month, day, startHour, 0);

    for (var i = 0; i < 24; i++) {
      var utcStart = anchorUtc + i * 3600000;
      var slot = evaluateSlot(opts.entities, policy, utcStart, opts.durationMin);
      slot.index = i;
      slot.offsetMin = i * 60;             // 표 시작점부터의 경과 분
      slot.hourLabel = TZ.zonedParts(opts.baseTz, utcStart).hour;   // 홈 법인의 실제 현지 시각
      slots.push(slot);
    }

    return {
      policy: policy, slots: slots, startHour: startHour,
      anchorUtc: anchorUtc, nextPolicy: nextQuarterOf(policy)
    };
  }

  /**
   * 코어타임 창이 24칸의 가운데에 오도록 시작 시각을 계산한다.
   * 홈 법인이 한국보다 많이 뒤처진 지역이면 음수가 나오는데(= 전날 저녁부터 시작),
   * 이 값을 24로 감싸면 표가 통째로 하루 뒤로 밀리므로 그대로 둔다.
   */
  function centeredStartHour(policy, baseTz, dateStr) {
    var TZ = global.TZ;
    var win = (policy.effectiveWindows || policy.windows)[0];
    if (!win) return 6;                       // 추천시간이 없으면 06시부터 하루를 보여준다
    var p = dateStr.split('-');
    var startUtc = TZ.wallToUtc(windowTz(policy, win), +p[0], +p[1], +p[2],
      Math.floor(win.from), Math.round((win.from % 1) * 60));
    var localStart = TZ.zonedParts(baseTz, startUtc).decimal;
    var length = win.to - win.from;
    return Math.round(localStart - (24 - length) / 2);
  }

  global.Scheduler = {
    planDay: planDay,
    resolvePolicy: resolvePolicy,
    centeredStartHour: centeredStartHour,
    isTrilateral: isTrilateral,
    policyFor: policyFor,
    nextQuarterOf: nextQuarterOf,
    evaluateSlot: evaluateSlot,
    evaluateEntity: evaluateEntity,
    activeWindows: activeWindows,
    fixedRuleFor: fixedRuleFor,
    autoWindow: autoWindow,
    dateKey: dateKey,
    STATUS_LABEL: STATUS_LABEL
  };
})(window);
