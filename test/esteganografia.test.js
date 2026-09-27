/** Testes do Módulo 3 — Esteganografia LSB. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';

import {
  ocultarMensagem,
  extrairMensagem,
  contemMensagem,
  capacidade,
  lerPng,
  bytesParaBits,
  bitsParaBytes,
  escreverBits,
  lerBits,
  TAMANHO_CABECALHO,
} from '../src/esteganografia/lsb.js';
import { compararImagens, gerarMapaDiferencas } from '../src/esteganografia/metricas.js';

const MENSAGEM_ACENTOS = 'Reunião às 22h — ação secreta 🔐 çãõéî';

/** Cria uma pasta temporária isolada. */
function pastaTemporaria() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'esteg-test-'));
}

/**
 * Gera um PNG pequeno com valores pseudoaleatórios (determinísticos) em disco.
 * @param {string} caminho Destino.
 * @param {number} largura Largura em pixels.
 * @param {number} altura Altura em pixels.
 */
function criarPngTeste(caminho, largura = 32, altura = 32) {
  const png = new PNG({ width: largura, height: altura });
  for (let p = 0; p < largura * altura; p += 1) {
    const i = p * 4;
    png.data[i] = (p * 7) % 256;
    png.data[i + 1] = (p * 13 + 40) % 256;
    png.data[i + 2] = (p * 29 + 90) % 256;
    png.data[i + 3] = 255;
  }
  fs.writeFileSync(caminho, PNG.sync.write(png));
  return caminho;
}

test('bytesParaBits e bitsParaBytes são inversos', () => {
  const bytes = Buffer.from('STG1 teste çã', 'utf8');
  const bits = bytesParaBits(bytes);

  assert.equal(bits.length, bytes.length * 8);
  assert.deepEqual(bitsParaBytes(bits), bytes);
});

test('bytesParaBits usa o bit mais significativo primeiro', () => {
  assert.deepEqual(bytesParaBits(Buffer.from([0b10000001])), [1, 0, 0, 0, 0, 0, 0, 1]);
});

test('bitsParaBytes rejeita quantidade que não é múltipla de 8', () => {
  assert.throws(() => bitsParaBytes([1, 0, 1]), /múltipla de 8/);
});

test('escreverBits e lerBits pulam o canal alfa', () => {
  const data = Buffer.alloc(16, 0); // 4 pixels RGBA
  escreverBits(data, [1, 1, 1, 1, 1, 1]);

  // Os 3 primeiros canais de cada um dos 2 primeiros pixels receberam o bit 1.
  assert.deepEqual([...data], [1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(lerBits(data, 6), [1, 1, 1, 1, 1, 1]);
});

test('lerBits respeita o deslocamento inicial', () => {
  const data = Buffer.alloc(16, 0);
  escreverBits(data, [1, 0, 1, 0, 1, 0]);
  assert.deepEqual(lerBits(data, 3, 3), [0, 1, 0]);
});

test('capacidade segue a fórmula largura x altura x 3 / 8 - cabeçalho', () => {
  const png = new PNG({ width: 32, height: 32 });
  assert.equal(capacidade(png), Math.floor((32 * 32 * 3) / 8) - TAMANHO_CABECALHO);
});

test('ida e volta recupera a mensagem exata, com acentos e emoji', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'));
  const saida = path.join(pasta, 'com-segredo.png');

  ocultarMensagem(original, saida, MENSAGEM_ACENTOS);
  assert.equal(extrairMensagem(saida), MENSAGEM_ACENTOS);
});

test('mensagem no limite exato da capacidade funciona', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'), 16, 16);
  const saida = path.join(pasta, 'com-segredo.png');

  const limite = capacidade(lerPng(original));
  const mensagem = 'x'.repeat(limite);

  ocultarMensagem(original, saida, mensagem);
  assert.equal(extrairMensagem(saida), mensagem);
});

test('nenhum canal difere em mais de 1 entre a original e a alterada', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'), 64, 64);
  const saida = path.join(pasta, 'com-segredo.png');

  ocultarMensagem(original, saida, MENSAGEM_ACENTOS);

  const metricas = compararImagens(original, saida);
  assert.equal(metricas.diferencaMaxima, 1);
  assert.ok(metricas.canaisAlterados > 0, 'alguma coisa deve ter mudado');
  assert.ok(metricas.psnr > 50, `PSNR deveria passar de 50 dB, veio ${metricas.psnr}`);
});

