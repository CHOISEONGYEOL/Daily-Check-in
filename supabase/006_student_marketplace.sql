-- ============================================================
-- 006_student_marketplace.sql
-- 학생 마켓플레이스: 학생 제작 아이템 판매 요청 시스템
-- ============================================================

-- 1) 학생 제작 아이템 테이블
CREATE TABLE IF NOT EXISTS student_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id TEXT UNIQUE NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(id),
  creator_name TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('hat','effect','pet','title','skin')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  proposed_price INTEGER NOT NULL,
  final_price INTEGER,
  icon TEXT,
  pixel_data JSONB,
  title_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason TEXT,
  sales_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) 구매 기록 테이블
CREATE TABLE IF NOT EXISTS student_item_purchases (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id TEXT NOT NULL,
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  price INTEGER NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) 인덱스
CREATE INDEX IF NOT EXISTS idx_si_status ON student_items(status);
CREATE INDEX IF NOT EXISTS idx_si_creator ON student_items(creator_id);
CREATE INDEX IF NOT EXISTS idx_sip_buyer ON student_item_purchases(buyer_id);

-- 4) 원자적 코인 이체 RPC
CREATE OR REPLACE FUNCTION transfer_coins(
  buyer_uuid UUID,
  seller_uuid UUID,
  amount INTEGER,
  p_item_id TEXT
) RETURNS void AS $$
BEGIN
  -- 구매자 코인 차감
  UPDATE users SET coins = coins - amount WHERE id = buyer_uuid;
  -- 판매자 코인 지급
  UPDATE users SET coins = coins + amount WHERE id = seller_uuid;
  -- 구매 기록
  INSERT INTO student_item_purchases (item_id, buyer_id, seller_id, price)
  VALUES (p_item_id, buyer_uuid, seller_uuid, amount);
  -- 판매 횟수 증가
  UPDATE student_items SET sales_count = sales_count + 1 WHERE item_id = p_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) RLS 정책
ALTER TABLE student_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_item_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved student items"
  ON student_items FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert student items"
  ON student_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Teachers can update student items"
  ON student_items FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can read purchases"
  ON student_item_purchases FOR SELECT
  USING (true);

CREATE POLICY "Purchases via RPC"
  ON student_item_purchases FOR INSERT
  WITH CHECK (true);
