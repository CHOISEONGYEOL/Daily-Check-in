-- ============================================================
-- 021_item_drafts.sql
-- 작품 임시저장 (드래프트) 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS item_drafts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'hat' CHECK (item_type IN ('hat','pet','character','effect','title','skin')),
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  proposed_price INTEGER NOT NULL DEFAULT 50,
  pixel_data JSONB,
  icon TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drafts_user ON item_drafts(user_id);

-- RLS
ALTER TABLE item_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own drafts"
  ON item_drafts FOR SELECT
  USING (true);

CREATE POLICY "Users can insert drafts"
  ON item_drafts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own drafts"
  ON item_drafts FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete own drafts"
  ON item_drafts FOR DELETE
  USING (true);
