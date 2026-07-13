# Gestão_Regional-CRM - TODO

## Backend & Infraestrutura
- [x] Schema do banco de dados (SQLite + Drizzle ORM) com todas as tabelas
- [x] Migração automática ao iniciar servidor
- [x] Seed de dados realistas (22 representantes, 59 clientes, 60 oportunidades, 4 regiões, 50 atividades, 5 automações, 3 alertas)
- [x] Autenticação com email/senha (usuário admin: claudiolx.nunes@gmail.com / Clxn@032461)
- [x] tRPC routers para todos os módulos (15 testes unitários passando)

## Frontend - Layout Base
- [x] DashboardLayout com sidebar de navegação (16 módulos)
- [x] Tema visual (verde agro + azul profissional)
- [x] Página de login
- [x] Proteção de rotas autenticadas

## Módulo 1: Dashboard Executivo
- [x] KPIs (representantes, clientes ativos, oportunidades, pipeline R$)
- [x] Gráfico de tendência de receita 12 meses (Recharts)
- [x] Pipeline por estágio (donut chart)
- [x] Performance por região (bar chart)
- [x] Ranking de representantes
- [x] Filtros por região

## Módulo 2: Gestão de Representantes
- [x] Listagem com busca e filtros
- [x] Cadastro/edição completo
- [x] Histórico de vendas 12 meses
- [x] Performance score e comparação com média
- [x] Recomendações IA

## Módulo 3: Carteira de Clientes
- [x] Listagem (Fazendas de Ruminantes e Fábricas de Ração)
- [x] Cadastro/edição completo
- [x] Histórico de compras
- [x] Segmentação e análise geográfica

## Módulo 4: Pipeline de Oportunidades
- [x] Kanban drag-and-drop com 6 estágios (Prospecting, Qualification, Proposal, Negotiation, Won, Lost)
- [x] Criação/edição de oportunidades
- [x] Análise preditiva de probabilidade de fechamento

## Módulo 5: Sistema de Metas
- [x] Metas por região e representante
- [x] Acompanhamento de progresso com barra
- [x] Status (No Caminho / Em Risco / Superada)
- [x] Alertas de desvio

## Módulo 6: Atividades e Interações
- [x] Registro de visitas, ligações, emails, propostas, reuniões
- [x] Timeline de atividades com 50 registros
- [x] Filtros por tipo e status

## Módulo 7: Relatórios e Análises
- [x] Performance por representante (score e vendas)
- [x] Tendências de vendas
- [x] Análise de pipeline
- [x] Segmentação de clientes
- [x] Comparativo regional

## Módulo 8: IA Insights
- [x] Análise preditiva com métricas (projeção 90 dias, taxa conversão, ciclo médio, ticket médio)
- [x] Insights gerados automaticamente (5 insights)
- [x] Top representantes
- [x] Metas em risco
- [x] Oportunidades de alto valor

## Módulo 9: Registro Rápido Mobile (Registro de Campo)
- [x] Formulário simplificado para campo
- [x] Interface responsiva mobile
- [x] Atividades recentes

## Módulo 10: Mapa Geográfico
- [x] Visualização de clientes por região (SP, MG, RJ, Outras)
- [x] Cards de resumo por região com clientes, representantes e receita
- [x] Gráfico de distribuição regional
- [x] Tipos de cliente (Fazendas de Ruminantes e Fábricas de Ração)

## Módulo 11: Alertas e Notificações
- [x] Centro de notificações com abas (Não lidas, Todas, Lidas)
- [x] Alertas de meta em risco, oportunidade de alto valor, atividade pendente
- [x] Marcar como lida / Marcar todas como lidas

## Módulo 12: Preferências de Notificação
- [x] Configuração de notificações (5 tipos de alerta)
- [x] Filtros padrão (região, período)
- [x] Modo compacto e animações
- [x] Informações do sistema

## Módulo 13: Importação de Dados
- [x] Upload de CSV/XLSX
- [x] Abas para Clientes, Representantes e Oportunidades
- [x] Template para download
- [x] Dicas de importação

## Módulo 14: Analytics Avançada
- [x] Forecast 90 dias (R$ 3.0M)
- [x] Funil de vendas (FunnelChart)
- [x] Heatmap de atividades por tipo
- [x] Métricas avançadas (taxa conversão 42%, ciclo 45 dias, ticket R$32K)
- [x] Performance dos representantes
- [x] Análise do pipeline por estágio

