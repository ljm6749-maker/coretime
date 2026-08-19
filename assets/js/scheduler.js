/**
 * 글로벌 코어타임 기반 회의시간 추천 엔진
 *
 * 후보 시각(기준 법인 현지시간 00:00~24:00)을 훑으면서 참여 법인별로
 * 해당 분기 코어타임 안에 들어오는지 판정하고 점수를 매깁니다. 점수가 낮을수록 좋습니다.
 */
(function (global) {
  'use strict';

  var STATUS = {
    core: { key: 'core', label: '코어타임', rank: 0 },
    ext:  { key: 'ext',  label: '확장 가능', rank: 1 },
    out:  { key: 'out',  label: '근무시간 외', rank: 2 },
    off:  { key: 'off',  label: '휴무일', rank: 3 }
  };

  var PENALTY = { core: 0, ext: 12, out: 120, off: 1200, lunch: 4 };

  function quarterOf(month) { return 'Q' + Math.ceil(month / 3); }

  function policyFor(year, month) {
    var q = quarterOf(month);
    var p = global.CORE_TIME_POLICY[q];
    return { quarter: q, year: year, label: p.label, note: p.note, windows: p.windows };
  }

  function windowFor(policy, entity) {
    return policy.windows[entity.id] || { core: [9, 18], extended: [8, 19] };
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  /** 한 법인이 특정 UTC 시각에 회의를 시작할 때의 상태 판정 */
  function evaluateEntity(entity, policy, utcStart, durationMin) {
    var TZ = global.TZ;
    var startP = TZ.zonedParts(entity.tz, utcStart);
    var endP = TZ.zonedParts(entity.tz, utcStart + durationMin * 60000);
    var win = windowFor(policy, entity);
    var s = startP.decimal;
    var e = s + durationMin / 60;              // 자정을 넘기면 24 초과 값이 된다
    var crossesMidnight = endP.day !== startP.day;
    var notes = [];
    var status;
    var penalty = 0;

    if (entity.workdays.indexOf(startP.weekday) === -1) {
      status = 'off';
      notes.push('현지 휴무일');
      penalty += PENALTY.off;
    } else if (crossesMidnight || s < win.extended[0] || e > win.extended[1]) {
      status = 'out';
      var over = Math.max(win.extended[0] - s, e - win.extended[1], crossesMidnight ? 6 : 0);
      penalty += PENALTY.out + over * 20;
      notes.push(s < 6 || crossesMidnight ? '심야 시간대' : '근무시간 밖');
    } else if (s >= win.core[0] && e <= win.core[1]) {
      status = 'core';
      // 코어타임 안에서는 구간 중앙에 가까울수록 소폭 가산점
      var mid = (win.core[0] + win.core[1]) / 2;
      penalty += Math.abs((s + e) / 2 - mid) * 0.4;
    } else {
      status = 'ext';
      var gap = Math.max(win.core[0] - s, e - win.core[1], 0);
      penalty += PENALTY.ext + gap * 6;
      notes.push('코어타임 밖 · 사전 협의 필요');
    }

    if (entity.shortDay && startP.weekday === entity.shortDay.weekday && e > entity.shortDay.until) {
      if (status === 'core' || status === 'ext') {
        status = 'out';
        penalty += PENALTY.out;
      }
      notes.push(entity.shortDay.reason);
    }

    if (entity.lunch && status !== 'off' && overlaps(s, e, entity.lunch[0], entity.lunch[1])) {
      penalty += PENALTY.lunch;
      notes.push('현지 점심시간과 겹침');
    }

    return {
      id: entity.id,
      entity: entity,
      status: status,
      statusLabel: STATUS[status].label,
      penalty: penalty,
      start: startP,
      end: endP,
      startDecimal: s,
      endDecimal: e,
      crossesMidnight: crossesMidnight,
      window: win,
      notes: notes
    };
  }

  /** 후보 슬롯 1개 평가 */
  function evaluateSlot(entities, policy, utcStart, durationMin) {
    var rows = [];
    var score = 0;
    var counts = { core: 0, ext: 0, out: 0, off: 0 };

    for (var i = 0; i < entities.length; i++) {
      var r = evaluateEntity(entities[i], policy, utcStart, durationMin);
      rows.push(r);
      score += r.penalty;
      counts[r.status] += 1;
    }

    return {
      utcStart: utcStart,
      durationMin: durationMin,
      rows: rows,
      score: score,
      counts: counts,
      feasible: counts.out === 0 && counts.off === 0,
      allCore: counts.core === entities.length
    };
  }

  /**
   * @param {Object} opts
   *   opts.date        'YYYY-MM-DD' (기준 법인 기준 날짜)
   *   opts.baseTz      기준 법인 시간대
   *   opts.entities    참여 법인 객체 배열
   *   opts.durationMin 회의 소요시간(분)
   *   opts.stepMin     후보 간격(분, 기본 30)
   */
  function plan(opts) {
    var TZ = global.TZ;
    var step = opts.stepMin || 30;
    var parts = opts.date.split('-');
    var year = +parts[0], month = +parts[1], day = +parts[2];
    var policy = policyFor(year, month);
    var slots = [];

    for (var minutes = 0; minutes < 24 * 60; minutes += step) {
      var utcStart = TZ.wallToUtc(opts.baseTz, year, month, day, 0, minutes);
      var slot = evaluateSlot(opts.entities, policy, utcStart, opts.durationMin);
      slot.baseMinutes = minutes;
      slot.baseDecimal = minutes / 60;
      slots.push(slot);
    }

    var ranked = slots.slice().sort(function (a, b) {
      if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
      if (a.score !== b.score) return a.score - b.score;
      return a.baseMinutes - b.baseMinutes;
    });

    return {
      policy: policy,
      slots: slots,
      ranked: ranked,
      best: diversify(ranked, 90),
      hasFeasible: ranked.length > 0 && ranked[0].feasible,
      commonCore: commonCoreWindows(slots, opts.entities.length),
      spreadHours: spreadHours(opts.entities, slots[0].utcStart)
    };
  }

  /** 인접한 30분짜리 후보가 상위권을 독식하지 않도록 최소 간격을 두고 추천안을 고른다 */
  function diversify(ranked, minGapMin, limit) {
    var picked = [];
    for (var i = 0; i < ranked.length && picked.length < (limit || 5); i++) {
      var candidate = ranked[i];
      var tooClose = picked.some(function (p) {
        var diff = Math.abs(p.baseMinutes - candidate.baseMinutes);
        return Math.min(diff, 24 * 60 - diff) < minGapMin;
      });
      if (!tooClose) picked.push(candidate);
    }
    return picked;
  }

  /** 참여 법인 간 최대 시차(시간) */
  function spreadHours(entities, utcMs) {
    var offsets = entities.map(function (e) { return global.TZ.offsetMinutes(e.tz, utcMs); });
    return (Math.max.apply(null, offsets) - Math.min.apply(null, offsets)) / 60;
  }

  /**
   * 전원이 모일 수 있는 시간이 없을 때 쓰는 분할 회의 제안.
   * 시차가 가장 크게 벌어지는 지점에서 두 그룹으로 나누고 그룹별 최적 시간을 계산한다.
   */
  function splitPlan(opts) {
    var utcRef = global.TZ.wallToUtc(opts.baseTz, +opts.date.split('-')[0], +opts.date.split('-')[1], +opts.date.split('-')[2], 12, 0);
    var sorted = opts.entities.slice().sort(function (a, b) {
      return global.TZ.offsetMinutes(a.tz, utcRef) - global.TZ.offsetMinutes(b.tz, utcRef);
    });
    if (sorted.length < 2) return null;

    var gapIndex = 1, gapSize = -1;
    for (var i = 1; i < sorted.length; i++) {
      var gap = global.TZ.offsetMinutes(sorted[i].tz, utcRef) - global.TZ.offsetMinutes(sorted[i - 1].tz, utcRef);
      if (gap > gapSize) { gapSize = gap; gapIndex = i; }
    }

    var groups = [sorted.slice(0, gapIndex), sorted.slice(gapIndex)];
    return groups.map(function (group) {
      var result = plan({
        date: opts.date,
        baseTz: opts.baseTz,
        entities: group,
        durationMin: opts.durationMin,
        stepMin: opts.stepMin
      });
      return { entities: group, slot: result.ranked[0], hasFeasible: result.hasFeasible };
    });
  }

  /** 모든 참여 법인이 코어타임인 연속 구간(기준 법인 시간 기준)을 묶어서 반환 */
  function commonCoreWindows(slots, entityCount) {
    var windows = [];
    var current = null;
    for (var i = 0; i < slots.length; i++) {
      var ok = slots[i].counts.core === entityCount;
      if (ok && !current) {
        current = { from: slots[i].baseDecimal, to: slots[i].baseDecimal };
      } else if (ok) {
        current.to = slots[i].baseDecimal;
      } else if (current) {
        windows.push(current);
        current = null;
      }
    }
    if (current) windows.push(current);
    return windows;
  }

  global.Scheduler = {
    plan: plan,
    splitPlan: splitPlan,
    policyFor: policyFor,
    quarterOf: quarterOf,
    evaluateSlot: evaluateSlot,
    STATUS: STATUS
  };
})(window);
