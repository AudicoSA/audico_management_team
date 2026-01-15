-- Allow ALL operations for ANON users on price_list_uploads
CREATE POLICY "Allow all for anon users" ON price_list_uploads
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Allow uploads to 'invoices' bucket for ANON
CREATE POLICY "Allow uploads to invoices bucket anon" ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'invoices');

-- Allow reading from 'invoices' bucket for ANON
CREATE POLICY "Allow reading from invoices bucket anon" ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'invoices');
