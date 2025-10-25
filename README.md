# Shorts Viral - Gerador de Vídeos Virais

Sistema para geração automatizada de shorts virais com upload de imagem e processamento via webhook.

## 🚀 Recursos

- Upload de imagem para geração de shorts
- Integração com webhook para processamento
- Interface moderna e responsiva
- Deploy otimizado para Easypanel

## 🛠 Tecnologias

- **React 18** com TypeScript
- **Vite** como bundler
- **TailwindCSS** para estilização
- **Supabase** como backend
- **React Router DOM** para navegação

## ⚙️ Instalação

### 1. Clone o repositório
```bash
git clone <repository-url>
cd shorts-viral
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais:
- `VITE_SUPABASE_URL`: URL do seu projeto Supabase
- `VITE_SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `VITE_API_BASE_URL`: URL base da API (N8N ou similar)
- `VITE_WEBHOOK_GERA_SHORTS`: Endpoint do webhook para geração de shorts

### 4. Execute o projeto
```bash
npm run dev
```

## 📦 Deploy no Easypanel

1. Configure o `easypanel.json` com seu repositório GitHub
2. Adicione as variáveis de ambiente no Easypanel
3. O deploy será feito automaticamente via Dockerfile

## 🏗 Estrutura do Projeto

```
shorts-viral/
├── src/
│   ├── app/              # Configuração da aplicação
│   ├── features/         # Funcionalidades (feature-based)
│   ├── shared/           # Componentes e utilitários compartilhados
│   └── types/            # Definições de tipos TypeScript
├── public/               # Arquivos estáticos
└── dist/                 # Build de produção
```

## 📝 Licença

MIT
