const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { migrate } = require('../electron/schema.cjs');
const { createRepo } = require('../electron/repo.cjs');

function novoRepo() {
  const db = new Database(':memory:');
  migrate(db);
  const repo = createRepo(db);
  repo.configurarCasal({
    nomeCasal: 'Casa teste',
    mes: '2026-11',
    pessoas: [{ nome: 'Ana', renda_mensal: 10700 }, { nome: 'Beto', renda_mensal: 9300 }]
  });
  return { db, repo };
}

test('divisão proporcional à renda', () => {
  const { repo } = novoRepo();
  const [p1, p2] = repo.percentuaisPadrao();
  assert.equal(p1.percentual, 0.535);
  assert.equal(p2.percentual, 0.465);
});

test('view corrigida não duplica o total da casa', () => {
  const { db, repo } = novoRepo();
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Aluguel', valor: 3000, dia_vencimento: 5 });
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Luz', valor: 400, dia_vencimento: 10, categoria: 'raio' });
  const r = repo.resumo('2026-11');
  assert.equal(r.total_casa, 3400);
  assert.equal(r.paga_pessoa1, 1819);  // 3400 * 0.535
  assert.equal(r.paga_pessoa2, 1581);
  assert.equal(r.paga_pessoa1 + r.paga_pessoa2, r.total_casa);

  // A view original (mesma lógica de JOIN) contaria o total em dobro:
  const original = db.prepare(`
    SELECT SUM(ct.valor) AS total FROM contas ct JOIN divisoes d ON d.conta_id = ct.id
  `).get();
  assert.equal(original.total, 6800);
});

test('divisão que não soma 100% é recusada', () => {
  const { repo } = novoRepo();
  const ps = repo.estado().pessoas;
  assert.throws(() => repo.salvarConta({
    mes_referencia: '2026-11', nome: 'X', valor: 10,
    divisoes: [{ pessoa_id: ps[0].id, percentual: 0.5 }, { pessoa_id: ps[1].id, percentual: 0.3 }]
  }), /100%/);
});

test('abrir mês novo copia contas recorrentes sem marcar como pagas', () => {
  const { repo } = novoRepo();
  const a = repo.salvarConta({ mes_referencia: '2026-11', nome: 'Aluguel', valor: 3000, pago: true });
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Presente', valor: 200, recorrente: false });
  assert.equal(a.pago, true);
  const r = repo.definirMes('2026-12');
  assert.equal(r.criadas, 1);
  const dez = repo.listarContas('2026-12');
  assert.equal(dez.length, 1);
  assert.equal(dez[0].nome, 'Aluguel');
  assert.equal(dez[0].pago, false);
  assert.equal(dez[0].divisoes.length, 2);
  // voltar para um mês que já tem contas não duplica nada
  assert.equal(repo.definirMes('2026-11').criadas, 0);
});

test('sobra por pessoa desconta casa e gastos pessoais', () => {
  const { repo } = novoRepo();
  const [ana] = repo.estado().pessoas;
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Aluguel', valor: 2000, categoria: 'casa' });
  repo.salvarGasto({ pessoa_id: ana.id, mes_referencia: '2026-11', descricao: 'Academia', valor: 150, tipo: 'fixa' });
  repo.salvarGasto({ pessoa_id: ana.id, mes_referencia: '2026-11', descricao: 'Mercado', valor: 800, tipo: 'dia_a_dia' });
  const r = repo.resumo('2026-11');
  const pa = r.pessoas[0];
  assert.equal(pa.parte_casa, 1070);
  assert.equal(pa.sobra, 10700 - 1070 - 150 - 800);
  assert.equal(r.moradia.valor, 2000);
});

test('cartões trazem 4 meses de faturas e limite disponível', () => {
  const { repo } = novoRepo();
  const id = repo.salvarCartao({ nome: 'Nubank', final: '1234', limite: 10000, dia_vencimento: 5 });
  repo.salvarFatura({ cartao_id: id, mes_referencia: '2026-12', valor: 2500 });
  repo.salvarFatura({ cartao_id: id, mes_referencia: '2026-12', valor: 2600 }); // upsert
  const [c] = repo.listarCartoes('2026-11');
  assert.deepEqual(c.faturas.map((f) => f.mes_referencia), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.equal(c.faturas[1].valor, 2600);
  assert.equal(c.disponivel, 7400);
});

test('histórico lê da view, mês mais recente primeiro', () => {
  const { repo } = novoRepo();
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Aluguel', valor: 3000 });
  repo.definirMes('2026-12');
  const h = repo.historico();
  assert.deepEqual(h.map((x) => x.mes_referencia), ['2026-12', '2026-11']);
});

test('mês novo herda gastos pessoais fixos, não os do dia a dia', () => {
  const { repo } = novoRepo();
  const [ana] = repo.estado().pessoas;
  repo.salvarGasto({ pessoa_id: ana.id, mes_referencia: '2026-11', descricao: 'Academia', valor: 150, tipo: 'fixa' });
  repo.salvarGasto({ pessoa_id: ana.id, mes_referencia: '2026-11', descricao: 'Mercado', valor: 800, tipo: 'dia_a_dia' });
  repo.definirMes('2026-12');
  const dez = repo.listarGastos('2026-12');
  assert.deepEqual(dez.map((g) => g.descricao), ['Academia']);
});
