-- Migration: Enable Realtime for shorts_generation table
-- Created: 2025-01-26
-- Execute this in Supabase SQL Editor

-- Habilitar Realtime para a tabela shorts_generation
ALTER PUBLICATION supabase_realtime ADD TABLE shorts_generation;
