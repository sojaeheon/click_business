package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.service.WarehouseService;
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
    private final WarehouseService warehouseService;

    /**
     * 체결 결과를 수령합니다.
     * - 매수(BUY) 체결 → 창고(MATERIAL/PRODUCT)에 아이템 지급
     * - 매도(SELL) 체결 → 회사 잔고에 현금 입금
     */
    @Transactional
    public void collect(Long userId, Long tradeHistoryId) {
        TradeHistory tradeHistory = tradeHistoryRepository.findById(tradeHistoryId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 체결 내역입니다. id=" + tradeHistoryId));

        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 유저에게 소속된 회사가 없습니다."));

        MarketOrder order = tradeHistory.getMarketOrder();
        if (!order.getCompanyId().equals(company.getId())) {
            throw new IllegalStateException("본인 회사의 체결 내역만 수령할 수 있습니다.");
        }

        tradeHistory.collect();

        if (order.getOrderType() == OrderType.BUY) {
            warehouseService.addItem(
                    company.getId(),
                    order.getItemId().longValue(),
                    tradeHistory.getExecutionQuantity()
            );
        } else {
            long cashReceived = tradeHistory.getPrice() * tradeHistory.getExecutionQuantity();
            company.receiveCash(cashReceived);
        }
    }
}
