// Esquema do banco local (SQLite). Mantém os nomes das tabelas e colunas do
// modelo original (configuracao, contas, divisoes, pessoas) para que a troca
// por Postgres no futuro seja só de driver.

const MIGRATIONS = [
  // v1 — estrutura inicial
  `
  CREATE TABLE casais (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    nome      TEXT NOT NULL DEFAULT 'Nossa casa',
    criado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE pessoas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    casal_id     INTEGER NOT NULL REFERENCES casais(id) ON DELETE CASCADE,
    ordem        INTEGER NOT NULL CHECK (ordem IN (1, 2)),
    nome         TEXT NOT NULL,
    renda_mensal REAL NOT NULL DEFAULT 0 CHECK (renda_mensal >= 0),
    UNIQUE (casal_id, ordem)
  );

  -- Uma linha por casal: mês ativo e preferências.
  CREATE TABLE configuracao (
    casal_id       INTEGER PRIMARY KEY REFERENCES casais(id) ON DELETE CASCADE,
    mes_referencia TEXT NOT NULL,                 -- 'YYYY-MM'
    modo_divisao   TEXT NOT NULL DEFAULT 'proporcional'
                   CHECK (modo_divisao IN ('proporcional', 'igual')),
    meta_moradia   REAL NOT NULL DEFAULT 0.30     -- fração do salário
  );

  CREATE TABLE contas (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    casal_id       INTEGER NOT NULL REFERENCES casais(id) ON DELETE CASCADE,
    mes_referencia TEXT NOT NULL,
    nome           TEXT NOT NULL,
    categoria      TEXT NOT NULL DEFAULT 'casa',
    valor          REAL NOT NULL DEFAULT 0 CHECK (valor >= 0),
    dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
    pago           INTEGER NOT NULL DEFAULT 0,
    recorrente     INTEGER NOT NULL DEFAULT 1,
    criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX ix_contas_mes ON contas (casal_id, mes_referencia);

  -- percentual em fração (0.535 = 53,5%), como na view original (valor * percentual)
  CREATE TABLE divisoes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    conta_id   INTEGER NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
    pessoa_id  INTEGER NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    percentual REAL NOT NULL CHECK (percentual BETWEEN 0 AND 1),
    UNIQUE (conta_id, pessoa_id)
  );

  CREATE TABLE gastos_pessoais (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    pessoa_id      INTEGER NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    mes_referencia TEXT NOT NULL,
    descricao      TEXT NOT NULL,
    valor          REAL NOT NULL DEFAULT 0 CHECK (valor >= 0),
    tipo           TEXT NOT NULL DEFAULT 'fixa' CHECK (tipo IN ('fixa', 'dia_a_dia'))
  );
  CREATE INDEX ix_gastos_mes ON gastos_pessoais (pessoa_id, mes_referencia);

  CREATE TABLE cartoes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    casal_id       INTEGER NOT NULL REFERENCES casais(id) ON DELETE CASCADE,
    nome           TEXT NOT NULL,
    final          TEXT,
    limite         REAL NOT NULL DEFAULT 0,
    dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31)
  );

  CREATE TABLE faturas (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    cartao_id      INTEGER NOT NULL REFERENCES cartoes(id) ON DELETE CASCADE,
    mes_referencia TEXT NOT NULL,
    valor          REAL NOT NULL DEFAULT 0,
    paga           INTEGER NOT NULL DEFAULT 0,
    UNIQUE (cartao_id, mes_referencia)
  );

  CREATE TABLE metas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    casal_id    INTEGER NOT NULL REFERENCES casais(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    tipo        TEXT NOT NULL DEFAULT 'reserva' CHECK (tipo IN ('reserva', 'obra', 'outro')),
    valor_alvo  REAL NOT NULL DEFAULT 0,
    valor_atual REAL NOT NULL DEFAULT 0
  );

  -- View corrigida. A original juntava contas x divisoes direto, então
  -- SUM(ct.valor) contava cada conta uma vez por pessoa (total em dobro), e não
  -- amarrava contas ao mês. Aqui as divisões são agregadas por conta antes.
  CREATE VIEW resumo_mensal AS
  WITH partes AS (
    SELECT d.conta_id,
           SUM(CASE WHEN p.ordem = 1 THEN d.percentual ELSE 0 END) AS pct1,
           SUM(CASE WHEN p.ordem = 2 THEN d.percentual ELSE 0 END) AS pct2
    FROM divisoes d
    JOIN pessoas p ON p.id = d.pessoa_id
    GROUP BY d.conta_id
  )
  SELECT ct.casal_id,
         ct.mes_referencia,
         SUM(ct.valor)                              AS total_casa,
         SUM(ct.valor * COALESCE(pt.pct1, 0))       AS paga_pessoa1,
         SUM(ct.valor * COALESCE(pt.pct2, 0))       AS paga_pessoa2,
         SUM(CASE WHEN ct.pago = 1 THEN ct.valor ELSE 0 END) AS total_pago
  FROM contas ct
  LEFT JOIN partes pt ON pt.conta_id = ct.id
  GROUP BY ct.casal_id, ct.mes_referencia;
  `,

  // v2 (app 1.1) — conta por pessoa e gastos com dono.
  // contas.pessoa_id NULL = conta da casa (dividida); preenchido = gasto só daquela pessoa.
  // Os gastos_pessoais da 1.0 viram contas pessoais e a tabela antiga sai.
  `
  ALTER TABLE contas ADD COLUMN pessoa_id INTEGER REFERENCES pessoas(id) ON DELETE CASCADE;
  CREATE INDEX ix_contas_pessoa ON contas (pessoa_id, mes_referencia);
  ALTER TABLE pessoas ADD COLUMN pin_hash TEXT;

  INSERT INTO contas (casal_id, mes_referencia, nome, categoria, valor, dia_vencimento, pago, recorrente, pessoa_id)
  SELECT p.casal_id, g.mes_referencia, g.descricao,
         CASE g.tipo WHEN 'dia_a_dia' THEN 'mercado' ELSE 'outro' END,
         g.valor, NULL, 0, CASE g.tipo WHEN 'fixa' THEN 1 ELSE 0 END, g.pessoa_id
  FROM gastos_pessoais g JOIN pessoas p ON p.id = g.pessoa_id;

  INSERT INTO divisoes (conta_id, pessoa_id, percentual)
  SELECT id, pessoa_id, 1 FROM contas WHERE pessoa_id IS NOT NULL;

  DROP TABLE gastos_pessoais;

  -- A view passa a considerar só as contas da casa.
  DROP VIEW resumo_mensal;
  CREATE VIEW resumo_mensal AS
  WITH partes AS (
    SELECT d.conta_id,
           SUM(CASE WHEN p.ordem = 1 THEN d.percentual ELSE 0 END) AS pct1,
           SUM(CASE WHEN p.ordem = 2 THEN d.percentual ELSE 0 END) AS pct2
    FROM divisoes d
    JOIN pessoas p ON p.id = d.pessoa_id
    GROUP BY d.conta_id
  )
  SELECT ct.casal_id,
         ct.mes_referencia,
         SUM(ct.valor)                              AS total_casa,
         SUM(ct.valor * COALESCE(pt.pct1, 0))       AS paga_pessoa1,
         SUM(ct.valor * COALESCE(pt.pct2, 0))       AS paga_pessoa2,
         SUM(CASE WHEN ct.pago = 1 THEN ct.valor ELSE 0 END) AS total_pago
  FROM contas ct
  LEFT JOIN partes pt ON pt.conta_id = ct.id
  WHERE ct.pessoa_id IS NULL
  GROUP BY ct.casal_id, ct.mes_referencia;
  `,

  // v3 (app 1.2) — cartões e metas também podem ser de uma pessoa (NULL = da casa/casal).
  `
  ALTER TABLE cartoes ADD COLUMN pessoa_id INTEGER REFERENCES pessoas(id) ON DELETE CASCADE;
  ALTER TABLE metas   ADD COLUMN pessoa_id INTEGER REFERENCES pessoas(id) ON DELETE CASCADE;
  `
];

function migrate(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const atual = db.pragma('user_version', { simple: true });
  for (let v = atual; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

module.exports = { migrate, MIGRATIONS };
