package com.ssafy.ecosim.domain.production.repository;

import com.ssafy.ecosim.domain.production.entity.Workstation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkstationRepository extends JpaRepository<Workstation, Long> {
    Optional<Workstation> findByCompanyIdAndId(Long companyId, Long workstationId);

    boolean existsByCompanyIdAndId(Long companyId, Long workstationId);

    List<Workstation> findAllByCompanyId(Long companyId);

    boolean existsByCompanyId(Long companyId);
}
