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
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final InventoryService inventoryService;

    public CompanyService(CompanyRepository companyRepository,
            UserRepository userRepository,
            InventoryService inventoryService) {
        this.companyRepository = companyRepository;
        this.userRepository = userRepository;
        this.inventoryService = inventoryService;
    }

    /**
     * 회원 가입 및 튜토리얼 이후에 유저의 1:1 기업을 지급하고 초기 창고를 생성합니다.
     */
    @Transactional
    public Company createCompanyForUser(Long userId, String companyName) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

        if (companyRepository.findByUserId(userId).isPresent()) {
            throw new IllegalArgumentException("이 유저는 이미 기업을 보유하고 있습니다.");
        }

        Company company = new Company(user, companyName);
        Company savedCompany = companyRepository.save(company);

        // 창고 자동 지급 연동
        inventoryService.createDefaultInventory(savedCompany);

        return savedCompany;
    }
}
