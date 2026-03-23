package com.ssafy.ecosim.domain.feedback.service;

import com.ssafy.ecosim.domain.feedback.entity.Feedback;
import com.ssafy.ecosim.domain.feedback.entity.FeedbackCategory;
import com.ssafy.ecosim.domain.feedback.repository.FeedbackRepository;
import com.ssafy.ecosim.domain.user.entity.User;
import com.ssafy.ecosim.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FeedbackService {

    private final FeedbackRepository feedbackRepository;
    private final UserRepository userRepository;

    @Transactional
    public void submitFeedback(Long userId, FeedbackCategory category, String content) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 유저입니다."));

        feedbackRepository.save(new Feedback(user, category, content));
    }
}
