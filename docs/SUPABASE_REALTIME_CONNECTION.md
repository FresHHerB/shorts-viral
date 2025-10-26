# Como a Página Conecta ao Supabase Realtime

## 🔌 Visão Geral da Conexão

A página se conecta ao Supabase Realtime através de **WebSockets** usando o cliente JavaScript oficial do Supabase. A conexão é automática e transparente.

---

## 📦 1. Configuração do Cliente Supabase

### Arquivo: `src/shared/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

// Pega credenciais do arquivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cria cliente único para toda a aplicação
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Credenciais Usadas (`.env`)

```env
VITE_SUPABASE_URL=https://vstsnxvwvsaodulrvfjz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Importante:**
- `VITE_SUPABASE_URL` - URL do seu projeto Supabase
- `VITE_SUPABASE_ANON_KEY` - Chave pública (pode ser exposta no frontend)
- **Não confundir com `service_role` key** (essa deve ficar no backend/n8n)

---

## 🌐 2. Como a Conexão WebSocket é Estabelecida

### Quando você chama `createClient()`:

```typescript
const supabase = createClient(url, key)
```

**O que acontece automaticamente:**

1. Cliente Supabase é inicializado
2. Estabelece conexão HTTP com `https://vstsnxvwvsaodulrvfjz.supabase.co`
3. **WebSocket NÃO é criado ainda** (só quando você se inscrever em um canal)

### Quando você cria um canal Realtime:

```typescript
const channel = supabase
  .channel('my-channel')
  .on('postgres_changes', { ... }, callback)
  .subscribe()
```

**O que acontece:**

1. **WebSocket é aberto** para `wss://vstsnxvwvsaodulrvfjz.supabase.co/realtime/v1/websocket`
2. Autenticação via JWT (anon key)
3. Inscrição no canal `my-channel`
4. Fica ouvindo mudanças no banco de dados

---

## 🔍 3. Como Funciona no Código da Aplicação

### Arquivo: `GerarShortsPage.tsx`

#### Passo 1: Importar Cliente

```typescript
import { supabase } from '@shared/lib/supabase'
```

#### Passo 2: Criar Canal e Inscrever

```typescript
const startVideoRealtime = async (taskUuid: string) => {
  // Criar canal único para este vídeo
  const channel = supabase
    .channel(`video_generation_${taskUuid}`)  // ⭐ Nome único do canal
    .on(
      'postgres_changes',  // ⭐ Tipo: mudanças no Postgres
      {
        event: 'UPDATE',   // ⭐ Evento: apenas UPDATEs
        schema: 'public',  // ⭐ Schema do banco
        table: 'shorts_generation',  // ⭐ Tabela monitorada
        filter: `id=eq.${taskUuid}`  // ⭐ Filtro: apenas este registro
      },
      (payload) => {
        // ⭐ Callback executado quando houver UPDATE
        console.log('🔔 Realtime update recebido:', payload)
        const data = payload.new  // Novos valores

        if (data.status === 'completed' && data.video_url) {
          setVideoUrl(data.video_url)
          setStatus('success')
        }
      }
    )
    .subscribe((status) => {
      // ⭐ Callback de status da conexão
      console.log('📡 Realtime subscription status:', status)
    })

  // Salvar referência do canal
  channelRef.current = channel
}
```

#### Passo 3: Desconectar Quando Não Precisar Mais

```typescript
const stopRealtime = () => {
  if (channelRef.current) {
    channelRef.current.unsubscribe()  // ⭐ Fecha WebSocket
    channelRef.current = null
  }
}

// Cleanup ao desmontar componente
useEffect(() => {
  return () => stopRealtime()
}, [])
```

---

## 🔐 4. Como Funciona a Autenticação

### anon key (Frontend)

