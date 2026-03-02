-- ============================================================
-- 011_marketplace_character_type.sql
-- student_items 테이블에 'character' 아이템 유형 추가
-- ============================================================

-- 기존 CHECK 제약조건 삭제 후 character 포함하여 재생성
ALTER TABLE student_items DROP CONSTRAINT IF EXISTS student_items_item_type_check;
ALTER TABLE student_items ADD CONSTRAINT student_items_item_type_check
  CHECK (item_type IN ('hat','pet','character','effect','title','skin'));
