package com.ssafy.ecosim.domain.feedback.repository;

import com.ssafy.ecosim.domain.feedback.entity.Feedback;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeedbackRepository extends JpaRepository<Feedback, Long> {
}
