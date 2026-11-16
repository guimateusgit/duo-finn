// Camada local de acesso ao banco. Todas as regras de negócio ficam aqui;
// o frontend só chama estes métodos pelo IPC (ver preload.cjs).
//
// Contas: pessoa_id NULL = conta da casa (dividida entre os dois);
//         pessoa_id preenchido = gasto só daquela pessoa (não entra na divisão).

const crypto = require('node:crypto');

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

// PIN: 4 a 6 dígitos, guardado como scrypt com sal. É uma trava de perfil,
// não criptografia do banco.
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(String(pin), salt, 32).toString('hex')}`;
}
function confere(pin, guardado) {
  const [salt, hash] = String(guardado).split(':');
  const calc = crypto.scryptSync(String(pin), salt, 32);
  return crypto.timingSafeEqual(calc, Buffer.from(hash, 'hex'));
}
function validaPin(pin) {
  if (!/^\d{4,6}$/.test(String(pin))) throw new Error('O PIN precisa ter de 4 a 6 números.');
}

const CATEGORIAS_MORADIA = ['casa', 'cond'];

function createRepo(db) {
  const casalId = () => {
    const r = db.prepare('SELECT id FROM casais ORDER BY id LIMIT 1').get();
    if (!r) throw new Error('Configure o casal primeiro.');
    return r.id;
  };
  const pessoasRaw = () =>
    db.prepare('SELECT * FROM pessoas WHERE casal_id = ? ORDER BY ordem').all(casalId());
  const publica = (p) => ({ id: p.id, casal_id: p.casal_id, ordem: p.ordem, nome: p.nome, renda_mensal: p.renda_mensal, tem_pin: !!p.pin_hash });
  const pessoas = () => pessoasRaw().map(publica);
  const config = () => db.prepare('SELECT * FROM configuracao WHERE casal_id = ?').get(casalId());
  const pessoaDoCasal = (id) => {
    const p = db.prepare('SELECT * FROM pessoas WHERE id = ? AND casal_id = ?').get(id, casalId());
    if (!p) throw new Error('Pessoa inválida.');
    return p;
  };

  // escopo: 'todas' | 'casa' (pessoa_id NULL) | id de uma pessoa
  function filtroDono(escopo) {
    if (escopo == null || escopo === 'todas') return { sql: '', params: [] };
    if (escopo === 'casa') return { sql: 'AND pessoa_id IS NULL', params: [] };
    return { sql: 'AND pessoa_id = ?', params: [Number(escopo)] };
  }
  const donoValido = (id) => (id ? pessoaDoCasal(id).id : null);

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
    // ---------- casal / pessoas / perfis ----------
    estado() {
      const c = db.prepare('SELECT * FROM casais ORDER BY id LIMIT 1').get();
      if (!c) return { pronto: false };
      return { pronto: true, casal: c, pessoas: pessoas(), config: config() };
    },

    configurarCasal({ nomeCasal, pessoas: ps, mes }) {
      if (db.prepare('SELECT 1 FROM casais').get()) throw new Error('O casal já está configurado.');
      if (!Array.isArray(ps) || ps.length !== 2) throw new Error('Informe as duas pessoas.');
      ps.forEach((p) => { if (p.pin) validaPin(p.pin); });
      db.transaction(() => {
        const id = db.prepare('INSERT INTO casais (nome) VALUES (?)').run(nomeCasal || 'Nossa casa').lastInsertRowid;
        ps.forEach((p, i) => {
          if (!String(p.nome || '').trim()) throw new Error(`Informe o nome da pessoa ${i + 1}.`);
          db.prepare('INSERT INTO pessoas (casal_id, ordem, nome, renda_mensal, pin_hash) VALUES (?, ?, ?, ?, ?)')
            .run(id, i + 1, String(p.nome).trim(), cents(p.renda_mensal), p.pin ? hashPin(p.pin) : null);
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

    // Entrar no perfil: sem PIN cadastrado, entra direto.
    entrar(pessoaId, pin) {
      const p = pessoaDoCasal(pessoaId);
      if (p.pin_hash && !confere(pin ?? '', p.pin_hash)) throw new Error('PIN incorreto.');
      return publica(p);
    },

    // Definir/trocar/remover PIN. Se já existe PIN, exige o atual.
    definirPin({ pessoa_id, pin_atual, pin_novo }) {
      const p = pessoaDoCasal(pessoa_id);
      if (p.pin_hash && !confere(pin_atual ?? '', p.pin_hash)) throw new Error('PIN atual incorreto.');
      if (pin_novo) validaPin(pin_novo);
      db.prepare('UPDATE pessoas SET pin_hash = ? WHERE id = ?').run(pin_novo ? hashPin(pin_novo) : null, p.id);
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

    // Troca o mês ativo. Mês novo sem lançamentos recebe uma cópia das contas
    // recorrentes (da casa e pessoais) do último mês que tinha lançamentos.
    definirMes(mes) {
      validaMes(mes);
      const id = casalId();
      let criadas = 0;
      db.transaction(() => {
        db.prepare('UPDATE configuracao SET mes_referencia = ? WHERE casal_id = ?').run(mes, id);
        const tem = db.prepare('SELECT 1 FROM contas WHERE casal_id = ? AND mes_referencia = ?').get(id, mes);
        if (tem) return;
        const origem = db.prepare(
          'SELECT MAX(mes_referencia) AS m FROM contas WHERE casal_id = ? AND mes_referencia < ?'
        ).get(id, mes).m;
        if (!origem) return;
        const base = db.prepare(
          'SELECT * FROM contas WHERE casal_id = ? AND mes_referencia = ? AND recorrente = 1'
        ).all(id, origem);
        const insConta = db.prepare(
          `INSERT INTO contas (casal_id, mes_referencia, nome, categoria, valor, dia_vencimento, pago, recorrente, pessoa_id)
           VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?)`
        );
        const divs = db.prepare('SELECT pessoa_id, percentual FROM divisoes WHERE conta_id = ?');
        for (const c of base) {
          const novo = insConta.run(id, mes, c.nome, c.categoria, c.valor, c.dia_vencimento, c.pessoa_id).lastInsertRowid;
          gravaDivisoes(novo, divs.all(c.id));
          criadas++;
        }
      })();
      return { mes, criadas, estado: repo.estado() };
    },

    // ---------- contas (casa e pessoais) ----------
    // escopo: 'casa' (padrão) | 'todas' | id da pessoa (gastos só dela)
    listarContas(mes, escopo = 'casa') {
      validaMes(mes);
      const ps = pessoas();
      let filtro = 'AND pessoa_id IS NULL';
      const params = [casalId(), mes];
      if (escopo === 'todas') filtro = '';
      else if (escopo !== 'casa') { filtro = 'AND pessoa_id = ?'; params.push(Number(escopo)); }
      const contas = db.prepare(
        `SELECT * FROM contas WHERE casal_id = ? AND mes_referencia = ? ${filtro}
         ORDER BY COALESCE(dia_vencimento, 99), nome`
      ).all(...params);
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
      const dono = conta.pessoa_id ? pessoaDoCasal(conta.pessoa_id).id : null;
      const divisoes = dono
        ? [{ pessoa_id: dono, percentual: 1 }]
        : (conta.divisoes && conta.divisoes.length ? conta.divisoes : percentuaisPadrao());
      let contaId = conta.id;
      db.transaction(() => {
        const vals = [String(conta.nome).trim(), conta.categoria || 'casa', cents(conta.valor), dia,
          conta.pago ? 1 : 0, conta.recorrente === false ? 0 : 1, dono];
        if (contaId) {
          const r = db.prepare(
            `UPDATE contas SET nome = ?, categoria = ?, valor = ?, dia_vencimento = ?, pago = ?, recorrente = ?, pessoa_id = ?
             WHERE id = ? AND casal_id = ?`
          ).run(...vals, contaId, id);
          if (!r.changes) throw new Error('Conta não encontrada.');
        } else {
          contaId = db.prepare(
            `INSERT INTO contas (nome, categoria, valor, dia_vencimento, pago, recorrente, pessoa_id, casal_id, mes_referencia)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(...vals, id, mes).lastInsertRowid;
        }
        gravaDivisoes(contaId, divisoes);
      })();
      return repo.listarContas(mes, 'todas').find((c) => c.id === Number(contaId));
    },

    // Muda só o dono de um gasto (casa <-> pessoa), mantendo o resto.
    definirDono(id, pessoaId) {
      const c = db.prepare('SELECT * FROM contas WHERE id = ? AND casal_id = ?').get(id, casalId());
      if (!c) throw new Error('Gasto não encontrado.');
      return repo.salvarConta({ ...c, pago: !!c.pago, recorrente: !!c.recorrente, pessoa_id: pessoaId || null, divisoes: null });
    },

    removerConta(id) {
      db.prepare('DELETE FROM contas WHERE id = ? AND casal_id = ?').run(id, casalId());
      return true;
    },

    marcarPago(id, pago) {
      db.prepare('UPDATE contas SET pago = ? WHERE id = ? AND casal_id = ?').run(pago ? 1 : 0, id, casalId());
      return true;
    },

    // Reaplica a divisão padrão (ex.: depois que a renda mudou) às contas da casa do mês.
    redividirMes(mes) {
      validaMes(mes);
      const padrao = percentuaisPadrao();
      const ids = db.prepare(
        'SELECT id FROM contas WHERE casal_id = ? AND mes_referencia = ? AND pessoa_id IS NULL'
      ).all(casalId(), mes);
      db.transaction(() => ids.forEach((c) => gravaDivisoes(c.id, padrao)))();
      return ids.length;
    },

    // ---------- cartões e faturas ----------
    listarCartoes(mes, escopo = 'todas') {
      validaMes(mes);
      const f = filtroDono(escopo);
      const meses = [0, 1, 2, 3].map((n) => somaMes(mes, n));
      const fat = db.prepare('SELECT * FROM faturas WHERE cartao_id = ? AND mes_referencia = ?');
      return db.prepare(`SELECT * FROM cartoes WHERE casal_id = ? ${f.sql} ORDER BY pessoa_id IS NOT NULL, nome`)
        .all(casalId(), ...f.params).map((c) => {
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
        c.dia_vencimento ? Number(c.dia_vencimento) : null, donoValido(c.pessoa_id)];
      if (c.id) {
        db.prepare('UPDATE cartoes SET nome = ?, final = ?, limite = ?, dia_vencimento = ?, pessoa_id = ? WHERE id = ? AND casal_id = ?')
          .run(...vals, c.id, casalId());
        return c.id;
      }
      return db.prepare('INSERT INTO cartoes (nome, final, limite, dia_vencimento, pessoa_id, casal_id) VALUES (?, ?, ?, ?, ?, ?)')
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
    listarMetas(escopo = 'todas') {
      const f = filtroDono(escopo);
      return db.prepare(`SELECT * FROM metas WHERE casal_id = ? ${f.sql} ORDER BY pessoa_id IS NOT NULL, tipo, nome`)
        .all(casalId(), ...f.params);
    },

    salvarMeta(m) {
      if (!String(m.nome || '').trim()) throw new Error('Dê um nome para a meta.');
      const vals = [String(m.nome).trim(), m.tipo || 'reserva', cents(m.valor_alvo), cents(m.valor_atual), donoValido(m.pessoa_id)];
      if (m.id) {
        db.prepare('UPDATE metas SET nome = ?, tipo = ?, valor_alvo = ?, valor_atual = ?, pessoa_id = ? WHERE id = ? AND casal_id = ?')
          .run(...vals, m.id, casalId());
        return m.id;
      }
      return db.prepare('INSERT INTO metas (nome, tipo, valor_alvo, valor_atual, pessoa_id, casal_id) VALUES (?, ?, ?, ?, ?, ?)')
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
      const casa = repo.listarContas(mes, 'casa');
      const pessoais = db.prepare(
        `SELECT pessoa_id, SUM(valor) AS total, SUM(CASE WHEN pago = 0 THEN valor ELSE 0 END) AS pendente, COUNT(*) AS qtd
         FROM contas WHERE casal_id = ? AND mes_referencia = ? AND pessoa_id IS NOT NULL GROUP BY pessoa_id`
      ).all(id, mes);
      const rendaTotal = ps.reduce((a, p) => a + p.renda_mensal, 0);

      const porPessoa = ps.map((p, i) => {
        const parte = cents(i === 0 ? v.paga_pessoa1 : v.paga_pessoa2);
        const pp = pessoais.find((x) => x.pessoa_id === p.id) || { total: 0, pendente: 0, qtd: 0 };
        return {
          id: p.id, ordem: p.ordem, nome: p.nome, renda: p.renda_mensal,
          parte_casa: parte,
          gastos_pessoais: cents(pp.total), pessoais_pendente: cents(pp.pendente), qtd_pessoais: pp.qtd,
          sobra: cents(p.renda_mensal - parte - pp.total),
          pct_casa: v.total_casa ? parte / v.total_casa : 0
        };
      });

      const moradia = cents(casa.filter((c) => CATEGORIAS_MORADIA.includes(c.categoria)).reduce((a, c) => a + c.valor, 0));

      return {
        mes,
        total_casa: cents(v.total_casa),
        paga_pessoa1: cents(v.paga_pessoa1),
        paga_pessoa2: cents(v.paga_pessoa2),
        total_pago: cents(v.total_pago),
        total_pendente: cents(casa.filter((c) => !c.pago).reduce((a, c) => a + c.valor, 0)),
        qtd_contas: casa.length,
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
  'estado', 'configurarCasal', 'atualizarPessoa', 'entrar', 'definirPin', 'atualizarConfig',
  'percentuaisPadrao', 'definirMes',
  'listarContas', 'salvarConta', 'definirDono', 'removerConta', 'marcarPago', 'redividirMes',
  'listarCartoes', 'salvarCartao', 'removerCartao', 'salvarFatura',
  'listarMetas', 'salvarMeta', 'removerMeta',
  'resumo', 'historico'
];

module.exports = { createRepo, METODOS, mesHoje, somaMes };
