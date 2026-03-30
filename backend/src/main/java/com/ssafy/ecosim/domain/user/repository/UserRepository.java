package com.ssafy.ecosim.domain.user.repository;

import com.ssafy.ecosim.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
}
