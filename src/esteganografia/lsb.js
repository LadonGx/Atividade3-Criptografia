/**
 * Módulo de esteganografia LSB (Least Significant Bit) em imagens PNG.
 *
 * IDEIA
 * -----
 * Cada canal de cor de um pixel é um byte (0..255). Trocar o bit menos
 * significativo muda o valor em no máximo 1 — uma diferença imperceptível ao olho
 * humano. Escondendo 1 bit por canal R, G e B, cabem 3 bits por pixel.
 *
 * PROTOCOLO DE GRAVAÇÃO
 * ---------------------
 * Só os canais R, G e B são usados; o canal alfa NUNCA é alterado (mexer na
 * transparência pode ser visível e alguns editores descartam/normalizam o alfa).
 *
 * Em cada canal: novoValor = (valor & 0xFE) | bit
 *
 * Ordem dos bits gravados:
 *   1. Assinatura mágica "STG1" (4 bytes) — permite saber se a imagem tem mensagem.
 *   2. Tamanho da mensagem em bytes (inteiro de 32 bits, big-endian = 4 bytes).
 *   3. Bytes da mensagem em UTF-8, bit mais significativo primeiro.
 *
 * Capacidade em bytes: floor(largura x altura x 3 / 8) - 8  (8 bytes de cabeçalho)
 *
 * FORMATO DE SAÍDA
 * ----------------
 * A saída precisa ser PNG. PNG usa compressão SEM perdas, então os bytes dos
 * pixels são preservados exatamente. Formatos com perdas como JPEG recalculam os
 * pixels (DCT + quantização) e destruiriam justamente os bits menos significativos,
 * apagando a mensagem.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

/** Assinatura que identifica uma imagem com mensagem oculta. */
export const ASSINATURA = 'STG1';
/** Bytes de cabeçalho: 4 da assinatura + 4 do tamanho. */
export const TAMANHO_CABECALHO = 8;
/** Canais usados por pixel (R, G e B — o alfa fica de fora). */
export const CANAIS_POR_PIXEL = 3;

/* ------------------------------------------------------------------ *
 * Funções internas puras (exportadas para permitir testes unitários)  *
 * ------------------------------------------------------------------ */

/**
 * Converte um Buffer em um array de bits (0/1), bit mais significativo primeiro.
 * @param {Buffer} bytes Bytes de entrada.
 * @returns {number[]} Bits.
 */
export function bytesParaBits(bytes) {
  const bits = new Array(bytes.length * 8);
  for (let i = 0; i < bytes.length; i += 1) {
    for (let b = 0; b < 8; b += 1) {
      bits[i * 8 + b] = (bytes[i] >> (7 - b)) & 1;
    }
  }
  return bits;
}

/**
 * Converte um array de bits (MSB primeiro) de volta em Buffer.
 * @param {number[]} bits Bits, em quantidade múltipla de 8.
 * @returns {Buffer} Bytes.
 */
export function bitsParaBytes(bits) {
  if (bits.length % 8 !== 0) {
    throw new Error('A quantidade de bits deve ser múltipla de 8');
  }
  const bytes = Buffer.alloc(bits.length / 8);
  for (let i = 0; i < bytes.length; i += 1) {
    let valor = 0;
    for (let b = 0; b < 8; b += 1) {
      valor = (valor << 1) | bits[i * 8 + b];
    }
    bytes[i] = valor;
  }
  return bytes;
}

/**
 * Grava bits nos LSBs dos canais R, G e B do buffer RGBA (pula o alfa).
 * Altera o buffer no lugar.
 * @param {Buffer} data Buffer RGBA da imagem.
 * @param {number[]} bits Bits a gravar.
 */
export function escreverBits(data, bits) {
  let indiceBit = 0;
  for (let i = 0; i < data.length && indiceBit < bits.length; i += 1) {
    if (i % 4 === 3) continue; // posição do canal alfa — nunca alterada
    data[i] = (data[i] & 0xfe) | bits[indiceBit];
    indiceBit += 1;
  }
  if (indiceBit < bits.length) {
    throw new Error('Buffer da imagem insuficiente para gravar todos os bits');
  }
}

/**
 * Lê uma quantidade de bits dos LSBs dos canais R, G e B (pula o alfa).
 * @param {Buffer} data Buffer RGBA da imagem.
 * @param {number} quantidade Quantos bits ler.
 * @param {number} inicio A partir de qual bit (índice na sequência de canais RGB).
 * @returns {number[]} Bits lidos.
 */
