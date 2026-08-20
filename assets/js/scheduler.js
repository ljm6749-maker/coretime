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

  /** 회의 구간이 창 안에서 시작해 창 안에서 끝나는가 — 메모 문구를 가르는 기준 */
  function windowContains(win, from, to) {
    if (!windowCovers(win, from)) return false;
    if (win.to <= 24) return to <= win.to;
    return from >= win.from ? to <= win.to : to + 24 <= win.to;
  }

  /** 회의가 시작되는 시점에 열려 있는 코어타임 창 */
  function activeWindows(policy, utcMs) {
    var from = global.TZ.zonedParts(policy.baseTz, utcMs).decimal;
    return (policy.effectiveWindows || policy.windows).filter(function (win) {
      return windowCovers(win, from);
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

  /** 참여 법인에 따라 실제 적용되는 코어타임 창을 확정한다 */
  function resolvePolicy(policy, entityIds) {
    var rule = global.TRILATERAL_RULE;
    var trilateral = isTrilateral(entityIds);
    var windows = trilateral && policy.windows[0] !== rule.window ? [rule.window] : policy.windows;
    return {
      quarter: policy.quarter, year: policy.year,
      label: policy.label, note: policy.note, rotation: policy.rotation,
      windows: policy.windows,
      effectiveWindows: windows,
      trilateral: trilateral && policy.windows[0] !== rule.window,
      trilateralNote: rule.note,
      baseTz: policy.baseTz
    };
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
     *   적합      회의 전체가 현지 근무시간 안에 있거나, 전체가 코어타임 창 안에 있음
     *   협의 필요 휴무일이거나, 근무시간도 코어타임도 아닌 시간이 조금이라도 포함됨
     * 코어타임 적용 제외 시간(현지 새벽·심야)은 규정상 협의 대상이므로 '적합'이 아니다.
     */
    var fitsWork = entity.workdays.indexOf(start.weekday) !== -1 &&
                   s >= entity.work[0] && e <= entity.work[1];
    var fit = status !== 'off' && !excludedReason && (fitsWork || fullyInCore);

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
    var policy = resolvePolicy(policyFor(year, month), opts.entities.map(function (e) { return e.id; }));
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
    var p = dateStr.split('-');
    var startUtc = TZ.wallToUtc(policy.baseTz, +p[0], +p[1], +p[2],
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
    dateKey: dateKey,
    STATUS_LABEL: STATUS_LABEL
  };
})(window);
