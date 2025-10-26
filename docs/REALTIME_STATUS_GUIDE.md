# Guia: Como funciona o Realtime e Status de Vídeos

## 📊 Status Monitorados pela Plataforma

A plataforma monitora a tabela `shorts_generation` no Supabase e fica de olho nos seguintes campos:

### Status Possíveis

| Status | Descrição | Quando ocorre |
|--------|-----------|---------------|
| `processing` | Vídeo sendo gerado | Quando n8n envia para Runware |
| `completed` | Vídeo pronto | Quando Runware retorna o callback com sucesso |
| `error` | Erro na geração | Quando Runware retorna erro ou timeout |

### Campos Monitorados

```typescript
{
  id: UUID,              // ID único gerado pelo frontend
  status: 'processing' | 'completed' | 'error',
  video_url: string,     // URL do vídeo quando pronto
  error_message: string, // Mensagem de erro se houver
  image_url: string,     // URL da imagem usada
  video_description: string,
  user_id: string,
  cost: number,
  created_at: timestamp
}
```

---

## 🔄 Como Funciona o Fluxo Completo

### 1. Frontend Inicia a Geração

```typescript
// 1. Gera UUID único
const taskUuid = uuidv4() // ex: 'abc-123-def-456'

// 2. Envia para n8n
await apiService.gerarShorts({
  generation_type: 'video',
  task_uuid: taskUuid,
  video_description: '...',
  image_url: '...',
  user_id: 'user123'
})

// 3. Inicia escuta Realtime
startVideoRealtime(taskUuid)
```

### 2. n8n Cria Registro no Supabase

**Webhook: `/webhook/gerarShorts`**

```javascript
// n8n - Nó: Supabase Insert
{
  "id": "{{ $json.task_uuid }}",      // abc-123-def-456
  "status": "processing",              // ⭐ Status inicial
  "user_id": "{{ $json.user_id }}",
  "image_url": "{{ $json.image_url }}",
  "video_description": "{{ $json.video_description }}",
  "created_at": "{{ $now.toISO() }}"
}
```

### 3. n8n Envia para Runware

```javascript
// n8n - Nó: HTTP Request POST
{
  "taskType": "videoInference",
  "taskUUID": "{{ $json.task_uuid }}", // Mesmo UUID!
  "positivePrompt": "{{ $json.video_description }}",
  "model": "kling/v1/standard/image-to-video",
  "inputImage": "{{ $json.image_url }}",
  "duration": 5,
  "aspectRatio": "9:16",
  "callbackURL": "https://n8n.automear.com/webhook/runware-callback"
}
```

### 4. Runware Processa (2-5 minutos)

Enquanto isso, o frontend está escutando mudanças na linha `id=abc-123-def-456`

### 5. Runware Retorna via Callback

**Webhook: `/webhook/runware-callback`** (NOVO)

**Resposta do Runware:**
```json
{
  "data": [{
    "taskType": "videoInference",
    "taskUUID": "abc-123-def-456",
    "videoUUID": "xyz-789",
    "videoURL": "https://vs.runware.ai/video/ws/0.5/vi/xyz-789.mp4",
    "cost": 0.045
  }]
}
```

### 6. n8n Atualiza Supabase

**⭐ AQUI É ONDE VOCÊ ATUALIZA O STATUS PARA 'completed'**

```javascript
// n8n - Nó: Supabase Update
// Filtro
{
  "id": "{{ $json.data[0].taskUUID }}" // abc-123-def-456
}

// Update
{
  "status": "completed",  // ⭐⭐⭐ MUDA PARA COMPLETED
  "video_url": "{{ $json.data[0].videoURL }}",
  "cost": "{{ $json.data[0].cost }}"
}
```

### 7. Frontend Recebe Notificação Instantânea

```typescript
// O Realtime detecta o UPDATE e dispara:
const channel = supabase
  .channel(`video_generation_${taskUuid}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    table: 'shorts_generation',
    filter: `id=eq.${taskUuid}`
  }, (payload) => {
    const data = payload.new

    if (data.status === 'completed' && data.video_url) {
      // ✅ VÍDEO PRONTO!
      setVideoUrl(data.video_url)
      setStatus('success')
      setIsGeneratingVideo(false)
    }
  })
