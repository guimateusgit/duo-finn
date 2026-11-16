import { useState } from 'react';
import { api } from '../api';
import { ContaModal } from '../components/ContaModal';
import { Header } from '../components/Header';
import { brl, dia2, pct } from '../format';
import { CatIcon, Icon, nomeCategoria } from '../icons';
import type { Conta } from '../types';
import { Check, useAcao, useApp, useDados } from '../ui';

export function Contas() {
  const { estado, mes } = useApp();
  const acao = useAcao();
  const [p1, p2] = estado.pessoas;
  const { dados: contas } = useDados(() => api.listarContas(mes), [mes]);
  const [editando, setEditando] = useState<Conta | null | 'nova'>(null);
  const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'pagas'>('todas');

  const lista = (contas ?? []).filter((c) => filtro === 'todas' || (filtro === 'pagas' ? c.pago : !c.pago));
  const soma = (k: 'valor' | 'parte1' | 'parte2') => lista.reduce((a, c) => a + c[k], 0);

  async function redividir() {
    if (!window.confirm('Aplicar a divisão padrão a TODAS as contas deste mês? Divisões personalizadas serão substituídas.')) return;
    await acao(() => api.redividirMes(mes), 'Divisão padrão aplicada');
  }

  return (
    <>
      <main className="main">
        <Header
          titulo="Contas da casa"
          sub="Os gastos da casa no mês e a parte de cada um. Contas recorrentes são copiadas ao abrir o próximo mês."
          acoes={<>
            <button className="btn sec" type="button" onClick={redividir} disabled={!contas?.length}>Reaplicar divisão padrão</button>
            <button className="btn" type="button" onClick={() => setEditando('nova')}><Icon.mais /> Nova conta</button>
          </>}
        />
        <section className="glass card">
          <div className="card-head">
            <div className="seg-ctl" role="group" aria-label="Filtro">
              {(['todas', 'pendentes', 'pagas'] as const).map((f) => (
                <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <span className="badge blue">{lista.length} {lista.length === 1 ? 'conta' : 'contas'}</span>
          </div>

          {!contas ? null : lista.length === 0 ? (
            <div className="empty">
              {contas.length === 0 ? 'Nenhuma conta neste mês ainda.' : 'Nada neste filtro.'}
              {contas.length === 0 && <button className="btn" type="button" onClick={() => setEditando('nova')}><Icon.mais /> Adicionar conta</button>}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 34 }} aria-label="Paga" />
                    <th>Conta</th>
                    <th>Vence</th>
                    <th className="num">Valor</th>
                    <th className="num"><i className="dot p1" />{p1.nome}</th>
                    <th className="num"><i className="dot p2" />{p2.nome}</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((c) => {
                    const pp1 = c.valor ? c.parte1 / c.valor : 0;
                    return (
                      <tr key={c.id} className={c.pago ? 'pago' : ''}>
                        <td><Check on={c.pago} label={c.pago ? 'Marcar como não paga' : 'Marcar como paga'} onToggle={() => acao(() => api.marcarPago(c.id, !c.pago))} /></td>
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
                        <td className="tabular">{c.dia_vencimento ? `dia ${dia2(c.dia_vencimento)}` : '—'}</td>
                        <td className="num"><strong>{brl(c.valor)}</strong></td>
                        <td className="num">{brl(c.parte1)} <span className="label">{pct(pp1)}</span></td>
                        <td className="num">{brl(c.parte2)} <span className="label">{pct(1 - pp1)}</span></td>
                        <td><button className="icon-btn" type="button" aria-label={`Editar ${c.nome}`} onClick={() => setEditando(c)}><Icon.editar /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td /><td>Total</td><td />
                    <td className="num">{brl(soma('valor'))}</td>
                    <td className="num">{brl(soma('parte1'))}</td>
                    <td className="num">{brl(soma('parte2'))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </main>
      {editando && <ContaModal conta={editando === 'nova' ? null : editando} onClose={() => setEditando(null)} />}
    </>
  );
}
