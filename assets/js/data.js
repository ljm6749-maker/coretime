/**
 * 한화비전 글로벌 법인 정보 및 분기별 코어타임 정책
 *
 * 이 파일 하나만 수정하면 지도 마커 · 실시간 시계 · 회의시간 추천 로직에
 * 모두 반영됩니다. (법인 추가/삭제, 근무시간 변경, 분기 정책 변경)
 */

/* ─────────────────────────────────────────────────────────────
 * 1) 법인 (Corporations)
 *    lat/lon 은 지도(정방형 도법) 마커 위치에 사용됩니다.
 *    tz 는 IANA 표준 시간대 ID → 서머타임(DST)은 브라우저가 자동 반영합니다.
 * ───────────────────────────────────────────────────────────── */
window.ENTITIES = [
  {
    id: 'kr',
    name: '한국',
    legal: 'Hanwha Vision Co., Ltd. (본사)',
    city: '성남 판교', cityEn: 'Seongnam',
    country: '대한민국',
    code: 'HQ',
    tz: 'Asia/Seoul',
    lat: 37.40, lon: 127.10,
    labelSide: 'left',
    workdays: [1, 2, 3, 4, 5],
    lunch: [12, 13]
  },
  {
    id: 'na',
    name: '북미',
    legal: 'Hanwha Vision America',
    city: 'Teaneck, NJ', cityEn: 'Teaneck, NJ',
    country: '미국',
    code: 'HVA',
    tz: 'America/New_York',
    lat: 40.89, lon: -74.01,
    labelSide: 'left',
    workdays: [1, 2, 3, 4, 5],
    lunch: [12, 13]
  },
  {
    id: 'latam',
    name: '중남미',
    legal: 'Hanwha Vision Latin America',
    city: 'Mexico City', cityEn: 'Mexico City',
    country: '멕시코',
    code: 'HVL',
    tz: 'America/Mexico_City',
    lat: 19.43, lon: -99.13,
    labelSide: 'bottom',
    workdays: [1, 2, 3, 4, 5],
    lunch: [13, 14]
  },
  {
    id: 'eu',
    name: '유럽',
    legal: 'Hanwha Vision Europe',
    city: 'Chertsey, Surrey', cityEn: 'Chertsey',
    country: '영국',
    code: 'HVE',
    tz: 'Europe/London',
    lat: 51.39, lon: -0.51,
    labelSide: 'top',
    workdays: [1, 2, 3, 4, 5],
    lunch: [12, 13]
  },
  {
    id: 'me',
    name: '중동',
    legal: 'Hanwha Vision Middle East',
    city: 'Dubai', cityEn: 'Dubai',
    country: 'UAE',
    code: 'HVM',
    tz: 'Asia/Dubai',
    lat: 25.20, lon: 55.27,
    labelSide: 'bottom',
    workdays: [1, 2, 3, 4, 5],
    /** 금요일 주마(합동예배) 시간대는 회의 편성에서 제외 */
    shortDay: { weekday: 5, until: 12, reason: '금요일 오후 주마 예배' },
    lunch: [13, 14]
  },
  {
    id: 'sg',
    name: '싱가포르',
    legal: 'Hanwha Vision Singapore',
    city: 'Singapore', cityEn: 'Singapore',
    country: '싱가포르',
    code: 'HVS',
    tz: 'Asia/Singapore',
    lat: 1.35, lon: 103.82,
    labelSide: 'right',
    workdays: [1, 2, 3, 4, 5],
    lunch: [12, 13]
  }
];

/* ─────────────────────────────────────────────────────────────
 * 2) 분기별 글로벌 코어타임 정책
 *
 *    core     : 글로벌 회의를 "권장"하는 현지시간 구간   (최우선 배치)
 *    extended : 사전 협의 시 "가능"한 현지시간 구간      (차선 배치)
 *    시간은 모두 각 법인의 현지시간(24시간, 소수 = 분)입니다. 예) 8.5 = 08:30
 *
 *    ※ 아래 값은 분기 운영 특성을 반영한 기준안입니다.
 *      확정된 사내 코어타임 공지가 있으면 이 표만 교체하면 됩니다.
 * ───────────────────────────────────────────────────────────── */
