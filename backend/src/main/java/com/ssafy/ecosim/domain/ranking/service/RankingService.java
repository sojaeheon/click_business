package com.ssafy.ecosim.domain.ranking.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.ranking.dto.RankingPreviewResponse;
import com.ssafy.ecosim.domain.ranking.entity.RankingCurrent;
import com.ssafy.ecosim.domain.ranking.repository.RankingCurrentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RankingService {
    private static final int MAX_PREVIEW_LIMIT = 100;
    private static final int MIN_PREVIEW_LIMIT = 1;

    private final RankingCurrentRepository rankingCurrentRepository;
    private final CompanyRepository companyRepository;

    @Transactional(readOnly = true)
    public List<RankingPreviewResponse> getPreview(int limit) {
        int safeLimit = Math.min(Math.max(limit, MIN_PREVIEW_LIMIT), MAX_PREVIEW_LIMIT);

        List<RankingCurrent> rows = rankingCurrentRepository.findAllByOrderByValuationDescCompanyIdAsc(
                PageRequest.of(0, safeLimit)
        );
        if (rows.isEmpty()) {
            return List.of();
        }

        List<Long> companyIds = rows.stream().map(RankingCurrent::getCompanyId).toList();
        Map<Long, String> companyNameMap = companyRepository.findAllById(companyIds).stream()
                .collect(Collectors.toMap(Company::getId, Company::getName));

        List<RankingPreviewResponse> out = new ArrayList<>();
        int rank = 1;
        for (RankingCurrent row : rows) {
            out.add(RankingPreviewResponse.builder()
                    .rank(rank++)
                    .companyId(row.getCompanyId())
                    .companyName(companyNameMap.getOrDefault(row.getCompanyId(), "UNKNOWN"))
                    .tier("GENERAL")
                    .score(row.getValuation())
                    .build());
        }
        return out;
    }
}
