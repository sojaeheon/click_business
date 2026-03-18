package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.service.InventoryService;
import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import com.ssafy.ecosim.domain.market.entity.TradeHistory;
import com.ssafy.ecosim.domain.market.repository.TradeHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TradeCollectService {

    private final TradeHistoryRepository tradeHistoryRepository;
    private final CompanyRepository companyRepository;
    private final InventoryService inventoryService;

    /**
     * 체결 결과를 수령합니다.
     * - 매수(BUY) 체결 → 인벤토리에 아이템 지급
     * - 매도(SELL) 체결 → 회사 잔고에 현금 입금
     */
    @Transactional
    public void collect(Long userId, Long tradeHistoryId) {
        TradeHistory tradeHistory = tradeHistoryRepository.findById(tradeHistoryId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 체결 내역입니다. id=" + tradeHistoryId));

        // 권한 확인: 이 체결이 현재 유저 회사의 주문인지 검증
        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 유저에게 소속된 회사가 없습니다."));

        MarketOrder order = tradeHistory.getMarketOrder();
        if (!order.getCompanyId().equals(company.getId())) {
            throw new IllegalStateException("본인 회사의 체결 내역만 수령할 수 있습니다.");
        }

        // 중복 수령 방지 (TradeHistory.collect() 내부에서도 검증)
        tradeHistory.collect();

        if (order.getOrderType() == OrderType.BUY) {
            // 매수 체결 수령: 구매한 아이템을 인벤토리에 적재
            inventoryService.addItem(
                    company.getId(),
                    order.getItemId().longValue(),
                    tradeHistory.getExecutionQuantity()
            );
        } else {
            // 매도 체결 수령: 판매 대금을 회사 잔고에 입금
            long cashReceived = tradeHistory.getPrice() * tradeHistory.getExecutionQuantity();
            company.receiveCash(cashReceived);
        }
    }
}
