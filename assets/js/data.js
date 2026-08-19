/**
 * 한화비전 글로벌 법인 · 코어타임 · 공휴일 기준값
 *
 * 이 파일만 수정하면 지도 · 시간표 · 추천 · 메일 초안에 모두 반영됩니다.
 */

/* ─────────────────────────────────────────────────────────────
 * 1) 법인 (Corporations)
 *    tz       : IANA 시간대 ID (서머타임 자동 반영)
 *    work     : 현지 정규 근무시간 [시작, 종료]  (8.5 = 08:30)
 *    holidays : 공휴일 표 키 (아래 HOLIDAYS). 여러 법인이 공유 가능
 *    lat/lon  : 지도 마커 좌표, labelSide : 마커 라벨 방향
 * ───────────────────────────────────────────────────────────── */
window.ENTITIES = [
  {
    id: 'kr', name: '한국', code: 'HVC',
    legal: 'Hanwha Vision Co., Ltd. (본사)',
    city: '성남 판교', cityEn: 'Seongnam', country: '대한민국',
    tz: 'Asia/Seoul', lat: 37.40, lon: 127.10, labelSide: 'left',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [12, 13], holidays: 'kr'
  },
  {
    id: 'hva', name: '북미 동부', code: 'HVA',
    legal: 'Hanwha Vision America',
    city: 'Teaneck, NJ', cityEn: 'Teaneck, NJ', country: '미국',
    tz: 'America/New_York', lat: 40.89, lon: -74.01, labelSide: 'right',
    workdays: [1, 2, 3, 4, 5], work: [9, 17.5], lunch: [12, 13], holidays: 'us'
  },
  {
    id: 'hvw', name: '북미 서부', code: 'Carlsbad',
    legal: 'Hanwha Vision America — West',
    city: 'Carlsbad, CA', cityEn: 'Carlsbad, CA', country: '미국',
    tz: 'America/Los_Angeles', lat: 33.16, lon: -117.35, labelSide: 'left',
    workdays: [1, 2, 3, 4, 5], work: [9, 17.5], lunch: [12, 13], holidays: 'us'
  },
  {
    id: 'mx', name: '멕시코', code: 'Mex',
    legal: 'Hanwha Vision Mexico',
    city: 'Mexico City', cityEn: 'Mexico City', country: '멕시코',
    tz: 'America/Mexico_City', lat: 19.43, lon: -99.13, labelSide: 'bottom',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [13, 14], holidays: 'mx'
  },
  {
    id: 'eu', name: '유럽', code: 'HVE',
    legal: 'Hanwha Vision Europe',
    city: 'Chertsey, Surrey', cityEn: 'Chertsey', country: '영국',
    tz: 'Europe/London', lat: 51.39, lon: -0.51, labelSide: 'top',
    workdays: [1, 2, 3, 4, 5], work: [9, 17.5], lunch: [12, 13], holidays: 'uk'
  },
  {
    id: 'me', name: '중동', code: 'HVME',
    legal: 'Hanwha Vision Middle East',
    city: 'Dubai', cityEn: 'Dubai', country: 'UAE',
    tz: 'Asia/Dubai', lat: 25.20, lon: 55.27, labelSide: 'bottom',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [13, 14], holidays: 'ae',
    /** 금요일 주마(합동예배) 시간은 회의 편성에서 제외 */
    shortDay: { weekday: 5, until: 12, reason: '금요일 오후 주마 예배' }
  },
  {
    id: 'apac', name: 'APAC', code: 'HVAPAC',
    legal: 'Hanwha Vision Asia Pacific',
    city: 'Singapore', cityEn: 'Singapore', country: '싱가포르',
    tz: 'Asia/Singapore', lat: 1.35, lon: 103.82, labelSide: 'right',
    workdays: [1, 2, 3, 4, 5], work: [9, 18], lunch: [12, 13], holidays: 'sg'
  },
  {
    id: 'vn', name: '베트남', code: 'HVV',
    legal: 'Hanwha Vision Vietnam',
    city: 'Bắc Ninh', cityEn: 'Bac Ninh', country: '베트남',
    tz: 'Asia/Ho_Chi_Minh', lat: 21.19, lon: 106.08, labelSide: 'left',
    workdays: [1, 2, 3, 4, 5], work: [8, 17], lunch: [12, 13], holidays: 'vn'
  }
];

