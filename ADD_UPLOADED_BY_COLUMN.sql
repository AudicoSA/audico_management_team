-- Add uploaded_by column if it doesn't exist
ALTER TABLE price_list_uploads ADD COLUMN IF NOT EXISTS uploaded_by text;

-- Grant permissions just in case
GRANT ALL ON TABLE price_list_uploads TO anon;
GRANT ALL ON TABLE price_list_uploads TO authenticated;