window.CORE_TIME_POLICY = {
  Q1: {
    label: '1분기 · 사업계획 정렬 코어타임',
    note: '연간 사업계획 · 전년 실적 마감이 집중되는 분기로, 본사–해외법인 간 협의 구간을 넓게 운영합니다.',
    windows: {
      kr:    { core: [9, 19],   extended: [8, 21] },
      na:    { core: [8.5, 17], extended: [7.5, 19] },
      latam: { core: [9, 18],   extended: [8, 19] },
      eu:    { core: [8.5, 17.5], extended: [7.5, 19] },
      me:    { core: [9, 18],   extended: [8, 19] },
      sg:    { core: [9, 18],   extended: [8, 20] }
    }
  },
  Q2: {
    label: '2분기 · 표준 코어타임',
    note: '표준 운영 분기입니다. 각 법인의 정규 근무시간을 기준으로 코어타임을 적용합니다.',
    windows: {
      kr:    { core: [9, 18],   extended: [8, 20] },
      na:    { core: [9, 17],   extended: [8, 18.5] },
      latam: { core: [9, 18],   extended: [8, 19] },
      eu:    { core: [9, 17.5], extended: [8, 18.5] },
      me:    { core: [9, 18],   extended: [8, 19] },
      sg:    { core: [9, 18],   extended: [8, 19] }
    }
  },
  Q3: {
    label: '3분기 · 하계 유연근무 코어타임',
    note: '하계 휴가 · 조기 출퇴근(유연근무)이 반영되어 코어타임이 전반적으로 앞당겨지고 짧아집니다.',
    windows: {
      kr:    { core: [8, 17],   extended: [7.5, 19] },
      na:    { core: [8.5, 16], extended: [8, 17.5] },
      latam: { core: [8.5, 17], extended: [8, 18] },
      eu:    { core: [8.5, 16.5], extended: [8, 18] },
      me:    { core: [8, 16],   extended: [7.5, 17.5] },
      sg:    { core: [8.5, 17.5], extended: [8, 18.5] }
    }
  },
  Q4: {
    label: '4분기 · 결산 · 연말 코어타임',
    note: '예산 · 결산 및 차년도 준비로 글로벌 협의가 늘어나는 분기로, 이른 아침 / 늦은 저녁 구간을 일부 허용합니다.',
    windows: {
      kr:    { core: [9, 19],   extended: [7.5, 21.5] },
      na:    { core: [8.5, 17.5], extended: [7, 19] },
      latam: { core: [9, 18],   extended: [8, 19.5] },
      eu:    { core: [8.5, 18], extended: [7.5, 19.5] },
      me:    { core: [9, 18],   extended: [8, 19.5] },
      sg:    { core: [9, 18],   extended: [8, 20] }
    }
  }
};

/** 회의 소요시간 선택지 (분) */
window.DURATIONS = [30, 60, 90, 120];

/* ─────────────────────────────────────────────────────────────
 * 3) 법인별 공휴일 (2026년)
 *
 *    값은 문자열(휴일명) 또는 { name, tentative } 객체입니다.
 *    tentative: true = 음력/이슬람력 기반이라 확정 공고 전 잠정 날짜
 *    ※ 매년 사내 휴무일 공지에 맞춰 갱신해야 합니다.
 * ───────────────────────────────────────────────────────────── */
window.HOLIDAYS = {
  kr: {
    '2026-01-01': '신정',
    '2026-02-16': '설날 연휴',
    '2026-02-17': '설날',
    '2026-02-18': '설날 연휴',
    '2026-03-02': '삼일절 대체공휴일',
    '2026-05-01': '근로자의 날',
    '2026-05-05': '어린이날',
    '2026-05-25': '부처님오신날 대체공휴일',
    '2026-06-03': '전국동시지방선거',
    '2026-09-24': '추석 연휴',
    '2026-09-25': '추석',
    '2026-09-26': '추석 연휴',
    '2026-10-05': '개천절 대체공휴일',
    '2026-10-09': '한글날',
    '2026-12-25': '성탄절'
  },
  na: {
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
  latam: {
    '2026-01-01': 'Año Nuevo',
    '2026-02-02': 'Día de la Constitución',
    '2026-03-16': 'Natalicio de Benito Juárez',
    '2026-04-03': { name: 'Viernes Santo', tentative: true },
    '2026-05-01': 'Día del Trabajo',
    '2026-09-16': 'Día de la Independencia',
    '2026-11-16': 'Día de la Revolución',
    '2026-12-25': 'Navidad'
  },
  eu: {
    '2026-01-01': "New Year's Day",
    '2026-04-03': 'Good Friday',
    '2026-04-06': 'Easter Monday',
    '2026-05-04': 'Early May Bank Holiday',
    '2026-05-25': 'Spring Bank Holiday',
    '2026-08-31': 'Summer Bank Holiday',
    '2026-12-25': 'Christmas Day',
    '2026-12-28': 'Boxing Day (대체)'
  },
  me: {
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
    '2026-12-02': 'National Day',
    '2026-12-03': 'National Day'
  },
  sg: {
    '2026-01-01': "New Year's Day",
    '2026-02-17': 'Chinese New Year',
    '2026-02-18': 'Chinese New Year',
    '2026-03-21': { name: 'Hari Raya Puasa', tentative: true },
    '2026-04-03': 'Good Friday',
    '2026-05-01': 'Labour Day',
    '2026-05-27': { name: 'Hari Raya Haji', tentative: true },
    '2026-05-31': { name: 'Vesak Day', tentative: true },
    '2026-08-10': 'National Day (대체)',
    '2026-11-08': { name: 'Deepavali', tentative: true },
    '2026-12-25': 'Christmas Day'
  }
};

/** 'YYYY-MM-DD' 키로 공휴일 조회 → { name, tentative } 또는 null */
window.holidayOf = function (entityId, dateKey) {
  var table = window.HOLIDAYS[entityId];
  if (!table || !table[dateKey]) return null;
  var value = table[dateKey];
  return typeof value === 'string' ? { name: value, tentative: false } : value;
};
