-- Make proposals and decks publicly readable (no login required)
-- Clients receiving proposal/deck links should be able to view without auth
-- Authenticated users retain full CRUD access

-- PROPOSALS: Add public read policy
CREATE POLICY "public_read_proposals"
  ON proposals
  FOR SELECT
  TO anon
  USING (true);

-- DECKS: Add public read policy
CREATE POLICY "public_read_decks"
  ON decks
  FOR SELECT
  TO anon
  USING (true);
