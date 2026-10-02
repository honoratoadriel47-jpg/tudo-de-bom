# 💜 TUDO DE BOM — Açaiteria

Site e sistema de pedidos da açaiteria **TUDO DE BOM**: cardápio, "Monte seu açaí" com preço em tempo real, carrinho, checkout, envio do pedido pelo WhatsApp, acompanhamento do pedido pelo cliente e painel administrativo completo.

---

## 1. Resumo

**Para o cliente**

- Abertura animada com a logo (uma vez por sessão) e hero "Tudo de bom cabe num copo".
- Seções do site: Os queridinhos, Hoje tem promo!, Monte seu açaí, Cardápio por categoria, Galeria com ampliação, Como funciona, endereço, horários e contato.
- **Monte seu açaí** em etapas: tamanho → base → complementos → frutas → recheios → coberturas → adicionais → revisar.
  - O copo vai "enchendo" conforme o cliente escolhe.
  - Cada tamanho tem ingredientes grátis inclusos, aplicados automaticamente aos mais caros.
- **Carrinho**:
  - quantidade, remover, detalhes de cada item e observações;
  - subtotal, desconto da promoção e barra de "faltam R$ X para o frete grátis";
  - no celular, barra flutuante "🛒 3 itens — R$ ...".
- **Checkout** numa tela só:
  - nome e WhatsApp;
  - delivery (bairro com taxa e endereço) ou retirada;
  - PIX, dinheiro (com troco), crédito ou débito;
  - observações;
  - agendamento quando a loja está fechada.
- Ao finalizar, o WhatsApp abre com o pedido completo para a loja. Em seguida aparece a tela **"PEDIDO REALIZADO! 💜"**.
- **Acompanhamento** em `/pedido/<código>`: linha do tempo que se atualiza sozinha.
- Status 🟢 aberto / 🔴 fechado automático pelo horário de funcionamento.

**Para a loja (painel em `/admin`)**

- **Pedidos**:
  - atualização a cada 5 segundos, bip e título piscando quando chega pedido novo;
  - filtros por status, busca e data;
  - botão grande para avançar o status: NOVO → EM PREPARAÇÃO → PRONTO → SAIU PARA ENTREGA → ENTREGUE (ou CANCELADO);
  - botão para avisar o cliente no WhatsApp com a mensagem certa para cada etapa;
  - mensagem de produção pronta para copiar ou imprimir.
- **Cadastros**: produtos, categorias, promoções, tamanhos, etapas e ingredientes do "Monte seu açaí", bairros e taxas, galeria. Todos com upload de foto e opção de ativar ou desativar.
- **Configurações**:
  - nome da loja, WhatsApp, logo, Instagram, chave PIX e endereço;
  - horários de cada dia e aberto/fechado forçado;
  - tempos de preparo (retirada e delivery);
  - pedido mínimo, frete grátis, formas de pagamento e agendamento.
- **Usuários**: perfil *Administrador* (tudo) e *Funcionário* (só pedidos). Cada um troca a própria senha.

**Segurança**

- Os preços são **sempre recalculados no servidor**. Valores enviados pelo navegador são ignorados.
- Senhas com hash scrypt.
- Sessão em cookie HttpOnly/SameSite, proteção contra requisições forjadas (CSRF) e limite de tentativas no login e nos pedidos.
- Validação e limpeza de todos os campos.
- Uploads conferidos pelo conteúdo real do arquivo.
- Cabeçalhos de segurança (CSP, nosniff etc.).

---

## 2. Estrutura do projeto

```
tdb/
├── server/                     # Back-end (Node.js, sem dependências externas)
│   ├── index.js                # Servidor HTTP, arquivos estáticos, páginas, SEO
│   ├── config.js               # Lê as variáveis de ambiente
│   ├── db/
│   │   ├── schema.sql          # Estrutura do banco (SQLite)
│   │   ├── database.js         # Conexão
│   │   └── seed.js             # Dados de exemplo (produtos, preços, bairros…)
│   ├── routes/                 # API pública (/api/…) e do painel (/api/admin/…)
│   ├── services/               # Regras de negócio: pedidos, horários, WhatsApp, login…
│   ├── admin/                  # Definição dos cadastros do painel e validação das configurações
│   └── lib/                    # HTTP, rotas, validação, limite de requisições
├── public/                     # Front-end (HTML/CSS/JS puro, sem build)
│   ├── index.html              # Site da loja
│   ├── admin/index.html        # Painel
│   ├── css/                    # tokens (cores/fontes), componentes, loja, painel
│   ├── js/shared/pricing.js    # Regra de preço ÚNICA (usada no navegador e no servidor)
│   ├── js/store/               # Loja: carrinho, montagem, checkout, sucesso, acompanhamento
│   ├── js/admin/               # Painel: pedidos, cadastros, configurações, usuários
│   ├── js/ui/                  # Utilitários de interface (animações, painéis, avisos)
│   └── assets/
│       ├── brand/              # Logo oficial, ícones, imagem de compartilhamento
│       └── img/produtos/       # Imagens ilustrativas (substituíveis)
├── scripts/generate-placeholders.js
├── tests/                      # Testes automáticos (npm test)
├── data/                       # Criada automaticamente: banco e fotos enviadas (NÃO versionar)
├── .env.example
└── package.json
```