/* ─────────────────────────────────────────────────────────────
 * 2) 분기별 글로벌 코어타임
 *
 *    코어타임은 "같은 절대 시각"을 가리키는 창(window)입니다.
 *    from/to 는 baseTz(한국 본사) 기준 시각이고, 24를 넘으면 익일입니다.
 *    (예: from 23, to 26 → 한국 23:00 ~ 익일 02:00)
 *    따라서 한국 19~22시가 코어타임이면 북미 동부는 같은 순간인 06~09시가
 *    똑같이 붉게 표시됩니다.
 *
 *    entities 를 지정하면 해당 법인 행에만 코어타임이 칠해집니다.
 *    (생략하면 전 법인 공통 코어타임)
 * ───────────────────────────────────────────────────────────── */
window.CORE_TIME_BASE_TZ = 'Asia/Seoul';

window.CORE_TIME_POLICY = {
  Q1: {
    label: '1분기 · 사업계획 정렬 코어타임',
    note: '연간 사업계획과 전년 실적 마감이 겹치는 분기로, 본사–해외법인 협의 창을 넓게 운영합니다.',
    windows: [
      { id: 'apac', name: '아시아 · 중동 · 유럽', from: 16, to: 19.5, entities: ['vn', 'apac', 'kr', 'me', 'eu'] },
      { id: 'kram', name: '한국 · 미주 동부', from: 19, to: 22.5, entities: ['kr', 'hva', 'mx'] },
      { id: 'euam', name: '유럽 · 미주', from: 23, to: 26, entities: ['eu', 'mx', 'hva', 'hvw'] }
    ]
  },
  Q2: {
    label: '2분기 · 표준 코어타임',
    note: '표준 운영 분기입니다. 각 지역의 정규 근무시간이 가장 넓게 겹치는 구간을 코어타임으로 둡니다.',
    windows: [
      { id: 'apac', name: '아시아 · 중동 · 유럽', from: 16, to: 19, entities: ['vn', 'apac', 'kr', 'me', 'eu'] },
      { id: 'kram', name: '한국 · 미주 동부', from: 19, to: 22, entities: ['kr', 'hva', 'mx'] },
      { id: 'euam', name: '유럽 · 미주', from: 23, to: 26, entities: ['eu', 'mx', 'hva', 'hvw'] }
    ]
  },
  Q3: {
    label: '3분기 · 하계 유연근무 코어타임',
    note: '하계 휴가와 조기 출퇴근(유연근무)을 반영해 코어타임이 한 시간씩 앞당겨집니다.',
    windows: [
      { id: 'apac', name: '아시아 · 중동 · 유럽', from: 15, to: 18, entities: ['vn', 'apac', 'kr', 'me', 'eu'] },
      { id: 'kram', name: '한국 · 미주 동부', from: 18, to: 21, entities: ['kr', 'hva', 'mx'] },
      { id: 'euam', name: '유럽 · 미주', from: 22, to: 25, entities: ['eu', 'mx', 'hva', 'hvw'] }
    ]
  },
  Q4: {
    label: '4분기 · 결산 · 연말 코어타임',
    note: '예산·결산과 차년도 준비로 글로벌 협의가 늘어나는 분기로, 코어타임 창을 30분씩 넓혀 운영합니다.',
    windows: [
      { id: 'apac', name: '아시아 · 중동 · 유럽', from: 16, to: 19.5, entities: ['vn', 'apac', 'kr', 'me', 'eu'] },
      { id: 'kram', name: '한국 · 미주 동부', from: 19, to: 22.5, entities: ['kr', 'hva', 'mx'] },
      { id: 'euam', name: '유럽 · 미주', from: 22.5, to: 26, entities: ['eu', 'mx', 'hva', 'hvw'] }
    ]
  }
};

/** 회의 소요시간 선택지 (분) */
window.DURATIONS = [30, 60, 90, 120];

/* ─────────────────────────────────────────────────────────────
 * 3) 공휴일 (2026년)
 *    값은 문자열(휴일명) 또는 { name, tentative } 객체입니다.
 *    tentative: true = 음력·이슬람력 기반이라 확정 공고 전 잠정 날짜
 * ───────────────────────────────────────────────────────────── */
