# Documentação do Webhook - /webhook/geraShorts

Este documento detalha o funcionamento do webhook `/webhook/geraShorts` que deve ser implementado no N8N ou sistema similar.

## 🎯 Endpoint

```
POST /webhook/geraShorts
```

## 📥 Payload de Entrada

### Estrutura JSON

```json
{
  "imagem_url": "string (required)",
  "user_id": "string (required)",
  "opcoes": {
    "estilo": "string (optional)",
    "duracao": "number (optional)",
    "qualidade": "string (optional)",
    "audio": "boolean (optional)"
  }
}
```

### Campos Detalhados

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `imagem_url` | string | ✅ | URL pública da imagem no Supabase Storage | `https://abc.supabase.co/storage/v1/object/public/shorts-images/123.jpg` |
| `user_id` | string | ✅ | UUID do usuário no Supabase | `550e8400-e29b-41d4-a716-446655440000` |
| `opcoes` | object | ❌ | Objeto com opções de personalização | Ver abaixo |

### Opções Disponíveis

| Campo | Tipo | Padrão | Descrição | Valores Aceitos |
|-------|------|--------|-----------|-----------------|
| `estilo` | string | `"viral"` | Estilo do vídeo | `"viral"`, `"minimalista"`, `"profissional"` |
| `duracao` | number | `30` | Duração em segundos | `15`, `30`, `60` |
| `qualidade` | string | `"high"` | Qualidade do vídeo | `"low"`, `"medium"`, `"high"` |
| `audio` | boolean | `true` | Incluir áudio | `true`, `false` |

## 📤 Resposta Esperada

### Sucesso (200 OK)

```json
{
  "success": true,
  "message": "Short em processamento",
  "data": {
    "job_id": "job_abc123xyz",
    "status": "processing",
    "estimated_time": 120
  }
}
```

### Erro (400 Bad Request)

```json
{
  "success": false,
  "error": "Descrição do erro",
  "code": "INVALID_IMAGE_URL"
}
```

### Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `INVALID_IMAGE_URL` | URL da imagem inválida ou inacessível |
| `MISSING_REQUIRED_FIELD` | Campo obrigatório ausente |
| `INVALID_USER_ID` | ID de usuário inválido |
| `PROCESSING_ERROR` | Erro durante o processamento |

## 🔄 Fluxo de Processamento

### 1. Validação
```javascript
// Validar campos obrigatórios
if (!imagem_url || !user_id) {
  return { success: false, error: "Campos obrigatórios ausentes" }
}

// Validar formato da URL
if (!imagem_url.startsWith('http')) {
  return { success: false, error: "URL inválida" }
}
```

### 2. Download da Imagem
```javascript
// Baixar imagem do Supabase Storage
const response = await fetch(imagem_url)
const imageBuffer = await response.buffer()
```

### 3. Processamento
```javascript
// Processar imagem e gerar vídeo
const videoConfig = {
  input: imageBuffer,
  duration: opcoes.duracao || 30,
  style: opcoes.estilo || 'viral',
  quality: opcoes.qualidade || 'high',
  audio: opcoes.audio !== false
}

const video = await generateVideo(videoConfig)
```

### 4. Upload do Vídeo
```javascript
// Fazer upload do vídeo gerado para storage
const videoUrl = await uploadToStorage(video, user_id)
```

### 5. Atualizar Banco de Dados
```javascript
// Salvar informações no Supabase
await supabase
  .from('shorts_videos')
  .insert({
    user_id,
    imagem_url,
    video_url: videoUrl,
    status: 'completed',
    opcoes
  })
```

## 🛠 Implementação no N8N

### Estrutura do Workflow

```
1. Webhook Trigger
   ↓
2. Validar Payload
   ↓
3. Download da Imagem
   ↓
4. Gerar Vídeo (API externa ou script)
   ↓
5. Upload do Vídeo
   ↓
6. Salvar no Supabase
   ↓
7. Retornar Resposta
```

### Exemplo de Configuração N8N

#### Node 1: Webhook
- **Method:** POST
- **Path:** /webhook/geraShorts
- **Response Mode:** Wait for Webhook Response

