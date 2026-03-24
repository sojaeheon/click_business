package com.ssafy.ecosim.domain.company.repository;

import com.ssafy.ecosim.domain.company.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CompanyRepository extends JpaRepository<Company, Long> {
    Optional<Company> findByUser_Id(Long userId);
    boolean existsByName(String name);
}
