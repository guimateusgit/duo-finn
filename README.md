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
npm run dist         # gera release/Duo Finn Setup 1.0.0.exe
```

Entregue o `Duo Finn Setup 1.0.0.exe` ao cliente. O instalador permite escolher a pasta e
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
`casais`, `gastos_pessoais`, `cartoes`, `faturas` e `metas`. As migrações são versionadas
em `electron/schema.cjs` (`PRAGMA user_version`). Para mudar o esquema, adicione uma entrada
nova ao array `MIGRATIONS`. Nunca edite uma entrada que já existe.

**View `resumo_mensal` corrigida.** A versão anterior somava `ct.valor` depois do JOIN com
`divisoes`, o que contava cada conta uma vez por pessoa (total em dobro). Ela também não
filtrava contas por mês. A versão nova agrega as divisões por conta antes do JOIN. O arquivo
`sql/resumo_mensal_postgres.sql` traz a mesma correção em Postgres. O teste
`view corrigida não duplica o total da casa` demonstra o problema.

`percentual` é fração: `0.535` = 53,5%. Cada conta precisa somar 100% entre as duas pessoas.

## Regras do dia a dia

- **Divisão padrão:** proporcional à renda ou meio a meio (em *Nossa renda*). Cada conta pode
  ter divisão personalizada.
- **Virada de mês:** ao avançar para um mês sem contas, as contas marcadas como "repetir todo
  mês" e os gastos pessoais fixos são copiados do último mês, todos como não pagos.
- **Saldo previsto:** renda − parte da casa − contas pessoais − dia a dia.
- **Moradia:** soma das categorias *Aluguel/moradia* e *Condomínio*, comparada com a meta.

## Mudar para Postgres no futuro

Toda a lógica está em `electron/repo.cjs`, que usa SQL portável. Para usar Postgres, troque
`better-sqlite3` por `pg` nesse arquivo (as chamadas viram `async`) e mantenha os nomes dos
métodos. A interface não muda.