#### Node 2: Function (Validação)
```javascript
const body = $json.body;

if (!body.imagem_url || !body.user_id) {
  return {
    success: false,
    error: "Campos obrigatórios ausentes",
    code: "MISSING_REQUIRED_FIELD"
  };
}

return {
  ...body,
  opcoes: {
    estilo: body.opcoes?.estilo || 'viral',
    duracao: body.opcoes?.duracao || 30,
    qualidade: body.opcoes?.qualidade || 'high',
    audio: body.opcoes?.audio !== false
  }
};
```

#### Node 3: HTTP Request (Download Imagem)
- **Method:** GET
- **URL:** `{{ $json.imagem_url }}`
- **Response Format:** File

#### Node 4: Execute Binary (Gerar Vídeo)
- Depende da ferramenta usada (FFmpeg, Python script, etc.)

#### Node 5: Supabase (Upload Vídeo)
- **Operation:** Upload File
- **Bucket:** shorts-videos
- **File:** {{ $binary.data }}

#### Node 6: Supabase (Insert Record)
```javascript
{
  user_id: "{{ $json.user_id }}",
  imagem_url: "{{ $json.imagem_url }}",
  video_url: "{{ $json.videoUrl }}",
  status: "completed",
  opcoes: {{ $json.opcoes }}
}
```

#### Node 7: Respond to Webhook
```javascript
{
  success: true,
  message: "Short gerado com sucesso",
  data: {
    job_id: "{{ $json.job_id }}",
    status: "completed",
    video_url: "{{ $json.video_url }}"
  }
}
```

## 🔐 Segurança

### Autenticação (Opcional)

Adicione header de autenticação:

```javascript
// No N8N, validar token no header
const authHeader = $request.headers.authorization;
const token = authHeader?.replace('Bearer ', '');

if (!token || token !== process.env.WEBHOOK_SECRET) {
  return {
    success: false,
    error: "Não autorizado",
    code: "UNAUTHORIZED"
  };
}
```

### Rate Limiting

Implemente limite de requisições por usuário:

```javascript
// Verificar limite de requisições
const count = await redis.get(`rate:${user_id}`);
if (count > 10) {
  return {
    success: false,
    error: "Limite de requisições excedido",
    code: "RATE_LIMIT_EXCEEDED"
  };
}
```

## 📊 Monitoramento

### Logs Recomendados

```javascript
console.log({
  event: 'webhook_received',
  user_id,
  imagem_url,
  timestamp: new Date().toISOString()
});

console.log({
  event: 'video_generated',
  user_id,
  job_id,
  duration_ms: processingTime,
  timestamp: new Date().toISOString()
});
```

### Métricas Importantes

- Tempo médio de processamento
- Taxa de sucesso/erro
- Quantidade de vídeos gerados por hora
- Uso de armazenamento

## 🧪 Testes

### Teste com cURL

```bash
curl -X POST https://sua-api.com/webhook/geraShorts \
  -H "Content-Type: application/json" \
  -d '{
    "imagem_url": "https://storage.supabase.co/test.jpg",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "opcoes": {
      "estilo": "viral",
      "duracao": 30
    }
  }'
```

### Teste com JavaScript

```javascript
const response = await fetch('https://sua-api.com/webhook/geraShorts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    imagem_url: 'https://storage.supabase.co/test.jpg',
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    opcoes: {
      estilo: 'viral',
      duracao: 30
    }
  })
});

const result = await response.json();
console.log(result);
```

## 📝 Checklist de Implementação

- [ ] Webhook endpoint configurado
- [ ] Validação de payload implementada
- [ ] Download de imagem funcionando
- [ ] Processamento de vídeo configurado
- [ ] Upload de vídeo para storage
- [ ] Registro no banco de dados
- [ ] Tratamento de erros completo
- [ ] Logs e monitoramento
- [ ] Testes realizados
- [ ] Segurança implementada (opcional)
- [ ] Documentação atualizada

---

**Shorts Viral** - Webhook para geração automatizada de vídeos virais
