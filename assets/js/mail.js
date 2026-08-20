/**
 * 회의 소집 메일 템플릿
 *
 * 아래 DEFAULT_TEMPLATES 의 문구가 화면에 그대로 나오고,
 * 중괄호 토큰은 선택한 회의 시각으로 자동 치환됩니다.
 * 화면의 본문 창에서 바로 고쳐 쓴 뒤 복사할 수 있습니다.
 *
 *   {{일시}}     2026년 8월 20일(목) 19:00–20:00 (한국 기준)
 *   {{일시표}}   법인별 현지시각 목록 (여러 줄)
 *   {{소요시간}} 60분
 *   {{참여법인}} 한국, 북미 동부, 유럽 …
 *   {{코어타임}} 적용된 코어타임 창 이름
 *   {{분기}}     2026년 3분기
 */
(function (global) {
  'use strict';

  var TZ = global.TZ;
  var EN_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var DEFAULT_TEMPLATES = {
    ko: {
      subject: '[invitation] OOO 회의 소집 안내 – {{일시}}',
      body: [
        '안녕하세요, [ 본인 소속, 이름, 직위 ]입니다.',
        '',
        '아래와 같이 [ 회의 제목 ]을 소집합니다.',
        '본 회의에서는 [ 주요 논의내용 요약 ] 에 대한 논의를 진행할 예정입니다.',
        '',
        '1. 회의 개요',
        '- 일시 : {{일시}}',
        '- 장소 : Teams 미팅 (접속링크 삽입)',
        '- 참석자:',
        '- 목적:',
        '',
        '2. 주요 아젠다',
        '(1)',
        '(2)',
        '',
        '3. 회의 관련 자료',
        '- [사전 공유 자료 또는 링크]',
        '',
        '',
        '감사합니다.'
      ].join('\n')
    },
    en: {
      subject: '[invitation] [ Meeting Name ] – {{일시}}',
      body: [
        'Dear colleagues,',
        '',
        'I hope this email finds you well.',
        'You are invited to the [ Meeting Title ] below.',
        'In this session, we will discuss [ brief summary of key discussion points ].',
        '',
        '1. Meeting Overview',
        '- Date & Time: {{일시}}',
        '- Location: Teams Meeting (Meeting link attached)',
        '- Attendees:',
        '- Purpose:',
        '',
        '2. Key Agenda',
        '(1)',
        '(2)',
        '',
        '3. Reference Link',
        '- [ Materials or links to review ]',
        '',
        'Best regards,'
      ].join('\n')
    }
  };

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
    var name = lang === 'en' ? row.entity.legal : row.entity.name + '(' + row.entity.code + ')';
    var date = lang === 'en'
      ? s.month + '/' + s.day + ' ' + EN_DAY[s.weekday]
      : s.month + '/' + s.day + '(' + TZ.DAY_KO[s.weekday] + ')';
    var tail = '';
    if (row.status === 'off') tail = lang === 'en' ? '  * local holiday' : '  ※ 현지 휴무';
    else if (row.status === 'out') tail = lang === 'en' ? '  * outside business hours' : '  ※ 근무시간 외';
    else if (row.status === 'agree') tail = lang === 'en' ? '  * outside core hours - by agreement' : '  ※ 코어타임 제외 · 협의 필요';
    return '   · ' + padRight(name, lang === 'en' ? 34 : 20) + date + ' ' + timeRange(row) + tail;
  }

  function tokens(ctx, lang) {
    var I = global.I18N;
    if (!ctx.rows || !ctx.rows.length || !ctx.baseParts) {
      return {
        '{{일시}}': I.STRINGS[lang]['mail.phTime'],
        '{{소요시간}}': ctx.durationMin ? durationText(ctx.durationMin, lang) : I.STRINGS[lang]['mail.phDuration'],
        '{{참여법인}}': I.STRINGS[lang]['mail.phEntities'],
        '{{일시표}}': '   ' + I.STRINGS[lang]['mail.phEntities'],
        '{{코어타임}}': lang === 'en' ? 'the designated Global Core Hours' : '글로벌 코어타임',
        '{{분기}}': lang === 'en'
          ? ctx.policy.year + ' ' + ctx.policy.quarter
          : ctx.policy.year + '년 ' + ctx.policy.quarter.slice(1) + '분기'
      };
    }
    var b = ctx.baseParts;
    var when = lang === 'en'
      ? b.year + '-' + TZ.pad(b.month) + '-' + TZ.pad(b.day) + ' (' + EN_DAY[b.weekday] + ') ' +
        ctx.baseRange + ' ' + (ctx.base.nameEn || ctx.base.legal) + ' time'
      : b.year + '년 ' + b.month + '월 ' + b.day + '일(' + TZ.DAY_KO[b.weekday] + ') ' +
        ctx.baseRange + ' (' + ctx.base.name + ' 기준)';

    return {
      '{{일시}}': when,
      '{{소요시간}}': ctx.durationMin ? durationText(ctx.durationMin, lang) : global.I18N.STRINGS[lang]['mail.phDuration'],
      '{{참여법인}}': ctx.rows.map(function (r) {
        return lang === 'en' ? r.entity.legal : r.entity.name;
      }).join(', '),
      '{{일시표}}': ctx.rows.map(function (r) { return rowLine(r, lang); }).join('\n'),
      '{{코어타임}}': lang === 'en' ? 'the designated Global Core Hours' : '글로벌 코어타임',
      '{{분기}}': lang === 'en'
        ? ctx.policy.year + ' ' + ctx.policy.quarter
        : ctx.policy.year + '년 ' + ctx.policy.quarter.slice(1) + '분기'
    };
  }

  /** 60 → '1시간' / '1 hour' */
  function durationText(min, lang) {
    var h = Math.floor(min / 60);
    var half = min % 60 >= 30;
    if (!h) return lang === 'en' ? '30 min' : '30분';
    var plural = lang === 'en' && h > 1 ? 's' : '';
    if (lang === 'en') return h + ' hour' + plural + (half ? ' 30 min' : '');
    return h + '시간' + (half ? ' 30분' : '');
  }

  function fill(text, map) {
    return Object.keys(map).reduce(function (acc, token) {
      return acc.split(token).join(map[token]);
    }, text);
  }

  global.MailTemplate = {
    DEFAULTS: DEFAULT_TEMPLATES,
    /** 저장된 문구에 회의 시각을 채워 완성본을 만든다 */
    render: function (ctx, lang) {
      var map = tokens(ctx, lang);
      return {
        subject: fill(DEFAULT_TEMPLATES[lang].subject, map),
        body: fill(DEFAULT_TEMPLATES[lang].body, map)
      };
    }
  };
})(window);
