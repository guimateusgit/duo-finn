import { useState } from 'react';
import { api } from '../api';
import { brl, dia2, iniciais } from '../format';
import { CatIcon, Icon, nomeCategoria } from '../icons';
import type { Cartao, Conta, Meta } from '../types';
import { CartaoModal } from '../pages/Cartoes';
import { MetaModal } from '../pages/Metas';
import { Check, Modal, useAcao, useApp, useDados } from '../ui';
import { ContaModal } from './ContaModal';

/** Números do mês de uma pessoa: renda, parte da casa, gastos pessoais e sobra. */
export function ResumoPessoa({ pessoaId }: { pessoaId: number }) {
  const { mes } = useApp();
  const { dados: r } = useDados(() => api.resumo(mes), [mes]);
  const p = r?.pessoas.find((x) => x.id === pessoaId);
  if (!p) return null;
  const itens = [
    { rotulo: 'Renda', valor: p.renda },
    { rotulo: 'Parte da casa', valor: p.parte_casa },
    { rotulo: 'Gastos pessoais', valor: p.gastos_pessoais },
    { rotulo: 'Sobra prevista', valor: p.sobra, destaque: true }
  ];
  return (
    <div className="mini-kpis">
      {itens.map((i) => (
        <div key={i.rotulo} className={`mini-kpi${i.destaque ? ' destaque' : ''}`}>
          <span className="label">{i.rotulo}</span>
          <strong className={i.valor < 0 ? 'neg' : ''}>{brl(i.valor)}</strong>
        </div>
      ))}
    </div>
  );
}

/** Lista dos gastos só daquela pessoa no mês, com marcar como pago e editar. */
export function ListaGastosPessoa({ pessoaId, onNovo }: { pessoaId: number; onNovo?: () => void }) {
  const { mes } = useApp();
  const acao = useAcao();
  const { dados: contas } = useDados(() => api.listarContas(mes, pessoaId), [mes, pessoaId]);
  const [editando, setEditando] = useState<Conta | null>(null);

  if (!contas) return null;
  const total = contas.reduce((a, c) => a + c.valor, 0);
  const pendente = contas.filter((c) => !c.pago).reduce((a, c) => a + c.valor, 0);

  return (
    <>
      {contas.length === 0 ? (
        <div className="empty">
          Nenhum gasto pessoal neste mês.
          {onNovo && <button className="btn sec" type="button" onClick={onNovo}><Icon.mais /> Lançar gasto</button>}
        </div>
      ) : contas.map((c) => (
        <div className={`row${c.pago ? ' pago' : ''}`} key={c.id}>
          <button type="button" className="row-left row-btn" onClick={() => setEditando(c)}>
            <CatIcon cat={c.categoria} />
            <div>
              <div className="row-name">{c.nome}</div>
              <div className="label">
                {nomeCategoria(c.categoria)}{c.dia_vencimento ? ` · dia ${dia2(c.dia_vencimento)}` : ''}{c.recorrente ? ' · todo mês' : ''}
              </div>
            </div>
          </button>
          <span className="row-val">{brl(c.valor)}</span>
          <Check on={c.pago} label={c.pago ? 'Marcar como não pago' : 'Marcar como pago'} onToggle={() => acao(() => api.marcarPago(c.id, !c.pago))} />
        </div>
      ))}
      {contas.length > 0 && (
        <div className="card-foot">
          <span>Falta pagar {brl(pendente)}</span>
          <span>Total <strong>{brl(total)}</strong></span>
        </div>
      )}
      {editando && <ContaModal conta={editando} onClose={() => setEditando(null)} />}
    </>
  );
}

