// Ponte segura entre a interface e a camada de dados. A interface não tem
// acesso ao Node nem ao arquivo do banco: só a estes métodos.
const { contextBridge, ipcRenderer } = require('electron');

const METODOS = [
  'estado', 'configurarCasal', 'atualizarPessoa', 'entrar', 'definirPin', 'atualizarConfig',
  'percentuaisPadrao', 'definirMes',
  'listarContas', 'salvarConta', 'definirDono', 'removerConta', 'marcarPago', 'redividirMes',
  'listarCartoes', 'salvarCartao', 'removerCartao', 'salvarFatura',
  'listarMetas', 'salvarMeta', 'removerMeta',
  'resumo', 'historico'
];

const api = {};
for (const m of METODOS) api[m] = (...args) => ipcRenderer.invoke('db', m, args);
api.exportarBackup = () => ipcRenderer.invoke('backup:exportar');
api.restaurarBackup = () => ipcRenderer.invoke('backup:restaurar');
api.abrirPastaDados = () => ipcRenderer.invoke('app:pastaDados');

contextBridge.exposeInMainWorld('duofinn', api);
