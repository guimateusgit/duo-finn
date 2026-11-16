const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { migrate } = require('../electron/schema.cjs');
const { createRepo } = require('../electron/repo.cjs');

function novoRepo(pins = [null, null]) {
  const db = new Database(':memory:');
  migrate(db);
  const repo = createRepo(db);
  repo.configurarCasal({
    nomeCasal: 'Casa teste',
    mes: '2026-11',
    pessoas: [{ nome: 'Ana', renda_mensal: 10700, pin: pins[0] }, { nome: 'Beto', renda_mensal: 9300, pin: pins[1] }]
  });
  const [ana, beto] = repo.estado().pessoas;
  return { db, repo, ana, beto };
}

test('divisão proporcional à renda', () => {
  const { repo } = novoRepo();
  const [p1, p2] = repo.percentuaisPadrao();
  assert.equal(p1.percentual, 0.535);
  assert.equal(p2.percentual, 0.465);
});

test('view corrigida não duplica o total da casa', () => {
  const { repo } = novoRepo();
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Aluguel', valor: 3000, dia_vencimento: 5 });
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Luz', valor: 400, dia_vencimento: 10, categoria: 'raio' });
  const r = repo.resumo('2026-11');
  assert.equal(r.total_casa, 3400);
  assert.equal(r.paga_pessoa1, 1819);
  assert.equal(r.paga_pessoa2, 1581);
});

test('gasto pessoal não entra na casa nem aparece para o outro', () => {
  const { repo, ana, beto } = novoRepo();
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Aluguel', valor: 2000, categoria: 'casa' });
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Academia', valor: 150, pessoa_id: ana.id });
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Curso', valor: 300, pessoa_id: beto.id, pago: true });

  assert.deepEqual(repo.listarContas('2026-11').map((c) => c.nome), ['Aluguel']);
  assert.deepEqual(repo.listarContas('2026-11', ana.id).map((c) => c.nome), ['Academia']);
  assert.deepEqual(repo.listarContas('2026-11', beto.id).map((c) => c.nome), ['Curso']);
  assert.equal(repo.listarContas('2026-11', 'todas').length, 3);

  const r = repo.resumo('2026-11');
  assert.equal(r.total_casa, 2000);
  const [ra, rb] = r.pessoas;
  assert.equal(ra.parte_casa, 1070);
  assert.equal(ra.gastos_pessoais, 150);
  assert.equal(ra.sobra, 10700 - 1070 - 150);
  assert.equal(rb.gastos_pessoais, 300);
  assert.equal(rb.pessoais_pendente, 0);
  assert.equal(repo.historico()[0].total_casa, 2000);
});

test('mudar o dono move a conta entre casa e pessoal', () => {
  const { repo, ana } = novoRepo();
  const c = repo.salvarConta({ mes_referencia: '2026-11', nome: 'Academia', valor: 150 });
  assert.equal(repo.resumo('2026-11').total_casa, 150);
  repo.salvarConta({ ...c, pessoa_id: ana.id });
  assert.equal(repo.resumo('2026-11').total_casa, 0);
  assert.equal(repo.resumo('2026-11').pessoas[0].gastos_pessoais, 150);
  const volta = repo.salvarConta({ ...c, pessoa_id: null });
  assert.equal(volta.divisoes.length, 2);
  assert.equal(repo.resumo('2026-11').total_casa, 150);
});

test('divisão que não soma 100% é recusada', () => {
  const { repo, ana, beto } = novoRepo();
  assert.throws(() => repo.salvarConta({
    mes_referencia: '2026-11', nome: 'X', valor: 10,
    divisoes: [{ pessoa_id: ana.id, percentual: 0.5 }, { pessoa_id: beto.id, percentual: 0.3 }]
  }), /100%/);
});

test('mês novo copia recorrentes da casa e pessoais, sem marcar como pagas', () => {
  const { repo, ana } = novoRepo();
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Aluguel', valor: 3000, pago: true });
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Presente', valor: 200, recorrente: false });
  repo.salvarConta({ mes_referencia: '2026-11', nome: 'Academia', valor: 150, pessoa_id: ana.id, pago: true });
  assert.equal(repo.definirMes('2026-12').criadas, 2);
  const dez = repo.listarContas('2026-12', 'todas');
  assert.deepEqual(dez.map((c) => [c.nome, c.pago, c.pessoa_id]).sort(),
    [['Academia', false, ana.id], ['Aluguel', false, null]]);
  assert.equal(repo.definirMes('2026-11').criadas, 0);
});

test('PIN: entra sem PIN, exige PIN quando cadastrado, troca e remove', () => {
  const { repo, ana, beto } = novoRepo(['1234', null]);
  assert.equal(repo.estado().pessoas[0].tem_pin, true);
  assert.equal(repo.estado().pessoas[1].tem_pin, false);
  assert.equal(JSON.stringify(repo.estado()).includes('pin_hash'), false);
  assert.throws(() => repo.entrar(ana.id, '0000'), /PIN incorreto/);
  assert.equal(repo.entrar(ana.id, '1234').nome, 'Ana');
  assert.equal(repo.entrar(beto.id).nome, 'Beto');
  assert.throws(() => repo.definirPin({ pessoa_id: ana.id, pin_atual: '9999', pin_novo: '5555' }), /atual incorreto/);
  assert.throws(() => repo.definirPin({ pessoa_id: beto.id, pin_novo: '12' }), /4 a 6/);
  repo.definirPin({ pessoa_id: ana.id, pin_atual: '1234', pin_novo: '5555' });
  assert.equal(repo.entrar(ana.id, '5555').nome, 'Ana');
  repo.definirPin({ pessoa_id: ana.id, pin_atual: '5555', pin_novo: null });
  assert.equal(repo.entrar(ana.id).nome, 'Ana');
});