---

## 3. Tecnologias

- **Node.js 22.5 ou mais novo**, usando só recursos nativos:
  - `node:http` para o servidor;
  - `node:sqlite` para o banco;
  - `node:crypto` para senhas e sessões;
  - `node:test` para os testes.
- **Nenhuma dependência para instalar.** Não precisa de `npm install`.
- **Banco SQLite**: um único arquivo em `data/tudodebom.db`, simples de copiar como backup.
- **Front-end** em HTML, CSS e JavaScript moderno (módulos ES), sem etapa de build.
- **Fontes**: Bricolage Grotesque (títulos) e Figtree (textos), via Google Fonts.

---

## 4. Como rodar localmente

1. Instale o **Node.js 22.5 ou mais novo** (recomendado: a versão LTS mais recente em <https://nodejs.org>).
2. Na pasta do projeto, crie o arquivo de configuração:
   ```bash
   cp .env.example .env
   ```
3. Inicie:
   ```bash
   npm start
   ```
4. Abra:
   - Loja: <http://localhost:3000>
   - Painel: <http://localhost:3000/admin>

**Login inicial do painel:** `admin@tudodebom.com.br` / `troque-esta-senha`.

> ⚠️ **Troque essa senha antes de publicar.** Você pode trocar em `.env` (vale só na **primeira** vez que o banco é criado) ou depois, pelo painel em **Minha senha**.

Outros comandos úteis:

| Comando | O que faz |
|---|---|
| `npm run dev` | Inicia reiniciando sozinho a cada alteração no código |
| `npm test` | Roda os testes automáticos (sobe o servidor num banco temporário) |
| `npm run seed` | Recria o **cardápio** de exemplo (produtos, categorias, promoções, bairros, galeria). Mantém pedidos, usuários e configurações |
| `npm run seed:all` | Volta ao estado de fábrica: apaga também pedidos, clientes e configurações (usuários são mantidos) |
| `npm run images` | Regera as imagens ilustrativas |

Na primeira execução, o banco e os dados de exemplo são criados automaticamente.

---

## 5. Variáveis de ambiente (`.env`)

| Variável | Para que serve | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `NODE_ENV` | Use `production` no servidor público (ativa cookie seguro/HTTPS) | `development` |
| `PUBLIC_URL` | Endereço público do site, sem barra no final. Usado no SEO e no link de acompanhamento enviado no WhatsApp | `http://localhost:3000` |
| `DB_PATH` | Arquivo do banco | `./data/tudodebom.db` |
| `UPLOAD_DIR` | Pasta das fotos enviadas pelo painel | `./data/uploads` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Administrador criado na primeira execução | ver `.env.example` |
| `STAFF_EMAIL` / `STAFF_PASSWORD` | Funcionário opcional criado na primeira execução (também dá para criar pelo painel) | vazio |
| `SESSION_TTL_HOURS` | Tempo de login do painel | `12` |
| `TRUST_PROXY` | `1` se estiver atrás de Nginx, Render, Railway etc. | `0` |
| `ORDER_WEBHOOK_URL` | Opcional: URL chamada a cada pedido novo ou mudança de status | vazio |
| `WHATSAPP_CLOUD_TOKEN` / `WHATSAPP_CLOUD_PHONE_ID` | Opcional: envio automático pela API oficial do WhatsApp | vazio |

---

## 6. Como configurar o WhatsApp da loja

1. Entre no painel → **⚙️ Configurações** → card **Loja**.
2. Em **WhatsApp da loja (recebe os pedidos)**, digite o número com DDD, por exemplo `(27) 99999-9999`.
3. Clique em **Salvar configurações**. O site passa a usar o número novo na hora.

Como funciona hoje, sem custo e sem cadastro na Meta:

- Ao finalizar, o **WhatsApp do cliente** abre com a mensagem do pedido já escrita para esse número, no formato de produção da loja (━━ NOVO PEDIDO #…). O cliente só aperta *enviar*.
- No painel, o botão **💬** de cada pedido abre o WhatsApp da loja com uma mensagem pronta para o cliente: pedido recebido, em preparo, saiu para entrega etc.

Se quiser que o pedido chegue **automaticamente**, sem o cliente apertar enviar, veja a seção 10.

---

## 7. Como alterar produtos e preços

**Pelo painel (recomendado)**

- **🍨 Produtos**: clique no produto para editar nome, preço, foto, descrição, selo ("Mais pedido", "Novidade"…), sabores, se aparece nos "Queridinhos" e se está disponível.
  - O interruptor da lista ativa ou desativa na hora. Prefira **desativar** em vez de excluir quando um item acabar.
- **🥤 Tamanhos**: preço base e quantos ingredientes grátis cada tamanho inclui.
- **🧩 Etapas**: cada etapa do "Monte seu açaí", com mínimo e máximo de escolhas e se entra na cota de grátis.
- **🍓 Ingredientes**: preço de cada complemento, fruta, cobertura etc. Preço 0 ou "Sempre grátis" = sem custo.
- **🏷️ Promoções**: desconto em % ou em R$, pedido mínimo, dias da semana e período. O melhor desconto entra sozinho no carrinho.
- **🛵 Bairros e taxas**: taxa de entrega e minutos extras por bairro.

As mudanças aparecem no site imediatamente, e o servidor já passa a cobrar os novos valores.

**Pelo código**

Edite `server/db/seed.js` e rode `npm run seed`.

> ⚠️ Isso substitui todo o cardápio pelo do arquivo, mas **mantém pedidos, clientes, usuários e configurações**.

---

## 8. Como trocar ou adicionar a logo oficial

A logo oficial já está aplicada:

- `public/assets/brand/logo.webp` e `logo.png`: versão recortada com fundo transparente;
- `logo-sm.webp`: versão pequena para o cabeçalho;
- `logo-original.jpg`: arquivo original.

Para trocar, há dois caminhos:

- **Pelo painel**: **Configurações → Logo → Trocar logo**. PNG ou WEBP com fundo transparente fica melhor.
- **Pelos arquivos**: substitua `logo.webp`, `logo.png` e `logo-sm.webp` em `public/assets/brand/`, mantendo os nomes. Isso troca a logo também na animação de abertura.

Para trocar os ícones (favicon e atalho no celular), substitua `icon-32.png`, `icon-180.png`, `icon-192.png` e `icon-512.png`. A imagem de compartilhamento em redes sociais é `og-image.jpg`, em 1200×630.

---

## 9. Como colocar as fotos reais dos produtos

As imagens atuais são **ilustrações** (marcadas "foto ilustrativa").

- **Pelo painel**: abra o produto (ou tamanho, promoção, foto da galeria) → **📷 Enviar foto** → **Salvar**.
  - Aceita JPG, PNG ou WEBP de até 5 MB.
  - As fotos ficam em `data/uploads/`.
- **Dica de foto**: formato **4:3** (por exemplo 1200×900), produto centralizado e fundo limpo. Se possível, comprima em <https://squoosh.app> antes de enviar, para o site ficar rápido.
- **Galeria**: em **📸 Galeria**, escolha o formato *normal*, *alto* ou *largo* para montar o mosaico.

> Faça backup da pasta `data/` (banco + fotos) regularmente.

---

## 10. O que depende de credenciais ou serviços externos

| Item | Situação | O que é preciso |
|---|---|---|
| **Domínio e HTTPS** | Necessário para publicar | Um domínio e uma hospedagem que rode Node.js 22.5+ (VPS, Render, Railway, Fly.io…). Configure `PUBLIC_URL=https://seudominio.com.br`, `NODE_ENV=production` e, atrás de proxy, `TRUST_PROXY=1`. Atualize também o domínio em `public/robots.txt` e `public/sitemap.xml`. A pasta `data/` precisa de **disco persistente**. |
| **WhatsApp automático** | Opcional, já preparado | Conta no **WhatsApp Business Platform (Cloud API)** da Meta. Preencha `WHATSAPP_CLOUD_TOKEN` e `WHATSAPP_CLOUD_PHONE_ID`. A Meta pode exigir verificação da empresa e modelos de mensagem aprovados. Sem isso, o sistema continua funcionando pelo link do WhatsApp. |
| **Webhook / impressora / automações** | Opcional, já preparado | Uma URL em `ORDER_WEBHOOK_URL` (n8n, Zapier, Make, servidor de impressão térmica). O sistema envia o pedido em JSON a cada evento. |
| **PIX com QR Code automático / pagamento online** | Ainda não incluído | Conta em um gateway (Mercado Pago, PagSeguro, Asaas, Efí…) e suas chaves de API. Hoje o PIX é manual: o cliente recebe a **chave PIX** cadastrada nas Configurações. |
| **Google Maps** | Opcional | Basta colar o link do Google Maps nas Configurações. Não precisa de chave. |
| **Fontes do Google** | Usadas no site | Carregadas do Google Fonts. Sem internet, o site usa fontes do sistema. |

**Pontos de extensão para o futuro**

- **Cupons, programa de fidelidade e login de cliente**: as tabelas `customers` (já registra telefone, nome e número de pedidos) e `promotions` são a base.
- **Relatórios e controle de estoque**: entram como novos cadastros em `server/admin/resources.js`, que o painel monta sozinho.
- **Impressora**: o ponto único é `server/services/notify.service.js`.

---

## 11. Antes de publicar (checklist)

- [ ] Trocar a senha do administrador.
- [ ] Configurar o WhatsApp real da loja, o endereço, os horários, a chave PIX e o Instagram.
- [ ] Revisar produtos, preços, bairros e taxas. Os dados de exemplo são fictícios.
- [ ] Enviar as fotos reais dos produtos.
- [ ] Definir `PUBLIC_URL`, `NODE_ENV=production` e HTTPS.
- [ ] Atualizar o domínio em `robots.txt` e `sitemap.xml`.
- [ ] Agendar backup da pasta `data/`.
