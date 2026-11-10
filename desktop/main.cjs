// CrowdKart desktop (Windows / macOS / Linux).
// By default it boots the CrowdKart server inside the app and opens it, so it works standalone.
// Set CROWDKART_SERVER=https://your-server (or put it in <userData>/server.txt) to use a shared hosted server instead.
const { app, BrowserWindow, shell, session, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const { pathToFileURL } = require('node:url');

const firstExisting = (...c) => c.find((p) => fs.existsSync(p));

function freePort(preferred) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => { const t = net.createServer(); t.listen(0, () => { const p = t.address().port; t.close(() => resolve(p)); }); });
    s.listen(preferred, () => s.close(() => resolve(preferred)));
  });
}

function remoteServer() {
  if (process.env.CROWDKART_SERVER) return process.env.CROWDKART_SERVER;
  const f = path.join(app.getPath('userData'), 'server.txt');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() || null : null;
}

async function startEmbeddedServer() {
  const entry = firstExisting(path.join(__dirname, 'app-server', 'src', 'index.js'), path.join(__dirname, '..', 'server', 'src', 'index.js'));
  const clientDist = firstExisting(path.join(__dirname, 'app-client'), path.join(__dirname, '..', 'client', 'dist'));
  if (!entry || !clientDist) throw new Error('CrowdKart server or client build not found. Run "npm run build" first.');
  process.env.CROWDKART_DATA_DIR = path.join(app.getPath('userData'), 'data');
  process.env.CROWDKART_CLIENT_DIST = clientDist;
  // Optional secrets (AI_API_KEY, PAYPAL_*) can live in <userData>/.env or the repo's server/.env.
  const envFile = firstExisting(path.join(app.getPath('userData'), '.env'), path.join(__dirname, '..', 'server', '.env'));
  if (envFile) process.env.DOTENV_CONFIG_PATH = envFile;
  const port = await freePort(Number(process.env.PORT) || 4310);
  const mod = await import(pathToFileURL(entry).href);
  await mod.start(port);
  return `http://localhost:${port}`;
}

async function createWindow() {
  const url = remoteServer() || (await startEmbeddedServer());
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 600,
    title: 'CrowdKart', icon: path.join(__dirname, 'icon.png'), backgroundColor: '#0f766e',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/paypal\.com/.test(target)) return { action: 'allow' }; // PayPal checkout popup
    shell.openExternal(target);
    return { action: 'deny' };
  });
  await win.loadURL(url);
  return win;
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(['geolocation', 'notifications'].includes(permission)));
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'quit' }] },
    { label: 'View', submenu: [{ role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] },
  ]));
  try {
    await createWindow();
  } catch (e) {
    const { dialog } = require('electron');
    dialog.showErrorBox('CrowdKart could not start', String(e?.stack || e));
    app.quit();
  }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
