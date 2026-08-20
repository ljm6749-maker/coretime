/**
 * 조회수 카운터 Cloudflare Worker (무료 플랜으로 충분)
 *
 * 배포 순서
 *   1. dash.cloudflare.com → Workers & Pages → Create → Worker 생성
 *   2. 이 파일 내용을 붙여넣고 Deploy
 *   3. Settings → Variables → KV Namespace Bindings 에서
 *      새 KV 네임스페이스를 만들고 변수명 COUNTER 로 연결
 *   4. 발급된 주소(https://<이름>.<계정>.workers.dev)를
 *      assets/js/counter.js 의 workerUrl 에 넣기 (mode 는 'auto' 그대로 두면 Worker 를 먼저 사용)
 *
 * 응답 예시: { "today": 12, "total": 348 }
 */
export default {
  async fetch(request, env) {
    const cors = {
      'access-control-allow-origin': '*',
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    };

    const url = new URL(request.url);
    const counting = url.searchParams.get('hit') === '1';
    const now = new Date();
    const dayKey = 'day:' + now.toISOString().slice(0, 10);

    let total = Number(await env.COUNTER.get('total')) || 0;
    let today = Number(await env.COUNTER.get(dayKey)) || 0;

    if (counting) {
      total += 1;
      today += 1;
      await env.COUNTER.put('total', String(total));
      await env.COUNTER.put(dayKey, String(today), { expirationTtl: 60 * 60 * 24 * 40 });
    }

    return new Response(JSON.stringify({ today, total }), { headers: cors });
  }
};
