import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { iniciais, nomeMes } from './format';
import { Icon } from './icons';
import { Ajustes } from './pages/Ajustes';
import { Cartoes } from './pages/Cartoes';
import { Contas } from './pages/Contas';
import { Historico } from './pages/Historico';
import { Metas } from './pages/Metas';
import { MeusGastos } from './pages/MeusGastos';
import { Perfil } from './pages/Perfil';
import { PessoaModal } from './components/GastosPessoa';
import { Onboarding } from './pages/Onboarding';
import { Renda } from './pages/Renda';
import { VisaoGeral } from './pages/VisaoGeral';
import type { Estado, Mes, Pessoa } from './types';
import { AppCtx, Toaster, type ToastItem } from './ui';

const NAV = [
  { id: 'geral', nome: 'Visão geral', icon: Icon.grid },
  { id: 'meus', nome: 'Meus gastos', icon: Icon.renda },
  { id: 'contas', nome: 'Lançamentos', icon: Icon.lista },
  { id: 'cartoes', nome: 'Cartões', icon: Icon.cartao },
  { id: 'metas', nome: 'Reserva e obra', icon: Icon.obra },
  { id: 'historico', nome: 'Histórico', icon: Icon.grafico }
];
const NAV_AJUSTES = [
  { id: 'renda', nome: 'Nossa renda', icon: Icon.reserva },
  { id: 'ajustes', nome: 'Configurações', icon: Icon.engrenagem }
];

function lerTema(): 'light' | 'dark' {
  try { return localStorage.getItem('duofinn-tema') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

export function App() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [pagina, setPagina] = useState('geral');
  const [tema, setTema] = useState(lerTema);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [perfilId, setPerfilId] = useState<number | null>(null);
  const [vendoPessoa, setVendoPessoa] = useState<number | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem('duofinn-tema', tema); } catch { /* sem storage */ }
  }, [tema]);

  const carregarEstado = useCallback(() => api.estado().then(setEstado).catch((e: Error) => setErro(e.message)), []);
  useEffect(() => { carregarEstado(); }, [carregarEstado, versao]);

  const toast = useCallback((msg: string, tipo?: 'ok' | 'erro') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, msg, tipo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tipo === 'erro' ? 5000 : 2800);
  }, []);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  const trocarMes = useCallback(async (m: Mes) => {
    try {
      const r = await api.definirMes(m);
      if (r.criadas) toast(`Mês de ${nomeMes(m)} aberto com ${r.criadas} contas recorrentes`, 'ok');
      recarregar();
    } catch (e) { toast((e as Error).message, 'erro'); }
  }, [recarregar, toast]);

  const trocarPerfil = useCallback(() => { setPerfilId(null); setPagina('geral'); setVendoPessoa(null); }, []);
  // o perfil vem sempre do estado atual (nome/PIN podem mudar)
  const perfil: Pessoa | undefined = estado && estado.pronto ? estado.pessoas.find((p) => p.id === perfilId) : undefined;

  const ctx = useMemo(() => (estado && estado.pronto && perfil ? {
    estado, perfil, trocarPerfil, verPessoa: setVendoPessoa,
    mes: estado.config.mes_referencia, versao, recarregar, trocarMes, toast
  } : null), [estado, perfil, trocarPerfil, versao, recarregar, trocarMes, toast]);

  if (erro) return <div className="onb"><div className="glass"><h1 className="page-title">Não foi possível abrir os dados</h1><p className="erro">{erro}</p></div></div>;
  if (!estado) return null;
  if (!estado.pronto) return <><Onboarding pronto={recarregar} /><Toaster itens={toasts} /></>;
  if (!ctx) return <Perfil pessoas={estado.pessoas} nomeCasa={estado.casal.nome} onEntrar={(p) => setPerfilId(p.id)} />;

  const [p1, p2] = estado.pessoas;
  const Item = ({ n }: { n: typeof NAV[number] }) => (
    <button className={`nav-item${pagina === n.id ? ' active' : ''}`} type="button" aria-current={pagina === n.id ? 'page' : undefined} onClick={() => setPagina(n.id)}>
      <n.icon />{n.nome}
    </button>
  );

  return (
    <AppCtx.Provider value={ctx}>
      <div className={`app${pagina === 'geral' ? ' com-lateral' : ''}`}>
        <aside className="glass sidebar" aria-label="Navegação principal">
          <div className="brand">
            <div className="brand-logo" aria-hidden="true">D</div>
            <div>
              <div className="brand-name">Duo Finn</div>
              <div className="label">{estado.casal.nome}</div>
            </div>
          </div>
          <nav className="nav" aria-label="Menu">
            {NAV.map((n) => <Item key={n.id} n={n} />)}
            <div className="nav-title">Ajustes</div>
            {NAV_AJUSTES.map((n) => <Item key={n.id} n={n} />)}
          </nav>
          <div className="sidebar-foot">
            <div className="theme-toggle">
              <span>{tema === 'dark' ? 'Tema escuro' : 'Tema claro'}</span>
              <button className="switch" type="button" role="switch" aria-checked={tema === 'dark'} aria-label="Alternar tema claro e escuro"
                onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')} />
            </div>
            <div className="duo">
              {[p1, p2].map((p) => (
                <button key={p.id} type="button" className="duo-row btn-row" onClick={() => setVendoPessoa(p.id)} title={`Ver gastos de ${p.nome}`}>
                  <span className={`avatar ${p.ordem === 1 ? 'p1' : 'p2'}`}>{iniciais(p.nome)}</span>{p.nome}
                  {p.id === ctx.perfil.id && <span className="voce">você</span>}
                </button>
              ))}
              <button type="button" className="btn sm ghost" onClick={trocarPerfil}>Trocar perfil</button>
            </div>
          </div>
        </aside>

        {pagina === 'geral' && <VisaoGeral irPara={setPagina} />}
        {pagina === 'meus' && <MeusGastos />}
        {pagina === 'contas' && <Contas />}
        {pagina === 'cartoes' && <Cartoes />}
        {pagina === 'metas' && <Metas />}
        {pagina === 'historico' && <Historico />}
        {pagina === 'renda' && <Renda />}
        {pagina === 'ajustes' && <Ajustes />}
      </div>
      {vendoPessoa != null && <PessoaModal pessoaId={vendoPessoa} onClose={() => setVendoPessoa(null)} />}
      <Toaster itens={toasts} />
    </AppCtx.Provider>
  );
}
