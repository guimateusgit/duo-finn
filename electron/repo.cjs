// Camada local de acesso ao banco. Todas as regras de negócio ficam aqui;
// o frontend só chama estes métodos pelo IPC (ver preload.cjs).

const cents = (v) => Math.round((Number(v) || 0) * 100) / 100;

function mesHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function somaMes(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function validaMes(mes) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(mes))) throw new Error('Mês inválido (use AAAA-MM).');
  return mes;
}

const CATEGORIAS_MORADIA = ['casa', 'cond'];

function createRepo(db) {
  const casalId = () => {
    const r = db.prepare('SELECT id FROM casais ORDER BY id LIMIT 1').get();
    if (!r) throw new Error('Configure o casal primeiro.');
    return r.id;
  };
  const pessoas = () =>
    db.prepare('SELECT * FROM pessoas WHERE casal_id = ? ORDER BY ordem').all(casalId());
  const config = () => db.prepare('SELECT * FROM configuracao WHERE casal_id = ?').get(casalId());

  function percentuaisPadrao() {
    const ps = pessoas();
    const cfg = config();
    const total = ps.reduce((a, p) => a + p.renda_mensal, 0);
    if (cfg.modo_divisao === 'igual' || total <= 0) {
      return ps.map((p) => ({ pessoa_id: p.id, percentual: 1 / ps.length }));
    }
    const p1 = Math.round((ps[0].renda_mensal / total) * 10000) / 10000;
    return [
      { pessoa_id: ps[0].id, percentual: p1 },
      { pessoa_id: ps[1].id, percentual: Math.round((1 - p1) * 10000) / 10000 }
    ];
  }

  function gravaDivisoes(contaId, divisoes) {
    const soma = divisoes.reduce((a, d) => a + Number(d.percentual), 0);
    if (Math.abs(soma - 1) > 0.001) throw new Error('A divisão da conta precisa somar 100%.');
    db.prepare('DELETE FROM divisoes WHERE conta_id = ?').run(contaId);
    const ins = db.prepare('INSERT INTO divisoes (conta_id, pessoa_id, percentual) VALUES (?, ?, ?)');
    for (const d of divisoes) ins.run(contaId, d.pessoa_id, Number(d.percentual));
  }

  const repo = {
    // ---------- casal / pessoas / configuração ----------
    estado() {
      const c = db.prepare('SELECT * FROM casais ORDER BY id LIMIT 1').get();
      if (!c) return { pronto: false };
      return { pronto: true, casal: c, pessoas: pessoas(), config: config() };
    },

    configurarCasal({ nomeCasal, pessoas: ps, mes }) {
      if (db.prepare('SELECT 1 FROM casais').get()) throw new Error('O casal já está configurado.');
      if (!Array.isArray(ps) || ps.length !== 2) throw new Error('Informe as duas pessoas.');
      db.transaction(() => {
        const id = db.prepare('INSERT INTO casais (nome) VALUES (?)').run(nomeCasal || 'Nossa casa').lastInsertRowid;
        ps.forEach((p, i) => {
          if (!String(p.nome || '').trim()) throw new Error(`Informe o nome da pessoa ${i + 1}.`);
          db.prepare('INSERT INTO pessoas (casal_id, ordem, nome, renda_mensal) VALUES (?, ?, ?, ?)')
            .run(id, i + 1, String(p.nome).trim(), cents(p.renda_mensal));
        });
        db.prepare('INSERT INTO configuracao (casal_id, mes_referencia) VALUES (?, ?)')
          .run(id, validaMes(mes || mesHoje()));
      })();
      return repo.estado();
    },

    atualizarPessoa({ id, nome, renda_mensal }) {
      if (!String(nome || '').trim()) throw new Error('O nome não pode ficar vazio.');
      db.prepare('UPDATE pessoas SET nome = ?, renda_mensal = ? WHERE id = ? AND casal_id = ?')
        .run(String(nome).trim(), cents(renda_mensal), id, casalId());
      return repo.estado();
    },

    atualizarConfig({ nome_casal, modo_divisao, meta_moradia }) {
      const id = casalId();
      if (nome_casal != null) db.prepare('UPDATE casais SET nome = ? WHERE id = ?').run(nome_casal, id);
      if (modo_divisao != null) db.prepare('UPDATE configuracao SET modo_divisao = ? WHERE casal_id = ?').run(modo_divisao, id);
      if (meta_moradia != null) db.prepare('UPDATE configuracao SET meta_moradia = ? WHERE casal_id = ?').run(Number(meta_moradia), id);
      return repo.estado();
    },

    percentuaisPadrao,

    // Troca o mês ativo. Mês novo sem contas recebe uma cópia das contas
    // recorrentes do último mês que tinha contas (com pago = 0).
    definirMes(mes) {
      validaMes(mes);
      const id = casalId();
      let criadas = 0;
      db.transaction(() => {
        db.prepare('UPDATE configuracao SET mes_referencia = ? WHERE casal_id = ?').run(mes, id);
        // gastos pessoais fixos (tipo 'fixa') também passam para o mês novo
        const temGasto = db.prepare(
          `SELECT 1 FROM gastos_pessoais g JOIN pessoas p ON p.id = g.pessoa_id
           WHERE p.casal_id = ? AND g.mes_referencia = ?`
        ).get(id, mes);
        if (!temGasto) {
          const origemG = db.prepare(
            `SELECT MAX(g.mes_referencia) AS m FROM gastos_pessoais g JOIN pessoas p ON p.id = g.pessoa_id
             WHERE p.casal_id = ? AND g.mes_referencia < ?`
          ).get(id, mes).m;
          if (origemG) {
            db.prepare(
              `INSERT INTO gastos_pessoais (pessoa_id, mes_referencia, descricao, valor, tipo)
               SELECT g.pessoa_id, ?, g.descricao, g.valor, g.tipo FROM gastos_pessoais g
               JOIN pessoas p ON p.id = g.pessoa_id
               WHERE p.casal_id = ? AND g.mes_referencia = ? AND g.tipo = 'fixa'`
            ).run(mes, id, origemG);
          }
        }
        const tem =db.prepare('SELECT 1 FROM contas WHERE casal_id = ? AND mes_referencia = ?').get(id, mes);
        if (tem) return;
        const origem = db.prepare(
          'SELECT MAX(mes_referencia) AS m FROM contas WHERE casal_id = ? AND mes_referencia < ?'
        ).get(id, mes).m;
        if (!origem) return;
        const base = db.prepare(
          'SELECT * FROM contas WHERE casal_id = ? AND mes_referencia = ? AND recorrente = 1'
        ).all(id, origem);
        const insConta = db.prepare(
          `INSERT INTO contas (casal_id, mes_referencia, nome, categoria, valor, dia_vencimento, pago, recorrente)
           VALUES (?, ?, ?, ?, ?, ?, 0, 1)`
        );
        const divs = db.prepare('SELECT pessoa_id, percentual FROM divisoes WHERE conta_id = ?');
        for (const c of base) {
          const novo = insConta.run(id, mes, c.nome, c.categoria, c.valor, c.dia_vencimento).lastInsertRowid;
          gravaDivisoes(novo, divs.all(c.id));
          criadas++;
        }
      })();
      return { mes, criadas, estado: repo.estado() };
    },

    // ---------- contas da casa ----------
    listarContas(mes) {
      validaMes(mes);
      const ps = pessoas();
      const contas = db.prepare(
        `SELECT * FROM contas WHERE casal_id = ? AND mes_referencia = ?
         ORDER BY COALESCE(dia_vencimento, 99), nome`
      ).all(casalId(), mes);
      const divs = db.prepare('SELECT pessoa_id, percentual FROM divisoes WHERE conta_id = ?');
      return contas.map((c) => {
        const d = divs.all(c.id);
        const pct = (pid) => (d.find((x) => x.pessoa_id === pid) || { percentual: 0 }).percentual;
        return {
          ...c,
          pago: !!c.pago,
          recorrente: !!c.recorrente,
          divisoes: d,
          parte1: cents(c.valor * pct(ps[0].id)),
          parte2: cents(c.valor * pct(ps[1].id))
        };
      });
    },

    salvarConta(conta) {
      const id = casalId();
      if (!String(conta.nome || '').trim()) throw new Error('Dê um nome para a conta.');
      const mes = validaMes(conta.mes_referencia);
      const dia = conta.dia_vencimento ? Number(conta.dia_vencimento) : null;
      if (dia != null && (dia < 1 || dia > 31)) throw new Error('Dia de vencimento deve ser entre 1 e 31.');
      const divisoes = conta.divisoes && conta.divisoes.length ? conta.divisoes : percentuaisPadrao();
      let contaId = conta.id;
      db.transaction(() => {
        const vals = [String(conta.nome).trim(), conta.categoria || 'casa', cents(conta.valor), dia,
          conta.pago ? 1 : 0, conta.recorrente === false ? 0 : 1];
        if (contaId) {
          const r = db.prepare(
            `UPDATE contas SET nome = ?, categoria = ?, valor = ?, dia_vencimento = ?, pago = ?, recorrente = ?
             WHERE id = ? AND casal_id = ?`
          ).run(...vals, contaId, id);
          if (!r.changes) throw new Error('Conta não encontrada.');
        } else {
          contaId = db.prepare(
            `INSERT INTO contas (nome, categoria, valor, dia_vencimento, pago, recorrente, casal_id, mes_referencia)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(...vals, id, mes).lastInsertRowid;
        }
        gravaDivisoes(contaId, divisoes);
      })();
      return repo.listarContas(mes).find((c) => c.id === Number(contaId));
    },

    removerConta(id) {
      db.prepare('DELETE FROM contas WHERE id = ? AND casal_id = ?').run(id, casalId());
      return true;
    },

    marcarPago(id, pago) {
      db.prepare('UPDATE contas SET pago = ? WHERE id = ? AND casal_id = ?').run(pago ? 1 : 0, id, casalId());
      return true;
    },

    // Reaplica a divisão padrão (ex.: depois que a renda mudou) a todas as contas do mês.
    redividirMes(mes) {
      validaMes(mes);
      const padrao = percentuaisPadrao();
      const ids = db.prepare('SELECT id FROM contas WHERE casal_id = ? AND mes_referencia = ?').all(casalId(), mes);
      db.transaction(() => ids.forEach((c) => gravaDivisoes(c.id, padrao)))();
      return ids.length;
    },

    // ---------- gastos pessoais ----------
    listarGastos(mes) {
      validaMes(mes);
      return db.prepare(
        `SELECT g.* FROM gastos_pessoais g JOIN pessoas p ON p.id = g.pessoa_id
         WHERE p.casal_id = ? AND g.mes_referencia = ? ORDER BY p.ordem, g.tipo, g.descricao`
      ).all(casalId(), mes);
    },

    salvarGasto(g) {
      validaMes(g.mes_referencia);
      if (!String(g.descricao || '').trim()) throw new Error('Descreva o gasto.');
      const dono = db.prepare('SELECT 1 FROM pessoas WHERE id = ? AND casal_id = ?').get(g.pessoa_id, casalId());
      if (!dono) throw new Error('Pessoa inválida.');
      const tipo = g.tipo === 'dia_a_dia' ? 'dia_a_dia' : 'fixa';
      if (g.id) {
        db.prepare('UPDATE gastos_pessoais SET pessoa_id = ?, descricao = ?, valor = ?, tipo = ? WHERE id = ?')
          .run(g.pessoa_id, String(g.descricao).trim(), cents(g.valor), tipo, g.id);
        return g.id;
      }
      return db.prepare(
        'INSERT INTO gastos_pessoais (pessoa_id, mes_referencia, descricao, valor, tipo) VALUES (?, ?, ?, ?, ?)'
      ).run(g.pessoa_id, g.mes_referencia, String(g.descricao).trim(), cents(g.valor), tipo).lastInsertRowid;
    },

    removerGasto(id) {
      db.prepare('DELETE FROM gastos_pessoais WHERE id = ?').run(id);
      return true;
    },

    // ---------- cartões e faturas ----------
    listarCartoes(mes) {
      validaMes(mes);
      const meses = [0, 1, 2, 3].map((n) => somaMes(mes, n));
      const fat = db.prepare('SELECT * FROM faturas WHERE cartao_id = ? AND mes_referencia = ?');
      return db.prepare('SELECT * FROM cartoes WHERE casal_id = ? ORDER BY nome').all(casalId()).map((c) => {
        const faturas = meses.map((m) => {
          const f = fat.get(c.id, m);
          return { mes_referencia: m, valor: f ? f.valor : 0, paga: f ? !!f.paga : false, id: f ? f.id : null };
        });
        return { ...c, faturas, disponivel: cents(c.limite - faturas.reduce((a, f) => a + (f.paga ? 0 : f.valor), 0)) };
      });
    },

    salvarCartao(c) {
      if (!String(c.nome || '').trim()) throw new Error('Dê um nome para o cartão.');
      const vals = [String(c.nome).trim(), c.final ? String(c.final).slice(-4) : null, cents(c.limite),
        c.dia_vencimento ? Number(c.dia_vencimento) : null];
      if (c.id) {
        db.prepare('UPDATE cartoes SET nome = ?, final = ?, limite = ?, dia_vencimento = ? WHERE id = ? AND casal_id = ?')
          .run(...vals, c.id, casalId());
        return c.id;
      }
      return db.prepare('INSERT INTO cartoes (nome, final, limite, dia_vencimento, casal_id) VALUES (?, ?, ?, ?, ?)')
        .run(...vals, casalId()).lastInsertRowid;
    },

    removerCartao(id) {
      db.prepare('DELETE FROM cartoes WHERE id = ? AND casal_id = ?').run(id, casalId());
      return true;
    },

    salvarFatura({ cartao_id, mes_referencia, valor, paga }) {
      validaMes(mes_referencia);
      db.prepare(
        `INSERT INTO faturas (cartao_id, mes_referencia, valor, paga) VALUES (?, ?, ?, ?)
         ON CONFLICT (cartao_id, mes_referencia) DO UPDATE SET valor = excluded.valor, paga = excluded.paga`
      ).run(cartao_id, mes_referencia, cents(valor), paga ? 1 : 0);
      return true;
    },

    // ---------- metas (reserva, obra) ----------
    listarMetas() {
      return db.prepare('SELECT * FROM metas WHERE casal_id = ? ORDER BY tipo, nome').all(casalId());
    },

    salvarMeta(m) {
      if (!String(m.nome || '').trim()) throw new Error('Dê um nome para a meta.');
      const vals = [String(m.nome).trim(), m.tipo || 'reserva', cents(m.valor_alvo), cents(m.valor_atual)];
      if (m.id) {
        db.prepare('UPDATE metas SET nome = ?, tipo = ?, valor_alvo = ?, valor_atual = ? WHERE id = ? AND casal_id = ?')
          .run(...vals, m.id, casalId());
        return m.id;
      }
      return db.prepare('INSERT INTO metas (nome, tipo, valor_alvo, valor_atual, casal_id) VALUES (?, ?, ?, ?, ?)')
        .run(...vals, casalId()).lastInsertRowid;
    },

    removerMeta(id) {
      db.prepare('DELETE FROM metas WHERE id = ? AND casal_id = ?').run(id, casalId());
      return true;
    },

    // ---------- resumo e histórico (usam a view resumo_mensal) ----------
    resumo(mes) {
      validaMes(mes);
      const id = casalId();
      const ps = pessoas();
      const cfg = config();
      const v = db.prepare('SELECT * FROM resumo_mensal WHERE casal_id = ? AND mes_referencia = ?').get(id, mes)
        || { total_casa: 0, paga_pessoa1: 0, paga_pessoa2: 0, total_pago: 0 };
      const gastos = repo.listarGastos(mes);
      const contas = repo.listarContas(mes);
      const rendaTotal = ps.reduce((a, p) => a + p.renda_mensal, 0);

      const porPessoa = ps.map((p, i) => {
        const parte = cents(i === 0 ? v.paga_pessoa1 : v.paga_pessoa2);
        const fixos = cents(gastos.filter((g) => g.pessoa_id === p.id && g.tipo === 'fixa').reduce((a, g) => a + g.valor, 0));
        const dia = cents(gastos.filter((g) => g.pessoa_id === p.id && g.tipo === 'dia_a_dia').reduce((a, g) => a + g.valor, 0));
        return {
          id: p.id, ordem: p.ordem, nome: p.nome, renda: p.renda_mensal,
          parte_casa: parte, gastos_fixos: fixos, dia_a_dia: dia,
          sobra: cents(p.renda_mensal - parte - fixos - dia),
          pct_casa: v.total_casa ? parte / v.total_casa : 0
        };
      });

      const moradia = cents(contas.filter((c) => CATEGORIAS_MORADIA.includes(c.categoria)).reduce((a, c) => a + c.valor, 0));
      const pendentes = contas.filter((c) => !c.pago);

      return {
        mes,
        total_casa: cents(v.total_casa),
        paga_pessoa1: cents(v.paga_pessoa1),
        paga_pessoa2: cents(v.paga_pessoa2),
        total_pago: cents(v.total_pago),
        total_pendente: cents(pendentes.reduce((a, c) => a + c.valor, 0)),
        qtd_contas: contas.length,
        renda_total: cents(rendaTotal),
        sobra_total: cents(porPessoa.reduce((a, p) => a + p.sobra, 0)),
        pessoas: porPessoa,
        moradia: { valor: moradia, pct_renda: rendaTotal ? moradia / rendaTotal : 0, meta: cfg.meta_moradia }
      };
    },

    historico(limite = 12) {
      return db.prepare(
        'SELECT * FROM resumo_mensal WHERE casal_id = ? ORDER BY mes_referencia DESC LIMIT ?'
      ).all(casalId(), limite).map((r) => ({
        ...r,
        total_casa: cents(r.total_casa), paga_pessoa1: cents(r.paga_pessoa1),
        paga_pessoa2: cents(r.paga_pessoa2), total_pago: cents(r.total_pago)
      }));
    }
  };
  return repo;
}

// Métodos expostos ao frontend pelo IPC (lista branca).
const METODOS = [
  'estado', 'configurarCasal', 'atualizarPessoa', 'atualizarConfig', 'percentuaisPadrao', 'definirMes',
  'listarContas', 'salvarConta', 'removerConta', 'marcarPago', 'redividirMes',
  'listarGastos', 'salvarGasto', 'removerGasto',
  'listarCartoes', 'salvarCartao', 'removerCartao', 'salvarFatura',
  'listarMetas', 'salvarMeta', 'removerMeta',
  'resumo', 'historico'
];

module.exports = { createRepo, METODOS, mesHoje, somaMes };
