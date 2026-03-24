-- 기업 테이블에 미니게임 지불 여부 컬럼 추가
ALTER TABLE company ADD COLUMN IF NOT EXISTS minigame_paid BOOLEAN NOT NULL DEFAULT FALSE;
