package com.ssafy.ecosim.domain.company.service;

import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.service.InventoryService;
import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@lombok.RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final InventoryService inventoryService;

    /**
     * 회원 가입 및 튜토리얼 이후에 유저의 1:1 기업을 지급하고 초기 창고를 생성합니다.
     *
     * @param userId      유저 ID
     * @param companyName 생성할 기업 이름
     * @return 생성된 기업 엔티티
     */
    @Transactional
    public Company createCompanyForUser(Long userId, String companyName) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

        // 유저당 하나의 기업만 가질 수 있도록 체크
        companyRepository.findByUserId(userId).ifPresent(c -> {
            throw new IllegalArgumentException("이 유저는 이미 기업을 보유하고 있습니다.");
        });

        // 임시로 1L, 2L 할당 (추후 기획에 맞게 수정)
        Company company = new Company(user, companyName, 1L, 2L);
        Company savedCompany = companyRepository.save(company);

        // 기업 생성 시 기본 창고(인벤토리) 자동 지급
        inventoryService.createDefaultInventory(savedCompany);

        return savedCompany;
    }

    /**
     * 유저 ID를 기반으로 해당 유저의 기업 엔티티를 조회합니다.
     *
     * @param userId 유저 ID
     * @return 기업 엔티티
     */
    public Company getCompanyByUserId(Long userId) {
        return companyRepository.findByUserId(userId)
                .orElseThrow(() -> new IllegalArgumentException("이 유저는 아직 기업을 소유하고 있지 않습니다."));
    }

    /**
     * 기업 ID를 기반으로 기업 엔티티를 조회합니다.
     *
     * @param companyId 기업 ID
     * @return 기업 엔티티
     */
    public Company getCompanyById(Long companyId) {
        return companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 기업입니다."));
    }
}