```

---

## 🛠️ Como Adicionar Nova Coluna

Se você quiser adicionar um novo campo (ex: `thumbnail_url`):

### 1. Criar Migration no Supabase

```sql
-- supabase/migrations/20250126_add_thumbnail.sql
ALTER TABLE shorts_generation
ADD COLUMN thumbnail_url TEXT;
```

### 2. Executar no Supabase SQL Editor

Execute o SQL acima no dashboard do Supabase.

### 3. Atualizar n8n Callback Webhook

```javascript
// n8n - Nó: Supabase Update
{
  "status": "completed",
  "video_url": "{{ $json.data[0].videoURL }}",
  "thumbnail_url": "{{ $json.data[0].thumbnailURL }}", // ⭐ Novo campo
  "cost": "{{ $json.data[0].cost }}"
}
```

### 4. Atualizar Frontend

```typescript
// GerarShortsPage.tsx - Atualizar SELECT
const { data: initialData } = await supabase
  .from('shorts_generation')
  .select('status, video_url, thumbnail_url, error_message') // ⭐ Adicionar
  .eq('id', taskUuid)
  .single()

// Usar o novo campo
if (initialData?.thumbnail_url) {
  setThumbnailUrl(initialData.thumbnail_url)
}
```

---

## 📝 Como Atualizar Status Manualmente (Testes)

### Opção 1: Via Supabase Dashboard

1. Ir para **Table Editor** > `shorts_generation`
2. Encontrar o registro pelo `id`
3. Editar os campos:
   - `status` → `completed`
   - `video_url` → `https://example.com/video.mp4`
4. Salvar

O frontend receberá a notificação instantaneamente!

### Opção 2: Via SQL Editor

```sql
UPDATE shorts_generation
SET
  status = 'completed',
  video_url = 'https://vs.runware.ai/video/test.mp4',
  cost = 0.045
WHERE id = 'abc-123-def-456';
```

### Opção 3: Via n8n Teste

Criar workflow de teste:

1. **Manual Trigger**
2. **Set Node**:
   ```json
   {
     "data": [{
       "taskUUID": "abc-123-def-456",
       "videoURL": "https://vs.runware.ai/video/test.mp4",
       "cost": 0.045
     }]
   }
   ```
3. **Supabase Update** (mesmo código do callback)

---

## ⚠️ Tratamento de Erros

### Quando Runware retorna erro:

```javascript
// n8n - Nó: Supabase Update (em caso de erro)
{
  "status": "error",
  "error_message": "{{ $json.error || 'Erro desconhecido ao gerar vídeo' }}"
}
```

### Frontend detecta erro:

```typescript
if (data.status === 'error') {
  setStatus('error')
  setErrorMessage(data.error_message || 'Erro ao gerar vídeo')
  stopRealtime()
}
```

---

## 🔍 Debug: Como Verificar se Realtime está Funcionando

### 1. Verificar no Console do Navegador

```
📡 Realtime subscription status: { status: 'SUBSCRIBED' }
```

### 2. Fazer Update Manual no Supabase

```sql
UPDATE shorts_generation
SET status = 'completed',
    video_url = 'https://example.com/test.mp4'
WHERE id = 'SEU_UUID_AQUI';
```

### 3. Verificar Console do Navegador

```
🔔 Realtime update recebido: { new: { status: 'completed', ... } }
```

### 4. Verificar se Realtime está habilitado

```sql
-- Executar no SQL Editor
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

Deve aparecer `shorts_generation` na lista.

---

## 📋 Checklist: Quando Vídeo Não Aparece

- [ ] Verificar se migration `20250126_create_shorts_generation.sql` foi executada
- [ ] Verificar se Realtime foi habilitado (`20250126_enable_realtime.sql`)
- [ ] Verificar se n8n está usando `service_role` key (não `anon` key)
- [ ] Verificar se `task_uuid` gerado no frontend é o mesmo enviado para n8n
- [ ] Verificar logs do n8n no webhook `/webhook/runware-callback`
- [ ] Verificar se `callbackURL` no request para Runware está correto
- [ ] Verificar console do navegador para erros de Realtime
- [ ] Fazer teste manual de UPDATE no Supabase

---

## 🎯 Resumo

**Frontend monitora:**
- Eventos `UPDATE` na tabela `shorts_generation`
- Filtro: `id=eq.{taskUuid}`
- Campos: `status`, `video_url`, `error_message`

**Para atualizar quando vídeo pronto:**
1. n8n recebe callback do Runware
2. n8n executa `UPDATE` no Supabase:
   ```sql
   UPDATE shorts_generation
   SET status = 'completed', video_url = '...'
   WHERE id = '...';
   ```
3. Frontend recebe notificação instantânea via Realtime
4. Vídeo aparece automaticamente na tela

**Status válidos:** `processing`, `completed`, `error`
