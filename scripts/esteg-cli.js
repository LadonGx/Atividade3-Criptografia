/**
 * CLI de esteganografia.
 *
 * Uso:
 *   node scripts/esteg-cli.js ocultar --entrada assets/original.png --saida output/secreta.png --mensagem "texto"
 *   node scripts/esteg-cli.js extrair --entrada output/secreta.png
 */
import { parseArgs } from 'node:util';
import { ocultarMensagem, extrairMensagem, capacidade, lerPng } from '../src/esteganografia/lsb.js';

const USO = `
Uso:
  node scripts/esteg-cli.js ocultar --entrada <arquivo.png> --saida <arquivo.png> --mensagem "<texto>"
  node scripts/esteg-cli.js extrair --entrada <arquivo.png>

Opções:
  --entrada, -e   Caminho do PNG de entrada        (obrigatório)
  --saida,   -s   Caminho do PNG de saída          (obrigatório em "ocultar")
  --mensagem,-m   Texto a ocultar                  (obrigatório em "ocultar")
  --ajuda,   -h   Mostra esta ajuda
`.trim();

function encerrarComErro(mensagem) {
  console.error(`Erro: ${mensagem}\n`);
  console.error(USO);
  process.exit(1);
}

function principal() {
  const [comando, ...resto] = process.argv.slice(2);

  if (!comando || comando === '--ajuda' || comando === '-h' || comando === 'ajuda') {
    console.log(USO);
    process.exit(comando ? 0 : 1);
  }

  let opcoes;
  try {
    ({ values: opcoes } = parseArgs({
      args: resto,
      options: {
        entrada: { type: 'string', short: 'e' },
        saida: { type: 'string', short: 's' },
        mensagem: { type: 'string', short: 'm' },
        ajuda: { type: 'boolean', short: 'h', default: false },
      },
      allowPositionals: false,
    }));
  } catch (erro) {
    encerrarComErro(erro.message);
  }

  if (opcoes.ajuda) {
    console.log(USO);
    process.exit(0);
  }

  if (comando === 'ocultar') {
    if (!opcoes.entrada) encerrarComErro('faltou --entrada');
    if (!opcoes.saida) encerrarComErro('faltou --saida');
    if (!opcoes.mensagem) encerrarComErro('faltou --mensagem');

    try {
      const resultado = ocultarMensagem(opcoes.entrada, opcoes.saida, opcoes.mensagem);
      console.log(`Imagem de entrada: ${opcoes.entrada} (${resultado.largura}x${resultado.altura})`);
      console.log(`Capacidade:        ${resultado.capacidade} bytes`);
      console.log(`Mensagem:          ${resultado.bytesMensagem} bytes`);
      console.log(`Imagem gerada:     ${resultado.caminhoSaida}`);
    } catch (erro) {
      encerrarComErro(erro.message);
    }
    return;
  }

  if (comando === 'extrair') {
    if (!opcoes.entrada) encerrarComErro('faltou --entrada');

    try {
      const mensagem = extrairMensagem(opcoes.entrada);
      console.log(`Mensagem encontrada em ${opcoes.entrada}:\n`);
      console.log(mensagem);
    } catch (erro) {
      encerrarComErro(erro.message);
    }
    return;
  }

  if (comando === 'capacidade') {
    if (!opcoes.entrada) encerrarComErro('faltou --entrada');

    try {
      const png = lerPng(opcoes.entrada);
      console.log(`${opcoes.entrada}: ${png.width}x${png.height} → ${capacidade(png)} bytes disponíveis`);
    } catch (erro) {
      encerrarComErro(erro.message);
    }
    return;
  }

  encerrarComErro(`comando desconhecido "${comando}" (use "ocultar" ou "extrair")`);
}

principal();
