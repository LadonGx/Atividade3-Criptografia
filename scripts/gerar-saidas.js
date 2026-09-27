/**
 * Executa cada demonstração e os testes, gravando a saída do terminal em
 * output/saidas/*.txt. Serve para colar no relatório sem precisar de captura
 * de tela, ou para conferir o texto exato do que foi impresso.
 *
 * Execute com: npm run saidas
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PASTA = path.join('output', 'saidas');

const COMANDOS = [
  { arquivo: 'demo-hashing.txt', titulo: 'npm run demo:hash', args: ['scripts/demo-hashing.js'] },
  { arquivo: 'demo-criptografia.txt', titulo: 'npm run demo:cripto', args: ['scripts/demo-criptografia.js'] },
  { arquivo: 'demo-esteganografia.txt', titulo: 'npm run demo:esteg', args: ['scripts/demo-esteganografia.js'] },
  { arquivo: 'testes.txt', titulo: 'npm test', args: ['--test', '--test-reporter=spec', 'test/'] },
];

fs.mkdirSync(PASTA, { recursive: true });

console.log('Executando os scripts e gravando as saídas...\n');

for (const { arquivo, titulo, args } of COMANDOS) {
  const resultado = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });

  const saida = `$ ${titulo}\n\n${resultado.stdout}${resultado.stderr}`;
  const destino = path.join(PASTA, arquivo);
  fs.writeFileSync(destino, saida, 'utf8');

  const linhas = saida.split('\n').length;
  console.log(
    `${resultado.status === 0 ? '✔' : '✘'} ${titulo.padEnd(22)} → ${destino} (${linhas} linhas, exit ${resultado.status})`,
  );
}

// Copia também os dois artefatos de dados que o relatório cita.
for (const [origem, destino] of [
  [path.join('data', 'usuarios.json'), path.join(PASTA, 'usuarios.json')],
  [path.join('output', 'mensagem.enc.json'), path.join(PASTA, 'mensagem.enc.json')],
]) {
  if (fs.existsSync(origem)) {
    fs.copyFileSync(origem, destino);
    console.log(`✔ ${origem.padEnd(24)} → ${destino}`);
  }
}

console.log('\nSaídas gravadas em output/saidas/.');
