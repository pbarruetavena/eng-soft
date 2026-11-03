# Contrato da API — Gerenciador de Assinaturas

**Versão:** 0.1 (Sprint 1)
**Base URL (desenvolvimento):** `http://localhost:3001`
**Formato:** JSON (`Content-Type: application/json`) em todas as requisições e respostas.

> Este documento é a referência única do contrato entre frontend e backend. Qualquer mudança de rota, campo ou formato deve ser atualizada aqui **antes** de ser implementada, para evitar retrabalho de integração (risco apontado no Sprint 0).
>
> Reflete as rotas reais em `backend/src/routes/`. A seção de documentação da Home (`apiDocs.js`) deve ser mantida em sincronia com este arquivo.

---

## 1. Convenções gerais

- Datas em `YYYY-MM-DD` (ex.: `2026-10-05`), horários em `YYYY-MM-DD HH:mm:ss` quando existirem.
- Valores monetários como `number` (ex.: `39.90`), nunca string.
- IDs são `integer` autoincremento.
- Toda resposta de erro segue o mesmo formato (seção 2).
- Não há autenticação nesta versão (sistema single-user, decisão do Sprint 0).

## 2. Formato padrão de erro

```json
{
  "error": "Mensagem descrevendo o problema"
}
```

| Status | Quando usar |
|---|---|
| 400 | Dados inválidos ou campo obrigatório faltando |
| 404 | Recurso (id) não encontrado |
| 500 | Erro inesperado no servidor |

---

## 3. Recurso: Subscriptions

### Modelo `Subscription`

```json
{
  "id": 1,
  "nome": "Netflix",
  "valor": 39.9,
  "data_cobranca": "2026-10-05",
  "data_inicio": "2026-01-05",
  "categoria": "streaming",
  "status": "ativo",
  "criado_em": "2026-09-26 14:20:00",
  "cancelado_em": null
}
```

| Campo | Tipo | Obrigatório | Observação |
|---|---|---|---|
| id | integer | gerado pelo servidor | — |
| nome | string | sim | não vazio |
| valor | number | sim | maior que 0 (ex.: `39.90`) |
| data_cobranca | string (date) | sim | dia da cobrança/renovação, formato `AAAA-MM-DD` |
| data_inicio | string (date) | sim para novos cadastros | data em que a assinatura começou de fato; usada no gráfico de evolução |
| categoria | string (enum) | sim | ver seção 5 |
| status | string (enum) | gerado pelo servidor | `ativo` \| `cancelado` |
| criado_em | string (datetime) | gerado pelo servidor | data em que o registro foi criado no sistema |
| cancelado_em | string (datetime) \| null | gerado pelo servidor | preenchido no cancelamento |

---

### `GET /subscriptions`

Lista as assinaturas, ordenadas por `data_cobranca` (crescente). Quando não há resultados, devolve uma lista vazia (nunca erro).

**Query params**

| Param | Valores | Padrão | Observação |
|---|---|---|---|
| status | `ativo` \| `cancelado` | `ativo` | filtra por status |

**Exemplo:** `GET /subscriptions?status=ativo`

**Resposta 200**
```json
[
  {
    "id": 1,
    "nome": "Netflix",
    "valor": 39.9,
    "data_cobranca": "2026-10-05",
    "categoria": "streaming",
    "status": "ativo"
  }
]
```
Lista vazia (`[]`) quando não há resultados — **nunca** retorna erro nesse caso. (Campos restantes omitidos no exemplo.)

---

### `POST /subscriptions`

Cria uma nova assinatura com status `"ativo"`.

**Request body**
```json
{
  "nome": "Netflix",
  "valor": 39.90,
  "data_cobranca": "2026-10-05",
  "data_inicio": "2026-01-05",
  "categoria": "streaming"
}
```

**Campos aceitos**

| Campo | Tipo | Descrição |
|---|---|---|
| nome | string | Obrigatório, não pode ser vazio. |
| valor | number | Obrigatório, maior que zero (ex.: `39.90`). |
| data_cobranca | string | Data da cobrança, no formato `AAAA-MM-DD`. |
| data_inicio | string | Data em que a assinatura começou (`AAAA-MM-DD`). Usada no gráfico de evolução. |
| categoria | string | `streaming`, `produtividade`, `jogos`, `academia` ou `outros`. |

**Resposta 201** — objeto criado (modelo `Subscription` completo, com `id`, `status: "ativo"` e `criado_em`).

**Resposta 400** — exemplo:
```json
{ "error": "O campo 'valor' deve ser maior que zero" }
```

---

### `PUT /subscriptions/:id`

Atualiza uma assinatura existente. Usa as mesmas validações do cadastro, e o corpo precisa trazer todos os campos.

**Path params**

| Param | Descrição |
|---|---|
| id | ID da assinatura. |

**Request body** — mesmo formato do `POST`.

**Resposta 200** — objeto atualizado.
**Resposta 400** — mesmas mensagens do `POST`.
**Resposta 404** — `{ "error": "Assinatura não encontrada" }`

---

### `DELETE /subscriptions/:id`
**Alias:** `PATCH /subscriptions/:id/cancel`

Cancela a assinatura (remoção lógica): o `status` vira `"cancelado"` e `cancelado_em` é preenchido. O registro é mantido para o histórico.

**Path params**

| Param | Descrição |
|---|---|
| id | ID da assinatura. |

