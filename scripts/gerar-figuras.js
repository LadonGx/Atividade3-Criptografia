/**
 * Gera as figuras usadas no relatório.
 *
 * Produz, em assets/figuras/ (versionado, para o relatório exibir no GitHub):
 *   - comparacao-lado-a-lado.png  → original | com segredo | mapa de diferenças
 *   - zoom-primeira-linha.png     → ampliação 8x da faixa onde os bits foram gravados
 *
 * Execute com: npm run figuras
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { ocultarMensagem, extrairMensagem } from '../src/esteganografia/lsb.js';
import { compararImagens, gerarMapaDiferencas } from '../src/esteganografia/metricas.js';
import { garantirImagem } from './gerar-imagem.js';

const ORIGINAL = path.join('assets', 'original.png');
const COM_SEGREDO = path.join('output', 'imagem-com-segredo.png');
const MAPA = path.join('output', 'mapa-diferencas.png');
const PASTA_FIGURAS = path.join('assets', 'figuras');
const MENSAGEM = 'Reunião confidencial: servidor de backup migra na sexta às 22h.';

/* ------------------------------------------------------------------ *
 * Desenho de texto: fonte de bitmap 5x7 embutida (sem dependências)   *
 * ------------------------------------------------------------------ */

/** Glifos 5x7, uma string de 7 linhas com '#' onde o pixel é aceso. */
const FONTE = {
  A: '01110#10001#10001#11111#10001#10001#10001',
  B: '11110#10001#10001#11110#10001#10001#11110',
  C: '01110#10001#10000#10000#10000#10001#01110',
  D: '11110#10001#10001#10001#10001#10001#11110',
  E: '11111#10000#10000#11110#10000#10000#11111',
  F: '11111#10000#10000#11110#10000#10000#10000',
  G: '01110#10001#10000#10111#10001#10001#01111',
  H: '10001#10001#10001#11111#10001#10001#10001',
  I: '11111#00100#00100#00100#00100#00100#11111',
  J: '00111#00010#00010#00010#00010#10010#01100',
  K: '10001#10010#10100#11000#10100#10010#10001',
  L: '10000#10000#10000#10000#10000#10000#11111',
  M: '10001#11011#10101#10101#10001#10001#10001',
  N: '10001#11001#10101#10011#10001#10001#10001',
  O: '01110#10001#10001#10001#10001#10001#01110',
  P: '11110#10001#10001#11110#10000#10000#10000',
  Q: '01110#10001#10001#10001#10101#10010#01101',
  R: '11110#10001#10001#11110#10100#10010#10001',
  S: '01111#10000#10000#01110#00001#00001#11110',
  T: '11111#00100#00100#00100#00100#00100#00100',
  U: '10001#10001#10001#10001#10001#10001#01110',
  V: '10001#10001#10001#10001#10001#01010#00100',
  W: '10001#10001#10001#10101#10101#11011#10001',
  X: '10001#10001#01010#00100#01010#10001#10001',
  Y: '10001#10001#01010#00100#00100#00100#00100',
  Z: '11111#00001#00010#00100#01000#10000#11111',
  0: '01110#10001#10011#10101#11001#10001#01110',
  1: '00100#01100#00100#00100#00100#00100#01110',
  2: '01110#10001#00001#00110#01000#10000#11111',
  3: '11111#00010#00100#00010#00001#10001#01110',
  4: '00010#00110#01010#10010#11111#00010#00010',
  5: '11111#10000#11110#00001#00001#10001#01110',
  6: '00110#01000#10000#11110#10001#10001#01110',
  7: '11111#00001#00010#00100#01000#01000#01000',
  8: '01110#10001#10001#01110#10001#10001#01110',
  9: '01110#10001#10001#01111#00001#00010#01100',
  '.': '00000#00000#00000#00000#00000#01100#01100',
  ',': '00000#00000#00000#00000#01100#01100#11000',
  ':': '00000#01100#01100#00000#01100#01100#00000',
  '-': '00000#00000#00000#11111#00000#00000#00000',
  '(': '00010#00100#01000#01000#01000#00100#00010',
  ')': '01000#00100#00010#00010#00010#00100#01000',
  '=': '00000#00000#11111#00000#11111#00000#00000',
  '%': '11001#11010#00010#00100#01000#01011#10011',
  '/': '00001#00010#00010#00100#01000#01000#10000',
  '<': '00010#00100#01000#10000#01000#00100#00010',
  '>': '01000#00100#00010#00001#00010#00100#01000',
  ' ': '00000#00000#00000#00000#00000#00000#00000',
};

/**
 * Escreve texto no buffer de um PNG usando a fonte de bitmap.
 * Acentos são removidos, porque a fonte embutida só cobre ASCII.
 * @param {PNG} png Imagem de destino.
 * @param {string} texto Texto a desenhar.
 * @param {number} x Coluna inicial.
 * @param {number} y Linha inicial.
 * @param {number} escala Fator de ampliação de cada pixel do glifo.
 * @param {[number,number,number]} cor Cor RGB.
 */
