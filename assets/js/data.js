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
    city: '성남 판교',
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
    city: 'Teaneck, NJ',
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
    city: 'Mexico City',
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
    city: 'Chertsey, Surrey',
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
    city: 'Dubai',
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
    city: 'Singapore',
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
