-- Migration: Create shorts_generation table for video polling
-- Created: 2025-01-26

-- Create table for tracking video generation
CREATE TABLE IF NOT EXISTS shorts_generation (
  id UUID PRIMARY KEY,
  video_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'error')),
  image_url TEXT,
  video_description TEXT,
  user_id TEXT,
  error_message TEXT,
  cost NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE shorts_generation ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Anyone can view video generations" ON shorts_generation;
DROP POLICY IF EXISTS "Service role can insert/update" ON shorts_generation;

-- Policy to allow anyone to view video generations
CREATE POLICY "Anyone can view video generations"
  ON shorts_generation FOR SELECT
  USING (true);

-- Policy for service role to insert/update (n8n will use service_role key)
CREATE POLICY "Service role can insert/update"
  ON shorts_generation FOR ALL
  USING (true);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_shorts_generation_user_id ON shorts_generation(user_id);
CREATE INDEX IF NOT EXISTS idx_shorts_generation_status ON shorts_generation(status);
CREATE INDEX IF NOT EXISTS idx_shorts_generation_created_at ON shorts_generation(created_at DESC);
