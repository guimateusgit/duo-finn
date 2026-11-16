# Duo Finn — finanças em casal (app desktop)

Programa para Windows que roda só no PC do cliente. A interface (React) conversa com uma
camada local de acesso a dados (Electron + SQLite). Não tem servidor nem internet envolvidos.

```
┌──────────────────────┐   IPC (lista branca)   ┌──────────────────────────┐
│  Interface React     │ ─────────────────────▶ │ electron/repo.cjs        │
│  src/                │   window.duofinn.*     │ regras de negócio        │
└──────────────────────┘                        │ electron/schema.cjs      │
                                                │ tabelas + view resumo_   │
                                                │ mensal  →  duofinn.db    │
                                                └──────────────────────────┘
```

## Gerar o instalador (.exe)

No Windows, com Node 20+ instalado:

```bash
npm install          # instala e já compila o SQLite para o Electron
npm run dist         # gera release/Duo Finn Setup <versão>.exe
```

Entregue o `Duo Finn Setup <versão>.exe` ao cliente. O instalador permite escolher a pasta e
cria o atalho na área de trabalho.

> O Windows SmartScreen vai avisar "editor desconhecido" porque o executável não está
> assinado. O cliente clica em **Mais informações → Executar assim mesmo**. Para tirar o aviso
> é preciso um certificado de assinatura de código (configurável no `electron-builder`).

## Desenvolver

```bash
npm run dev       # Vite + Electron com recarregamento automático
npm run test:db   # testes da camada de dados (Node puro, sem Electron)
npm run build     # checagem de tipos + build da interface
```

## Onde ficam os dados

- Banco: `%APPDATA%\Duo Finn\duofinn.db` (desinstalar ou reinstalar não apaga os dados)
- Backup automático: 1 por dia em `%APPDATA%\Duo Finn\backups\` (guarda os últimos 14)
- Backup manual: **Configurações → Exportar backup / Restaurar backup**

## Banco de dados

Mesmas tabelas do modelo original (`configuracao`, `contas`, `divisoes`, `pessoas`), mais
`casais`, `cartoes`, `faturas` e `metas`. Desde a 1.1, gastos pessoais são `contas` com
`pessoa_id` (a antiga `gastos_pessoais` é migrada e removida). As migrações são versionadas
em `electron/schema.cjs` (`PRAGMA user_version`). Para mudar o esquema, adicione uma entrada
nova ao array `MIGRATIONS`. Nunca edite uma entrada que já existe.

**View `resumo_mensal` corrigida.** A versão anterior somava `ct.valor` depois do JOIN com
`divisoes`, o que contava cada conta uma vez por pessoa (total em dobro). Ela também não
filtrava contas por mês. A versão nova agrega as divisões por conta antes do JOIN. O arquivo
`sql/resumo_mensal_postgres.sql` traz a mesma correção em Postgres. O teste
`view corrigida não duplica o total da casa` demonstra o problema.

`percentual` é fração: `0.535` = 53,5%. Cada conta precisa somar 100% entre as duas pessoas.

## Perfis (1.1)

- Ao abrir, o app pergunta **"Quem está usando?"**. Cada pessoa pode ter um PIN de 4 a 6
  números (criado no cadastro inicial ou em *Nossa renda → Criar PIN*). O PIN é uma trava de
  perfil, não criptografa o banco.
- Todo gasto tem **"De quem é?"**: *Casa (dividir)*, *Só pessoa 1* ou *Só pessoa 2*. No banco,
  isso é `contas.pessoa_id`: `NULL` = casa; preenchido = gasto só daquela pessoa (100% dela,
  fora da divisão e fora da view `resumo_mensal`).
- *Meus gastos* mostra os gastos de quem está logado. No dashboard, clicar num nome (divisão da
  casa, legenda do saldo ou barra lateral) abre os gastos pessoais daquela pessoa.
- Para corrigir um gasto lançado errado como "da casa", basta editar e trocar o "De quem é?".

## Dono em tudo (1.2)

- **Lançamentos** reúne tudo do mês (casa e gastos de cada um), com filtro por dono e situação.
  O dono pode ser trocado direto na tabela (`definirDono`).
- **Cartões** e **metas** também têm dono (`pessoa_id`, `NULL` = da casa/do casal) e filtro.
- *Meus gastos* e a janela aberta ao clicar num nome mostram gastos, cartões e metas da pessoa.

## Atualizar o app no cliente

Aumente `"version"` no `package.json`, rode `npm run dist` e instale o novo `.exe` por cima.
Se a atualização muda o banco, o app guarda uma cópia antes em
`%APPDATA%\Duo Finn\backups\antes-da-atualizacao-vN.db` e migra sozinho. Os testes
incluem um banco real da 1.0 (`tests/fixtures/duofinn-v1.db`) para garantir isso.

## Regras do dia a dia

- **Divisão padrão:** proporcional à renda ou meio a meio (em *Nossa renda*). Cada conta pode
  ter divisão personalizada.
- **Virada de mês:** ao avançar para um mês sem lançamentos, os gastos marcados como "repetir
  todo mês" (da casa e pessoais) são copiados do último mês, todos como não pagos.
- **Saldo previsto (por pessoa):** renda − parte da casa − gastos pessoais.
- **Moradia:** soma das categorias *Aluguel/moradia* e *Condomínio*, comparada com a meta.

## Mudar para Postgres no futuro

Toda a lógica está em `electron/repo.cjs`, que usa SQL portável. Para usar Postgres, troque
`better-sqlite3` por `pg` nesse arquivo (as chamadas viram `async`) e mantenha os nomes dos
métodos. A interface não muda.
