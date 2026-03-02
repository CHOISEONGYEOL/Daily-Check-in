-- 교사 출결 체크 기록 (결석/조퇴/지각/출석)
CREATE TABLE teacher_attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  attend_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('present','late','early','absent')),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, attend_date)
);

CREATE INDEX idx_teacher_attendance_date ON teacher_attendance(attend_date);
CREATE INDEX idx_teacher_attendance_class ON teacher_attendance(class_name, attend_date);

ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher_attendance_all" ON teacher_attendance FOR ALL USING (true);
