-- View resumo_mensal corrigida (Postgres), para usar no banco original.
--
-- Problema da versão anterior:
--   1. contas JOIN divisoes gera uma linha por pessoa, então SUM(ct.valor)
--      contava cada conta duas vezes (total_casa em dobro).
--   2. contas não era ligada a configuracao.mes_referencia, então todo mês
--      mostrava as mesmas contas.
-- Correção: agregar divisoes por conta antes do JOIN e agrupar pelo mês da conta.
-- Pré-requisito: contas.mes_referencia (ALTER TABLE contas ADD COLUMN mes_referencia char(7)).

CREATE OR REPLACE VIEW resumo_mensal AS
WITH partes AS (
  SELECT d.conta_id,
         SUM(d.percentual) FILTER (WHERE p.ordem = 1) AS pct1,
         SUM(d.percentual) FILTER (WHERE p.ordem = 2) AS pct2
  FROM divisoes d
  JOIN pessoas p ON p.id = d.pessoa_id
  GROUP BY d.conta_id
)
SELECT ct.casal_id,
       ct.mes_referencia,
       SUM(ct.valor)                              AS total_casa,
       SUM(ct.valor * COALESCE(pt.pct1, 0))       AS paga_pessoa1,
       SUM(ct.valor * COALESCE(pt.pct2, 0))       AS paga_pessoa2,
       SUM(ct.valor) FILTER (WHERE ct.pago)       AS total_pago
FROM contas ct
LEFT JOIN partes pt ON pt.conta_id = ct.id
GROUP BY ct.casal_id, ct.mes_referencia;
