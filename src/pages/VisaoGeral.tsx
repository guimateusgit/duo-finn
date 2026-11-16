import { useMemo, useState } from 'react';
import { api } from '../api';
import { ContaModal } from '../components/ContaModal';
import { Header } from '../components/Header';
import { brl, dia2, mesCurto, nomeMes, pct } from '../format';
import { CatIcon, Icon } from '../icons';
import type { Conta } from '../types';
import { Check, Ring, useAcao, useApp, useDados } from '../ui';

interface Props { irPara: (p: string) => void }

export function VisaoGeral({ irPara }: Props) {
  const { estado, mes, toast } = useApp();
  const acao = useAcao();
  const [p1, p2] = estado.pessoas;

  const { dados: resumo } = useDados(() => api.resumo(mes), [mes]);
  const { dados: contas } = useDados(() => api.listarContas(mes), [mes]);
  const { dados: cartoes } = useDados(() => api.listarCartoes(mes), [mes]);
  const { dados: metas } = useDados(() => api.listarMetas(), []);

  const [editando, setEditando] = useState<Conta | null | 'nova'>(null);
  const [quem, setQuem] = useState<1 | 2>(1);

  // ----- contas a pagar (contas da casa + faturas do mês) -----
  const aPagar = useMemo(() => {
    const itens: { chave: string; nome: string; valor: number; dia: number; cat: string; pagar: () => Promise<unknown> }[] = [];
    (contas ?? []).filter((c) => !c.pago).forEach((c) => itens.push({
      chave: `c${c.id}`, nome: c.nome, valor: c.valor, dia: c.dia_vencimento ?? 31, cat: c.categoria,
      pagar: () => api.marcarPago(c.id, true)
    }));
    (cartoes ?? []).forEach((k) => {
      const f = k.faturas[0];
      if (f && f.valor > 0 && !f.paga) itens.push({
        chave: `f${k.id}`, nome: `Fatura ${k.nome}`, valor: f.valor, dia: k.dia_vencimento ?? 31, cat: 'cartao',
        pagar: () => api.salvarFatura({ cartao_id: k.id, mes_referencia: f.mes_referencia, valor: f.valor, paga: true })
      });
    });
    return itens.sort((a, b) => a.dia - b.dia);
  }, [contas, cartoes]);

  const dias = [...new Set(aPagar.map((i) => i.dia))];
  const hoje = new Date();
  const ehMesAtual = mes === `${hoje.getFullYear()}-${dia2(hoje.getMonth() + 1)}`;
  const [diaSel, setDiaSel] = useState<number | null>(null);
  const diaPadrao = (ehMesAtual ? dias.find((d) => d >= hoje.getDate()) : undefined) ?? dias[0];
  const dia = diaSel != null && dias.includes(diaSel) ? diaSel : diaPadrao;
  const ateODia = aPagar.filter((i) => dia != null && i.dia <= dia);

  if (!resumo || !contas || !cartoes || !metas) return <main className="main" />;

  const [r1, r2] = resumo.pessoas;
  const fixos = r1.gastos_fixos + r2.gastos_fixos;
  const diaADia = r1.dia_a_dia + r2.dia_a_dia;
  const base = Math.max(resumo.renda_total, resumo.total_casa + fixos + diaADia, 1);
  const w = (v: number) => `${Math.max(0, (v / base) * 100)}%`;
  const pctLivre = resumo.renda_total ? resumo.sobra_total / resumo.renda_total : 0;

  const cartao = cartoes[0];
  const proximas = [1, 2, 3].map((n) => ({
    mes: cartoes[0]?.faturas[n]?.mes_referencia ?? '',
    valor: cartoes.reduce((a, k) => a + (k.faturas[n]?.valor ?? 0), 0)
  }));
  const maxFat = Math.max(...proximas.map((p) => p.valor), 1);
  const pctP1 = resumo.total_casa ? resumo.paga_pessoa1 / resumo.total_casa : 0.5;

  function resumoTexto() {
    return [
      `Duo Finn — Resumo de ${nomeMes(mes)}`,
      `Total da casa: ${brl(resumo!.total_casa)} (${brl(resumo!.total_pago)} já pago)`,
      `${p1.nome} paga ${pct(pctP1)}: ${brl(resumo!.paga_pessoa1)}`,
      `${p2.nome} paga ${pct(1 - pctP1)}: ${brl(resumo!.paga_pessoa2)}`,
      `Saldo previsto do casal: ${brl(resumo!.sobra_total)}`,
      `Ainda a pagar: ${brl(resumo!.total_pendente)}`
    ].join('\n');
  }

  return (
    <>
      <main className="main">
        <Header
          titulo="Visão geral do casal"
          sub="Tudo o que entra, sai e sobra na casa de vocês, num só lugar."
          acoes={<>
            <button className="btn sec" type="button" onClick={() =>
              navigator.clipboard.writeText(resumoTexto()).then(() => toast('Resumo copiado', 'ok'), () => toast('Não foi possível copiar', 'erro'))}>
              <Icon.copiar /> Copiar resumo
            </button>
            <button className="btn sec" type="button" onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(resumoTexto()))}>
              WhatsApp
            </button>
            <button className="btn" type="button" onClick={() => setEditando('nova')}><Icon.mais /> Nova conta</button>
          </>}
        />

        <section className="glass card tint-hero">
          <div className="card-head">
            <div>
              <h2 className="card-title">Saldo previsto</h2>
              <p className="card-sub">O que sobra da renda depois de casa, contas pessoais e dia a dia.</p>
            </div>
            <span className={`badge ${pctLivre < 0 ? '' : 'blue'}`}>{pct(pctLivre)} da renda livre</span>
          </div>
          <div className={`big${resumo.sobra_total < 0 ? ' neg' : ''}`}>{brl(resumo.sobra_total)}</div>
          <div className="label">Valor livre estimado do casal até o fim do mês</div>
          <div className="seg" role="img" aria-label="Distribuição da renda">
            <span style={{ width: w(resumo.total_casa), background: 'var(--accent)' }} />
            <span style={{ width: w(fixos), background: '#7aa6ff' }} />
            <span style={{ width: w(diaADia), background: 'var(--pink)' }} />
            <span style={{ width: w(Math.max(0, resumo.sobra_total)), background: '#fbb6c6' }} />
          </div>
          <div className="legend">
            <span>Renda<b>{brl(resumo.renda_total)}</b></span>
            <span><i className="dot" style={{ background: 'var(--accent)' }} />Casa<b>{brl(resumo.total_casa)}</b></span>
            <span><i className="dot" style={{ background: '#7aa6ff' }} />Contas pessoais<b>{brl(fixos)}</b></span>
            <span><i className="dot" style={{ background: 'var(--pink)' }} />Dia a dia<b>{brl(diaADia)}</b></span>
            <span><i className="dot" style={{ background: '#fbb6c6' }} />Sobra<b>{brl(resumo.sobra_total)}</b></span>
          </div>
        </section>

        <div className="cols-2">
          <section className="glass card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Divisão da casa</h2>
                <p className="card-sub">Quanto cada um paga do total mensal da casa.</p>
              </div>
              <span className="badge blue">{estado.config.modo_divisao === 'igual' ? 'Meio a meio' : 'Pela renda'}</span>
            </div>
            <div className="big md">{brl(resumo.total_casa)}</div>
            <div className="label">Total mensal da casa</div>
            <div className="split" role="img" aria-label={`${p1.nome} paga ${pct(pctP1)}, ${p2.nome} paga ${pct(1 - pctP1)}`}>
              <span style={{ width: `${pctP1 * 100}%`, background: 'var(--accent)' }} />
              <span style={{ width: `${(1 - pctP1) * 100}%`, background: 'var(--pink)' }} />
            </div>
            {[r1, r2].map((p, i) => (
              <div className="row" key={p.id}>
                <span className="row-left"><i className={`dot ${i ? 'p2' : 'p1'}`} />{p.nome} paga {pct(i ? 1 - pctP1 : pctP1)}</span>
                <span className="row-val">{brl(p.parte_casa)}</span>
              </div>
            ))}
          </section>

          <section className="glass card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Cartões</h2>
                <p className="card-sub">{cartao ? 'Limite e vencimento do cartão principal.' : 'Nenhum cartão cadastrado.'}</p>
              </div>
              {cartao && <span className={`badge ${cartao.faturas[0]?.paga ? 'ok' : 'blue'}`}>{cartao.faturas[0]?.paga ? 'Paga' : 'Aberta'}</span>}
            </div>
            {cartao ? (
              <>
                <div className="row-left" style={{ marginBottom: 10 }}>
                  <CatIcon cat="cartao" />
                  <div><div style={{ fontWeight: 600 }}>{cartao.nome}</div>{cartao.final && <div className="label">Final {cartao.final}</div>}</div>
                </div>
                <div className="label">Limite disponível</div>
                <div className="big sm">{brl(cartao.disponivel)}</div>
                <div className="card-foot">
                  <span>{cartao.dia_vencimento ? `Vence dia ${dia2(cartao.dia_vencimento)}` : 'Sem vencimento'}</span>
                  <span>Fatura atual <strong>{brl(cartao.faturas[0]?.valor ?? 0)}</strong></span>
                </div>
              </>
            ) : (
              <div className="empty"><button className="btn sec" type="button" onClick={() => irPara('cartoes')}><Icon.mais /> Cadastrar cartão</button></div>
            )}
          </section>
        </div>

        <section className="glass card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Contas da casa</h2>
              <p className="card-sub">Clique numa conta para editar. O quadrado marca como paga.</p>
            </div>
            <span className="badge blue">{contas.length} {contas.length === 1 ? 'item' : 'itens'}</span>
          </div>
          {contas.length === 0 ? (
            <div className="empty">
              Nenhuma conta neste mês ainda.
              <button className="btn" type="button" onClick={() => setEditando('nova')}><Icon.mais /> Adicionar a primeira conta</button>
            </div>
          ) : (
            <div>
              {contas.map((c) => (
                <div className={`row${c.pago ? ' pago' : ''}`} key={c.id}>
                  <button type="button" className="row-left" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flex: 1 }} onClick={() => setEditando(c)}>
                    <CatIcon cat={c.categoria} />
                    <div>
                      <div className="row-name">{c.nome}</div>
                      <div className="label">{c.dia_vencimento ? `Vence dia ${dia2(c.dia_vencimento)}` : 'Sem vencimento'}</div>
                    </div>
                  </button>
                  <span className="row-val">{brl(c.valor)}</span>
                  <Check on={c.pago} label={c.pago ? 'Marcar como não paga' : 'Marcar como paga'}
                    onToggle={() => acao(() => api.marcarPago(c.id, !c.pago))} />
                </div>
              ))}
            </div>
          )}
          <div className="card-foot">
            <span>Pago {brl(resumo.total_pago)} · falta {brl(resumo.total_pendente)}</span>
            <span>Total <strong>{brl(resumo.total_casa)}</strong></span>
          </div>
        </section>

        <div className="cols-2">
          <section className="glass card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Próximas faturas</h2>
                <p className="card-sub">Soma dos cartões nos próximos meses.</p>
              </div>
            </div>
            {cartoes.length === 0 ? <div className="empty">Cadastre um cartão para ver as próximas faturas.</div> : (
              <div className="bars">
                {proximas.map((f) => (
                  <div className="bar-col" key={f.mes}>
                    <div className="v">{brl(f.valor)}</div>
                    <div className="bar" style={{ height: `${(f.valor / maxFat) * 110}px` }} />
                    <span className="m">{mesCurto(f.mes, f.mes.slice(0, 4) !== mes.slice(0, 4))}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Reserva e obra</h2>
                <p className="card-sub">O quanto já foi guardado para cada objetivo.</p>
              </div>
            </div>
            {metas.length === 0 ? (
              <div className="empty"><button className="btn sec" type="button" onClick={() => irPara('metas')}><Icon.mais /> Criar meta</button></div>
            ) : metas.slice(0, 3).map((m) => (
              <div key={m.id} style={{ marginBottom: 12 }}>
                <div className="row" style={{ padding: '4px 8px' }}>
                  <span className="row-left"><CatIcon cat={m.tipo === 'obra' ? 'obra' : 'reserva'} /><span className="row-name">{m.nome}</span></span>
                  <span className="row-val">{brl(m.valor_atual)}</span>
                </div>
                <div className="progress"><span style={{ width: `${Math.min(100, m.valor_alvo ? (m.valor_atual / m.valor_alvo) * 100 : 0)}%` }} /></div>
                <div className="label" style={{ marginTop: 4 }}>
                  {m.valor_alvo ? `${pct(m.valor_atual / m.valor_alvo)} de ${brl(m.valor_alvo)}` : 'Sem valor-alvo'}
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>

      <aside className="side">
        <section className="glass card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Contas a pagar</h2>
              <p className="card-sub">Escolha o dia para ver o que vence até ele.</p>
            </div>
          </div>
          {aPagar.length === 0 ? (
            <div className="empty"><span className="badge ok">Tudo pago neste mês</span></div>
          ) : (
            <>
              <div className="pills" role="group" aria-label="Dia de vencimento">
                {dias.map((d) => (
                  <button key={d} type="button" className={`pill${d === dia ? ' active' : ''}`} aria-pressed={d === dia} onClick={() => setDiaSel(d)}>
                    {dia2(d)}
                  </button>
                ))}
              </div>
              <div className="big sm">{brl(ateODia.reduce((a, i) => a + i.valor, 0))}</div>
              <div className="label">Total a pagar até o dia {dia2(dia ?? 1)}</div>
              <div style={{ marginTop: 10 }}>
                {ateODia.map((i) => (
                  <div className="row" key={i.chave}>
                    <span className="row-left">
                      <CatIcon cat={i.cat} />
                      <div><div className="row-name">{i.nome}</div><div className="label">Dia {dia2(i.dia)}</div></div>
                    </span>
                    <span className="row-val">{brl(i.valor)}</span>
                    <Check on={false} label="Marcar como paga" onToggle={() => acao(i.pagar, `${i.nome} marcada como paga`)} />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="glass card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Moradia</h2>
              <p className="card-sub">Quanto da renda do casal vai para morar.</p>
            </div>
            <span className={`badge ${resumo.moradia.pct_renda > resumo.moradia.meta ? 'warn' : 'blue'}`}>Meta {pct(resumo.moradia.meta)}</span>
          </div>
          <div className="ring-wrap">
            <Ring valor={resumo.moradia.pct_renda} cor={resumo.moradia.pct_renda > resumo.moradia.meta ? 'var(--pink)' : 'var(--accent)'} />
            <div>
              <div className="big sm" style={{ margin: 0 }}>{brl(resumo.moradia.valor)}</div>
              <div className="label">Aluguel/moradia + condomínio, {pct(resumo.moradia.pct_renda)} da renda.</div>
            </div>
          </div>
        </section>

        <section className="glass card">
          <div className="card-head">
            <div>
              <h2 className="card-title">O que entra na conta</h2>
              <p className="card-sub">Cada item da casa e a parte de cada um.</p>
            </div>
          </div>
          <div className="seg-ctl" role="group" aria-label="Pessoa" style={{ marginBottom: 10 }}>
            <button type="button" aria-pressed={quem === 1} onClick={() => setQuem(1)}>{p1.nome}</button>
            <button type="button" aria-pressed={quem === 2} onClick={() => setQuem(2)}>{p2.nome}</button>
          </div>
          {contas.map((c) => (
            <div className="row" key={c.id}>
              <span className="row-left"><CatIcon cat={c.categoria} /><span className="row-name">{c.nome}</span></span>
              <span className="row-val">{brl(quem === 1 ? c.parte1 : c.parte2)}</span>
            </div>
          ))}
          <div className="card-foot"><span>Total do rateio</span><strong>{brl(quem === 1 ? resumo.paga_pessoa1 : resumo.paga_pessoa2)}</strong></div>
        </section>
      </aside>

      {editando && <ContaModal conta={editando === 'nova' ? null : editando} onClose={() => setEditando(null)} />}
    </>
  );
}
