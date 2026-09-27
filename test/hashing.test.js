/** Testes do Módulo 1 — Hashing com salt. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { gerarSalt, gerarHash, compararHash } from '../src/hashing/hash.js';
import { cadastrarUsuario, autenticarUsuario, MOTIVO_GENERICO } from '../src/hashing/cadastro.js';
import { lerUsuarios } from '../src/db/bancoSimulado.js';

/** Cria um arquivo de banco temporário isolado para cada teste. */
function bancoTemporario() {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'hashing-test-'));
  return path.join(pasta, 'usuarios.json');
}

test('gerarSalt produz valores diferentes a cada chamada', () => {
  const salts = new Set(Array.from({ length: 100 }, () => gerarSalt()));
  assert.equal(salts.size, 100, 'os 100 salts gerados devem ser únicos');
});

test('gerarSalt(16) devolve 32 caracteres hexadecimais', () => {
  const salt = gerarSalt(16);
  assert.equal(salt.length, 32);
  assert.match(salt, /^[0-9a-f]{32}$/);
});

test('mesma senha e mesmo salt produzem o mesmo hash (determinismo)', () => {
  const salt = gerarSalt();
  assert.equal(gerarHash('minhaSenha123', salt), gerarHash('minhaSenha123', salt));
});

test('mesma senha com salts diferentes produz hashes diferentes', () => {
  const hashA = gerarHash('minhaSenha123', gerarSalt());
  const hashB = gerarHash('minhaSenha123', gerarSalt());
  assert.notEqual(hashA, hashB);
});

test('gerarHash devolve 64 caracteres hexadecimais (SHA-256)', () => {
  assert.match(gerarHash('abc', gerarSalt()), /^[0-9a-f]{64}$/);
});

test('compararHash aceita a senha correta e rejeita a incorreta', () => {
  const salt = gerarSalt();
  const hash = gerarHash('senhaCorreta1', salt);

  assert.equal(compararHash('senhaCorreta1', salt, hash), true);
  assert.equal(compararHash('senhaErrada1', salt, hash), false);
  assert.equal(compararHash('senhaCorreta1', gerarSalt(), hash), false);
});

test('compararHash devolve false para hash armazenado de tamanho inválido', () => {
  const salt = gerarSalt();
  assert.equal(compararHash('qualquer', salt, 'curto'), false);
  assert.equal(compararHash('qualquer', salt, undefined), false);
});

test('o arquivo do banco não contém a senha em texto puro', () => {
  const caminho = bancoTemporario();
  const senha = 'SenhaSecreta123';
  cadastrarUsuario({ nome: 'Ana', email: 'ana@exemplo.com', senha }, caminho);

  const conteudo = fs.readFileSync(caminho, 'utf8');
  assert.equal(conteudo.includes(senha), false);
  assert.equal(Object.hasOwn(lerUsuarios(caminho)[0], 'senha'), false);
});

test('cadastrarUsuario não devolve hash nem senha', () => {
  const caminho = bancoTemporario();
  const registro = cadastrarUsuario(
    { nome: 'Ana', email: 'ana@exemplo.com', senha: 'SenhaSecreta123' },
    caminho,
  );

  assert.equal(Object.hasOwn(registro, 'hash'), false);
  assert.equal(Object.hasOwn(registro, 'senha'), false);
  assert.ok(registro.id);
  assert.equal(registro.email, 'ana@exemplo.com');
});

test('cadastro com e-mail duplicado lança erro', () => {
  const caminho = bancoTemporario();
  cadastrarUsuario({ nome: 'Ana', email: 'ana@exemplo.com', senha: 'SenhaSecreta123' }, caminho);

  assert.throws(
    () => cadastrarUsuario({ nome: 'Outra', email: 'ANA@exemplo.com', senha: 'OutraSenha123' }, caminho),
    /Já existe um usuário/,
  );
});

test('cadastro rejeita senha curta e campos obrigatórios ausentes', () => {
  const caminho = bancoTemporario();
  assert.throws(() => cadastrarUsuario({ nome: 'Ana', email: 'a@b.com', senha: 'curta' }, caminho), /8 caracteres/);
  assert.throws(() => cadastrarUsuario({ email: 'a@b.com', senha: 'SenhaSecreta123' }, caminho), /nome/);
  assert.throws(() => cadastrarUsuario({ nome: 'Ana', senha: 'SenhaSecreta123' }, caminho), /e-mail/);
  assert.throws(() => cadastrarUsuario({ nome: 'Ana', email: 'a@b.com' }, caminho), /senha/);
});

test('dois usuários com a mesma senha têm salts e hashes diferentes', () => {
  const caminho = bancoTemporario();
  const senha = 'MesmaSenha123';
  cadastrarUsuario({ nome: 'Ana', email: 'ana@exemplo.com', senha }, caminho);
  cadastrarUsuario({ nome: 'Bruno', email: 'bruno@exemplo.com', senha }, caminho);

  const [ana, bruno] = lerUsuarios(caminho);
  assert.notEqual(ana.salt, bruno.salt);
  assert.notEqual(ana.hash, bruno.hash);
});

test('autenticarUsuario funciona com a senha correta', () => {
  const caminho = bancoTemporario();
  cadastrarUsuario({ nome: 'Ana', email: 'ana@exemplo.com', senha: 'SenhaSecreta123' }, caminho);

  const resultado = autenticarUsuario('ana@exemplo.com', 'SenhaSecreta123', caminho);
  assert.equal(resultado.sucesso, true);
  assert.equal(resultado.usuario.nome, 'Ana');
  assert.equal(Object.hasOwn(resultado.usuario, 'hash'), false);
});

test('autenticarUsuario usa o mesmo motivo para senha errada e usuário inexistente', () => {
  const caminho = bancoTemporario();
  cadastrarUsuario({ nome: 'Ana', email: 'ana@exemplo.com', senha: 'SenhaSecreta123' }, caminho);

  const senhaErrada = autenticarUsuario('ana@exemplo.com', 'errada12345', caminho);
  const semUsuario = autenticarUsuario('ninguem@exemplo.com', 'SenhaSecreta123', caminho);

  assert.equal(senhaErrada.sucesso, false);
  assert.equal(semUsuario.sucesso, false);
  assert.equal(senhaErrada.motivo, MOTIVO_GENERICO);
  assert.equal(semUsuario.motivo, MOTIVO_GENERICO);
});

test('lerUsuarios devolve array vazio quando o arquivo não existe', () => {
  assert.deepEqual(lerUsuarios(path.join(os.tmpdir(), 'inexistente-xyz', 'usuarios.json')), []);
});