## Módulo 15: Automações
- [x] Configuração de workflows (5 automações pré-configuradas)
- [x] Triggers (oportunidade criada, meta em risco, ciclo longo, cliente inativo, alto valor)
- [x] Ativar/desativar automações
- [x] Criar nova automação

## Módulo 16: Filtros Interativos
- [x] Filtros por período, região, representante, tipo de cliente
- [x] Persistência em localStorage
- [x] Filtros em todos os módulos principais

## Deploy
- [x] 15 testes unitários passando
- [x] Checkpoint final salvo
- [x] Deploy com link público

## Correção de Deploy
- [x] Substituir better-sqlite3 por @libsql/client (sem binários nativos)
- [x] Atualizar drizzle/schema.ts para usar libSQL
- [x] Atualizar server/db.ts para usar libSQL
- [x] Atualizar server/migrate-and-seed.ts para libSQL
- [x] Atualizar drizzle.config.ts para libSQL
- [x] Atualizar routers.ts para compatibilidade com libSQL
- [x] Executar testes e verificar todos os módulos
- [x] Redeploy público com link funcional

## Correções de Compatibilidade Mobile
- [ ] Adicionar translate="no" e class="notranslate" no index.html para bloquear Google Tradutor
- [ ] Melhorar ErrorBoundary global com recuperação graceful
- [ ] Corrigir erro na aba "Regiões" (dados nulos ou rota quebrada)
- [ ] Verificar todos os módulos com dados nulos/undefined
- [ ] Redeploy público após correções

## Melhorias v2 - CRUD Completo + IA Real

- [ ] Backend: procedures tRPC create/update/delete para Representantes
- [ ] Backend: procedures tRPC create/update/delete para Clientes
- [ ] Backend: procedures tRPC create/update/delete para Oportunidades
- [ ] Backend: procedures tRPC create/update/delete para Vendas/Histórico
- [ ] Backend: router IA Insights com OpenAI gpt-4.1-mini
- [ ] Frontend: formulário modal criar/editar/excluir Representantes
- [ ] Frontend: formulário modal criar/editar/excluir Clientes
- [ ] Frontend: formulário modal criar/editar/excluir Oportunidades
- [ ] Frontend: botões editar/excluir nos cards do Pipeline Kanban
- [ ] Frontend: formulário modal criar/editar/excluir Vendas (Histórico)
- [ ] Frontend: IA Insights com análises reais via OpenAI (cobertura, metas, desempenho)
- [ ] Testes unitários atualizados
- [ ] Redeploy público

## Perfil Completo de Clientes

- [ ] Schema: adicionar campos animalCount, animalTypes, productionType, purchasePotential ao clients
- [ ] Backend: procedure getClientProfile com atividades + compras + representante
- [ ] Backend: delete para representantes e clientes
- [ ] Backend: CRUD para salesHistory
- [ ] Frontend: cards de clientes com informações visuais completas
- [ ] Frontend: modal/página de perfil completo do cliente (atividades, compras, contato, animais)
- [ ] Frontend: formulário criar/editar cliente com todos os campos novos
- [ ] Frontend: formulário criar/editar representante
- [ ] Frontend: formulário criar/editar oportunidade no Pipeline Kanban
- [ ] Frontend: formulário criar/editar vendas no histórico
- [ ] Frontend: IA Insights com OpenAI gpt-4.1-mini real

## Correções e Novas Funcionalidades (Sessão Atual)

- [x] Testar formulários de cadastro (cliente, representante, oportunidade) no dev
- [x] Adicionar todos os 27 estados do Brasil nos formulários e seed
- [x] Implementar importação inteligente de Excel/CSV com mapeamento automático via IA
- [x] Backend: tRPC procedure para processar upload Excel, mapear colunas com LLM
- [x] Frontend: botão "Importar Excel" na página de Clientes com modal de preview
- [x] Corrigir autenticação (upsertUser falhava quando openId era null)
- [x] Corrigir migrate-and-seed.ts (process.exit matava o servidor)
- [x] Migrar schema de SQLite para MySQL (produção usa MySQL TiDB)
- [x] Gestor regional pode cadastrar seus próprios clientes e oportunidades
- [x] Redeploy público com todas as correções

## Relatório Diário Mobile (/campo)

