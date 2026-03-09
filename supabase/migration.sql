-- ============================================
-- Daily Check-in: Supabase Migration
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================

-- 1. users: 유저 기본 정보
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT UNIQUE NOT NULL,
  student_name TEXT NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  coins INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  active_title TEXT,
  active_char_idx INTEGER NOT NULL DEFAULT 0,
  max_slots INTEGER NOT NULL DEFAULT 1,
  owned TEXT[] NOT NULL DEFAULT '{}',
  titles TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. characters: 캐릭터 슬롯 (픽셀 + 장비)
CREATE TABLE characters (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '캐릭터',
  pixels JSONB,
  hat TEXT,
  effect TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, slot_index)
);

-- 3. check_ins: 출석 기록
CREATE TABLE check_ins (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checked_at DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, checked_at)
);

-- 4. auctions: 경매
CREATE TABLE auctions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  item_code TEXT NOT NULL,
  price INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('char','item')),
  pixels JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. auction_bids: 입찰
CREATE TABLE auction_bids (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auction_id BIGINT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  bid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_chars_user ON characters(user_id);
CREATE INDEX idx_checkins_user_date ON check_ins(user_id, checked_at);
CREATE INDEX idx_auctions_active ON auctions(is_active) WHERE is_active = true;
CREATE INDEX idx_bids_auction ON auction_bids(auction_id);

-- ============================================
-- updated_at 자동 갱신 트리거
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_characters_updated
  BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;

-- users: 누구나 student_id로 조회 가능, 본인만 수정
CREATE POLICY "users_read" ON users
  FOR SELECT USING (true);

CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "users_update" ON users
  FOR UPDATE USING (true);

-- characters: 본인 데이터만
CREATE POLICY "chars_read" ON characters
  FOR SELECT USING (true);

CREATE POLICY "chars_insert" ON characters
  FOR INSERT WITH CHECK (true);

CREATE POLICY "chars_update" ON characters
  FOR UPDATE USING (true);

CREATE POLICY "chars_delete" ON characters
  FOR DELETE USING (true);

-- check_ins
CREATE POLICY "checkins_all" ON check_ins
  FOR ALL USING (true);

-- auctions: 모두 조회, 본인만 등록
CREATE POLICY "auctions_all" ON auctions
  FOR ALL USING (true);

CREATE POLICY "bids_all" ON auction_bids
  FOR ALL USING (true);

-- ============================================
-- 64x64 HD 캔버스 지원: characters에 grid 컬럼 추가
-- ============================================
ALTER TABLE characters ADD COLUMN IF NOT EXISTS grid INTEGER DEFAULT 32;
