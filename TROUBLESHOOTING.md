# 🔧 Troubleshooting - Página em Branco

## Problema: Página carrega mas nenhum conteúdo aparece

---

## ✅ Checklist Rápido

### 1. Verificar Console do Navegador

**Como fazer:**
1. Abra a aplicação no navegador
2. Pressione **F12** (ou Ctrl+Shift+I / Cmd+Option+I)
3. Clique na aba **Console**
4. Procure por erros em vermelho

**Erros Comuns:**

#### ❌ "Missing Supabase environment variables"
**Causa:** Variáveis de ambiente não configuradas ou build antigo

**Solução:**
1. Verifique se as variáveis estão no Easypanel
2. Faça **Redeploy** para aplicar as variáveis
3. Aguarde build completar (2-4 min)

#### ❌ "Failed to fetch" ou "Network Error"
**Causa:** URL do Supabase incorreta ou projeto não existe

**Solução:**
1. Verifique `VITE_SUPABASE_URL` está correta
2. Teste acessar: `https://vstsnxvwvsaodulrvfjz.supabase.co`
3. Deve retornar uma página (não 404)

#### ❌ "Invalid API key" ou "Invalid JWT"
**Causa:** ANON_KEY incorreta ou expirada

**Solução:**
1. Vá em Supabase > Settings > API
2. Copie novamente a **anon public** key
3. Atualize no Easypanel
4. Redeploy

---

### 2. Verificar Rede (Network)

**Como fazer:**
1. F12 → Aba **Network**
2. Recarregue a página (F5)
3. Verifique se há requisições falhando (em vermelho)

**Procure por:**
- ❌ Status 404 → Arquivo não encontrado (problema de build)
- ❌ Status 500 → Erro no servidor
- ❌ CORS error → Problema de configuração Supabase

---

### 3. Verificar Configuração Supabase

#### 3.1 Bucket existe?

1. Acesse Supabase Dashboard
2. Vá em **Storage** → **Buckets**
3. Deve ter um bucket chamado **shorts-images**

**Se não existe:**
- Execute o SQL em `SUPABASE_SETUP.sql`

#### 3.2 Políticas RLS configuradas?

1. Supabase > Storage > Policies
2. Deve ter 2 políticas:
   - "Usuarios podem fazer upload de imagens"
   - "Imagens sao publicamente acessiveis"

**Se não existe:**
- Execute o SQL em `SUPABASE_SETUP.sql`

#### 3.3 Usuário existe?

1. Supabase > Authentication > Users
2. Deve ter pelo menos 1 usuário

**Se não existe:**
- Clique em **Add User**
- Email: `test@example.com`
- Password: `test123456`
- Confirme

---

### 4. Verificar Build do Easypanel

#### 4.1 Deploy completou?

1. Easypanel > Serviço shorts-viral
2. Verifique **Status**: deve estar **Running** (verde)
3. Verifique **Logs**

**Logs devem mostrar:**
```
npm install
npm run build
Build completed successfully
Nginx started
```

#### 4.2 Variáveis corretas?

No Easypanel, verifique que as variáveis estão **exatamente** assim:

```env
VITE_SUPABASE_URL=https://vstsnxvwvsaodulrvfjz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_BASE_URL=http://n8n.automear.com
VITE_WEBHOOK_GERA_SHORTS=/webhook/gerarShorts
```

**Atenção:**
- ❌ `http://n8n.automear.com/` (com `/` no final)
- ✅ `http://n8n.automear.com` (sem `/` no final)
- ❌ `webhook/gerarShorts` (sem `/` no início)
- ✅ `/webhook/gerarShorts` (com `/` no início)

---

## 🐛 Erros Específicos e Soluções

### Erro: Página completamente em branco

**Possíveis causas:**
1. Erro JavaScript crítico
2. Arquivo `index.html` não carregou
3. Build falhou mas deploy passou

**Soluções:**
1. Abra o console (F12)
2. Veja o erro exato
3. Verifique se `main.tsx` foi compilado

**Teste rápido:**
- Acesse: `https://seu-dominio/index.html`
- Deve carregar a estrutura HTML básica

---

### Erro: "Chunk load error"

**Causa:** Arquivos JS não foram gerados corretamente

**Solução:**
1. Easypanel > Redeploy
2. Verifique logs do build
3. Confirme que `dist/` foi criado com sucesso

---

### Erro: "Failed to load module"

**Causa:** Problema com imports ou paths

**Solução:**
1. Verifique se o `vite.config.ts` está correto
2. Confirme que os aliases `@/`, `@shared/`, etc. estão funcionando
3. Redeploy

---

## 🔬 Diagnóstico Avançado

### Verificar arquivos gerados

**SSH no container (se tiver acesso):**
```bash
docker exec -it [container-id] sh
cd /usr/share/nginx/html
ls -la
```

**Deve ter:**
- `index.html`
- `assets/` (pasta com JS/CSS)
- `vite.svg`

---

### Verificar Nginx

**Logs do Nginx:**
```bash
docker logs [container-id]
```

**Configuração Nginx:**
```bash
cat /etc/nginx/conf.d/default.conf
```

**Deve ter:**
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri /index.html;
    }
}
```

---

## 📋 Checklist Completo

- [ ] Console do navegador sem erros
- [ ] Network (F12) mostra todos arquivos carregando (200 OK)
- [ ] Supabase bucket `shorts-images` existe
- [ ] Políticas RLS configuradas
- [ ] Usuário de teste criado no Supabase
- [ ] Variáveis de ambiente corretas no Easypanel
- [ ] Build completou com sucesso
- [ ] Container está Running
- [ ] Porta 80 está acessível

---

## 🆘 Ainda não funciona?

### Me envie as seguintes informações:

1. **Screenshot do Console (F12)**
2. **Screenshot da aba Network (F12)**
3. **Logs do Easypanel** (últimas 50 linhas)
4. **URL da aplicação**

### Testes manuais:

**Teste 1: Supabase está acessível?**
```bash
curl https://vstsnxvwvsaodulrvfjz.supabase.co
# Deve retornar HTML
```

**Teste 2: Nginx está servindo?**
```bash
curl http://seu-dominio-easypanel
# Deve retornar HTML
```

**Teste 3: Variáveis foram injetadas?**
```bash
# Veja o código-fonte da página (Ctrl+U)
# Procure por: <script type="module" src="/assets/
# Clique no link do script
# Procure por: "vstsnxvwvsaodulrvfjz.supabase.co"
# Se encontrar = variáveis foram injetadas ✅
# Se não encontrar = build não pegou as variáveis ❌
```

---

## 🎯 Solução Mais Provável

**90% dos casos:**
1. Variáveis de ambiente não aplicadas (precisa redeploy)
2. Bucket do Supabase não criado (execute SQL)
3. Erro de CORS ou RLS (políticas não configuradas)

**Execute:**
1. SQL em `SUPABASE_SETUP.sql`
2. Corrija variáveis no Easypanel
3. Redeploy
4. Aguarde 3-4 minutos
5. Teste novamente

---

**Página deve carregar após estes passos!** ✨