```env
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Permissões:**
- ✅ Ler dados (SELECT) - controlado por RLS
- ✅ Ouvir mudanças via Realtime
- ❌ Inserir/Atualizar sem RLS bypass

**Decodificado (JWT):**
```json
{
  "iss": "supabase",
  "ref": "vstsnxvwvsaodulrvfjz",
  "role": "anon",  // ⭐ Role: anon (público)
  "iat": 1758063793,
  "exp": 2073639793
}
```

### service_role key (n8n)

**Usado apenas no backend (n8n) para:**
- ✅ Inserir registros (INSERT)
- ✅ Atualizar status (UPDATE)
- ✅ Bypass RLS policies

**Nunca expor no frontend!**

---

## 🌊 5. Fluxo Completo da Conexão

```
┌─────────────────────────────────────────────────────────────┐
│ 1. INICIALIZAÇÃO                                            │
│                                                              │
│  App.tsx                                                     │
│    │                                                         │
│    └─> import { supabase } from '@shared/lib/supabase'     │
│          │                                                   │
│          └─> createClient(URL, ANON_KEY)                    │
│                │                                             │
│                └─> Cliente Supabase criado                  │
│                    (WebSocket ainda NÃO criado)             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. GERAÇÃO DE VÍDEO                                         │
│                                                              │
│  GerarShortsPage.tsx                                        │
│    │                                                         │
│    ├─> handleGenerateVideo()                                │
│    │     │                                                   │
│    │     ├─> taskUuid = uuidv4()  // "abc-123-456"         │
│    │     │                                                   │
│    │     ├─> POST /webhook/gerarShorts                      │
│    │     │                                                   │
│    │     └─> startVideoRealtime(taskUuid)                   │
│    │           │                                             │
│    │           └─> (próximo passo...)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. ABERTURA DA CONEXÃO WEBSOCKET                            │
│                                                              │
│  startVideoRealtime(taskUuid)                               │
│    │                                                         │
│    ├─> supabase.channel('video_generation_abc-123-456')    │
│    │     │                                                   │
│    │     └─> .on('postgres_changes', ...)                   │
│    │           │                                             │
│    │           └─> .subscribe()                              │
│    │                 │                                       │
│    │                 ├─> WebSocket ABERTO                   │
│    │                 │   wss://vstsnxvwvsaodulrvfjz         │
│    │                 │       .supabase.co/realtime/v1/...   │
│    │                 │                                       │
│    │                 ├─> Envia JWT (anon key)               │
│    │                 │                                       │
│    │                 └─> Server responde: SUBSCRIBED        │
│    │                                                         │
│    └─> Console: "📡 Realtime subscription status:           │
│                   { status: 'SUBSCRIBED' }"                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 4. BACKEND ATUALIZA BANCO (n8n)                             │
│                                                              │
│  n8n (service_role key)                                     │
│    │                                                         │
│    └─> UPDATE shorts_generation                             │
│          SET status = 'completed',                          │
│              video_url = 'https://...'                      │
│          WHERE id = 'abc-123-456'                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 5. SUPABASE DETECTA MUDANÇA                                 │
│                                                              │
│  Supabase Server                                            │
│    │                                                         │
│    ├─> Detecta UPDATE na tabela shorts_generation          │
│    │                                                         │
│    ├─> Verifica: id = 'abc-123-456'                        │
│    │                                                         │
│    ├─> Encontra canal inscrito:                            │
│    │   'video_generation_abc-123-456'                       │
│    │                                                         │
│    └─> Envia via WebSocket:                                 │
│          {                                                   │
│            "event": "UPDATE",                               │
│            "schema": "public",                              │
│            "table": "shorts_generation",                    │
│            "new": {                                         │
│              "id": "abc-123-456",                           │
│              "status": "completed",                         │
│              "video_url": "https://..."                     │
│            }                                                 │
│          }                                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 6. FRONTEND RECEBE NOTIFICAÇÃO                              │
│                                                              │
│  GerarShortsPage.tsx                                        │
│    │                                                         │
│    └─> Callback executado:                                  │
│          (payload) => {                                      │
│            console.log('🔔 Realtime update:', payload)      │
│            const data = payload.new                         │
│                                                              │
│            if (data.status === 'completed') {               │
│              setVideoUrl(data.video_url)  // ✅ Vídeo!     │
│              setStatus('success')                           │
│              stopRealtime()  // Fecha WebSocket             │
│            }                                                 │
│          }                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 6. Tecnologias Usadas

