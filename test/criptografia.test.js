/** Testes do Módulo 2 — Criptografia AES-256-GCM. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  gerarChaveAleatoria,
  derivarChave,
  cifrar,
  decifrar,
  ALGORITMO,
  TAMANHO_CHAVE,
  TAMANHO_IV,
} from '../src/criptografia/aes.js';

const TEXTO_ACENTOS = 'Transferência de R$ 1.234,56 — ação concluída às 9h ✅ 🔐 àéîõü';

test('gerarChaveAleatoria devolve 32 bytes distintos a cada chamada', () => {
  const a = gerarChaveAleatoria();
  const b = gerarChaveAleatoria();
  assert.equal(a.length, TAMANHO_CHAVE);
  assert.equal(a.equals(b), false);
});

test('derivarChave é determinística para a mesma senha e salt', () => {
  const salt = crypto.randomBytes(16);
  assert.equal(derivarChave('senha-combinada', salt).equals(derivarChave('senha-combinada', salt)), true);
});

test('derivarChave produz chaves diferentes com salts diferentes', () => {
  const chaveA = derivarChave('senha-combinada', crypto.randomBytes(16));
  const chaveB = derivarChave('senha-combinada', crypto.randomBytes(16));
  assert.equal(chaveA.equals(chaveB), false);
});

test('ida e volta recupera o texto exato, com acentos e emojis', () => {
  const chave = gerarChaveAleatoria();
  assert.equal(decifrar(cifrar(TEXTO_ACENTOS, chave), chave), TEXTO_ACENTOS);
});

test('ida e volta funciona com texto vazio e com texto longo', () => {
  const chave = gerarChaveAleatoria();
  const longo = 'a'.repeat(100_000);

  assert.equal(decifrar(cifrar('', chave), chave), '');
  assert.equal(decifrar(cifrar(longo, chave), chave), longo);
});

test('o pacote tem o formato esperado', () => {
  const pacote = cifrar('mensagem', gerarChaveAleatoria());

  assert.equal(pacote.algoritmo, ALGORITMO);
  assert.equal(Buffer.from(pacote.iv, 'base64').length, TAMANHO_IV);
  assert.equal(Buffer.from(pacote.authTag, 'base64').length, 16);
  assert.equal(typeof pacote.textoCifrado, 'string');
});

test('duas cifragens do mesmo texto com a mesma chave geram saídas diferentes (IV aleatório)', () => {
  const chave = gerarChaveAleatoria();
  const a = cifrar(TEXTO_ACENTOS, chave);
  const b = cifrar(TEXTO_ACENTOS, chave);

  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.textoCifrado, b.textoCifrado);
  // Mesmo assim, ambos decifram para o mesmo texto.
  assert.equal(decifrar(a, chave), decifrar(b, chave));
});

test('chave errada lança erro', () => {
  const pacote = cifrar(TEXTO_ACENTOS, gerarChaveAleatoria());
  assert.throws(() => decifrar(pacote, gerarChaveAleatoria()), /chave incorreta ou dados adulterados/);
});

test('texto cifrado adulterado lança erro', () => {
  const chave = gerarChaveAleatoria();
  const pacote = cifrar(TEXTO_ACENTOS, chave);

  const bytes = Buffer.from(pacote.textoCifrado, 'base64');
  bytes[0] ^= 0x01;

  assert.throws(
    () => decifrar({ ...pacote, textoCifrado: bytes.toString('base64') }, chave),
    /chave incorreta ou dados adulterados/,
  );
});

test('auth tag adulterada lança erro', () => {
  const chave = gerarChaveAleatoria();
  const pacote = cifrar(TEXTO_ACENTOS, chave);

  const tag = Buffer.from(pacote.authTag, 'base64');
  tag[15] ^= 0xff;

  assert.throws(
    () => decifrar({ ...pacote, authTag: tag.toString('base64') }, chave),
    /chave incorreta ou dados adulterados/,
  );
});

test('IV adulterado lança erro', () => {
  const chave = gerarChaveAleatoria();
  const pacote = cifrar(TEXTO_ACENTOS, chave);

  const iv = Buffer.from(pacote.iv, 'base64');
  iv[0] ^= 0x01;

  assert.throws(() => decifrar({ ...pacote, iv: iv.toString('base64') }, chave), /chave incorreta ou dados adulterados/);
});

test('cifrar rejeita chave de tamanho inválido e entrada não textual', () => {
  assert.throws(() => cifrar('texto', crypto.randomBytes(16)), /32 bytes/);
  assert.throws(() => cifrar(123, gerarChaveAleatoria()), /string/);
});

test('decifrar rejeita pacote incompleto ou com algoritmo desconhecido', () => {
  const chave = gerarChaveAleatoria();
  const pacote = cifrar('texto', chave);

  assert.throws(() => decifrar(null, chave), /Pacote cifrado inválido/);
  assert.throws(() => decifrar({ ...pacote, authTag: undefined }, chave), /incompleto/);
  assert.throws(() => decifrar({ ...pacote, algoritmo: 'aes-128-cbc' }, chave), /não suportado/);
});

test('o texto cifrado não contém o texto original em claro', () => {
  const chave = gerarChaveAleatoria();
  const segredo = 'numero-do-cartao-4111111111111111';
  const pacote = cifrar(segredo, chave);

  const bruto = Buffer.from(pacote.textoCifrado, 'base64').toString('latin1');
  assert.equal(bruto.includes('4111'), false);
});
