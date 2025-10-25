# Guia de Deploy - Shorts Viral

Este guia detalha como fazer o deploy do projeto Shorts Viral no Easypanel.

## 📋 Pré-requisitos

1. **Conta Supabase configurada**
   - Criar projeto no Supabase
   - Criar bucket de storage chamado `shorts-images`
   - Configurar políticas de acesso público

2. **Servidor N8N ou API de Webhooks**
   - URL base da API configurada
   - Endpoint `/webhook/geraShorts` implementado

3. **Conta no Easypanel/VPS**
   - Acesso ao painel Easypanel
   - Repositório GitHub com o código

## 🚀 Passos para Deploy

### 1. Configurar Supabase Storage

Execute no SQL Editor do Supabase:

```sql
-- Criar bucket de storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('shorts-images', 'shorts-images', true);

-- Política para upload (apenas usuários autenticados)
CREATE POLICY "Usuários podem fazer upload de imagens"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'shorts-images');

-- Política para leitura pública
CREATE POLICY "Imagens são publicamente acessíveis"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'shorts-images');
```

### 2. Configurar Repositório GitHub

1. Crie um repositório no GitHub
2. Faça push do código:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/shorts-viral.git
git push -u origin main
```

3. Atualize o `easypanel.json`:

```json
{
  "name": "shorts-viral",
  "services": [
    {
      "type": "app",
      "data": {
        "name": "shorts-viral",
        "source": {
          "type": "github",
          "repo": "SEU_USUARIO/shorts-viral",
          "branch": "main"
        },
        ...
      }
    }
  ]
}
```

### 3. Deploy no Easypanel

1. **Criar novo projeto no Easypanel**
   - Acesse seu painel Easypanel
   - Clique em "Create Project"
   - Selecione "From GitHub"

2. **Configurar Build**
   - Build Type: Dockerfile
   - Dockerfile Path: `./Dockerfile`

3. **Adicionar Variáveis de Ambiente**

   No painel do Easypanel, adicione as seguintes variáveis:

   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anonima
   VITE_API_BASE_URL=https://sua-api-n8n.com
   VITE_WEBHOOK_GERA_SHORTS=/webhook/geraShorts
   ```

4. **Deploy**
   - Clique em "Deploy"
   - Aguarde o build completar (3-5 minutos)

### 4. Configurar Webhook N8N

O webhook `/webhook/geraShorts` deve receber o seguinte payload:

```json
{
  "imagem_url": "https://storage.supabase.co/...",
  "user_id": "uuid-do-usuario",
  "opcoes": {
    "estilo": "viral",
    "duracao": 30
  }
}
```

**Resposta esperada:**

```json
{
  "success": true,
  "message": "Short em processamento",
  "job_id": "abc123"
}
```

## 🔧 Configurações Avançadas

### Domínio Personalizado

1. No Easypanel, vá em Settings > Domains
2. Adicione seu domínio
3. Configure DNS:
   ```
   Type: CNAME
   Name: shorts
   Value: seu-app.easypanel.host
   ```

### SSL/HTTPS

O Easypanel configura automaticamente certificados SSL via Let's Encrypt.

### Monitoramento

- Logs: Easypanel > Logs
- Métricas: Easypanel > Metrics
- Health Check: `https://seu-dominio/`

## 🐛 Troubleshooting

### Erro: "Missing Supabase environment variables"

**Solução:** Verifique se todas as variáveis VITE_SUPABASE_* estão configuradas no Easypanel.

### Erro de upload: "Failed to upload image"

**Solução:**
1. Verifique se o bucket `shorts-images` existe
2. Confirme as políticas de RLS no Supabase
3. Teste manualmente o upload via Supabase Dashboard

### Erro 404 no webhook

**Solução:**
1. Confirme que a VITE_API_BASE_URL está correta
2. Teste o webhook diretamente com curl:

```bash
curl -X POST https://sua-api.com/webhook/geraShorts \
  -H "Content-Type: application/json" \
  -d '{"imagem_url":"https://example.com/test.jpg","user_id":"test"}'
```

## 📊 Estrutura de Pastas no Build

```
/app/
├── dist/              # Build de produção (servido pelo Nginx)
├── node_modules/      # Dependências (não incluído na imagem final)
└── ...
```

## 🔄 Atualizações

Para atualizar o app após mudanças no código:

1. Commit e push para GitHub
2. No Easypanel, clique em "Redeploy"
3. Ou configure auto-deploy no GitHub webhook

## 📝 Checklist de Deploy

- [ ] Supabase configurado com bucket `shorts-images`
- [ ] Políticas de RLS configuradas
- [ ] Repositório GitHub criado e atualizado
- [ ] easypanel.json com repo correto
- [ ] Variáveis de ambiente configuradas no Easypanel
- [ ] Webhook N8N implementado e testado
- [ ] Primeiro deploy realizado com sucesso
- [ ] Teste de upload de imagem funcionando
- [ ] SSL configurado (automático)
- [ ] Domínio personalizado configurado (opcional)

---

**Shorts Viral** - Deploy simplificado para geração de vídeos virais