/** Janela aberta ao clicar no nome de alguém no dashboard ou na barra lateral. */
export function PessoaModal({ pessoaId, onClose }: { pessoaId: number; onClose: () => void }) {
  const { estado } = useApp();
  const pessoa = estado.pessoas.find((p) => p.id === pessoaId);
  const [novo, setNovo] = useState(false);
  if (!pessoa) return null;
  return (
    <>
      <Modal
        titulo={`Só de ${pessoa.nome}`}
        sub="Gastos, cartões e metas só dessa pessoa. Nada disso entra na divisão da casa."
        onClose={onClose}
        rodape={<div className="dir"><button className="btn" type="button" onClick={() => setNovo(true)}><Icon.mais /> Gasto de {pessoa.nome}</button></div>}
      >
        <div className="row-left" style={{ gap: 10 }}>
          <span className={`avatar ${pessoa.ordem === 1 ? 'p1' : 'p2'}`}>{iniciais(pessoa.nome)}</span>
          <strong>{pessoa.nome}</strong>
        </div>
        <ResumoPessoa pessoaId={pessoa.id} />
        <div>
          <div className="sec-title" style={{ marginTop: 0 }}>Gastos</div>
          <ListaGastosPessoa pessoaId={pessoa.id} onNovo={() => setNovo(true)} />
          <CartoesMetasPessoa pessoaId={pessoa.id} />
        </div>
      </Modal>
      {novo && <ContaModal conta={null} donoPadrao={pessoa.id} onClose={() => setNovo(false)} />}
    </>
  );
}

/** Cartões e metas que são só daquela pessoa (editáveis). */
export function CartoesMetasPessoa({ pessoaId, comBotoes = false }: { pessoaId: number; comBotoes?: boolean }) {
  const { mes } = useApp();
  const { dados: cartoes } = useDados(() => api.listarCartoes(mes, pessoaId), [mes, pessoaId]);
  const { dados: metas } = useDados(() => api.listarMetas(pessoaId), [pessoaId]);
  const [cartao, setCartao] = useState<Cartao | null | 'novo'>(null);
  const [meta, setMeta] = useState<Meta | null | 'nova'>(null);
  if (!cartoes || !metas) return null;

  return (
    <>
      <div className="sec-title">Cartões</div>
      {cartoes.length === 0 && <div className="label" style={{ padding: '4px 0' }}>Nenhum cartão só dessa pessoa.</div>}
      {cartoes.map((c) => (
        <div className="row" key={c.id}>
          <button type="button" className="row-left row-btn" onClick={() => setCartao(c)}>
            <CatIcon cat="cartao" />
            <div>
              <div className="row-name">{c.nome}{c.final ? ` · final ${c.final}` : ''}</div>
              <div className="label">Fatura do mês {brl(c.faturas[0]?.valor ?? 0)}{c.dia_vencimento ? ` · vence dia ${dia2(c.dia_vencimento)}` : ''}</div>
            </div>
          </button>
          <span className="row-val">{brl(c.disponivel)}<span className="label" style={{ display: 'block', textAlign: 'right', fontWeight: 400 }}>disponível</span></span>
        </div>
      ))}
      {comBotoes && <button className="btn sm sec" type="button" style={{ marginTop: 6 }} onClick={() => setCartao('novo')}><Icon.mais /> Cartão</button>}

      <div className="sec-title">Metas</div>
      {metas.length === 0 && <div className="label" style={{ padding: '4px 0' }}>Nenhuma meta só dessa pessoa.</div>}
      {metas.map((m) => (
        <div key={m.id} style={{ marginBottom: 8 }}>
          <div className="row" style={{ padding: '4px 8px' }}>
            <button type="button" className="row-left row-btn" onClick={() => setMeta(m)}>
              <CatIcon cat={m.tipo === 'obra' ? 'obra' : 'reserva'} /><span className="row-name">{m.nome}</span>
            </button>
            <span className="row-val">{brl(m.valor_atual)}</span>
          </div>
          <div className="progress"><span style={{ width: `${Math.min(100, m.valor_alvo ? (m.valor_atual / m.valor_alvo) * 100 : 0)}%` }} /></div>
        </div>
      ))}
      {comBotoes && <button className="btn sm sec" type="button" style={{ marginTop: 6 }} onClick={() => setMeta('nova')}><Icon.mais /> Meta</button>}

      {cartao && <CartaoModal cartao={cartao === 'novo' ? null : cartao} donoPadrao={pessoaId} onClose={() => setCartao(null)} />}
      {meta && <MetaModal meta={meta === 'nova' ? null : meta} donoPadrao={pessoaId} onClose={() => setMeta(null)} />}
    </>
  );
}
