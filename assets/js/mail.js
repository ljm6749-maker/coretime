/**
 * 회의 소집 메일 템플릿
 *
 * 기본 문구는 아래 DEFAULT_TEMPLATES 에 들어 있고, 화면에서 수정하면
 * 브라우저(localStorage)에 저장되어 다음에 열 때도 유지됩니다.
 *
 * 중괄호 토큰은 선택한 회의 시각으로 자동 치환됩니다.
 *   {{일시}}     기준 법인 기준 일시           예) 2026년 8월 19일(수) 19:00–20:00 (한국 기준)
 *   {{일시표}}   법인별 현지시각 목록 (여러 줄)
 *   {{소요시간}} 60분
 *   {{참여법인}} 한국, 북미 동부, 유럽 …
 *   {{코어타임}} 적용된 코어타임 창 이름
 *   {{분기}}     2026년 3분기
 */
(function (global) {
  'use strict';

  var TZ = global.TZ;
  var STORAGE_PREFIX = 'hv-coretime-mail:';
  var EN_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var DEFAULT_TEMPLATES = {
    ko: {
      subject: '[한화비전] 글로벌 회의 소집 안내 — {{일시}}',
      body: [
        '안녕하세요, 한화비전입니다.',
        '아래와 같이 글로벌 회의를 개최하오니 참석 부탁드립니다.',
        '',
        '■ 일시 : {{일시}}',
        '■ 소요시간 : {{소요시간}}',
        '■ 참석 법인 : {{참여법인}}',
        '',
        '■ 법인별 현지시각',
        '{{일시표}}',
        '',
        '■ 회의 안건',
        '   1. ',
        '   2. ',
        '■ 접속 링크 : ',
        '■ 사전 공유 자료 : ',
        '',
        '※ 본 시각은 {{분기}} 글로벌 코어타임({{코어타임}}) 기준으로 산정되었습니다.',
        '',
        '감사합니다.'
      ].join('\n')
    },
    en: {
      subject: '[Hanwha Vision] Global meeting invitation — {{일시}}',
      body: [
        'Dear colleagues,',
        '',
        'You are invited to the global meeting below.',
        '',
        '- Date & time : {{일시}}',
        '- Duration : {{소요시간}}',
        '- Participating entities : {{참여법인}}',
        '',
        '- Local time by entity',
        '{{일시표}}',
        '',
        '- Agenda',
        '   1. ',
        '   2. ',
        '- Meeting link : ',
        '- Materials to review : ',
        '',
        '* This slot follows the {{분기}} global core time ({{코어타임}}).',
        '',
        'Best regards,'
      ].join('\n')
    }
  };

  function storageKey(lang, part) { return STORAGE_PREFIX + lang + ':' + part; }

  function load(lang, part) {
    try {
      var saved = global.localStorage.getItem(storageKey(lang, part));
      if (saved !== null) return saved;
    } catch (err) { /* 저장소 접근 불가 시 기본값 사용 */ }
    return DEFAULT_TEMPLATES[lang][part];
  }

  function save(lang, part, value) {
    try { global.localStorage.setItem(storageKey(lang, part), value); } catch (err) { /* 무시 */ }
  }

  function reset(lang) {
    try {
      global.localStorage.removeItem(storageKey(lang, 'subject'));
      global.localStorage.removeItem(storageKey(lang, 'body'));
    } catch (err) { /* 무시 */ }
  }

  function isCustomized(lang) {
    return load(lang, 'subject') !== DEFAULT_TEMPLATES[lang].subject ||
           load(lang, 'body') !== DEFAULT_TEMPLATES[lang].body;
  }

  /** 한글은 두 칸으로 계산해 고정폭 정렬을 맞춘다 */
  function padRight(text, width) {
    var len = 0;
    for (var i = 0; i < text.length; i++) len += text.charCodeAt(i) > 0x2E80 ? 2 : 1;
    return text + new Array(Math.max(1, width - len + 1)).join(' ');
  }

  function timeRange(row) {
    return TZ.pad(row.start.hour) + ':' + TZ.pad(row.start.minute) + '–' +
           TZ.pad(row.end.hour) + ':' + TZ.pad(row.end.minute);
  }

  function rowLine(row, lang) {
    var s = row.start;
    var name = lang === 'en'
      ? row.entity.legal
      : row.entity.name + '(' + row.entity.code + ')';
    var date = lang === 'en'
      ? s.month + '/' + s.day + ' ' + EN_DAY[s.weekday]
      : s.month + '/' + s.day + '(' + TZ.DAY_KO[s.weekday] + ')';
    var tail = row.status === 'off'
      ? (lang === 'en' ? '  * local holiday' : '  ※ 현지 휴무')
      : (row.status === 'out' ? (lang === 'en' ? '  * outside business hours' : '  ※ 근무시간 외') : '');
    return '   · ' + padRight(name, lang === 'en' ? 34 : 20) + date + ' ' + timeRange(row) + tail;
  }

  function tokens(ctx, lang) {
    var b = ctx.baseParts;
    var when = lang === 'en'
      ? b.year + '-' + TZ.pad(b.month) + '-' + TZ.pad(b.day) + ' (' + EN_DAY[b.weekday] + ') ' +
        ctx.baseRange + ' ' + ctx.base.cityEn + ' time'
      : b.year + '년 ' + b.month + '월 ' + b.day + '일(' + TZ.DAY_KO[b.weekday] + ') ' +
        ctx.baseRange + ' (' + ctx.base.name + ' 기준)';

    var windowNames = [];
    ctx.rows.forEach(function (row) {
      row.windows.forEach(function (w) {
        if (windowNames.indexOf(w.name) === -1) windowNames.push(w.name);
      });
    });

    return {
      '{{일시}}': when,
      '{{소요시간}}': lang === 'en' ? ctx.durationMin + ' minutes' : ctx.durationMin + '분',
      '{{참여법인}}': ctx.rows.map(function (r) {
        return lang === 'en' ? r.entity.legal : r.entity.name;
      }).join(', '),
      '{{일시표}}': ctx.rows.map(function (r) { return rowLine(r, lang); }).join('\n'),
      '{{코어타임}}': windowNames.length
        ? windowNames.join(' · ')
        : (lang === 'en' ? 'outside core time' : '코어타임 외 시간대'),
      '{{분기}}': lang === 'en'
        ? ctx.policy.year + ' ' + ctx.policy.quarter
        : ctx.policy.year + '년 ' + ctx.policy.quarter.slice(1) + '분기'
    };
  }

  function fill(text, map) {
    return Object.keys(map).reduce(function (acc, token) {
      return acc.split(token).join(map[token]);
    }, text);
  }

  global.MailTemplate = {
    DEFAULTS: DEFAULT_TEMPLATES,
    TOKENS: ['{{일시}}', '{{일시표}}', '{{소요시간}}', '{{참여법인}}', '{{코어타임}}', '{{분기}}'],
    raw: function (lang) {
      return { subject: load(lang, 'subject'), body: load(lang, 'body') };
    },
    save: save,
    reset: reset,
    isCustomized: isCustomized,
    /** 저장된 템플릿에 회의 시각을 채워 완성본을 만든다 */
    render: function (ctx, lang) {
      var map = tokens(ctx, lang);
      return {
        subject: fill(load(lang, 'subject'), map),
        body: fill(load(lang, 'body'), map)
      };
    }
  };
})(window);
