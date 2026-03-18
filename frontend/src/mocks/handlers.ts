import { http, HttpResponse, delay } from 'msw'
import { defaultGameState } from '../store/gameStore'

export const handlers = [
  // 최초 진입 시 전체 게임 상태(Status)
  http.get('*/api/v1/companies/:companyId/status', async () => {
    await delay(800);
    return HttpResponse.json(defaultGameState); // store에 정의된 초기 상태를 그대로 사용하여 덮어씀
  }),

  // 시장 거래 (Market)
  http.post('*/api/v1/market/orders', async () => {
    await delay(600);
    return HttpResponse.json({ success: true, message: 'Order created' });
  }),

  // 인력(HR) 
  http.post('*/api/v1/hr/upgrade', async () => {
    await delay(1000);
    return HttpResponse.json({ success: true });
  }),
  http.post('*/api/v1/hr/recruit', async () => {
    await delay(800);
    return HttpResponse.json({ success: true });
  }),

  // 미니게임 (Minigame)
  http.post('*/api/v1/minigame/unlock', async () => {
    await delay(500);
    return HttpResponse.json({ success: true });
  }),
  http.post('*/api/v1/minigame/claim', async () => {
    await delay(500);
    return HttpResponse.json({ success: true, reward: 50 });
  }),

  // 공통 딜레이
  http.get('*/api/v1/alerts', async () => {
    await delay(300);
    return HttpResponse.json([
      { id: 'm1', message: '[Mock] 테스트 알림 1', detail: 'MSW 연동 테스트', timeAgo: '방금 전', read: false },
      { id: 'm2', message: '[Mock] 테스트 알림 2', detail: '작업장 생산 완료', timeAgo: '10분 전', read: false }
    ]);
  }),
  http.post('*/api/v1/workstations/start', async () => {
    await delay(700);
    return HttpResponse.json({ success: true, message: 'Workstation started' });
  }),
  http.post('*/api/v1/workstations/collect', async () => {
    await delay(700);
    return HttpResponse.json({ success: true, message: 'Items collected' });
  }),
  // Ranking & Inventory
  http.get('*/api/v1/ranking/top', async () => {
    await delay(500);
    return HttpResponse.json({
      data: [
        { rank: 1, name: "허서연", company: "기업", amount: "10,000,000" },
        { rank: 2, name: "손서영", company: "", amount: "8,500,000" },
        { rank: 3, name: "김은수", company: "", amount: "7,200,000" },
        { rank: 4, name: "강찬휘", company: "", amount: "6,000,000" },
        { rank: 5, name: "소재헌", company: "", amount: "5,500,000" },
        { rank: 6, name: "최두용", company: "", amount: "4,200,000" }
      ],
      lastUpdated: "2026.03.03 PM 09:00"
    });
  }),
  http.get('*/api/v1/inventory', async () => {
    await delay(600);
    // 임의의 실패 예외 처리 테스트를 원하면 아래 주석 해제하여 500 에러를 반환할 수 있습니다.
    // return new HttpResponse(null, { status: 500 });
    return HttpResponse.json([
      { id: 1, name: "일꾼A", level: 2 },
      { id: 2 },
      { id: 3 },
      { id: 4, locked: true },
    ]);
  }),
  http.get('*/api/v1/bank/summary', async () => {
    await delay(400);
    return HttpResponse.json({
      loanRate: 5.5,
      depositRate: 2.3,
      currentLoan: 500000,
      currentDeposit: 150000,
    });
  }),
]
