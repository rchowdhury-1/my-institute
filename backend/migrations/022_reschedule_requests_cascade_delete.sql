-- Allow permanently deleting a student/teacher account even when they have
-- reschedule request history. Their reschedule requests are cascade-deleted
-- along with everything else (sessions, packages, homework) rather than
-- blocking the delete.
ALTER TABLE reschedule_requests DROP CONSTRAINT IF EXISTS reschedule_requests_student_id_fkey;
ALTER TABLE reschedule_requests ADD CONSTRAINT reschedule_requests_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE reschedule_requests DROP CONSTRAINT IF EXISTS reschedule_requests_teacher_id_fkey;
ALTER TABLE reschedule_requests ADD CONSTRAINT reschedule_requests_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;
