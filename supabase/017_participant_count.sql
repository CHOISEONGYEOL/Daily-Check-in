-- Participant count for accurate NPC/game scaling
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS participant_count INTEGER DEFAULT 0;
