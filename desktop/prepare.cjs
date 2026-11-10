// Copies the server source and the built client into the desktop app folder before packaging.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const copy = (from, to) => {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  console.log('copied', path.relative(root, from), '->', path.relative(root, to));
};

if (!fs.existsSync(path.join(root, 'client', 'dist', 'index.html'))) {
  console.error('client/dist missing. Run "npm run build" at the repo root first.');
  process.exit(1);
}
copy(path.join(root, 'server', 'src'), path.join(__dirname, 'app-server', 'src'));
fs.copyFileSync(path.join(root, 'server', 'package.json'), path.join(__dirname, 'app-server', 'package.json'));
copy(path.join(root, 'client', 'dist'), path.join(__dirname, 'app-client'));
