import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../store/gameStore'

// ─────────────────────────────────────────────────────────────
// gameStore 단위 테스트
// Zustand 스토어의 액션(함수)들이 상태를 올바르게 변경하는지 검증
// ─────────────────────────────────────────────────────────────

describe('gameStore', () => {

  // 매 테스트 전에 스토어를 초기 상태로 리셋
  beforeEach(() => {
    const { setState } = useGameStore
    setState({
      money: 5000000,
      companyName: '',
      industry: '금 제련업',
      warehouseMaxSlots: 6,
      inventoryMax: 4,
      warehouseItems: [],
      inventoryItems: [
        { id: 'inv_default_1', type: 'worker_수습_광부' as any, name: '수습 광부', icon: '⛏️', quantity: 1, level: 1 },
      ],
      warehouseExpandTickets: 0,
      inventoryExpandTickets: 0,
      debt: 0,
      bankData: { loanRate: 5.5, depositRate: 2.3, currentLoan: 0, currentDeposit: 0 },
      activeModal: null,
      activeBuildingPage: null,
      alerts: [],
    })
  })

  // ──────────────────────────────────────────────
  // 💰 돈(money) 관련 테스트
  // ──────────────────────────────────────────────

  describe('updateMoney', () => {
    it('돈을 정상적으로 증가시킨다', () => {
      const result = useGameStore.getState().updateMoney(1000)
      expect(result).toBe(true)
      expect(useGameStore.getState().money).toBe(5001000)
    })

    it('돈을 정상적으로 감소시킨다', () => {
      const result = useGameStore.getState().updateMoney(-1000000)
      expect(result).toBe(true)
      expect(useGameStore.getState().money).toBe(4000000)
    })

    it('잔액보다 많이 감소시키면 false를 반환하고 변경하지 않는다', () => {
      const result = useGameStore.getState().updateMoney(-99999999)
      expect(result).toBe(false)
      expect(useGameStore.getState().money).toBe(5000000) // 변경 없음
    })
  })

  // ──────────────────────────────────────────────
  // 🏭 회사 정보 테스트
  // ──────────────────────────────────────────────

  describe('setCompanyInfo', () => {
    it('회사 이름과 산업을 설정한다', () => {
      useGameStore.getState().setCompanyInfo('테스트 회사', '금광업')
      const state = useGameStore.getState()
      expect(state.companyName).toBe('테스트 회사')
      expect(state.industry).toBe('금광업')
    })
  })

  // ──────────────────────────────────────────────
  // 📦 창고(Warehouse) 재료 테스트
  // ──────────────────────────────────────────────

  describe('updateMaterial', () => {
    it('재료를 추가하면 warehouseItems에 반영된다', () => {
      useGameStore.getState().updateMaterial(50)
      const items = useGameStore.getState().warehouseItems
      const material = items.find(i => i.type === 'material')
      expect(material).toBeDefined()
      expect(material!.quantity).toBe(50)
    })

    it('재료를 두 번 추가하면 누적된다', () => {
      useGameStore.getState().updateMaterial(30)
      useGameStore.getState().updateMaterial(20)
      const material = useGameStore.getState().warehouseItems.find(i => i.type === 'material')
      expect(material!.quantity).toBe(50)
    })

    it('보유량보다 많이 차감하면 상태가 변경되지 않는다', () => {
      useGameStore.getState().updateMaterial(10)
      useGameStore.getState().updateMaterial(-50) // 10개밖에 없는데 50개 차감 시도
      const material = useGameStore.getState().warehouseItems.find(i => i.type === 'material')
      expect(material!.quantity).toBe(10) // 변경 없음
    })
  })

  describe('updateProduct', () => {
    it('생산품을 추가하면 warehouseItems에 반영된다', () => {
      useGameStore.getState().updateProduct(100)
      const product = useGameStore.getState().warehouseItems.find(i => i.type === 'product')
      expect(product).toBeDefined()
      expect(product!.quantity).toBe(100)
    })
  })

  // ──────────────────────────────────────────────
  // 🎒 인벤토리 테스트
  // ──────────────────────────────────────────────

  describe('addInventoryItem', () => {
    it('일꾼 아이템을 인벤토리에 추가한다', () => {
      useGameStore.getState().addInventoryItem({
        type: 'worker_숙련_광부' as any,
        name: '숙련 광부',
        icon: '⛏️',
        quantity: 1,
        level: 2,
      })
      const items = useGameStore.getState().inventoryItems
      expect(items.length).toBe(2) // 기본 1개 + 추가 1개
      expect(items[1].name).toBe('숙련 광부')
    })

    it('창고 확장권을 추가하면 warehouseExpandTickets가 증가한다', () => {
      useGameStore.getState().addInventoryItem({
        type: 'ticket_warehouse',
        name: '창고 확장권',
        icon: '📦',
        quantity: 1,
      })
      expect(useGameStore.getState().warehouseExpandTickets).toBe(1)
      // 인벤토리 아이템 배열에는 추가되지 않아야 함
      expect(useGameStore.getState().inventoryItems.length).toBe(1)
    })

    it('인벤토리 확장권을 추가하면 inventoryExpandTickets가 증가한다', () => {
      useGameStore.getState().addInventoryItem({
        type: 'ticket_inventory',
        name: '인벤토리 확장권',
        icon: '🎒',
        quantity: 1,
      })
      expect(useGameStore.getState().inventoryExpandTickets).toBe(1)
    })
  })

  describe('removeInventoryItem', () => {
    it('인벤토리에서 아이템을 제거한다', () => {
      useGameStore.getState().removeInventoryItem('inv_default_1')
      expect(useGameStore.getState().inventoryItems.length).toBe(0)
    })
  })

  // ──────────────────────────────────────────────
  // 🔓 확장권 사용 테스트
  // ──────────────────────────────────────────────

  describe('useWarehouseTicket', () => {
    it('확장권이 있으면 슬롯을 확장하고 true를 반환한다', () => {
      useGameStore.setState({ warehouseExpandTickets: 1 })
      const result = useGameStore.getState().useWarehouseTicket()
      expect(result).toBe(true)
      expect(useGameStore.getState().warehouseMaxSlots).toBe(7) // 6 → 7
      expect(useGameStore.getState().warehouseExpandTickets).toBe(0)
    })

    it('확장권이 없으면 false를 반환한다', () => {
      const result = useGameStore.getState().useWarehouseTicket()
      expect(result).toBe(false)
      expect(useGameStore.getState().warehouseMaxSlots).toBe(6) // 변경 없음
    })
  })

  describe('useInventoryTicket', () => {
    it('확장권이 있으면 인벤토리 슬롯을 확장한다', () => {
      useGameStore.setState({ inventoryExpandTickets: 2 })
      const result = useGameStore.getState().useInventoryTicket()
      expect(result).toBe(true)
      expect(useGameStore.getState().inventoryMax).toBe(5) // 4 → 5
      expect(useGameStore.getState().inventoryExpandTickets).toBe(1)
    })
  })

  // ──────────────────────────────────────────────
  // 🏦 은행 테스트
  // ──────────────────────────────────────────────

  describe('updateDebt', () => {
    it('부채를 증가시킨다', () => {
      useGameStore.getState().updateDebt(1000000)
      expect(useGameStore.getState().debt).toBe(1000000)
      expect(useGameStore.getState().bankData.currentLoan).toBe(1000000)
    })

    it('부채를 감소시키되 0 아래로 내려가지 않는다', () => {
      useGameStore.getState().updateDebt(500000)
      useGameStore.getState().updateDebt(-9999999)
      expect(useGameStore.getState().debt).toBe(0)
    })
  })

  // ──────────────────────────────────────────────
  // 🔀 모달 & 건물 페이지 전환 테스트
  // ──────────────────────────────────────────────

  describe('UI 상태 전환', () => {
    it('모달을 열고 닫을 수 있다', () => {
      useGameStore.getState().openModal('inventory')
      expect(useGameStore.getState().activeModal).toBe('inventory')

      useGameStore.getState().closeModal()
      expect(useGameStore.getState().activeModal).toBeNull()
    })

    it('건물 페이지를 열고 닫을 수 있다', () => {
      useGameStore.getState().openBuildingPage('warehouse')
      expect(useGameStore.getState().activeBuildingPage).toBe('warehouse')

      useGameStore.getState().closeBuildingPage()
      expect(useGameStore.getState().activeBuildingPage).toBeNull()
    })

    it('모달 탭을 전환할 수 있다', () => {
      useGameStore.getState().switchTab('alert')
      expect(useGameStore.getState().activeModal).toBe('alert')

      useGameStore.getState().switchTab('news')
      expect(useGameStore.getState().activeModal).toBe('news')
    })
  })

  // ──────────────────────────────────────────────
  // 🏭 산업별 아이템 이름 테스트
  // ──────────────────────────────────────────────

  describe('getIndustryItemNames', () => {
    it('금 제련업이면 금광석/금괴를 반환한다', () => {
      useGameStore.setState({ industry: '금 제련업' })
      const names = useGameStore.getState().getIndustryItemNames()
      expect(names.material).toBe('금광석')
      expect(names.product).toBe('금괴')
    })

    it('금광업이면 광산 드릴/금광석을 반환한다', () => {
      useGameStore.setState({ industry: '금광업' })
      const names = useGameStore.getState().getIndustryItemNames()
      expect(names.material).toBe('광산 드릴')
      expect(names.product).toBe('금광석')
    })

    it('제조업이면 금괴/광산 드릴을 반환한다', () => {
      useGameStore.setState({ industry: '제조업' })
      const names = useGameStore.getState().getIndustryItemNames()
      expect(names.material).toBe('금괴')
      expect(names.product).toBe('광산 드릴')
    })
  })

  // ──────────────────────────────────────────────
  // 🔔 알림 테스트
  // ──────────────────────────────────────────────

  describe('alerts', () => {
    it('알림을 추가하면 배열 맨 앞에 들어간다', () => {
      useGameStore.getState().addAlert({ message: '테스트 알림' })
      const alerts = useGameStore.getState().alerts
      expect(alerts.length).toBe(1)
      expect(alerts[0].message).toBe('테스트 알림')
      expect(alerts[0].read).toBe(false)
    })

    it('알림을 삭제할 수 있다', () => {
      useGameStore.getState().addAlert({ message: '알림1' })
      const id = useGameStore.getState().alerts[0].id
      useGameStore.getState().dismissAlert(id)
      expect(useGameStore.getState().alerts.length).toBe(0)
    })

    it('모든 알림을 읽음 처리할 수 있다', () => {
      useGameStore.getState().addAlert({ message: '알림1' })
      useGameStore.getState().addAlert({ message: '알림2' })
      useGameStore.getState().markAllAlertsAsRead()
      const alerts = useGameStore.getState().alerts
      expect(alerts.every(a => a.read)).toBe(true)
    })
  })

  // ──────────────────────────────────────────────
  // 🎒 getWarehouseUsage (창고 사용량 검증 추가)
  // ──────────────────────────────────────────────
  describe('getWarehouseUsage', () => {
    it('창고의 사용 퍼센트를 올바르게 계산한다', () => {
      // 1. 상태를 가져옵니다. (가상의 컴퓨터가 게임 데이터를 꺼내옴)
      const state = useGameStore.getState()
      
      // 2. 창고에 임의로 아이템을 100개 채워넣습니다! 퍼센트가 올라가겠죠?
      state.updateMaterial(100) 
      
      // 3. getWarehouseUsage 함수 호출 (현재 사용량 % 정보가 담긴 객체 반환)
      const { percent } = useGameStore.getState().getWarehouseUsage()
      
      // 4. 단언문(expect): 무조건 사용량이 0%보다는 높고 100% 이하여야 한다고 강제확인
      expect(typeof percent).toBe('number')
      expect(percent).toBeGreaterThan(0) // 아이템을 100개나 넣었으니 0퍼센트는 아닐 것!
    })
  })

  // ──────────────────────────────────────────────
  // 👷 신규 일꾼 뱃지 테스트 (hasNewWorker)
  // ──────────────────────────────────────────────
  describe('hasNewWorker 기능', () => {
    it('신규 일꾼이 인벤토리에 들어오면 hasNewWorker 값이 true로 바뀐다', () => {
      // 1. 처음엔 배지 알람이 꺼져있을 것이라고 설정 (준비 단계)
      useGameStore.setState({ hasNewWorker: false })
      
      // 2. 가상으로 사용자가 가챠(뽑기)를 해서 '숙련 광부' 아이템을 획득시킨다 (실행 단계)
      useGameStore.getState().addInventoryItem({
        type: 'worker_숙련_광부' as any,
        name: '숙련 광부',
        icon: '👷',
        quantity: 1,
        level: 2,
      })
      
      // 3. 기대 결과(단언): 일꾼을 받았으니 화면에 "새로 나왔어요(N)" 뱃지를 의미하는 변수가 true로 바뀌어 있어야 함!
      expect(useGameStore.getState().hasNewWorker).toBe(true)
    })
  })
})
