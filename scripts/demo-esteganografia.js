/**
 * Demonstração do Módulo 3 — Esteganografia LSB em PNG.
 * Execute com: npm run demo:esteg
 */
import path from 'node:path';
import assert from 'node:assert/strict';
import { ocultarMensagem, extrairMensagem, capacidade, lerPng } from '../src/esteganografia/lsb.js';
import { compararImagens, gerarMapaDiferencas } from '../src/esteganografia/metricas.js';
import { garantirImagem } from './gerar-imagem.js';

function secao(titulo) {
  console.log(`\n${'='.repeat(70)}\n${titulo}\n${'='.repeat(70)}`);
}

const ORIGINAL = path.join('assets', 'original.png');
const COM_SEGREDO = path.join('output', 'imagem-com-segredo.png');
const MAPA = path.join('output', 'mapa-diferencas.png');
const MENSAGEM = 'Reunião confidencial: servidor de backup migra na sexta às 22h.';

secao('MÓDULO 3 — ESTEGANOGRAFIA LSB EM IMAGENS PNG');

// 1. Garante a imagem de trabalho.
const imagem = garantirImagem(ORIGINAL);
console.log(
  imagem.criada
    ? `Imagem de trabalho criada: ${ORIGINAL}`
    : `Imagem de trabalho já existente: ${ORIGINAL}`,
);

// 2. Dimensões e capacidade.
secao('1) Imagem portadora');
const png = lerPng(ORIGINAL);
const disponivel = capacidade(png);
console.log(`Dimensões:  ${png.width} x ${png.height} pixels`);
console.log(`Canais RGB: ${png.width * png.height * 3} (1 bit oculto em cada)`);
console.log(`Capacidade: ${disponivel} bytes (~${(disponivel / 1024).toFixed(1)} KB de texto)`);

// 3. Oculta a mensagem.
secao('2) Ocultando a mensagem');
console.log(`Mensagem: "${MENSAGEM}"`);
const resultado = ocultarMensagem(ORIGINAL, COM_SEGREDO, MENSAGEM);
console.log(`Tamanho em UTF-8: ${resultado.bytesMensagem} bytes`);
console.log(`Ocupação da capacidade: ${((resultado.bytesMensagem / disponivel) * 100).toFixed(4)}%`);
console.log(`Imagem gerada: ${COM_SEGREDO}`);

// 4. Métricas de impacto visual.
secao('3) Impacto visual (original x alterada)');
const metricas = compararImagens(ORIGINAL, COM_SEGREDO);
console.log(`Canais comparados:   ${metricas.canaisComparados}`);
console.log(
  `Canais alterados:    ${metricas.canaisAlterados} (${metricas.percentualAlterado.toFixed(4)}%)`,
);
console.log(`Diferença máxima:    ${metricas.diferencaMaxima} (de 255 possíveis)`);
console.log(`MSE:                 ${metricas.mse.toExponential(3)}`);
console.log(`PSNR:                ${metricas.psnr.toFixed(2)} dB`);
console.log(`Canal alfa intacto:  ${metricas.alfaIntacto ? 'sim' : 'não'}`);

assert.equal(metricas.diferencaMaxima, 1, 'a diferença máxima por canal deve ser 1');
assert.equal(metricas.alfaIntacto, true, 'o canal alfa não pode ser alterado');
console.log('\n✔ Nenhum canal variou mais que 1 unidade e o alfa ficou intacto.');
console.log(
  metricas.psnr > 50
    ? '✔ PSNR acima de 50 dB: a alteração é visualmente imperceptível.'
    : '✘ PSNR abaixo do esperado.',
);

// 5. Mapa de diferenças.
secao('4) Mapa de diferenças');
const mapa = gerarMapaDiferencas(ORIGINAL, COM_SEGREDO, MAPA);
console.log(`Arquivo gerado: ${mapa.caminhoSaida}`);
console.log(
  `Pixels com algum canal alterado: ${mapa.pixelsAlterados} de ${mapa.totalPixels} ` +
    `(${((mapa.pixelsAlterados / mapa.totalPixels) * 100).toFixed(4)}%)`,
);
console.log('Os pixels brancos, no canto superior esquerdo, são onde a mensagem foi gravada.');

// 6. Extração.
secao('5) Extraindo a mensagem da imagem alterada');
const extraida = extrairMensagem(COM_SEGREDO);
console.log(`Mensagem recuperada: "${extraida}"`);
assert.equal(extraida, MENSAGEM);
console.log('\n✔ Mensagem idêntica à original');

// 7. Imagem sem mensagem.
secao('6) Tentando extrair da imagem ORIGINAL (sem mensagem)');
try {
  extrairMensagem(ORIGINAL);
  console.log('✘ Encontrou mensagem onde não havia.');
} catch (erro) {
  console.log(`✔ Erro esperado: ${erro.message}`);
}

console.log('\nDemonstração de esteganografia concluída.\n');
