import { useState } from 'react';
import { api } from '../api';
import { Header } from '../components/Header';
import { DonoBadge, DonoFiltro, DonoSelect, type Escopo } from '../components/Dono';
import { brl, dia2, mesCurto } from '../format';
import { CatIcon, Icon } from '../icons';
import type { Cartao, Fatura } from '../types';
import { Check, Field, Modal, MoneyInput, useAcao, useApp, useDados } from '../ui';

export function CartaoModal({ cartao, donoPadrao = null, onClose }: { cartao: Cartao | null; donoPadrao?: number | null; onClose: () => void }) {
  const acao = useAcao();
  const [dono, setDono] = useState<number | null>(cartao ? cartao.pessoa_id : donoPadrao);
  const [nome, setNome] = useState(cartao?.nome ?? '');
  const [final, setFinal] = useState(cartao?.final ?? '');
  const [limite, setLimite] = useState(cartao?.limite ?? 0);
  const [dia, setDia] = useState(cartao?.dia_vencimento ? String(cartao.dia_vencimento) : '');

  async function salvar() {
    const r = await acao(() => api.salvarCartao({
      id: cartao?.id, pessoa_id: dono, nome, final: final || null, limite, dia_vencimento: dia ? Number(dia) : null
    }), cartao ? 'Cartão atualizado' : 'Cartão cadastrado');
    if (r) onClose();
  }
  async function remover() {
    if (!cartao || !window.confirm(`Remover o cartão "${cartao.nome}" e todas as faturas dele?`)) return;
    if (await acao(() => api.removerCartao(cartao.id), 'Cartão removido')) onClose();
  }

  return (
    <Modal titulo={cartao ? 'Editar cartão' : 'Novo cartão'} onClose={onClose} rodape={<>
      {cartao && <button className="btn danger" type="button" onClick={remover}>Remover</button>}
      <div className="dir">
        <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
        <button className="btn" type="button" onClick={salvar} disabled={!nome.trim()}>Salvar</button>
      </div>
    </>}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <div className="field full"><span>De quem é?</span><DonoSelect value={dono} onChange={setDono} rotuloCasa="Da casa" ariaLabel="De quem é o cartão" /></div>
        <Field label="Nome do cartão" full><input className="input" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Cartão da casa" /></Field>
        <Field label="Final" hint="Só os 4 últimos dígitos."><input className="input" maxLength={4} inputMode="numeric" value={final} onChange={(e) => setFinal(e.target.value.replace(/\D/g, ''))} placeholder="0000" /></Field>
        <Field label="Dia de vencimento"><input className="input" type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} /></Field>
        <Field label="Limite total (R$)" full><MoneyInput value={limite} onChange={setLimite} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function FaturaCell({ cartaoId, f, atual }: { cartaoId: number; f: Fatura; atual: boolean }) {
  const acao = useAcao();
  const [valor, setValor] = useState(f.valor);
  const grava = (v: number, paga: boolean) =>
    acao(() => api.salvarFatura({ cartao_id: cartaoId, mes_referencia: f.mes_referencia, valor: v, paga }));
  return (
    <div className={`fat-cell${atual ? ' atual' : ''}`}>
      <div className="row" style={{ padding: 0, margin: 0 }}>
        <span className="label" style={{ fontWeight: 600 }}>{mesCurto(f.mes_referencia, true)}</span>
        <Check on={f.paga} label={f.paga ? 'Marcar como em aberto' : 'Marcar fatura como paga'} onToggle={() => grava(valor, !f.paga)} />
      </div>
      <div onBlur={() => { if (valor !== f.valor) grava(valor, f.paga); }}>
        <MoneyInput inline value={valor} onChange={setValor} ariaLabel={`Fatura de ${mesCurto(f.mes_referencia, true)}`} />
      </div>
    </div>
  );
}

export function Cartoes() {
  const { mes } = useApp();
  const [escopo, setEscopo] = useState<Escopo>('todas');
  const { dados: cartoes } = useDados(() => api.listarCartoes(mes, escopo), [mes, escopo]);
  const [editando, setEditando] = useState<Cartao | null | 'novo'>(null);

  return (
    <main className="main">
      <Header
        titulo="Cartões"
        sub="Limites, vencimentos e o valor das faturas deste mês e dos próximos três."
        acoes={<button className="btn" type="button" onClick={() => setEditando('novo')}><Icon.mais /> Novo cartão</button>}
      />
      <div className="filtros"><DonoFiltro value={escopo} onChange={setEscopo} rotuloCasa="Da casa" /></div>
      {cartoes && cartoes.length === 0 && (
        <section className="glass card"><div className="empty">
          {escopo === 'todas' ? 'Nenhum cartão cadastrado.' : 'Nenhum cartão neste filtro.'}
          <button className="btn" type="button" onClick={() => setEditando('novo')}><Icon.mais /> Cadastrar cartão</button>
        </div></section>
      )}
      <div className="grid-cartoes">
        {(cartoes ?? []).map((c) => {
          const usado = c.limite - c.disponivel;
          return (
            <section className="glass card" key={c.id}>
              <div className="card-head">
                <div className="row-left">
                  <CatIcon cat="cartao" />
                  <div>
                    <h2 className="card-title">{c.nome}</h2>
                    <p className="card-sub">{c.final ? `Final ${c.final} · ` : ''}{c.dia_vencimento ? `vence dia ${dia2(c.dia_vencimento)}` : 'sem vencimento'}</p>
                  </div>
                </div>
                <span className="row-left" style={{ gap: 4 }}>
                  <DonoBadge pessoaId={c.pessoa_id} rotuloCasa="Da casa" />
                  <button className="icon-btn" type="button" aria-label={`Editar ${c.nome}`} onClick={() => setEditando(c)}><Icon.editar /></button>
                </span>
              </div>
              <div className="label">Limite disponível</div>
              <div className={`big sm${c.disponivel < 0 ? ' neg' : ''}`}>{brl(c.disponivel)}</div>
              <div className="progress"><span style={{ width: `${c.limite ? Math.min(100, (usado / c.limite) * 100) : 0}%`, background: usado > c.limite * 0.8 ? 'var(--pink)' : 'var(--accent)' }} /></div>
              <div className="label" style={{ marginTop: 4 }}>{brl(usado)} comprometidos de {brl(c.limite)}</div>
              <div className="fat-grid">
                {c.faturas.map((f, i) => <FaturaCell key={`${c.id}-${f.mes_referencia}-${f.valor}-${f.paga}`} cartaoId={c.id} f={f} atual={i === 0} />)}
              </div>
              <p className="label" style={{ marginTop: 10 }}>Digite o valor de cada fatura e clique fora para salvar. O quadrado marca como paga.</p>
            </section>
          );
        })}
      </div>
      {editando && <CartaoModal cartao={editando === 'novo' ? null : editando} donoPadrao={typeof escopo === 'number' ? escopo : null} onClose={() => setEditando(null)} />}
    </main>
  );
}
