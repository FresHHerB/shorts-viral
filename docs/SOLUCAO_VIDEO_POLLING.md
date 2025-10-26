# Solução de Polling para Exibição de Vídeo Gerado

## Problema

O Runware Video Inference é **assíncrono**: você faz um POST e ele retorna imediatamente, mas o vídeo só fica pronto minutos depois. Como exibir o vídeo na página quando ele estiver pronto?

**Limitação:** Frontend não pode receber webhooks HTTP (roda no navegador, não é um servidor).

---

## Solução: n8n como Ponte + Polling Inteligente

### Fluxo Completo

```
┌─────────────┐
│  Frontend   │ 1. Gera UUID único
│             │ 2. Envia para n8n
└──────┬──────┘
       │ POST /webhook/gerarShorts
       │ {
       │   generation_type: "video",
       │   task_uuid: "abc-123",
       │   video_description: "...",
       │   image_url: "..."
       │ }
       ↓
┌─────────────┐
│     n8n     │ 3. Recebe e envia para Runware
│             │    {
│             │      taskUUID: "abc-123",
│             │      callbackURL: "https://n8n.automear.com/webhook/runware-callback"
│             │    }
└─────────────┘
       │
       ↓ (assíncrono - pode demorar 2-5 minutos)

┌─────────────┐
│   Runware   │ 4. Processa vídeo...
│             │ 5. Chama callback quando pronto
└──────┬──────┘
       │ POST /webhook/runware-callback
       │ {
       │   "data": [{
       │     "taskUUID": "abc-123",
       │     "videoURL": "https://vs.runware.ai/video/..."
       │   }]
       │ }
       ↓
┌─────────────┐
│  n8n (novo  │ 6. Recebe callback
│   webhook)  │ 7. Salva no Supabase
│             │    INSERT INTO video_generations
│             │    (id, video_url, status)
│             │    VALUES ('abc-123', 'https://...', 'completed')
└─────────────┘
       │
       ↓ (Frontend estava fazendo polling)

┌─────────────┐
│  Frontend   │ 8. Polling detecta vídeo pronto
│             │ 9. Exibe videoURL na tela!
└─────────────┘
```

---

## Implementação

### 1. Estrutura da Tabela Supabase

```sql
CREATE TABLE video_generations (
  id UUID PRIMARY KEY,
  video_url TEXT,
  status TEXT NOT NULL, -- 'processing', 'completed', 'error'
  image_url TEXT,
  video_description TEXT,
  user_id TEXT,
  error_message TEXT,
  cost NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE video_generations ENABLE ROW LEVEL SECURITY;

-- Policy para permitir leitura
CREATE POLICY "Anyone can view video generations"
  ON video_generations FOR SELECT
  USING (true);

-- Policy para n8n inserir/atualizar (usar service_role key)
CREATE POLICY "Service role can insert/update"
  ON video_generations FOR ALL
  USING (true);
```

---

### 2. Configuração no n8n

#### Webhook 1: `/webhook/gerarShorts` (já existe)

**Adicionar lógica para video:**

```javascript
// Nó: Switch - Verificar tipo de geração
{{ $json.generation_type }}

// Se generation_type === 'video':

// Nó: Supabase - Insert (criar registro inicial)
{
  "id": "{{ $json.task_uuid }}",
  "user_id": "{{ $json.user_id }}",
  "status": "processing",
  "image_url": "{{ $json.image_url }}",
  "video_description": "{{ $json.video_description }}",
  "created_at": "{{ $now.toISO() }}"
}

// Nó: HTTP Request - POST para Runware
URL: https://api.runware.ai/v1
Method: POST
Headers:
  Authorization: Bearer YOUR_API_KEY
  Content-Type: application/json

Body:
{
  "taskType": "videoInference",
  "taskUUID": "{{ $json.task_uuid }}",
  "positivePrompt": "{{ $json.video_description }}",
  "model": "kling/v1/standard/image-to-video",
  "inputImage": "{{ $json.image_url }}",
  "duration": 5,
  "aspectRatio": "9:16",
  "callbackURL": "https://n8n.automear.com/webhook/runware-callback"
}
```

#### Webhook 2: `/webhook/runware-callback` (NOVO)

**Trigger:** Webhook

**Nó: Supabase - Update**
```javascript
// Filtro
{
  "id": "{{ $json.data[0].taskUUID }}"
}

// Update
{
  "status": "completed",
  "video_url": "{{ $json.data[0].videoURL }}",
  "cost": "{{ $json.data[0].cost }}"
}
```

---

### 3. Frontend - Modificações

#### Instalar dependência:

```bash
npm install uuid
```

#### Atualizar `GerarShortsPage.tsx`:

