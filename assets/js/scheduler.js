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
      label: p.label, note: p.note,
      windows: p.windows,
      baseTz: global.CORE_TIME_BASE_TZ
    };
  }

  function nextQuarterOf(policy) {
    var n = +policy.quarter.slice(1);
    var q = n === 4 ? 'Q1' : 'Q' + (n + 1);
    var year = n === 4 ? policy.year + 1 : policy.year;
    var p = global.CORE_TIME_POLICY[q];
    return { quarter: q, year: year, label: p.label, note: p.note, windows: p.windows, baseTz: policy.baseTz };
  }

  /** 코어타임 창이 이 순간을 포함하는가 (창은 정책 기준 시간대로 정의) */
  function windowCovers(win, coreDecimal) {
    if (win.to <= 24) return coreDecimal >= win.from && coreDecimal < win.to;
    return coreDecimal >= win.from || coreDecimal < win.to - 24;   // 자정을 넘기는 창
  }

  /** 이 순간에 열려 있는 코어타임 창 목록 (법인 기준 필터 포함) */
  function activeWindows(policy, utcMs, entityId) {
    var coreDecimal = global.TZ.zonedParts(policy.baseTz, utcMs).decimal;
    return policy.windows.filter(function (win) {
      if (!windowCovers(win, coreDecimal)) return false;
      return !win.entities || !entityId || win.entities.indexOf(entityId) !== -1;
    });
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

    var windows = activeWindows(policy, utcStart, entity.id);
    var inWork = entity.workdays.indexOf(start.weekday) !== -1 &&
                 s >= entity.work[0] && e <= entity.work[1];

    if (entity.workdays.indexOf(start.weekday) === -1) {
      status = 'off';
      notes.push('주말');
    } else if (holiday) {
      status = 'off';
      notes.push('공휴일 · ' + holiday.name + (holiday.tentative ? ' (잠정)' : ''));
    } else if (windows.length) {
      status = 'core';
      notes.push(windows.map(function (w) { return w.name + ' 코어타임'; }).join(' · '));
      if (!inWork) notes.push('현지 정규 근무시간 밖');
    } else if (inWork) {
      status = 'work';
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

    return {
      id: entity.id,
      entity: entity,
      status: status,
      statusLabel: STATUS_LABEL[status],
      start: start,
      end: end,
      holiday: holiday,
      windows: windows,
      notes: notes
    };
  }

  /** 여러 법인의 상태를 한 번에 */
  function evaluateSlot(entities, policy, utcStart, durationMin) {
    var rows = entities.map(function (entity) {
      return evaluateEntity(entity, policy, utcStart, durationMin);
    });
    var counts = { core: 0, work: 0, out: 0, off: 0 };
    rows.forEach(function (r) { counts[r.status] += 1; });
    return {
      utcStart: utcStart,
      durationMin: durationMin,
      rows: rows,
      counts: counts,
      allCore: counts.core === rows.length,
      feasible: counts.out === 0 && counts.off === 0
    };
  }

  /**
   * 기준 법인의 하루(0~23시)를 1시간 단위로 평가
   * @param {Object} opts date / baseTz / entities / durationMin
   */
  function planDay(opts) {
    var TZ = global.TZ;
    var p = opts.date.split('-');
    var year = +p[0], month = +p[1], day = +p[2];
    var policy = policyFor(year, month);
    var slots = [];

    for (var hour = 0; hour < 24; hour++) {
      var utcStart = TZ.wallToUtc(opts.baseTz, year, month, day, hour, 0);
      var slot = evaluateSlot(opts.entities, policy, utcStart, opts.durationMin);
      slot.hour = hour;
      slots.push(slot);
    }

    return { policy: policy, slots: slots, nextPolicy: nextQuarterOf(policy) };
  }

  global.Scheduler = {
    planDay: planDay,
    policyFor: policyFor,
    nextQuarterOf: nextQuarterOf,
    evaluateSlot: evaluateSlot,
    evaluateEntity: evaluateEntity,
    activeWindows: activeWindows,
    dateKey: dateKey,
    STATUS_LABEL: STATUS_LABEL
  };
})(window);
