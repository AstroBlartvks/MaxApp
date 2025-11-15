-- Add share_token column to trades table for grouping multiple trades in one QR code
ALTER TABLE trades ADD COLUMN IF NOT EXISTS share_token VARCHAR(8);

-- Create index for faster lookups by share_token
CREATE INDEX IF NOT EXISTS idx_trades_share_token ON trades (share_token);

COMMENT ON COLUMN trades.share_token IS 'Short token for grouping multiple trades in a single QR code';
