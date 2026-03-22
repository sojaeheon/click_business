package com.ssafy.ecosim.domain.news.repository;

import com.ssafy.ecosim.domain.news.entity.ExternalNews;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ExternalNewsRepository extends JpaRepository<ExternalNews, Long> {
    List<ExternalNews> findAllByPublishedAtBeforeOrderByPublishedAtDesc(LocalDateTime dateTime);
}