- [ ] Schema: tabela dailyReports para consolidar relatórios diários
- [ ] Backend: dailyReportRouter (create, list, getByDate, getSummary)
- [ ] Backend: salesHistoryRouter CRUD completo
- [ ] Backend: purchasesRouter CRUD completo
- [ ] Backend: aiInsights com OpenAI gpt-4.1-mini real
- [ ] Frontend: página /campo (mobile-first) com login simplificado
- [ ] Frontend: card de atividades do dia (visitas, ligações, propostas, pedidos)
- [ ] Frontend: botão "Enviar Relatório do Dia" com resumo
- [ ] Frontend: feed de atividades no painel do gerente
- [ ] Frontend: alertas de representantes sem relatório
- [ ] Frontend: rota /campo no App.tsx sem DashboardLayout

## Acesso Automático para Representantes

- [x] Schema: adicionar campo userId (FK para users) na tabela representatives
- [x] Schema: adicionar campo initialPassword (texto) na tabela representatives para exibir credenciais
- [x] Backend: ao criar representante, criar usuário automaticamente com email e senha gerada
- [x] Backend: ao editar representante (mudança de email), atualizar usuário vinculado
- [x] Backend: procedure getRepCredentials para retornar email + senha inicial
- [x] Backend: procedure resetRepPassword para gerar nova senha
- [x] Frontend: badge "Tem Acesso" / "Sem Acesso" nos cards de representante
- [x] Frontend: botão "Acesso" com modal mostrando email e senha inicial
- [x] Frontend: botão "Redefinir Senha" com criação automática de conta
- [x] /campo: isolamento de dados via getRepByUserId
- [ ] Redeploy público após implementação

## Envio de Email de Credenciais via Resend

- [x] Instalar pacote resend no backend
- [x] Configurar variáveis de ambiente (RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME)
- [x] Implementar função de envio de email com template HTML bonito
- [x] Integrar envio de email na procedure resetPassword
- [x] Adicionar CC para claudio.nunes@bpfconsult.com.br em todos os emails
- [x] Adicionar feedback visual no frontend (mensagem "Email enviado para...")
- [ ] Testar envio de email com representante real
- [ ] Redeploy público com envio de email funcionando

## Histórico de Relatórios no /campo

- [x] Schema: tabela dailyReports já existe (representativeId, date, activitiesCount, status)
- [x] Backend: procedure getRecentReports para listar últimos 7 dias
- [x] Frontend: exibir histórico de relatórios no /campo (últimos 7 dias)
- [x] Frontend: cada dia mostra data, número de atividades, status "Enviado" ou "Pendente"
- [ ] Testar histórico de relatórios no /campo
- [ ] Redeploy público com histórico funcionando

## Responsividade Mobile/Tablet

- [x] Sidebar: menu hambúrguer no mobile, colapsado no tablet, normal no desktop
- [x] Dashboard: KPIs em 2 colunas no mobile, gráficos responsivos, tabelas com scroll
- [x] Formulários: campos em coluna única no mobile
- [x] Modais: tela cheia no mobile
- [x] Botões: mínimo 44px para toque
- [x] Pipeline Kanban: scroll horizontal no mobile
- [x] Tabelas: scroll horizontal ou layout de cards no mobile
- [x] Tipografia: mínimo 14px no mobile, espaçamentos adequados
- [x] Páginas corrigidas: Representantes, Clientes, Atividades, Metas, Automações, RegistroMobile, Relatorios, Preferencias, Oportunidades
- [ ] Redeploy público após correções

## Importação de Excel Melhorada (Grandes Volumes)

- [x] Backend: procedure importClients com processamento em lotes (chunks de 100)
- [x] Backend: mapeamento inteligente de colunas via IA (GPT-4.1-mini)
- [x] Backend: suporte para .xlsx, .xls e .csv
- [x] Backend: remover limite de registros — suportar qualquer volume
- [x] Backend: retornar resumo (X importados, Y erros) com lista de erros
- [x] Frontend: modal de importação com preview das primeiras 5 linhas
- [x] Frontend: permitir ajuste manual do mapeamento de colunas
- [x] Frontend: barra de progresso "Importando X de Y clientes..."
- [x] Frontend: suporte para 3 tipos de cliente (Fazenda, Fábrica, Revenda)
- [x] Frontend: resumo final com lista de erros se houver
- [ ] Testar importação com 1000+ registros
- [ ] Redeploy público com importação melhorada

## Importação de Histórico de Vendas (Nova)

- [x] Schema: verificar campos em salesHistory (cliente, representante, produto, valor, data, região)
- [x] Backend: procedure importSalesHistory com lotes e mapeamento IA
- [x] Backend: validar referências (cliente, representante, região)
- [x] Frontend: página "Importar Dados" com abas para Clientes e Vendas
- [x] Frontend: abas para Clientes, Vendas
- [x] Frontend: barra de progresso para importação de vendas
- [x] Frontend: resumo final com erros
- [ ] Testar: dados importados devem aparecer em Relatórios e Dashboard
- [ ] Redeploy público