export function lerBits(data, quantidade, inicio = 0) {
  const bits = [];
  let indiceCanal = 0;

  for (let i = 0; i < data.length && bits.length < quantidade; i += 1) {
    if (i % 4 === 3) continue; // alfa
    if (indiceCanal >= inicio) bits.push(data[i] & 1);
    indiceCanal += 1;
  }

  if (bits.length < quantidade) {
    throw new Error('A imagem não tem canais suficientes para a leitura solicitada');
  }
  return bits;
}

/* ------------------------------------------------------------------ *
 * API pública                                                         *
 * ------------------------------------------------------------------ */

/**
 * Calcula quantos bytes de mensagem cabem em uma imagem.
 * @param {PNG} png Imagem já lida.
 * @returns {number} Capacidade em bytes (já descontando o cabeçalho).
 */
export function capacidade(png) {
  const totalBits = png.width * png.height * CANAIS_POR_PIXEL;
  return Math.max(0, Math.floor(totalBits / 8) - TAMANHO_CABECALHO);
}

/**
 * Lê um PNG do disco (utilitário para quem precisa das dimensões/capacidade).
 * @param {string} caminho Caminho do PNG.
 * @returns {PNG}
 */
export function lerPng(caminho) {
  return PNG.sync.read(fs.readFileSync(caminho));
}

/**
 * Oculta uma mensagem de texto dentro de uma imagem PNG.
 * @param {string} caminhoEntrada PNG de origem.
 * @param {string} caminhoSaida PNG de destino (deve terminar em .png).
 * @param {string} mensagem Texto a ocultar.
 * @returns {{caminhoSaida: string, bytesMensagem: number, capacidade: number, largura: number, altura: number}}
 */
export function ocultarMensagem(caminhoEntrada, caminhoSaida, mensagem) {
  if (typeof mensagem !== 'string' || mensagem === '') {
    throw new Error('A mensagem a ocultar deve ser um texto não vazio');
  }
  // Recusamos qualquer saída que não seja PNG: ver comentário sobre JPEG no topo.
  if (path.extname(caminhoSaida).toLowerCase() !== '.png') {
    throw new Error(
      'O arquivo de saída deve ser .png — formatos com perdas (JPEG) destroem os bits menos significativos',
    );
  }

  const png = lerPng(caminhoEntrada);
  const bytesMensagem = Buffer.from(mensagem, 'utf8');
  const disponivel = capacidade(png);

  if (bytesMensagem.length > disponivel) {
    throw new Error(
      `Mensagem grande demais: são necessários ${bytesMensagem.length} bytes e a imagem ` +
        `comporta apenas ${disponivel} bytes (${png.width}x${png.height}).`,
    );
  }

  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(bytesMensagem.length, 0);

  const carga = Buffer.concat([Buffer.from(ASSINATURA, 'ascii'), tamanho, bytesMensagem]);
  escreverBits(png.data, bytesParaBits(carga));

  const pastaSaida = path.dirname(caminhoSaida);
  if (pastaSaida && pastaSaida !== '.') fs.mkdirSync(pastaSaida, { recursive: true });
  fs.writeFileSync(caminhoSaida, PNG.sync.write(png));

  return {
    caminhoSaida,
    bytesMensagem: bytesMensagem.length,
    capacidade: disponivel,
    largura: png.width,
    altura: png.height,
  };
}

/**
 * Extrai a mensagem oculta de uma imagem PNG.
 * @param {string} caminho PNG a inspecionar.
 * @returns {string} Mensagem em UTF-8.
 * @throws {Error} Se a imagem não contiver a assinatura STG1.
 */
export function extrairMensagem(caminho) {
  const png = lerPng(caminho);

  const cabecalho = bitsParaBytes(lerBits(png.data, TAMANHO_CABECALHO * 8));

  if (cabecalho.subarray(0, 4).toString('ascii') !== ASSINATURA) {
    throw new Error('Nenhuma mensagem oculta encontrada');
  }

  const tamanho = cabecalho.readUInt32BE(4);
  const disponivel = capacidade(png);
  if (tamanho === 0 || tamanho > disponivel) {
    throw new Error(
      `Cabeçalho inválido: o tamanho declarado (${tamanho} bytes) é incompatível com a ` +
        `capacidade da imagem (${disponivel} bytes)`,
    );
  }

  const bitsMensagem = lerBits(png.data, tamanho * 8, TAMANHO_CABECALHO * 8);
  return bitsParaBytes(bitsMensagem).toString('utf8');
}

/**
 * Indica se a imagem contém uma mensagem oculta neste formato.
 * @param {string} caminho PNG a inspecionar.
 * @returns {boolean}
 */
export function contemMensagem(caminho) {
  try {
    extrairMensagem(caminho);
    return true;
  } catch {
    return false;
  }
}
