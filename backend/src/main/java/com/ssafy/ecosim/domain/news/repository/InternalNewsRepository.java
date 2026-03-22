package com.ssafy.ecosim.domain.news.repository;

import com.ssafy.ecosim.domain.news.entity.InternalNews;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface InternalNewsRepository extends JpaRepository<InternalNews, Long> {
    List<InternalNews> findAllByPublishedAtBeforeOrderByPublishedAtDesc(LocalDateTime dateTime);
}