test('cartões trazem 4 meses de faturas e limite disponível', () => {
  const { repo } = novoRepo();
  const id = repo.salvarCartao({ nome: 'Nubank', final: '1234', limite: 10000, dia_vencimento: 5 });
  repo.salvarFatura({ cartao_id: id, mes_referencia: '2026-12', valor: 2600 });
  const [c] = repo.listarCartoes('2026-11');
  assert.deepEqual(c.faturas.map((f) => f.mes_referencia), ['2026-11', '2026-12', '2027-01', '2027-02']);
  assert.equal(c.disponivel, 7400);
});

// Banco gerado pelo app 1.0 (antes das contas por pessoa).
const V1 = path.join(__dirname, 'fixtures', 'duofinn-v1.db');
test('migração de um banco 1.0 preserva os dados', { skip: !fs.existsSync(V1) }, () => {
  const tmp = path.join(os.tmpdir(), `duofinn-mig-${process.pid}.db`);
  fs.copyFileSync(V1, tmp);
  const db = new Database(tmp);
  assert.equal(db.pragma('user_version', { simple: true }), 1);
  migrate(db);
  assert.equal(db.pragma('user_version', { simple: true }), 3);
  const repo = createRepo(db);
  const [g, m] = repo.estado().pessoas;
  // contas da casa continuam iguais
  assert.equal(repo.resumo('2026-11').total_casa, 3660.4);
  // gastos pessoais viraram contas pessoais
  assert.deepEqual(repo.listarContas('2026-11', g.id).map((c) => [c.nome, c.valor, c.recorrente]), [['Celular', 89.9, true]]);
  assert.deepEqual(repo.listarContas('2026-11', m.id).map((c) => [c.nome, c.valor, c.recorrente]), [['Dia a dia', 1200, false]]);
  assert.equal(repo.resumo('2026-11').pessoas[1].gastos_pessoais, 1200);
  // a tabela antiga saiu
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'gastos_pessoais'").get(), undefined);
  // e a conta lançada errado como "da casa" pode ser corrigida
  const errada = repo.listarContas('2026-11').find((c) => c.nome === 'Academia da Marina');
  repo.salvarConta({ ...errada, pessoa_id: m.id });
  assert.equal(repo.resumo('2026-11').total_casa, 3510.4);
  db.close();
  fs.rmSync(tmp, { force: true });
});

test('cartões e metas com dono: casa ou pessoa, filtráveis e editáveis', () => {
  const { repo, ana, beto } = novoRepo();
  const casa = repo.salvarCartao({ nome: 'Cartão da casa', limite: 10000 });
  const daAna = repo.salvarCartao({ nome: 'Nubank Ana', limite: 3000, pessoa_id: ana.id });
  assert.deepEqual(repo.listarCartoes('2026-11').map((c) => c.nome), ['Cartão da casa', 'Nubank Ana']);
  assert.deepEqual(repo.listarCartoes('2026-11', 'casa').map((c) => c.id), [casa]);
  assert.deepEqual(repo.listarCartoes('2026-11', ana.id).map((c) => c.id), [daAna]);
  repo.salvarCartao({ id: daAna, nome: 'Nubank Ana', limite: 3000, pessoa_id: beto.id });
  assert.deepEqual(repo.listarCartoes('2026-11', beto.id).map((c) => c.id), [daAna]);

  repo.salvarMeta({ nome: 'Reserva do casal', tipo: 'reserva', valor_alvo: 50000, valor_atual: 1000 });
  const mb = repo.salvarMeta({ nome: 'Viagem do Beto', tipo: 'outro', valor_alvo: 8000, valor_atual: 500, pessoa_id: beto.id });
  assert.deepEqual(repo.listarMetas('casa').map((m) => m.nome), ['Reserva do casal']);
  assert.deepEqual(repo.listarMetas(beto.id).map((m) => m.id), [mb]);
  assert.equal(repo.listarMetas().length, 2);
  assert.throws(() => repo.salvarMeta({ nome: 'X', pessoa_id: 999 }), /Pessoa inválida/);
});

test('definirDono move um gasto entre casa e pessoa', () => {
  const { repo, ana } = novoRepo();
  const c = repo.salvarConta({ mes_referencia: '2026-11', nome: 'Mercado', valor: 600, pago: true, dia_vencimento: 8 });
  const p = repo.definirDono(c.id, ana.id);
  assert.equal(p.pessoa_id, ana.id);
  assert.equal(p.pago, true);
  assert.equal(p.dia_vencimento, 8);
  assert.equal(repo.resumo('2026-11').total_casa, 0);
  const volta = repo.definirDono(c.id, null);
  assert.equal(volta.pessoa_id, null);
  assert.equal(volta.parte1 + volta.parte2, 600);
});
