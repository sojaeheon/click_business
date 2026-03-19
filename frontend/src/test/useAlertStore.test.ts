import { describe, it, expect, beforeEach } from 'vitest'
import { useAlertStore } from '../store/useAlertStore'

// ─────────────────────────────────────────────────────────────
// useAlertStore 단위 테스트
// 글로벌 알림 다이얼로그의 열기/닫기 동작 검증
// ─────────────────────────────────────────────────────────────

describe('useAlertStore', () => {

  beforeEach(() => {
    useAlertStore.setState({ isOpen: false, message: '', title: '알림', onConfirm: undefined })
  })

  it('알림을 열면 isOpen이 true가 된다', () => {
    useAlertStore.getState().openAlert('테스트 메시지', '테스트 제목')
    const state = useAlertStore.getState()
    expect(state.isOpen).toBe(true)
    expect(state.message).toBe('테스트 메시지')
    expect(state.title).toBe('테스트 제목')
  })

  it('제목을 생략하면 기본값 "알림"이 사용된다', () => {
    useAlertStore.getState().openAlert('메시지만')
    expect(useAlertStore.getState().title).toBe('알림')
  })

  it('알림을 닫으면 isOpen이 false가 된다', () => {
    useAlertStore.getState().openAlert('열기')
    useAlertStore.getState().closeAlert()
    expect(useAlertStore.getState().isOpen).toBe(false)
  })

  it('onConfirm 콜백을 전달할 수 있다', () => {
    const mockFn = () => {}
    useAlertStore.getState().openAlert('확인', '제목', mockFn)
    expect(useAlertStore.getState().onConfirm).toBe(mockFn)
  })

  it('닫으면 onConfirm이 undefined로 초기화된다', () => {
    useAlertStore.getState().openAlert('확인', '제목', () => {})
    useAlertStore.getState().closeAlert()
    expect(useAlertStore.getState().onConfirm).toBeUndefined()
  })
})
