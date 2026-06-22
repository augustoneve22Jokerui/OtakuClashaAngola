# Otaku Clash Angola - Enterprise Backend

## 📌 Visão Geral

O **Otaku Clash Angola** é uma plataforma de quiz e competição de anime de alto desempenho. Este backend foi desenvolvido seguindo padrões de arquitetura corporativa (Enterprise-Grade), utilizando uma abordagem **Modular Clean Architecture** para garantir escalabilidade, segurança e manutenibilidade.

A plataforma oferece suporte a duelos em tempo real (Socket.io), gestão financeira (Wallets), integração com o ecossistema Supabase e sincronização automatizada de dados via Jikan API.

## 🚀 Tecnologias Core

- **Runtime:** Node.js 22.x (LTS)
- **Framework:** Express.js
- **Banco de Dados:** PostgreSQL (via Supabase)
- **Real-time:** Socket.io
- **Autenticação:** JWT (Access & Refresh Tokens) + Supabase Auth
- **Cache & Queues:** Redis + BullMQ
- **Validação:** Zod
- **Logs:** Winston + Morgan
- **Documentação:** Swagger / OpenAPI 3.0

## 🏗️ Arquitetura de Pastas

A estrutura segue o padrão de módulos independentes e camadas de responsabilidade:

```text
backend/
├── src/
│   ├── config/          # Configurações globais e inicialização de clientes
│   ├── core/            # Classes base, erros globais e constantes
│   ├── database/        # Schemas SQL, seeds e triggers
│   ├── modules/         # Módulos de negócio (Auth, Quiz, Wallet, etc)
│   ├── services/        # Serviços externos (Jikan, Storage, Email)
│   ├── socket/          # Lógica de WebSockets (Lobbies, Matchmaking)
│   ├── middlewares/     # Interceptores (Auth, Rate Limit, Validation)
│   └── utils/           # Helpers e utilitários compartilhados