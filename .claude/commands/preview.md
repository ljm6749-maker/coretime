---
description: 수정한 화면을 브라우저로 열어 스크린샷으로 확인합니다
---

소스를 고친 뒤 실제 화면이 의도대로 나오는지 눈으로 확인한다.

## 순서

1. `python3 build.py` 로 `dist/index.html` 을 만든다.

2. Playwright 로 `file:///.../dist/index.html` 을 연다.
   - Chromium 실행 파일: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
   - 뷰포트는 1400×1000 정도로 둔다.

3. 확인할 상태를 만든다.
   - 회의 개최일자, 나의 소속, 소요시간을 채우고 참여 법인을 몇 개 선택한다.
   - `$ARGUMENTS` 에 확인하고 싶은 조합이 있으면 그 조합으로 맞춘다.

4. 스크린샷을 찍어 사용자에게 보낸다.
   - 시간표만: `.tt`
   - 기준 패널만: `#panelPolicy`
   - 전체: 페이지 전체

5. 콘솔 오류(`pageerror`)가 있으면 함께 보고한다.
