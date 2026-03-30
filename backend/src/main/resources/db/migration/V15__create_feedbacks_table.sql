-- V13: feedbacks 테이블 생성 (버그 제보 / 개선 사항 / 문의 등)

CREATE TABLE IF NOT EXISTS feedbacks (
    feedback_id  BIGSERIAL     PRIMARY KEY,
    user_id      BIGINT,
    category     VARCHAR(50)   NOT NULL,
    content      VARCHAR(1000) NOT NULL,
    created_at   TIMESTAMP,
    updated_at   TIMESTAMP,

    CONSTRAINT fk_feedbacks_user
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id  ON feedbacks (user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_category ON feedbacks (category);
