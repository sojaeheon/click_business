package com.ssafy.ecosim.domain.company.service;

import com.ssafy.ecosim.domain.company.dto.response.CompanyProfileResponse;
import com.ssafy.ecosim.domain.company.entity.Company;
import com.ssafy.ecosim.domain.company.entity.IndustryType;
import com.ssafy.ecosim.domain.company.repository.CompanyRepository;
import com.ssafy.ecosim.domain.inventory.entity.Inventory;
import com.ssafy.ecosim.domain.inventory.entity.Warehouse;
import com.ssafy.ecosim.domain.inventory.repository.InventoryRepository;
import com.ssafy.ecosim.domain.inventory.repository.WarehouseRepository;
import com.ssafy.ecosim.domain.inventory.service.InventoryService;
import com.ssafy.ecosim.domain.inventory.service.WarehouseService;
import com.ssafy.ecosim.domain.item.repository.ItemRepository;
import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final WarehouseService warehouseService;
    private final InventoryService inventoryService;
    private final ItemRepository itemRepository;
    private final WarehouseRepository warehouseRepository;
    private final InventoryRepository inventoryRepository;

    @Transactional
    public Company createCompanyForUser(Long userId, String companyName, IndustryType industryType) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

        companyRepository.findByUser_Id(userId).ifPresent(c -> {
            throw new IllegalArgumentException("이 유저는 이미 기업을 보유하고 있습니다.");
        });

        if (companyRepository.existsByName(companyName)) {
            throw new IllegalArgumentException("이미 사용 중인 기업명입니다.");
        }

        Company company = new Company(user, companyName, industryType);
        Company saved = companyRepository.save(company);

        warehouseService.createDefaultWarehouse(saved);
        inventoryService.createDefaultInventory(saved);

        return saved;
    }

    public Company getCompanyByUserId(Long userId) {
        return companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("이 유저는 아직 기업을 소유하고 있지 않습니다."));
    }

    public Company getCompanyById(Long companyId) {
        return companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 기업입니다."));
    }

    public CompanyProfileResponse getCompanyProfile(Long userId) {
        Company company = companyRepository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalArgumentException("이 유저는 아직 기업을 소유하고 있지 않습니다."));

        Warehouse warehouse = warehouseRepository.findByCompanyId(company.getId())
                .orElseThrow(() -> new IllegalStateException("창고 정보를 찾을 수 없습니다."));

        Inventory inventory = inventoryRepository.findByCompanyId(company.getId())
                .orElseThrow(() -> new IllegalStateException("인벤토리 정보를 찾을 수 없습니다."));

        return new CompanyProfileResponse(company, warehouse, inventory);
    }
}