## Estados Dinâmicos no Dashboard

- [x] Backend: procedure getAvailableStates (retorna apenas estados com dados)
- [ ] Backend: procedure getStatesByType (clientes, vendas, representantes)
- [ ] Frontend: Dashboard carrega estados dinamicamente
- [ ] Frontend: Mapa Geográfico mostra apenas estados com dados
- [ ] Frontend: Filtros mostram apenas estados com dados
- [ ] Frontend: Formulários de cadastro mostram todos os 27 estados
- [ ] Frontend: ao cadastrar novo cliente/venda, estado aparece automaticamente
- [ ] Testar: adicionar cliente em novo estado, verificar se aparece no dashboard
- [ ] Redeploy público

## Correção de Sobreposição no Menu Mobile

- [x] Verificar problema de sobreposição de itens no menu mobile
- [x] Corrigir DashboardLayout.tsx - altura mínima 48px para itens
- [x] Corrigir espaçamento entre itens do menu
- [x] Corrigir sobreposição de labels de seção com itens
- [x] Garantir que cada item ocupe sua própria linha
- [x] Adicionar scroll vertical se necessário
- [ ] Testar todos os 18 itens visíveis e clicáveis
- [ ] Redeploy público com visibility public

## Compartilhamento de Credenciais via WhatsApp

- [x] Analisar modal de Acesso na página de Representantes
- [x] Implementar botão "Compartilhar via WhatsApp"
- [x] Implementar botão "Copiar credenciais"
- [x] Mensagem pré-formatada com: nome, link, email, senha
- [ ] Testar compartilhamento via WhatsApp
- [ ] Testar cópia para clipboard
- [ ] Redeploy público com visibility public

## QR Code de Acesso Rápido

- [x] Instalar biblioteca qrcode.react
- [x] Implementar geração de QR Code no modal de Credenciais
- [x] QR Code abre /campo com email pré-preenchido
- [x] Título "Escaneie para acessar o app"
- [x] QR Code aparece abaixo dos botões WhatsApp e Copiar
- [ ] Testar escaneamento em dispositivo real
- [ ] Redeploy público com visibility public

## Download de QR Code

- [x] Implementar botão "Baixar QR Code"
- [x] Exportar QR Code como PNG
- [x] Nome do arquivo com nome do representante (ex: qrcode-joao-silva.png)
- [x] Usar canvas ou API de download do navegador
- [ ] Testar download em diferentes navegadores
- [ ] Redeploy público com visibility public

## Melhorias Identificadas na Auditoria

- [x] Formulário de cadastro de novas metas (modal com representante, tipo, valor, período, descrição)
- [ ] Filtro de datas nas atividades (hoje, semana, mês, personalizado)
- [ ] Exportação de relatórios em PDF
- [ ] IA Insights com análises reais do banco
- [ ] Analytics com gráficos completos com dados reais
- [ ] App /campo para representantes (garantir que atividades salvam no banco)
- [ ] Automações: alerta de meta em risco
- [ ] Automações: lembrete de follow-up
- [ ] Automações: relatório semanal automático
- [ ] Redeploy público com visibility public

## ProtectedRoute e LicenseGate

- [ ] Analisar estrutura atual de rotas e autenticação
- [ ] Criar tabela de licenças no banco (user_id, plano, status, data_inicio, data_fim)
- [ ] Implementar componente ProtectedRoute
- [ ] Implementar componente LicenseGate
- [ ] Envolver todas as rotas com ProtectedRoute + LicenseGate
- [ ] Testar autenticação e licenças
- [ ] Redeploy público com visibility public

## ProtectedRoute e LicenseGate

- [x] Criar tabela de licenças no banco de dados (plan, status, startDate, endDate)
- [x] Implementar componente ProtectedRoute que verifica autenticação
- [x] Implementar componente LicenseGate que verifica licença ativa
- [x] Adicionar licensesRouter com procedure licenses.getCurrent
- [x] Envolver todas as rotas com ProtectedRoute + LicenseGate
- [ ] Testar autenticação e licenças, fazer redeploy público

## Filtro de Período nas Atividades

