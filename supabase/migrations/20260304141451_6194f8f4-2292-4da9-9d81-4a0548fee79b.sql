-- Delete the accidental closing #80 (90 sales, created 2026-03-04 14:06)
-- This closing was created accidentally and has status 'pending' (no confirmation)
DELETE FROM pickup_closing_sales WHERE closing_id = 'a9b5d409-eafc-41e4-b174-616c644e2464';
DELETE FROM pickup_closings WHERE id = 'a9b5d409-eafc-41e4-b174-616c644e2464';