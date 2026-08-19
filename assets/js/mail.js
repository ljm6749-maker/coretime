/**
 * 회의 소집 메일 템플릿
 *
 * 실제 사내 문구가 확정되면 아래 MAIL_FIELDS 의 기본값과
 * bodyKo / bodyEn 의 본문만 고치면 화면과 복사 결과에 바로 반영됩니다.
 */
(function (global) {
  'use strict';

  /** 메일에서 채워 넣을 항목의 기본값(자리표시자) */
  global.MAIL_FIELDS = {
    meetingName: '(회의명)',
    organizer: '(주관 부서 / 담당자)',
    attendees: '(참석 대상)',
    agenda: ['(안건 1)', '(안건 2)'],
    link: '(Teams 회의 링크)',
    prework: '(사전 공유 자료 및 회신 기한)',
    signature: '(보내는 사람 · 부서 · 연락처)'
  };

  /** 영문 메일용 자리표시자 */
  global.MAIL_FIELDS_EN = {
    meetingName: '(Meeting name)',
    organizer: '(Organizing team / owner)',
    attendees: '(Attendees)',
    agenda: ['(Agenda item 1)', '(Agenda item 2)'],
    link: '(Teams meeting link)',
    prework: '(Materials to review and reply-by date)',
    signature: '(Sender · Team · Contact)'
  };

  function fields(lang) { return lang === 'en' ? global.MAIL_FIELDS_EN : global.MAIL_FIELDS; }

  var TZ = global.TZ;
  var EN_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function pad(n) { return TZ.pad(n); }

  function localLine(row, lang) {
    var s = row.start, e = row.end;
    var date = lang === 'en'
      ? (s.month + '/' + s.day + ' (' + EN_DAY[s.weekday] + ')')
      : (s.month + '/' + s.day + '(' + TZ.DAY_KO[s.weekday] + ')');
    var range = pad(s.hour) + ':' + pad(s.minute) + '–' + pad(e.hour) + ':' + pad(e.minute);
    var name = lang === 'en' ? row.entity.legal : row.entity.name + '(' + row.entity.code + ')';
    return { name: name, when: date + ' ' + range, status: row.status };
  }

  function padRight(text, width) {
    var len = 0;
    for (var i = 0; i < text.length; i++) {
      len += text.charCodeAt(i) > 0x2E80 ? 2 : 1;   // 한글·한자는 2칸으로 계산
    }
    return text + new Array(Math.max(1, width - len + 1)).join(' ');
  }

  function offNotice(rows, lang) {
    var outside = rows.filter(function (r) { return r.status === 'out' || r.status === 'off'; });
    if (!outside.length) return '';
    var names = outside.map(function (r) { return lang === 'en' ? r.entity.legal : r.entity.name; }).join(', ');
    return lang === 'en'
      ? '\n* ' + names + ' will join outside local business hours. Thank you for your flexibility.\n'
      : '\n※ ' + names + ' 법인은 현지 근무시간 외 시간대입니다. 참석에 양해 부탁드립니다.\n';
  }

  function bodyKo(ctx) {
    var f = fields('ko');
    var lines = [];
    lines.push('안녕하세요, 한화비전 ' + f.organizer + '입니다.');
    lines.push('아래와 같이 글로벌 회의를 개최하오니 참석 부탁드립니다.');
    lines.push('');
    lines.push('■ 일시 (법인별 현지시각)');
    ctx.rows.forEach(function (row) {
      var l = localLine(row, 'ko');
      lines.push('   · ' + padRight(l.name, 18) + l.when);
    });
    lines.push('■ 소요시간 : ' + ctx.durationMin + '분');
    lines.push('■ 참석 대상 : ' + f.attendees);
    lines.push('■ 회의 안건');
    f.agenda.forEach(function (item, i) {
      lines.push('   ' + (i + 1) + '. ' + item);
    });
    lines.push('■ 접속 링크 : ' + f.link);
    lines.push('■ 사전 준비 : ' + f.prework);
    lines.push(offNotice(ctx.rows, 'ko'));
    lines.push('※ 본 시간은 ' + ctx.policy.year + '년 ' + ctx.policy.quarter.slice(1) + '분기 글로벌 코어타임 기준으로 산정되었습니다.');
    lines.push('');
    lines.push('감사합니다.');
    lines.push(f.signature);
    return lines.join('\n');
  }

  function bodyEn(ctx) {
    var f = fields('en');
    var lines = [];
    lines.push('Dear colleagues,');
    lines.push('');
    lines.push('We would like to invite you to the global meeting below.');
    lines.push('');
    lines.push('- Date & time (local time per entity)');
    ctx.rows.forEach(function (row) {
      var l = localLine(row, 'en');
      lines.push('   * ' + padRight(l.name, 34) + l.when);
    });
    lines.push('- Duration : ' + ctx.durationMin + ' minutes');
    lines.push('- Attendees : ' + f.attendees);
    lines.push('- Agenda');
    f.agenda.forEach(function (item, i) {
      lines.push('   ' + (i + 1) + '. ' + item);
    });
    lines.push('- Meeting link : ' + f.link);
    lines.push('- Preparation : ' + f.prework);
    lines.push(offNotice(ctx.rows, 'en'));
    lines.push('* This slot follows the ' + ctx.policy.year + ' ' + ctx.policy.quarter + ' global core time guideline.');
    lines.push('');
    lines.push('Best regards,');
    lines.push(f.signature);
    return lines.join('\n');
  }

  function subject(ctx, lang) {
    var f = fields(lang);
    var b = ctx.baseParts;
    if (lang === 'en') {
      return '[Hanwha Vision] Global meeting invitation - ' + f.meetingName +
        ' (' + b.month + '/' + b.day + ', ' + pad(b.hour) + ':' + pad(b.minute) + ' ' + (ctx.base.cityEn || ctx.base.city) + ' time)';
    }
    return '[한화비전] 글로벌 ' + f.meetingName + ' 회의 소집 안내 (' +
      b.month + '/' + b.day + '(' + TZ.DAY_KO[b.weekday] + ') ' +
      pad(b.hour) + ':' + pad(b.minute) + ', ' + ctx.base.name + ' 기준)';
  }

  global.MailTemplate = {
    build: function (ctx, lang) {
      return {
        subject: subject(ctx, lang),
        body: lang === 'en' ? bodyEn(ctx) : bodyKo(ctx)
      };
    }
  };
})(window);
