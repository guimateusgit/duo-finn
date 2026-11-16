import { useState } from 'react';
import { api } from '../api';
import { Header } from '../components/Header';
import { brl, iniciais, pct } from '../format';
import { Icon } from '../icons';
import type { Gasto, Pessoa } from '../types';
import { Field, MoneyInput, useAcao, useApp, useDados } from '../ui';

function PessoaCard({ pessoa, gastos }: { pessoa: Pessoa; gastos: Gasto[] }) {
  const { mes, estado } = useApp();
  const acao = useAcao();
  const [nome, setNome] = useState(pessoa.nome);
  const [renda, setRenda] = useState(pessoa.renda_mensal);
  const [novo, setNovo] = useState({ descricao: '', valor: 0, tipo: 'fixa' as Gasto['tipo'] });
  const mudou = nome !== pessoa.nome || renda !== pessoa.renda_mensal;
  const total = estado.pessoas.reduce((a, p) => a + p.renda_mensal, 0);

  async function salvarPessoa() {
    const ok = await acao(() => api.atualizarPessoa({ id: pessoa.id, nome, renda_mensal: renda }), 'Dados salvos');
    if (ok && renda !== pessoa.renda_mensal && estado.config.modo_divisao === 'proporcional'
      && window.confirm('A renda mudou. Quer recalcular a divisão das contas deste mês pela nova proporção?')) {
      await acao(() => api.redividirMes(mes), 'Divisão recalculada');
    }
  }

  async function addGasto() {
    if (!novo.descricao.trim()) return;
    const ok = await acao(() => api.salvarGasto({ ...novo, pessoa_id: pessoa.id, mes_referencia: mes }));
    if (ok) setNovo({ descricao: '', valor: 0, tipo: novo.tipo });
  }

  const cor = pessoa.ordem === 1 ? 'p1' : 'p2';
  return (
    <section className="glass card">
      <div className="card-head">
        <div className="row-left">
          <span className={`avatar ${cor}`} style={{ marginRight: 10 }}>{iniciais(pessoa.nome)}</span>
          <div>
            <h2 className="card-title">{pessoa.nome}</h2>
            <p className="card-sub">{total ? `${pct(pessoa.renda_mensal / total)} da renda do casal` : 'Informe a renda'}</p>
          </div>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Nome"><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <Field label="Renda mensal líquida (R$)"><MoneyInput value={renda} onChange={setRenda} /></Field>
      </div>
      {mudou && <div style={{ marginTop: 12 }}><button className="btn" type="button" onClick={salvarPessoa}>Salvar alterações</button></div>}

      <h3 className="card-title" style={{ marginTop: 22 }}>Gastos pessoais do mês</h3>
      <p className="card-sub" style={{ marginBottom: 8 }}>Contas só de {pessoa.nome} (não entram na divisão da casa).</p>
      {(['fixa', 'dia_a_dia'] as const).map((tipo) => {
        const lista = gastos.filter((g) => g.tipo === tipo);
        return (
          <div key={tipo} style={{ marginBottom: 8 }}>
            <div className="label" style={{ fontWeight: 600, marginTop: 8 }}>{tipo === 'fixa' ? 'Contas pessoais' : 'Dia a dia (estimativa)'}</div>
            {lista.length === 0 && <div className="label" style={{ padding: '6px 0' }}>Nada lançado.</div>}
            {lista.map((g) => (
              <div className="row" key={g.id}>
                <span className="row-name">{g.descricao}</span>
                <span className="row-left" style={{ gap: 4 }}>
                  <span className="row-val">{brl(g.valor)}</span>
                  <button className="icon-btn del" type="button" aria-label={`Remover ${g.descricao}`} onClick={() => acao(() => api.removerGasto(g.id))}><Icon.lixo /></button>
                </span>
              </div>
            ))}
          </div>
        );
      })}
      <form className="row" style={{ gap: 8, marginTop: 6 }} onSubmit={(e) => { e.preventDefault(); addGasto(); }}>
        <input className="input inline" style={{ flex: 2 }} placeholder="Ex.: Academia" value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} aria-label="Descrição do gasto" />
        <div style={{ flex: 1 }}><MoneyInput inline value={novo.valor} onChange={(v) => setNovo({ ...novo, valor: v })} ariaLabel="Valor do gasto" /></div>
        <select className="input inline" style={{ flex: 1 }} value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value as Gasto['tipo'] })} aria-label="Tipo">
          <option value="fixa">Conta</option>
          <option value="dia_a_dia">Dia a dia</option>
        </select>
        <button className="btn sm" type="submit" disabled={!novo.descricao.trim()}><Icon.mais /></button>
      </form>
      <div className="card-foot">
        <span>Total pessoal</span>
        <strong>{brl(gastos.reduce((a, g) => a + g.valor, 0))}</strong>
      </div>
    </section>
  );
}

export function Renda() {
  const { estado, mes } = useApp();
  const acao = useAcao();
  const { dados: gastos } = useDados(() => api.listarGastos(mes), [mes]);
  const { dados: resumo } = useDados(() => api.resumo(mes), [mes]);
  const modo = estado.config.modo_divisao;

  async function trocarModo(m: 'proporcional' | 'igual') {
    if (m === modo) return;
    await acao(() => api.atualizarConfig({ modo_divisao: m }));
    if (window.confirm('Aplicar o novo jeito de dividir às contas deste mês também?')) {
      await acao(() => api.redividirMes(mes), 'Divisão recalculada');
    }
  }

  return (
    <main className="main">
      <Header titulo="Nossa renda" sub="Renda de cada um, como a casa é dividida e os gastos que são só de cada pessoa." />

      <section className="glass card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Como dividir as contas da casa</h2>
            <p className="card-sub">Vale para as contas novas. Dá para personalizar a divisão de cada conta.</p>
          </div>
          <div className="seg-ctl" role="group" aria-label="Modo de divisão">
            <button type="button" aria-pressed={modo === 'proporcional'} onClick={() => trocarModo('proporcional')}>Proporcional à renda</button>
            <button type="button" aria-pressed={modo === 'igual'} onClick={() => trocarModo('igual')}>Meio a meio</button>
          </div>
        </div>
        {resumo && (
          <div className="legend" style={{ fontSize: 13 }}>
            {resumo.pessoas.map((p) => (
              <span key={p.id}><i className={`dot ${p.ordem === 1 ? 'p1' : 'p2'}`} />{p.nome}: renda {brl(p.renda)} · casa {brl(p.parte_casa)} · sobra <b className={p.sobra < 0 ? 'neg' : ''}>{brl(p.sobra)}</b></span>
            ))}
          </div>
        )}
      </section>

      <div className="cols-2">
        {estado.pessoas.map((p) => (
          <PessoaCard key={`${p.id}-${p.nome}-${p.renda_mensal}`} pessoa={p} gastos={(gastos ?? []).filter((g) => g.pessoa_id === p.id)} />
        ))}
      </div>
    </main>
  );
}