function desenharTexto(png, texto, x, y, escala = 2, cor = [255, 255, 255]) {
  const limpo = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

  let cursor = x;
  for (const caractere of limpo) {
    const glifo = FONTE[caractere] ?? FONTE[' '];
    const linhas = glifo.split('#');

    for (let ly = 0; ly < linhas.length; ly += 1) {
      for (let lx = 0; lx < linhas[ly].length; lx += 1) {
        if (linhas[ly][lx] !== '1') continue;

        for (let ey = 0; ey < escala; ey += 1) {
          for (let ex = 0; ex < escala; ex += 1) {
            const px = cursor + lx * escala + ex;
            const py = y + ly * escala + ey;
            if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;

            const i = (py * png.width + px) * 4;
            png.data[i] = cor[0];
            png.data[i + 1] = cor[1];
            png.data[i + 2] = cor[2];
            png.data[i + 3] = 255;
          }
        }
      }
    }
    cursor += 6 * escala;
  }
}

/**
 * Largura em pixels que um texto ocupará, para dimensionar a tela sem cortes.
 * @param {string} texto Texto a medir.
 * @param {number} escala Mesma escala passada a desenharTexto.
 * @returns {number} Largura em pixels.
 */
function larguraTexto(texto, escala) {
  return texto.length * 6 * escala;
}

/** Preenche um retângulo com uma cor sólida. */
function preencher(png, x, y, largura, altura, [r, g, b]) {
  for (let py = y; py < y + altura; py += 1) {
    for (let px = x; px < x + largura; px += 1) {
      if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
      const i = (py * png.width + px) * 4;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = 255;
    }
  }
}

/** Copia uma imagem inteira para dentro de outra, na posição indicada. */
function colar(destino, origem, x, y) {
  for (let oy = 0; oy < origem.height; oy += 1) {
    for (let ox = 0; ox < origem.width; ox += 1) {
      const di = ((y + oy) * destino.width + (x + ox)) * 4;
      const oi = (oy * origem.width + ox) * 4;
      destino.data[di] = origem.data[oi];
      destino.data[di + 1] = origem.data[oi + 1];
      destino.data[di + 2] = origem.data[oi + 2];
      destino.data[di + 3] = 255;
    }
  }
}

/** Desenha uma moldura de 1px em volta de uma região. */
function moldura(png, x, y, largura, altura, cor) {
  preencher(png, x - 1, y - 1, largura + 2, 1, cor);
  preencher(png, x - 1, y + altura, largura + 2, 1, cor);
  preencher(png, x - 1, y - 1, 1, altura + 2, cor);
  preencher(png, x + largura, y - 1, 1, altura + 2, cor);
}

/** Lê um PNG do disco. */
function lerPng(caminho) {
  return PNG.sync.read(fs.readFileSync(caminho));
}

/* ------------------------------------------------------------------ *
 * Figuras                                                             *
 * ------------------------------------------------------------------ */

/**
 * Monta a figura com as três imagens lado a lado e as métricas ao pé.
 * @param {object} metricas Resultado de compararImagens.
 * @returns {string} Caminho do arquivo gerado.
 */
function figuraComparacao(metricas) {
  const a = lerPng(ORIGINAL);
  const b = lerPng(COM_SEGREDO);
  const c = lerPng(MAPA);

  const margem = 24;
  const espaco = 20;
  const alturaTitulo = 40;
  const alturaLegenda = 30;
  const alturaRodape = 92;

  const largura = margem * 2 + a.width * 3 + espaco * 2;
  const altura = margem + alturaTitulo + alturaLegenda + a.height + alturaRodape + margem;

  const figura = new PNG({ width: largura, height: altura });
  preencher(figura, 0, 0, largura, altura, [24, 26, 32]);

  desenharTexto(figura, 'ESTEGANOGRAFIA LSB - COMPARACAO VISUAL', margem, margem, 3, [255, 255, 255]);

  const y = margem + alturaTitulo + alturaLegenda;
  const painel = [
    { img: a, titulo: 'ORIGINAL' },
    { img: b, titulo: 'COM MENSAGEM OCULTA' },
    { img: c, titulo: 'MAPA DE DIFERENCAS' },
  ];

  painel.forEach(({ img, titulo }, indice) => {
    const x = margem + indice * (a.width + espaco);
    desenharTexto(figura, titulo, x, y - alturaLegenda + 2, 2, [150, 200, 255]);
    colar(figura, img, x, y);
    moldura(figura, x, y, img.width, img.height, [90, 95, 110]);
  });

  const rodape = y + a.height + 26;
  const linhas = [
    `DIFERENCA MAXIMA POR CANAL: ${metricas.diferencaMaxima} DE 255`,
    `CANAIS ALTERADOS: ${metricas.canaisAlterados} DE ${metricas.canaisComparados} (${metricas.percentualAlterado.toFixed(4)}%)`,
    `PSNR: ${metricas.psnr.toFixed(2)} DB - ACIMA DE 40 DB A ALTERACAO E IMPERCEPTIVEL`,
  ];
  linhas.forEach((linha, indice) => {
    desenharTexto(figura, linha, margem, rodape + indice * 20, 2, [200, 205, 215]);
  });

  fs.mkdirSync(PASTA_FIGURAS, { recursive: true });
  const caminho = path.join(PASTA_FIGURAS, 'comparacao-lado-a-lado.png');
  fs.writeFileSync(caminho, PNG.sync.write(figura));
  return caminho;
}

