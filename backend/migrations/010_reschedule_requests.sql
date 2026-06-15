CREATE TABLE reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id),
  teacher_id UUID NOT NULL REFERENCES users(id),
  proposed_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled_by_student')),
  decided_by UUID REFERENCES users(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reschedule_requests_session_id ON reschedule_requests(session_id);
CREATE INDEX idx_reschedule_requests_status ON reschedule_requests(status);
CREATE INDEX idx_reschedule_requests_teacher_status ON reschedule_requests(teacher_id, status);

-- Enforce at most one pending request per session
CREATE UNIQUE INDEX idx_reschedule_requests_one_pending_per_session
  ON reschedule_requests(session_id)
  WHERE status = 'pending';