test('o canal alfa permanece intacto', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'), 32, 32);
  const saida = path.join(pasta, 'com-segredo.png');

  ocultarMensagem(original, saida, MENSAGEM_ACENTOS);

  const a = lerPng(original);
  const b = lerPng(saida);
  for (let i = 3; i < a.data.length; i += 4) {
    assert.equal(a.data[i], b.data[i], `alfa alterado na posição ${i}`);
  }
  assert.equal(compararImagens(original, saida).alfaIntacto, true);
});

test('mensagem maior que a capacidade lança erro', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'), 8, 8);
  const saida = path.join(pasta, 'com-segredo.png');

  const excedente = 'a'.repeat(capacidade(lerPng(original)) + 1);
  assert.throws(() => ocultarMensagem(original, saida, excedente), /Mensagem grande demais/);
});

test('imagem sem mensagem lança erro na extração', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'));

  assert.throws(() => extrairMensagem(original), /Nenhuma mensagem oculta encontrada/);
  assert.equal(contemMensagem(original), false);
});

test('contemMensagem identifica a imagem alterada', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'));
  const saida = path.join(pasta, 'com-segredo.png');

  ocultarMensagem(original, saida, 'segredo');
  assert.equal(contemMensagem(saida), true);
});

test('saída que não é .png é recusada', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'));

  assert.throws(
    () => ocultarMensagem(original, path.join(pasta, 'saida.jpg'), 'segredo'),
    /deve ser \.png/,
  );
});

test('mensagem vazia é recusada', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'));

  assert.throws(() => ocultarMensagem(original, path.join(pasta, 's.png'), ''), /não vazio/);
});

test('a imagem original não é modificada no disco', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'));
  const antes = fs.readFileSync(original);

  ocultarMensagem(original, path.join(pasta, 'com-segredo.png'), MENSAGEM_ACENTOS);
  assert.deepEqual(fs.readFileSync(original), antes);
});

test('ocultar duas vezes sobrescreve a mensagem anterior', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'));
  const primeira = path.join(pasta, 'a.png');
  const segunda = path.join(pasta, 'b.png');

  ocultarMensagem(original, primeira, 'mensagem antiga');
  ocultarMensagem(primeira, segunda, 'mensagem nova');

  assert.equal(extrairMensagem(segunda), 'mensagem nova');
});

test('gerarMapaDiferencas produz um PNG com os pixels alterados em branco', () => {
  const pasta = pastaTemporaria();
  const original = criarPngTeste(path.join(pasta, 'original.png'), 32, 32);
  const saida = path.join(pasta, 'com-segredo.png');
  const mapa = path.join(pasta, 'mapa.png');

  ocultarMensagem(original, saida, 'segredo');
  const resultado = gerarMapaDiferencas(original, saida, mapa);

  assert.ok(fs.existsSync(mapa));
  assert.ok(resultado.pixelsAlterados > 0);
  assert.equal(resultado.totalPixels, 32 * 32);

  const png = lerPng(mapa);
  const brancos = [...png.data].filter((v, i) => i % 4 !== 3 && v === 255).length;
  assert.equal(brancos, resultado.pixelsAlterados * 3);
});

test('compararImagens recusa dimensões diferentes', () => {
  const pasta = pastaTemporaria();
  const a = criarPngTeste(path.join(pasta, 'a.png'), 16, 16);
  const b = criarPngTeste(path.join(pasta, 'b.png'), 32, 32);

  assert.throws(() => compararImagens(a, b), /dimensões diferentes/);
});

test('compararImagens devolve PSNR infinito para imagens idênticas', () => {
  const pasta = pastaTemporaria();
  const a = criarPngTeste(path.join(pasta, 'a.png'), 16, 16);
  const b = path.join(pasta, 'b.png');
  fs.copyFileSync(a, b);

  const metricas = compararImagens(a, b);
  assert.equal(metricas.canaisAlterados, 0);
  assert.equal(metricas.psnr, Infinity);
});