/**
 * Monta a figura com o zoom da faixa onde os bits foram gravados.
 * @returns {string} Caminho do arquivo gerado.
 */
function figuraZoom() {
  const a = lerPng(ORIGINAL);
  const b = lerPng(COM_SEGREDO);

  const recorteLargura = 64;
  const recorteAltura = 8;
  const escala = 8;

  /** Amplia um recorte do canto superior esquerdo da imagem. */
  const ampliar = (fonte) => {
    const destino = new PNG({ width: recorteLargura * escala, height: recorteAltura * escala });
    for (let y = 0; y < recorteAltura * escala; y += 1) {
      for (let x = 0; x < recorteLargura * escala; x += 1) {
        const fi = (Math.floor(y / escala) * fonte.width + Math.floor(x / escala)) * 4;
        const di = (y * destino.width + x) * 4;
        destino.data[di] = fonte.data[fi];
        destino.data[di + 1] = fonte.data[fi + 1];
        destino.data[di + 2] = fonte.data[fi + 2];
        destino.data[di + 3] = 255;
      }
    }
    return destino;
  };

  const zoomA = ampliar(a);
  const zoomB = ampliar(b);

  const margem = 24;
  const espaco = 18;
  const alturaTitulo = 42;
  const alturaLegenda = 26;

  const titulo = 'ZOOM 8X - PRIMEIROS 64X8 PIXELS';
  const legendaA = 'ORIGINAL';
  const legendaB = 'COM MENSAGEM OCULTA - REGIAO ONDE OS BITS FORAM GRAVADOS';
  const rodape = 'MESMO AMPLIADAS 8X, AS DUAS FAIXAS SAO INDISTINGUIVEIS';

  // A tela precisa caber o texto mais largo, não só as imagens.
  const largura =
    margem * 2 +
    Math.max(
      zoomA.width,
      larguraTexto(titulo, 3),
      larguraTexto(legendaA, 2),
      larguraTexto(legendaB, 2),
      larguraTexto(rodape, 2),
    );
  const altura =
    margem * 2 + alturaTitulo + (alturaLegenda + zoomA.height + espaco) * 2 + 24;

  const figura = new PNG({ width: largura, height: altura });
  preencher(figura, 0, 0, largura, altura, [24, 26, 32]);

  desenharTexto(figura, titulo, margem, margem, 3, [255, 255, 255]);

  let y = margem + alturaTitulo;
  desenharTexto(figura, legendaA, margem, y, 2, [150, 200, 255]);
  colar(figura, zoomA, margem, y + alturaLegenda);
  moldura(figura, margem, y + alturaLegenda, zoomA.width, zoomA.height, [90, 95, 110]);

  y += alturaLegenda + zoomA.height + espaco;
  desenharTexto(figura, legendaB, margem, y, 2, [150, 200, 255]);
  colar(figura, zoomB, margem, y + alturaLegenda);
  moldura(figura, margem, y + alturaLegenda, zoomB.width, zoomB.height, [90, 95, 110]);

  y += alturaLegenda + zoomB.height + 16;
  desenharTexto(figura, rodape, margem, y, 2, [200, 205, 215]);

  fs.mkdirSync(PASTA_FIGURAS, { recursive: true });
  const caminho = path.join(PASTA_FIGURAS, 'zoom-primeira-linha.png');
  fs.writeFileSync(caminho, PNG.sync.write(figura));
  return caminho;
}

/* ------------------------------------------------------------------ */

garantirImagem(ORIGINAL);
ocultarMensagem(ORIGINAL, COM_SEGREDO, MENSAGEM);
gerarMapaDiferencas(ORIGINAL, COM_SEGREDO, MAPA);

const metricas = compararImagens(ORIGINAL, COM_SEGREDO);

console.log('Gerando figuras do relatório...\n');
console.log(`Mensagem oculta e reextraída: "${extrairMensagem(COM_SEGREDO)}"`);
console.log(`Diferença máxima por canal:   ${metricas.diferencaMaxima}`);
console.log(`PSNR:                         ${metricas.psnr.toFixed(2)} dB\n`);
console.log(`Figura 1: ${figuraComparacao(metricas)}`);
console.log(`Figura 2: ${figuraZoom()}`);
console.log('\nFiguras geradas.');
