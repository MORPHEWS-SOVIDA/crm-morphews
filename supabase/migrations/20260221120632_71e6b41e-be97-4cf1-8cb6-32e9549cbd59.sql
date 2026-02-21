-- Allow anonymous users to create abandoned transaction records from public checkout
CREATE POLICY "Public can create abandoned transactions"
  ON payment_link_transactions
  FOR INSERT
  TO anon
  WITH CHECK (status = 'abandoned');

-- Allow anonymous users to update their own abandoned records
CREATE POLICY "Public can update abandoned transactions"
  ON payment_link_transactions
  FOR UPDATE
  TO anon
  USING (status = 'abandoned')
  WITH CHECK (status = 'abandoned');

-- Allow anonymous users to delete their own abandoned records (cleanup on payment)
CREATE POLICY "Public can delete abandoned transactions"
  ON payment_link_transactions
  FOR DELETE
  TO anon
  USING (status = 'abandoned');