window.HOLIDAYS = {
  kr: {
    '2026-01-01': '신정',
    '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
    '2026-03-02': '삼일절 대체공휴일',
    '2026-05-01': '근로자의 날',
    '2026-05-05': '어린이날',
    '2026-05-25': '부처님오신날 대체공휴일',
    '2026-06-03': '전국동시지방선거',
    '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
    '2026-10-05': '개천절 대체공휴일',
    '2026-10-09': '한글날',
    '2026-12-25': '성탄절'
  },
  us: {
    '2026-01-01': "New Year's Day",
    '2026-01-19': 'Martin Luther King Jr. Day',
    '2026-02-16': "Presidents' Day",
    '2026-05-25': 'Memorial Day',
    '2026-06-19': 'Juneteenth',
    '2026-07-03': 'Independence Day (관측)',
    '2026-09-07': 'Labor Day',
    '2026-11-26': 'Thanksgiving',
    '2026-11-27': { name: 'Day after Thanksgiving', tentative: true },
    '2026-12-25': 'Christmas Day'
  },
  mx: {
    '2026-01-01': 'Año Nuevo',
    '2026-02-02': 'Día de la Constitución',
    '2026-03-16': 'Natalicio de Benito Juárez',
    '2026-04-03': { name: 'Viernes Santo', tentative: true },
    '2026-05-01': 'Día del Trabajo',
    '2026-09-16': 'Día de la Independencia',
    '2026-11-16': 'Día de la Revolución',
    '2026-12-25': 'Navidad'
  },
  uk: {
    '2026-01-01': "New Year's Day",
    '2026-04-03': 'Good Friday',
    '2026-04-06': 'Easter Monday',
    '2026-05-04': 'Early May Bank Holiday',
    '2026-05-25': 'Spring Bank Holiday',
    '2026-08-31': 'Summer Bank Holiday',
    '2026-12-25': 'Christmas Day',
    '2026-12-28': 'Boxing Day (대체)'
  },
  ae: {
    '2026-01-01': "New Year's Day",
    '2026-03-19': { name: 'Eid al-Fitr', tentative: true },
    '2026-03-20': { name: 'Eid al-Fitr', tentative: true },
    '2026-03-21': { name: 'Eid al-Fitr', tentative: true },
    '2026-05-26': { name: 'Arafat Day', tentative: true },
    '2026-05-27': { name: 'Eid al-Adha', tentative: true },
    '2026-05-28': { name: 'Eid al-Adha', tentative: true },
    '2026-06-16': { name: 'Islamic New Year', tentative: true },
    '2026-08-25': { name: "Prophet Muhammad's Birthday", tentative: true },
    '2026-12-01': 'Commemoration Day',
    '2026-12-02': 'National Day', '2026-12-03': 'National Day'
  },
  sg: {
    '2026-01-01': "New Year's Day",
    '2026-02-17': 'Chinese New Year', '2026-02-18': 'Chinese New Year',
    '2026-03-21': { name: 'Hari Raya Puasa', tentative: true },
    '2026-04-03': 'Good Friday',
    '2026-05-01': 'Labour Day',
    '2026-05-27': { name: 'Hari Raya Haji', tentative: true },
    '2026-05-31': { name: 'Vesak Day', tentative: true },
    '2026-08-10': 'National Day (대체)',
    '2026-11-08': { name: 'Deepavali', tentative: true },
    '2026-12-25': 'Christmas Day'
  },
  vn: {
    '2026-01-01': 'Tết Dương lịch',
    '2026-02-16': { name: 'Tết Nguyên đán', tentative: true },
    '2026-02-17': { name: 'Tết Nguyên đán', tentative: true },
    '2026-02-18': { name: 'Tết Nguyên đán', tentative: true },
    '2026-02-19': { name: 'Tết Nguyên đán', tentative: true },
    '2026-02-20': { name: 'Tết Nguyên đán', tentative: true },
    '2026-04-26': { name: 'Giỗ Tổ Hùng Vương', tentative: true },
    '2026-04-30': 'Ngày Giải phóng',
    '2026-05-01': 'Ngày Quốc tế Lao động',
    '2026-09-02': 'Quốc khánh'
  }
};

/** 'YYYY-MM-DD' 키로 공휴일 조회 → { name, tentative } 또는 null */
window.holidayOf = function (entityOrId, dateKey) {
  var key = typeof entityOrId === 'string' ? entityOrId : (entityOrId.holidays || entityOrId.id);
  var table = window.HOLIDAYS[key];
  if (!table || !table[dateKey]) return null;
  var value = table[dateKey];
  return typeof value === 'string' ? { name: value, tentative: false } : value;
};
