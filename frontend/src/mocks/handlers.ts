import { http, HttpResponse, delay } from 'msw'
import { defaultGameState } from '../store/gameStore'

export const handlers = [
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
      { id: 'm1', message: '[시스템] 추가 분석 보고서 도착', detail: 'MSW 연동 테스트 (안읽음)', timeAgo: '방금 전', read: false },
      { id: 'm2', message: '[경고] 외부 기온 급강하 피해 예상', detail: '설비 점검 요망 (안읽음)', timeAgo: '10분 전', read: false },
      { id: 'm3', message: '[정보] 전일 생산 목표 달성', timeAgo: '어제', read: true },
      { id: 'm4', message: '[알림] 직원 복지 기금 입금 확인', timeAgo: '어제', read: true },
      { id: 'm5', message: '[시스템] 공장 가동률 80% 돌파', timeAgo: '2일 전', read: true },
      { id: 'm6', message: '[구매] 주요 원자재 가격 변동 알림', timeAgo: '2일 전', read: true },
      { id: 'm7', message: '[공지] 이번 주 창고 정리 일정 안내', timeAgo: '3일 전', read: true },
      { id: 'm8', message: '[마케팅] 신규 계약 체결 성공', timeAgo: '3일 전', read: true },
      { id: 'm9', message: '[인사] 이달의 우수 사원 선정 발표', timeAgo: '4일 전', read: true },
      { id: 'm10', message: '[시스템] 정기 시스템 유지보수 완료', timeAgo: '5일 전', read: true }
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
    return HttpResponse.json({
      data: [
        { slotIndex: 0, itemId: 1, itemName: "철광석", itemType: "MATERIAL", quantity: 120, maxQuantity: 500 },
        { slotIndex: 1, itemId: 2, itemName: "목재", itemType: "MATERIAL", quantity: 80, maxQuantity: 500 },
        { slotIndex: 2, itemId: 3, itemName: "철검", itemType: "PRODUCT", quantity: 30, maxQuantity: 500 },
        { slotIndex: 3, itemId: null, itemName: null, itemType: null, quantity: 0, maxQuantity: 500 },
      ]
    });
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
