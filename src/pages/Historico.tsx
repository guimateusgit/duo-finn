import { api } from '../api';
import { Header } from '../components/Header';
import { brl, brlCompact, mesCurto, nomeMesAno, pct } from '../format';
import { useApp, useDados } from '../ui';

export function Historico() {
  const { estado, trocarMes } = useApp();
  const [p1, p2] = estado.pessoas;
  const { dados } = useDados(() => api.historico(12), []);
  const linhas = dados ?? [];
  const cron = [...linhas].reverse();
  const max = Math.max(...cron.map((l) => l.total_casa), 1);
  const media = linhas.length ? linhas.reduce((a, l) => a + l.total_casa, 0) / linhas.length : 0;

  return (
    <main className="main">
      <Header titulo="Histórico" sub="Os últimos 12 meses da casa, direto da view resumo_mensal." />

      <section className="glass card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Total da casa por mês</h2>
            <p className="card-sub">Barra azul: parte de {p1.nome}. Rosa: parte de {p2.nome}.</p>
          </div>
          {linhas.length > 0 && <span className="badge blue">Média {brl(media)}</span>}
        </div>
        {cron.length === 0 ? <div className="empty">Ainda não há meses com contas.</div> : (
          <div className="bars" style={{ height: 220 }}>
            {cron.map((l) => (
              <div className="bar-col" key={l.mes_referencia} title={`${nomeMesAno(l.mes_referencia)}: ${brl(l.total_casa)}`}>
                <div className="v">{brlCompact(l.total_casa)}</div>
                <div style={{ width: '100%', maxWidth: 56, display: 'flex', flexDirection: 'column' }}>
                  <div className="bar pink" style={{ height: `${(l.paga_pessoa2 / max) * 160}px`, borderRadius: '10px 10px 0 0' }} />
                  <div className="bar" style={{ height: `${(l.paga_pessoa1 / max) * 160}px`, borderRadius: '0 0 4px 4px' }} />
                </div>
                <span className="m">{mesCurto(l.mes_referencia, true)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass card">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Mês</th>
                <th className="num">Total da casa</th>
                <th className="num"><i className="dot p1" />{p1.nome}</th>
                <th className="num"><i className="dot p2" />{p2.nome}</th>
                <th className="num">Pago</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.mes_referencia}>
                  <td>{nomeMesAno(l.mes_referencia)}</td>
                  <td className="num"><strong>{brl(l.total_casa)}</strong></td>
                  <td className="num">{brl(l.paga_pessoa1)}</td>
                  <td className="num">{brl(l.paga_pessoa2)}</td>
                  <td className="num">{l.total_casa ? pct(l.total_pago / l.total_casa) : '—'}</td>
                  <td className="num"><button className="btn sm ghost" type="button" onClick={() => trocarMes(l.mes_referencia)}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
