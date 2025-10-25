export interface User {
  id: string
  email: string
  created_at?: string
}

export interface ShortVideo {
  id: string
  user_id: string
  imagem_url: string
  video_url?: string
  status: 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at?: string
}

export interface GerarShortsOptions {
  estilo?: string
  duracao?: number
  qualidade?: 'low' | 'medium' | 'high'
  audio?: boolean
  [key: string]: any
}
