/**
 * Métricas de comparação entre a imagem original e a imagem com mensagem oculta.
 *
 * Servem para comprovar objetivamente que a alteração é imperceptível:
 *  - a diferença máxima por canal deve ser 1 (só o bit menos significativo mudou);
 *  - o PSNR (Peak Signal-to-Noise Ratio) fica muito acima de 50 dB, faixa em que a
 *    diferença é considerada invisível a olho nu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

/** Lê um PNG do disco. */
function lerPng(caminho) {
  return PNG.sync.read(fs.readFileSync(caminho));
}

/** Garante que as duas imagens têm as mesmas dimensões. */
function validarDimensoes(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `As imagens têm dimensões diferentes: ${a.width}x${a.height} e ${b.width}x${b.height}`,
    );
  }
}

/**
 * Compara duas imagens PNG canal a canal (apenas R, G e B).
 * @param {string} caminhoA Imagem original.
 * @param {string} caminhoB Imagem alterada.
 * @returns {{largura: number, altura: number, canaisComparados: number, canaisAlterados: number,
 *            percentualAlterado: number, diferencaMaxima: number, mse: number, psnr: number,
 *            alfaIntacto: boolean}}
 */
export function compararImagens(caminhoA, caminhoB) {
  const a = lerPng(caminhoA);
  const b = lerPng(caminhoB);
  validarDimensoes(a, b);

  let canaisComparados = 0;
  let canaisAlterados = 0;
  let diferencaMaxima = 0;
  let somaQuadrados = 0;
  let alfaIntacto = true;

  for (let i = 0; i < a.data.length; i += 1) {
    if (i % 4 === 3) {
      // Canal alfa: não entra nas métricas, mas conferimos que não foi tocado.
      if (a.data[i] !== b.data[i]) alfaIntacto = false;
      continue;
    }

    const diferenca = Math.abs(a.data[i] - b.data[i]);
    canaisComparados += 1;
    if (diferenca !== 0) canaisAlterados += 1;
    if (diferenca > diferencaMaxima) diferencaMaxima = diferenca;
    somaQuadrados += diferenca * diferenca;
  }

  const mse = somaQuadrados / canaisComparados;
  // PSNR = 10 * log10(255^2 / MSE). Com MSE = 0 as imagens são idênticas → PSNR infinito.
  const psnr = mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);

  return {
    largura: a.width,
    altura: a.height,
    canaisComparados,
    canaisAlterados,
    percentualAlterado: (canaisAlterados / canaisComparados) * 100,
    diferencaMaxima,
    mse,
    psnr,
    alfaIntacto,
  };
}

/**
 * Gera um PNG em preto e branco marcando onde os pixels foram alterados
 * (branco = pelo menos um canal mudou; preto = idêntico). Útil como figura do relatório.
 * @param {string} caminhoA Imagem original.
 * @param {string} caminhoB Imagem alterada.
 * @param {string} caminhoSaida PNG do mapa de diferenças.
 * @returns {{caminhoSaida: string, pixelsAlterados: number, totalPixels: number}}
 */
export function gerarMapaDiferencas(caminhoA, caminhoB, caminhoSaida) {
  const a = lerPng(caminhoA);
  const b = lerPng(caminhoB);
  validarDimensoes(a, b);

  const mapa = new PNG({ width: a.width, height: a.height });
  let pixelsAlterados = 0;

  for (let p = 0; p < a.width * a.height; p += 1) {
    const i = p * 4;
    const alterado =
      a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2];

    if (alterado) pixelsAlterados += 1;

    const cor = alterado ? 255 : 0;
    mapa.data[i] = cor;
    mapa.data[i + 1] = cor;
    mapa.data[i + 2] = cor;
    mapa.data[i + 3] = 255;
  }

  const pasta = path.dirname(caminhoSaida);
  if (pasta && pasta !== '.') fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(caminhoSaida, PNG.sync.write(mapa));

  return { caminhoSaida, pixelsAlterados, totalPixels: a.width * a.height };
}
