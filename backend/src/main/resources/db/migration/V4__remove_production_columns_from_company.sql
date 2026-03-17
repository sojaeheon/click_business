-- production_requirement, production_yield 컬럼을 company 테이블에서 제거
-- 생산 비율은 IndustryType enum(백엔드 코드)에서 관리
ALTER TABLE company
    DROP COLUMN IF EXISTS production_requirement,
    DROP COLUMN IF EXISTS production_yield;
