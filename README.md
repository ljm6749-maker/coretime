# coretime — 우리 몇 시에 만날까요?

한화비전 글로벌 법인 간 회의 시간을 조율하는 정적 웹 도구.

**배포 주소** — https://coretime.pages.dev

## 폴더 구조

```
index.html               원본 골격 (assets/ 를 불러오는 틀)
build.py                 assets/ 의 CSS·JS 를 한 파일로 합쳐 dist/index.html 생성
assets/
  css/styles.css         전체 스타일
  js/data.js             법인 정보 · 코어타임 창 · 조합별 규칙 · 공휴일
  js/tz.js               시간대 변환 (Intl API, 서머타임 자동 반영)
  js/scheduler.js        추천시간 판정 엔진
  js/i18n.js             국문 · 영문 문구
  js/mail.js             회의 소집 메일 템플릿
  js/app.js              화면 렌더링
  js/counter.js          조회수 카운터
worker/view-counter.js   조회수 집계용 Cloudflare Worker (별도 배포)
.github/workflows/       GitHub push 시 Cloudflare Pages 자동 배포
.claude/commands/        Claude Code 커스텀 명령 (/deploy, /preview)
```

## 수정 방법

1. **`assets/` 안의 원본을 고친다.** 화면 구조를 바꿀 때만 `index.html` 을 건드린다.
2. `python3 build.py` 로 확인 → `dist/index.html` 이 만들어진다 (`dist/` 는 커밋하지 않는다)
3. 커밋 · 푸시 → GitHub Actions 가 다시 빌드해 Cloudflare Pages 로 배포

Claude Code 에서는 `/deploy` 한 번으로 처리된다.

> `index.html` 은 `assets/` 를 불러오는 **원본 골격**이다. 빌드 결과(`dist/index.html`)로
> 덮어쓰면 다음 빌드부터 `assets/` 수정이 반영되지 않으므로 주의한다.

## 규칙을 바꾸려면

거의 모든 정책은 `assets/js/data.js` 한 곳에 있다.

| 바꾸고 싶은 것 | 위치 |
|---|---|
| 법인 추가 · 이름 · 근무시간 · 시간대 | `ENTITIES` |
| 분기별 글로벌 코어타임 창 | `CORE_WINDOW_ODD` / `CORE_WINDOW_EVEN` |
| 조합별 고정 · 교대 규칙 | `MEETING_RULES` |
| 공휴일 | `HOLIDAYS` |

`MEETING_RULES` 의 `sets` 에 적힌 법인 조합과 **정확히 일치**할 때만 그 규칙이 적용되고,
일치하지 않으면 참여 법인의 근무시간을 기준으로 자동 편성된다.

## 배포 설정

GitHub Actions 가 Cloudflare Pages 로 배포하려면 저장소 Secret 두 개가 필요하다.

- `CLOUDFLARE_API_TOKEN` — Cloudflare API 토큰 (Pages 편집 권한)
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare 계정 ID
