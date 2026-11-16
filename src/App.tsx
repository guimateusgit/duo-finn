import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import { iniciais, nomeMes } from './format';
import { Icon } from './icons';
import { Ajustes } from './pages/Ajustes';
import { Cartoes } from './pages/Cartoes';
import { Contas } from './pages/Contas';
import { Historico } from './pages/Historico';
import { Metas } from './pages/Metas';
import { Onboarding } from './pages/Onboarding';
import { Renda } from './pages/Renda';
import { VisaoGeral } from './pages/VisaoGeral';
import type { Estado, Mes } from './types';
import { AppCtx, Toaster, type ToastItem } from './ui';

const NAV = [
  { id: 'geral', nome: 'Visão geral', icon: Icon.grid },
  { id: 'contas', nome: 'Contas da casa', icon: Icon.lista },
  { id: 'cartoes', nome: 'Cartões', icon: Icon.cartao },
  { id: 'metas', nome: 'Reserva e obra', icon: Icon.obra },
  { id: 'historico', nome: 'Histórico', icon: Icon.grafico }
];
const NAV_AJUSTES = [
  { id: 'renda', nome: 'Nossa renda', icon: Icon.renda },
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

  const ctx = useMemo(() => (estado && estado.pronto ? {
    estado, mes: estado.config.mes_referencia, versao, recarregar, trocarMes, toast
  } : null), [estado, versao, recarregar, trocarMes, toast]);

  if (erro) return <div className="onb"><div className="glass"><h1 className="page-title">Não foi possível abrir os dados</h1><p className="erro">{erro}</p></div></div>;
  if (!estado) return null;
  if (!estado.pronto || !ctx) return <><Onboarding pronto={recarregar} /><Toaster itens={toasts} /></>;

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
              <div className="duo-row"><span className="avatar p1">{iniciais(p1.nome)}</span>{p1.nome}</div>
              <div className="duo-row"><span className="avatar p2">{iniciais(p2.nome)}</span>{p2.nome}</div>
            </div>
          </div>
        </aside>

        {pagina === 'geral' && <VisaoGeral irPara={setPagina} />}
        {pagina === 'contas' && <Contas />}
        {pagina === 'cartoes' && <Cartoes />}
        {pagina === 'metas' && <Metas />}
        {pagina === 'historico' && <Historico />}
        {pagina === 'renda' && <Renda />}
        {pagina === 'ajustes' && <Ajustes />}
      </div>
      <Toaster itens={toasts} />
    </AppCtx.Provider>
  );
}
