CREATE TABLE IF NOT EXISTS stream_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES live_streams(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  votes jsonb NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stream_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read polls" ON stream_polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stream host can insert polls" ON stream_polls FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM live_streams WHERE id = stream_id AND user_id = auth.uid())
);
CREATE POLICY "Stream host can update polls" ON stream_polls FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM live_streams WHERE id = stream_id AND user_id = auth.uid())
);