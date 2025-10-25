# 🚀 Quick Start - Shorts Viral

Guia rápido para rodar o projeto em 5 minutos.

## ⚡ Setup Rápido

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Supabase

#### a) Criar Projeto
1. Acesse [supabase.com](https://supabase.com)
2. Crie novo projeto
3. Aguarde provisionamento (2-3 min)

#### b) Criar Bucket de Storage
```sql
-- Execute no SQL Editor do Supabase
INSERT INTO storage.buckets (id, name, public)
VALUES ('shorts-images', 'shorts-images', true);
```

#### c) Configurar Políticas
```sql
-- Política de upload (autenticados)
CREATE POLICY "auth_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'shorts-images');

-- Política de leitura (público)
CREATE POLICY "public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'shorts-images');
```

### 3. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
```

**Edite `.env` com seus dados:**

```env
# Encontre em: Supabase > Settings > API
VITE_SUPABASE_URL=https://abc123.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# URL do seu webhook N8N
VITE_API_BASE_URL=https://sua-instancia.n8n.cloud
VITE_WEBHOOK_GERA_SHORTS=/webhook/geraShorts
```

### 4. Criar Usuário de Teste

```sql
-- Execute no SQL Editor do Supabase
-- Ou use a interface Authentication > Add User
```

Ou via interface:
1. Supabase Dashboard
2. Authentication > Users
3. Add User
4. Email: `test@example.com` / Senha: `test123456`

### 5. Rodar Aplicação

```bash
npm run dev
```

**Acesse:** http://localhost:5173

---

## 🧪 Teste Rápido (Sem Webhook)

Se você ainda não tem o webhook configurado, pode testar apenas o upload:

1. Faça login com usuário criado
2. Selecione uma imagem
3. Clique em "Gerar Short Viral"
4. O upload será feito com sucesso
5. O erro no webhook é esperado (ainda não configurado)

**Verifique o upload:**
1. Supabase > Storage > shorts-images
2. Você verá sua imagem lá!

---

## 📝 Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Roda em modo dev (hot reload)

# Build
npm run build            # Gera build de produção
npm run preview          # Preview do build

# Linting
npm run lint             # Verifica erros de código
```

---

## 🔌 Configurar Webhook (N8N)

### Setup Mínimo

1. **Criar Workflow no N8N**
2. **Adicionar Webhook Node**
   - Path: `/webhook/geraShorts`
   - Method: POST
   - Response Mode: Wait for Webhook Response

3. **Adicionar Response Node**
```json
{
  "success": true,
  "message": "Short em processamento",
  "data": {
    "job_id": "{{ $json.id }}",
    "status": "processing"
  }
}
```

4. **Ativar Workflow**
5. **Copiar URL do webhook** para `.env`

**Teste com curl:**
```bash
curl -X POST https://sua-api.com/webhook/geraShorts \
  -H "Content-Type: application/json" \
  -d '{"imagem_url":"https://test.jpg","user_id":"123"}'
```

---

## 🚨 Problemas Comuns

### ❌ "Missing Supabase environment variables"

**Causa:** Variáveis de ambiente não configuradas

**Solução:**
```bash
# Verifique se o .env existe
cat .env

# Verifique se as variáveis estão corretas
# Devem começar com VITE_
```

### ❌ "Failed to upload image"

**Causa:** Bucket ou políticas não configuradas

**Solução:**
1. Verifique se o bucket existe: Supabase > Storage
2. Execute novamente os SQLs de política
3. Teste upload manual no Dashboard

### ❌ Erro no webhook

**Causa:** Webhook não configurado ou URL incorreta

**Solução:**
1. Verifique `VITE_API_BASE_URL` no `.env`
2. Teste o webhook com curl
3. Veja logs no N8N

---

## 📦 Deploy Rápido (Easypanel)

```bash
# 1. Commit e push
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/SEU_USER/shorts-viral.git
git push -u origin main

# 2. No Easypanel
# - Create Project > From GitHub
# - Selecione o repo
# - Adicione variáveis de ambiente
# - Deploy!
```

**Consulte `DEPLOYMENT.md` para guia completo**

---

## ✅ Checklist

- [ ] Node.js 18+ instalado
- [ ] npm install executado
- [ ] Projeto Supabase criado
- [ ] Bucket `shorts-images` criado
- [ ] Políticas RLS configuradas
- [ ] `.env` configurado com credenciais
- [ ] Usuário de teste criado
- [ ] `npm run dev` rodando
- [ ] Login funcionando
- [ ] Upload de imagem funcionando

---

## 📚 Documentação Completa

- `README.md` - Visão geral do projeto
- `DEPLOYMENT.md` - Guia de deploy detalhado
- `WEBHOOK.md` - Documentação técnica do webhook
- `PROJETO.md` - Resumo completo da arquitetura

---

## 🎯 Próximos Passos

1. ✅ Configurar Supabase
2. ✅ Rodar localmente
3. ⏭️ Configurar webhook N8N
4. ⏭️ Implementar geração de vídeo
5. ⏭️ Deploy em produção

---

**Pronto para começar!** 🚀

Execute `npm install && npm run dev` e acesse http://localhost:5173
