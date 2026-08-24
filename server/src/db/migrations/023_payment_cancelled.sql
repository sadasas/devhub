-- 023_payment_cancelled: status 'cancelled' untuk pembayaran pending yang dibatalkan user.
-- Cancelled bersifat terminal: markPaymentCompleted hanya cocok status='pending',
-- jadi order yang dibatalkan tidak bisa diaktivasi walau link lama dibayar.

ALTER TABLE team_payments DROP CONSTRAINT IF EXISTS team_payments_status_check;
ALTER TABLE team_payments ADD CONSTRAINT team_payments_status_check
  CHECK (status IN ('pending', 'completed', 'cancelled'));