### Frontend

- **@supabase/supabase-js** v2.x
  - Cliente JavaScript oficial
  - Gerencia WebSocket automaticamente
  - Reconecta automaticamente se cair

### Backend (Supabase)

- **PostgreSQL** com extensão Realtime
- **WebSocket Server** em Go (parte do Supabase)
- **Replication Slots** para detectar mudanças

### Protocolo

- **WebSocket (wss://)** - Bidirecional, tempo real
- **Phoenix Channels** - Framework usado pelo Supabase
- **JWT** - Autenticação via token

---

## 🔍 7. Debug: Inspecionar Conexão

### Ver WebSocket no Browser

1. Abrir **DevTools** (F12)
2. Ir para aba **Network**
3. Filtrar por **WS** (WebSockets)
4. Procurar por `websocket?apikey=...`
5. Clicar e ver aba **Messages**

**Você verá mensagens como:**

```json
// ← Enviado pelo cliente
{
  "topic": "realtime:video_generation_abc-123-456",
  "event": "phx_join",
  "payload": {},
  "ref": "1"
}

// → Resposta do servidor
{
  "topic": "realtime:video_generation_abc-123-456",
  "event": "phx_reply",
  "payload": { "status": "ok" },
  "ref": "1"
}

// → Notificação de UPDATE
{
  "topic": "realtime:video_generation_abc-123-456",
  "event": "postgres_changes",
  "payload": {
    "data": {
      "schema": "public",
      "table": "shorts_generation",
      "commit_timestamp": "2025-01-26T...",
      "type": "UPDATE",
      "old_record": { ... },
      "record": { "id": "abc-123-456", "status": "completed", ... }
    }
  }
}
```

### Console Logs

```javascript
// Quando conecta
📡 Realtime subscription status: {
  status: 'SUBSCRIBED',
  channel: 'video_generation_abc-123-456'
}

// Quando recebe update
🔔 Realtime update recebido: {
  commit_timestamp: "2025-01-26T15:30:00Z",
  eventType: "UPDATE",
  new: { id: "abc-123-456", status: "completed", video_url: "..." },
  old: { id: "abc-123-456", status: "processing" },
  schema: "public",
  table: "shorts_generation"
}
```

---

## ⚙️ 8. Configuração Necessária no Supabase

### Habilitar Realtime na Tabela

```sql
-- Executar no SQL Editor do Supabase
ALTER PUBLICATION supabase_realtime
ADD TABLE shorts_generation;
```

**Verificar se foi habilitado:**

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime';
```

Deve aparecer `shorts_generation` na lista.

---

## 🎯 Resumo

**Como a conexão funciona:**

1. **Cliente criado** com `createClient(URL, ANON_KEY)`
2. **WebSocket aberto** ao chamar `.subscribe()`
3. **Autenticação** via JWT (anon key)
4. **Escuta mudanças** na tabela `shorts_generation`
5. **Callback executado** quando há UPDATE
6. **Interface atualizada** instantaneamente

**Credenciais:**
- Frontend: `anon key` (público, RLS controlado)
- n8n: `service_role key` (privado, bypass RLS)

**Protocolo:**
- WebSocket (wss://)
- Phoenix Channels
- PostgreSQL Replication

**Vantagens:**
- ✅ Conexão automática
- ✅ Reconexão automática
- ✅ Sem polling
- ✅ Latência baixa (< 1 segundo)
- ✅ Seguro (RLS + JWT)