**Resposta 200**
```json
{
  "id": 1,
  "nome": "Netflix",
  "valor": 39.9,
  "data_cobranca": "2026-10-05",
  "data_inicio": "2026-01-05",
  "categoria": "streaming",
  "status": "cancelado",
  "criado_em": "2026-09-26 14:20:00",
  "cancelado_em": "2026-09-28 10:00:00"
}
```

**Resposta 404** — `{ "error": "Assinatura não encontrada" }` (ID inexistente ou assinatura já cancelada).

---

## 4. Resumo e cobranças

### `GET /subscriptions/summary`

Soma dos valores e quantidade das assinaturas ativas. Sem assinaturas, devolve zeros.

**Resposta 200**
```json
{
  "totalMensal": 129.7,
  "quantidadeAtivas": 4
}
```

**Resposta 500**
```json
{ "error": "Não foi possível calcular o resumo das assinaturas." }
```

---

### `GET /subscriptions/upcoming-charges`

Lista as assinaturas ativas cuja próxima cobrança acontece exatamente daqui a N dias (`N = NOTIFY_DAYS_BEFORE` no `.env`, padrão 3).

**Query params**

| Param | Valores | Padrão | Observação |
|---|---|---|---|
| date | `AAAA-MM-DD` | hoje (UTC) | Data de referência. Opcional. |

**Resposta 200**
```json
[
  {
    "id": 1,
    "nome": "Netflix",
    "valor": 39.9,
    "proximaCobranca": "2026-10-05",
    "diasRestantes": 3
  }
]
```

**Resposta 400**
```json
{ "error": "Parâmetro \"date\" inválido. Use o formato YYYY-MM-DD (ex: 2026-02-25)." }
```

**Resposta 500**
```json
{ "error": "Não foi possível calcular as próximas cobranças." }
```

---

### `POST /subscriptions/notify-upcoming`

Dispara manualmente o envio de e-mails de lembrete para as cobranças próximas. Útil para testar o SMTP sem esperar o agendamento. Se um envio falhar, o erro aparece em `resultados` (`sucesso: false`) e a resposta continua 200.

**Resposta 200**
```json
{
  "sucesso": true,
  "quantidade": 1,
  "resultados": [
    {
      "id": 1,
      "nome": "Netflix",
      "diasRestantes": 3,
      "sucesso": true,
      "messageId": "<abc123@smtp>"
    }
  ]
}
```

**Resposta 500**
```json
{
  "sucesso": false,
  "erro": "Não foi possível disparar as notificações."
}
```

---

## 5. Categorias

Enum fixo, validado no `POST` e `PUT` de subscriptions:

```
streaming | produtividade | jogos | academia | outros
```

---

## 6. Estatísticas

### `GET /stats/monthly-evolution`

Gasto total por mês nos últimos 12 meses, em ordem cronológica. Considera `data_inicio` e `cancelado_em` de cada assinatura. Suporta US7.

**Resposta 200**
```json
[
  { "mes": "2026-08", "total": 89.8 },
  { "mes": "2026-09", "total": 129.7 }
]
```

- `mes` no formato `YYYY-MM`, ordem cronológica crescente.
- Meses sem nenhuma assinatura ativa retornam `"total": 0` (não pulam o mês).

**Resposta 500**
```json
{ "error": "Não foi possível calcular o histórico mensal de gastos." }
```

---

### `GET /stats/by-category`

Total gasto por categoria, considerando apenas assinaturas ativas. Sempre devolve as 5 categorias, mesmo com total 0. Suporta US8.

**Resposta 200**
```json
[
  { "categoria": "streaming", "total": 79.8 },
  { "categoria": "produtividade", "total": 49.9 },
  { "categoria": "jogos", "total": 0 },
  { "categoria": "academia", "total": 0 },
  { "categoria": "outros", "total": 0 }
]
```

- Retorna todas as categorias do enum, mesmo com `total: 0` (o frontend decide se omite as zeradas no gráfico).
- A soma de todos os `total` deve bater com `totalMensal` do `/subscriptions/summary`.

**Resposta 500**
```json
{ "error": "Não foi possível calcular os gastos por categoria." }
```

---

## 7. Sistema

### `GET /health`

Retorna 200 quando o servidor está funcionando.

**Resposta 200**
```json
{ "status": "ok" }
```

---

## 8. Resumo de rotas

| Método | Rota | História | Descrição |
|---|---|---|---|
| GET | `/health` | S1 | Verifica se a API está no ar |
| GET | `/subscriptions` | US2 | Lista assinaturas |
| POST | `/subscriptions` | US1 | Cria assinatura |
| PUT | `/subscriptions/:id` | US5 | Edita assinatura |
| DELETE | `/subscriptions/:id` | US6 | Cancela assinatura (lógico) |
| PATCH | `/subscriptions/:id/cancel` | US6 | Alias para o cancelamento |
| GET | `/subscriptions/summary` | US3 | Total mensal e quantidade ativas |
| GET | `/subscriptions/upcoming-charges` | US4 | Cobranças nos próximos N dias |
| POST | `/subscriptions/notify-upcoming` | US4 | Disparo manual dos e-mails de lembrete |
| GET | `/stats/monthly-evolution` | US7 | Série mensal de gastos |
| GET | `/stats/by-category` | US8 | Total por categoria |


