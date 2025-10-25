-- ========================================
-- SUPABASE SETUP - Shorts Viral
-- ========================================
-- Execute este SQL no Supabase SQL Editor
-- Dashboard > SQL Editor > New Query

-- 1. CRIAR BUCKET DE STORAGE
-- ========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('shorts-images', 'shorts-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. POLÍTICAS DE ACESSO (RLS)
-- ========================================

-- 2.1 Permitir upload de imagens (apenas usuários autenticados)
CREATE POLICY "Usuarios podem fazer upload de imagens"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shorts-images');

-- 2.2 Permitir leitura pública de imagens
CREATE POLICY "Imagens sao publicamente acessiveis"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'shorts-images');

-- 3. CRIAR TABELA DE VÍDEOS (OPCIONAL)
-- ========================================
-- Apenas se quiser guardar histórico de shorts gerados

CREATE TABLE IF NOT EXISTS public.shorts_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  imagem_url TEXT NOT NULL,
  video_url TEXT,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  opcoes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS na tabela
ALTER TABLE public.shorts_videos ENABLE ROW LEVEL SECURITY;

-- Política: usuários veem apenas seus próprios vídeos
CREATE POLICY "Usuarios veem apenas seus videos"
ON public.shorts_videos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Política: usuários criam apenas para si mesmos
CREATE POLICY "Usuarios criam apenas para si"
ON public.shorts_videos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. CRIAR USUÁRIO DE TESTE (OPCIONAL)
-- ========================================
-- Vá em Authentication > Users > Add User
-- Ou crie manualmente via interface

-- ========================================
-- FIM DO SETUP
-- ========================================
-- Verifique em:
-- - Storage > Buckets > shorts-images deve existir
-- - SQL Editor > Run query acima
-- - Authentication > Users > Criar usuário teste
