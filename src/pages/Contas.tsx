import { useState } from 'react';
import { api } from '../api';
import { ContaModal } from '../components/ContaModal';
import { DonoFiltro, DonoInline, type Escopo } from '../components/Dono';
import { Header } from '../components/Header';
import { brl, dia2 } from '../format';
import { CatIcon, Icon, nomeCategoria } from '../icons';
import type { Conta } from '../types';
import { Check, useAcao, useApp, useDados } from '../ui';

/** Todos os lançamentos do mês (casa e pessoais), editáveis na própria tabela. */
export function Contas() {
  const { estado, mes } = useApp();
  const acao = useAcao();
  const [p1, p2] = estado.pessoas;
  const [escopo, setEscopo] = useState<Escopo>('todas');
  const [situacao, setSituacao] = useState<'todas' | 'pendentes' | 'pagas'>('todas');
  const { dados: contas } = useDados(() => api.listarContas(mes, escopo), [mes, escopo]);
  const [editando, setEditando] = useState<Conta | null | 'nova'>(null);

  const lista = (contas ?? []).filter((c) => situacao === 'todas' || (situacao === 'pagas' ? c.pago : !c.pago));
  const soma = (k: 'valor' | 'parte1' | 'parte2') => lista.reduce((a, c) => a + c[k], 0);
  const donoNovo = typeof escopo === 'number' ? escopo : null;

  async function redividir() {
    if (!window.confirm('Aplicar a divisão padrão a TODAS as contas da casa deste mês? Divisões personalizadas serão substituídas.')) return;
    await acao(() => api.redividirMes(mes), 'Divisão padrão aplicada');
  }

  function trocarDono(c: Conta, dono: number | null) {
    const quem = dono == null ? 'a casa' : estado.pessoas.find((p) => p.id === dono)?.nome;
    acao(() => api.definirDono(c.id, dono), `"${c.nome}" agora é de ${quem}`);
  }

  return (
    <>
      <main className="main">
        <Header
          titulo="Lançamentos"
          sub="Tudo o que entra no mês: contas da casa e gastos de cada um. Troque o dono direto na tabela ou clique no lápis para editar o resto."
          acoes={<>
            <button className="btn sec" type="button" onClick={redividir}>Reaplicar divisão padrão</button>
            <button className="btn" type="button" onClick={() => setEditando('nova')}><Icon.mais /> Novo gasto</button>
          </>}
        />
        <section className="glass card">
          <div className="card-head">
            <div className="filtros">
              <DonoFiltro value={escopo} onChange={setEscopo} />
              <div className="seg-ctl" role="group" aria-label="Situação">
                {(['todas', 'pendentes', 'pagas'] as const).map((f) => (
                  <button key={f} type="button" aria-pressed={situacao === f} onClick={() => setSituacao(f)}>
                    {f === 'todas' ? 'Pagas e pendentes' : f[0].toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <span className="badge blue">{lista.length} {lista.length === 1 ? 'lançamento' : 'lançamentos'}</span>
          </div>

          {!contas ? null : lista.length === 0 ? (
            <div className="empty">
              Nada neste filtro.
              <button className="btn" type="button" onClick={() => setEditando('nova')}><Icon.mais /> Novo gasto</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 34 }} aria-label="Pago" />
                    <th>Gasto</th>
                    <th>De quem é</th>
                    <th>Vence</th>
                    <th className="num">Valor</th>
                    <th className="num"><i className="dot p1" />{p1.nome}</th>
                    <th className="num"><i className="dot p2" />{p2.nome}</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.id} className={c.pago ? 'pago' : ''}>
                      <td><Check on={c.pago} label={c.pago ? 'Marcar como não pago' : 'Marcar como pago'} onToggle={() => acao(() => api.marcarPago(c.id, !c.pago))} /></td>
                      <td className="nome">
                        <span className="row-left">
                          <CatIcon cat={c.categoria} />
                          <span>
                            <span>{c.nome}</span>
                            <span className="label" style={{ display: 'block' }}>
                              {nomeCategoria(c.categoria)}{c.recorrente ? ' · todo mês' : ' · só este mês'}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td><DonoInline value={c.pessoa_id} onChange={(v) => trocarDono(c, v)} rotulo={`De quem é ${c.nome}`} /></td>
                      <td className="tabular">{c.dia_vencimento ? `dia ${dia2(c.dia_vencimento)}` : '—'}</td>
                      <td className="num"><strong>{brl(c.valor)}</strong></td>
                      <td className="num">{c.parte1 ? brl(c.parte1) : <span className="muted">—</span>}</td>
                      <td className="num">{c.parte2 ? brl(c.parte2) : <span className="muted">—</span>}</td>
                      <td><button className="icon-btn" type="button" aria-label={`Editar ${c.nome}`} onClick={() => setEditando(c)}><Icon.editar /></button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td /><td>Total</td><td /><td />
                    <td className="num">{brl(soma('valor'))}</td>
                    <td className="num">{brl(soma('parte1'))}</td>
                    <td className="num">{brl(soma('parte2'))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="label" style={{ marginTop: 10 }}>
            As colunas com o nome de cada um mostram quanto cabe a cada pessoa: nas contas da casa, a parte da divisão; nos gastos pessoais, o valor inteiro fica com o dono.
          </p>
        </section>
      </main>
      {editando && <ContaModal conta={editando === 'nova' ? null : editando} donoPadrao={editando === 'nova' ? donoNovo : null} onClose={() => setEditando(null)} />}
    </>
  );
}
