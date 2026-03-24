package com.ssafy.ecosim.domain.market.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.service.WarehouseService;
import com.ssafy.ecosim.domain.market.entity.MarketOrder;
import com.ssafy.ecosim.domain.market.entity.OrderType;
import com.ssafy.ecosim.domain.market.entity.TradeHistory;
import com.ssafy.ecosim.domain.market.repository.MarketOrderRepository;
import com.ssafy.ecosim.domain.market.repository.TradeHistoryRepository;
import com.ssafy.ecosim.global.kafka.publisher.CompanyCashEventPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class TradeCollectService {

    private final TradeHistoryRepository tradeHistoryRepository;
    private final MarketOrderRepository marketOrderRepository;
    private final CompanyRepository companyRepository;
    private final WarehouseService warehouseService;
    private final CompanyCashEventPublisher companyCashEventPublisher;

    /**
     * 체결 결과를 수령합니다.
     * - 매수(BUY) 체결 → 창고 여유 확인 후 아이템 지급 (WarehouseService 내부에서 Kafka 발행)
     * - 매도(SELL) 체결 → 회사 잔고에 현금 입금 + Kafka 발행
     */
    @Transactional
    public void collect(Long userId, Long tradeHistoryId) {
        TradeHistory tradeHistory = tradeHistoryRepository.findById(tradeHistoryId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 체결 내역입니다. id=" + tradeHistoryId));

        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 유저에게 소속된 회사가 없습니다."));

        MarketOrder order = marketOrderRepository.findById(tradeHistory.getMarketOrderId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "원 주문이 존재하지 않아 체결 수령을 진행할 수 없습니다. orderId=" + tradeHistory.getMarketOrderId()));
        if (!order.getCompanyId().equals(company.getId())) {
            throw new IllegalStateException("본인 회사의 체결 내역만 수령할 수 있습니다.");
        }

        tradeHistory.collect();

        if (order.getOrderType() == OrderType.BUY) {
            if (tradeHistory.getItemId() == null) {
                throw new IllegalStateException("체결 내역에 item_id가 없어 수령을 진행할 수 없습니다.");
            }

            long itemId = tradeHistory.getItemId().longValue();
            long qty = tradeHistory.getExecutionQuantity();

            // 창고 여유 공간 사전 확인
            long available = warehouseService.getAvailableCapacity(company.getId(), itemId, qty);
            if (available < qty) {
                throw new IllegalStateException(
                        String.format("창고 공간이 부족합니다. 필요: %d, 가용: %d. 슬롯을 확보 후 수령하세요.", qty, available));
            }

            // 가격 차액 환불 처리 (주문 가격 > 실제 체결 가격인 경우)
            long paidPrice = order.getPrice();           // 주문 시 지불한 가격
            long actualPrice = tradeHistory.getPrice();  // 실제 체결 가격
            long refund = (paidPrice - actualPrice) * qty;

            if (refund > 0) {
                company.receiveCash(refund);
                companyCashEventPublisher.publishCashChanged(
                    company.getId(), company.getCash(), refund,
                    "MARKET_BUY_PRICE_DIFF_REFUND", tradeHistoryId.toString(), Instant.now()
                );
            }

            // 아이템 지급 — WarehouseService 내부에서 warehouse.item.stored 이벤트 발행
            warehouseService.addItem(company.getId(), itemId, qty, "MARKET_BUY_COLLECT");

        } else {
            // SELL 체결 수령: 현금 입금
            long cashReceived = tradeHistory.getPrice() * tradeHistory.getExecutionQuantity();
            company.receiveCash(cashReceived);

            companyCashEventPublisher.publishCashChanged(
                    company.getId(), company.getCash(), cashReceived,
                    "MARKET_SELL_COLLECT", tradeHistoryId.toString(), Instant.now()
            );
        }
    }
}