- [x] Adicionar select de período (Hoje, Esta Semana, Este Mês, Todos)
- [x] Implementar lógica de filtro por data
- [x] Atualizar contadores (Visitas, Ligações, Pendentes, Concluídas) com filtro
- [x] Atualizar listagem para mostrar apenas atividades do período selecionado
- [ ] Testar filtro em diferentes períodos
- [ ] Redeploy público com visibility public

## Exportação de Relatórios em PDF

- [x] Instalar bibliotecas jspdf e html2canvas
- [x] Implementar botão "Exportar PDF" na página de Relatórios
- [x] Capturar gráficos e dados visíveis
- [x] Gerar PDF com título e data
- [x] Permitir download do arquivo
- [ ] Testar exportação em diferentes navegadores
- [ ] Redeploy público com visibility public

## Dashboard de Administração

- [ ] Adicionar campo 'role' na tabela users (admin, superadmin, user)
- [ ] Criar tabela de histórico de acessos (user_id, login_at, ip_address)
- [ ] Backend: procedure users.getAll com filtro de role
- [ ] Backend: procedure licenses.create/update/renew/cancel para admin
- [ ] Backend: procedure loginHistory.getByUser para histórico de acessos
- [ ] Frontend: página /admin com lista de usuários e licenças
- [ ] Frontend: modais para criar, renovar, cancelar e editar licenças
- [ ] Frontend: tabela de histórico de acessos (último login, total de logins)
- [ ] Frontend: menu lateral mostra "Admin" apenas para superadmin
- [ ] Testar acesso com claudiolx.nunes@gmail.com como superadmin
- [ ] Redeploy público com visibility public

## Importação de Dados Excel (Sessão Atual)

- [x] Importar data(68).xlsx (113 linhas faturamento) — 0 novos (já existiam)
- [x] Importar data(69).xlsx (888 linhas faturamento/pedidos) — 4 novas vendas
- [x] Corrigir coluna uf em sales_invoices para VARCHAR(50) (nomes completos de estados)
- [x] Adicionar colunas uf, municipio, regiao em open_orders
- [x] Importar CópiadeMetas2026.xlsx (156 linhas) — 1.834 metas inseridas para 15 representantes
- [x] Inserir representante 001422 (JOSE NETO-ONIX) que faltava no banco
- [x] Importar ClientesAtivos02.2026.xlsx (355 registros) — 126 novos + 226 atualizados
- [x] Importar ClientesInativos02.2026.xlsx (535 registros) — 451 novos + 81 atualizados
- [x] Popular campos geográficos (uf, municipio, regiao) em 100% das 886 vendas
- [x] Checkpoint e redeploy em produção


## Refatoração v3 - Metas, ABC, Alertas e Dashboard (Sessão Atual)

- [x] Analisar arquivo MetasFAT.XVOL.2026 (estrutura e diferenças)
- [x] Atualizar schema: adicionar colunas para curva ABC (productABCClass, clientABCClass, repABCClass)
- [x] Atualizar schema: adicionar coluna lastPurchaseStatus em clients (active/inactive_6months)
- [x] Importar metas corrigidas de MetasFAT.XVOL.2026
- [x] Implementar procedure goals.getTotalByRep (totalização sem deduplicação por solução/subsolução)
- [x] Implementar procedure goals.getByRepWithDrilldown (drill-down representante → solução → subsolução)
- [x] Implementar curva ABC para produtos (baseado em volume/faturamento)
- [x] Implementar curva ABC para representantes (baseado em faturamento)
- [x] Implementar curva ABC para clientes (baseado em faturamento)
- [x] Implementar procedure sales.getSummaryByRegion (soma por região)
- [x] Implementar procedure sales.getSummaryByRep (soma por representante)
- [x] Implementar procedure sales.getMetrics (desconto médio, preço médio, ticket médio)
- [x] Implementar procedure clients.getByRepWithStatus (clientes por representante, separando ativos/inativos)
- [x] Implementar procedure clients.getInactiveAlerts (clientes com 6+ meses sem compra)
- [x] Criar tabela inactivityAlerts para rastrear alertas de clientes inativos
- [ ] Implementar procedure alerts.createInactivityAlert (criar alerta quando cliente fica inativo)
- [x] Atualizar dashboard com KPIs: vendas geral, carteira, desconto médio, preço médio, ticket médio
- [x] Criar página DashboardV2 com abas por representante (ativos/inativos)
- [ ] Criar página Metas com drill-down por representante
- [ ] Criar página Produtos com curva ABC
- [ ] Criar página Alertas com notificações de clientes inativos
- [ ] Fazer checkpoint e redeploy em produção