```typescript
import { useState, useRef, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { supabase } from '@shared/lib/supabase'

// Adicionar ao estado
const [videoUrl, setVideoUrl] = useState<string | null>(null)
const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

// Modificar handleGenerateVideo
const handleGenerateVideo = async () => {
  if (!generatedResult) return

  const userId = user?.id || 'test-user'
  const taskUuid = uuidv4() // Gerar UUID único

  try {
    setIsGeneratingVideo(true)
    setStatus('processing')
    setErrorMessage('')
    setSuccessMessage('')
    setVideoUrl(null)

    const payload = {
      generation_type: 'video',
      task_uuid: taskUuid, // ⭐ Enviar UUID
      video_description: generatedResult.video_description,
      image_url: generatedResult.image_url,
      user_id: userId,
      opcoes: {
        estilo: 'viral',
        duracao: 30,
      }
    }

    await apiService.gerarShorts(payload)

    setSuccessMessage('Vídeo enviado para geração! Aguardando processamento...')

    // ⭐ Iniciar polling
    startVideoPolling(taskUuid)

  } catch (error: any) {
    console.error('Erro ao processar:', error)
    setStatus('error')
    setIsGeneratingVideo(false)
    setErrorMessage(error.message || 'Erro ao gerar vídeo. Tente novamente.')
  }
}

// Função de polling
const startVideoPolling = (taskUuid: string) => {
  let attempts = 0
  const maxAttempts = 60 // 10 minutos (10s * 60)

  pollingIntervalRef.current = setInterval(async () => {
    attempts++

    try {
      const { data, error } = await supabase
        .from('video_generations')
        .select('status, video_url, error_message')
        .eq('id', taskUuid)
        .single()

      if (error) {
        console.log('Aguardando vídeo...', attempts)
        return
      }

      if (data?.status === 'completed' && data.video_url) {
        // ✅ Vídeo pronto!
        setVideoUrl(data.video_url)
        setStatus('success')
        setIsGeneratingVideo(false)
        setSuccessMessage('Vídeo gerado com sucesso!')
        stopPolling()
      } else if (data?.status === 'error') {
        setStatus('error')
        setIsGeneratingVideo(false)
        setErrorMessage(data.error_message || 'Erro ao gerar vídeo')
        stopPolling()
      } else if (attempts >= maxAttempts) {
        // Timeout
        setStatus('error')
        setIsGeneratingVideo(false)
        setErrorMessage('Tempo esgotado. O vídeo pode ainda estar sendo processado.')
        stopPolling()
      }
    } catch (err) {
      console.error('Erro no polling:', err)
    }
  }, 10000) // Verificar a cada 10 segundos
}

const stopPolling = () => {
  if (pollingIntervalRef.current) {
    clearInterval(pollingIntervalRef.current)
    pollingIntervalRef.current = null
  }
}

// Limpar polling ao desmontar componente
useEffect(() => {
  return () => stopPolling()
}, [])
```

#### Adicionar seção de vídeo na UI:

```tsx
{/* Seção: Vídeo Gerado */}
{videoUrl && (
  <div className="mb-6 bg-gray-900 border border-gray-700 rounded-xl p-6">
    <h3 className="text-xl font-semibold text-white mb-4">Vídeo Gerado</h3>

    <video
      src={videoUrl}
      controls
      className="w-full rounded-lg"
    />

    <div className="mt-4 flex gap-4">
      <a
        href={videoUrl}
        download
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
      >
        Download
      </a>
      <button
        onClick={() => navigator.clipboard.writeText(videoUrl)}
        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
      >
        Copiar URL
      </button>
    </div>
  </div>
)}

{/* Indicador de processamento */}
{isGeneratingVideo && !videoUrl && (
  <div className="mb-6 bg-blue-500/10 border border-blue-500 rounded-lg p-4 flex items-center gap-3">
    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
    <p className="text-blue-500 text-sm">
      Gerando vídeo... Isso pode levar alguns minutos. Aguarde na página.
    </p>
  </div>
)}
```

---

### 4. Atualizar tipos no `api.ts`

```typescript
export interface GerarShortsPayload {
  generation_type: 'imagem' | 'video'
  task_uuid?: string // ⭐ Adicionar para vídeo
  imagem_base64?: string
  imagem_nome?: string
  video_description?: string
  image_url?: string
  user_id: string
  opcoes?: {
    estilo?: string
    duracao?: number
  }
}
```

---

## Vantagens desta Solução

✅ **Simples:** Apenas 1 tabela no Supabase e 2 webhooks no n8n
✅ **Sem dependências complexas:** Não precisa de WebSockets ou Realtime
✅ **Funciona na mesma página:** Usuário vê o vídeo aparecer automaticamente
✅ **Timeout inteligente:** Para de tentar após 10 minutos
✅ **Leve:** Polling a cada 10s (muito leve para o Supabase)
✅ **Resiliente:** Se der erro, mostra mensagem clara

---

## Limitações

⚠️ **Usuário precisa manter a página aberta** durante a geração (2-5 min)
⚠️ **Se fechar a página:** Vídeo fica salvo no Supabase, mas precisa criar página "Meus Vídeos" para ver depois

---

## Próximos Passos (Opcional)

1. **Página "Meus Vídeos"**: Listar todos os vídeos gerados do usuário
2. **Notificação por Email**: n8n envia email quando vídeo ficar pronto
3. **Histórico**: Exibir lista de gerações anteriores

---

## Exemplo de Response do Runware

```json
{
  "data": [
    {
      "taskType": "videoInference",
      "taskUUID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "videoUUID": "f9e8d7c6-b5a4-3210-fedc-ba0987654321",
      "videoURL": "https://vs.runware.ai/video/ws/0.5/vi/f9e8d7c6-b5a4-3210-fedc-ba0987654321.mp4",
      "cost": 0.045
    }
  ]
}
```

O n8n extrai `taskUUID` e `videoURL` e atualiza o registro no Supabase.
