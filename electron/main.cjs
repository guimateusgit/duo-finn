const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const { migrate } = require('./schema.cjs');
const { createRepo, METODOS } = require('./repo.cjs');

// O banco fica na pasta de dados do usuário (no Windows:
// %APPDATA%\Duo Finn\duofinn.db). Reinstalar o app não apaga os dados.
const dbPath = () => path.join(app.getPath('userData'), 'duofinn.db');

let db;
let repo;

function abrirBanco() {
  fs.mkdirSync(path.dirname(dbPath()), { recursive: true });
  db = new Database(dbPath());
  migrate(db);
  repo = createRepo(db);
}

function backupAutomatico() {
  // Uma cópia por dia, mantendo as 14 mais recentes.
  const dir = path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const nome = `duofinn-${new Date().toISOString().slice(0, 10)}.db`;
  const destino = path.join(dir, nome);
  if (!fs.existsSync(destino)) db.backup(destino).catch(() => {});
  const antigos = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort().reverse().slice(14);
  antigos.forEach((f) => fs.rmSync(path.join(dir, f), { force: true }));
}

function criarJanela() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 980,
    minHeight: 640,
    title: 'Duo Finn',
    backgroundColor: '#EAF1FF',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Links externos abrem no navegador, nunca dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// Uma única instância: abrir o atalho de novo foca a janela existente.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [w] = BrowserWindow.getAllWindows();
    if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
  });

  app.whenReady().then(() => {
    abrirBanco();
    backupAutomatico();

    // Um canal só, com lista branca de métodos. Erros de regra de negócio
    // voltam como { ok: false, erro } para o front mostrar ao usuário.
    ipcMain.handle('db', (_e, metodo, args) => {
      if (!METODOS.includes(metodo)) return { ok: false, erro: `Método desconhecido: ${metodo}` };
      try {
        return { ok: true, dados: repo[metodo](...(args || [])) };
      } catch (err) {
        return { ok: false, erro: err.message };
      }
    });

    ipcMain.handle('backup:exportar', async () => {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Salvar cópia de segurança',
        defaultPath: `duofinn-backup-${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: 'Banco Duo Finn', extensions: ['db'] }]
      });
      if (canceled || !filePath) return { ok: false, erro: 'cancelado' };
      await db.backup(filePath);
      return { ok: true, dados: filePath };
    });

    ipcMain.handle('backup:restaurar', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Restaurar cópia de segurança',
        filters: [{ name: 'Banco Duo Finn', extensions: ['db'] }],
        properties: ['openFile']
      });
      if (canceled || !filePaths[0]) return { ok: false, erro: 'cancelado' };
      try {
        const teste = new Database(filePaths[0], { readonly: true });
        teste.prepare('SELECT 1 FROM resumo_mensal LIMIT 1').all();
        teste.close();
      } catch {
        return { ok: false, erro: 'Esse arquivo não é um backup válido do Duo Finn.' };
      }
      await db.backup(path.join(app.getPath('userData'), 'antes-de-restaurar.db'));
      db.close();
      fs.copyFileSync(filePaths[0], dbPath());
      for (const ext of ['-wal', '-shm']) fs.rmSync(dbPath() + ext, { force: true });
      abrirBanco();
      return { ok: true, dados: filePaths[0] };
    });

    ipcMain.handle('app:pastaDados', () => {
      shell.openPath(app.getPath('userData'));
      return { ok: true, dados: app.getPath('userData') };
    });

    criarJanela();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) criarJanela(); });
  });

  app.on('window-all-closed', () => {
    if (db) db.close();
    if (process.platform !== 'darwin') app.quit();
  });
}
