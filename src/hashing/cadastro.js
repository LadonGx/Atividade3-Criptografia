/**
 * Cadastro e autenticação de usuários.
 * A senha em texto puro nunca é gravada nem devolvida: apenas salt + hash.
 */
import crypto from 'node:crypto';
import { gerarSalt, gerarHash, compararHash, ALGORITMO } from './hash.js';
import { lerUsuarios, salvarUsuarios, CAMINHO_PADRAO } from '../db/bancoSimulado.js';

/** Tamanho mínimo exigido para a senha. */
export const TAMANHO_MINIMO_SENHA = 8;

/**
 * Mensagem genérica de falha no login.
 * Dizer "usuário não existe" permitiria a um atacante enumerar e-mails cadastrados;
 * por isso "e-mail inexistente" e "senha errada" devolvem exatamente o mesmo motivo.
 */
export const MOTIVO_GENERICO = 'E-mail ou senha inválidos';

/**
 * Cadastra um novo usuário.
 * @param {{nome: string, email: string, senha: string}} dados Dados do cadastro.
 * @param {string} caminho Caminho do arquivo do banco.
 * @returns {{id: string, nome: string, email: string, salt: string, algoritmo: string, criadoEm: string}}
 *          Registro criado SEM o hash e SEM a senha.
 */
export function cadastrarUsuario({ nome, email, senha } = {}, caminho = CAMINHO_PADRAO) {
  if (typeof nome !== 'string' || nome.trim() === '') {
    throw new Error('O nome é obrigatório');
  }
  if (typeof email !== 'string' || email.trim() === '') {
    throw new Error('O e-mail é obrigatório');
  }
  if (typeof senha !== 'string' || senha === '') {
    throw new Error('A senha é obrigatória');
  }
  if (senha.length < TAMANHO_MINIMO_SENHA) {
    throw new Error(`A senha deve ter no mínimo ${TAMANHO_MINIMO_SENHA} caracteres`);
  }

  const emailNormalizado = email.trim().toLowerCase();
  const usuarios = lerUsuarios(caminho);

  if (usuarios.some((u) => u.email === emailNormalizado)) {
    throw new Error(`Já existe um usuário cadastrado com o e-mail ${emailNormalizado}`);
  }

  const salt = gerarSalt(16);
  const registro = {
    id: crypto.randomUUID(),
    nome: nome.trim(),
    email: emailNormalizado,
    salt,
    hash: gerarHash(senha, salt),
    algoritmo: ALGORITMO,
    criadoEm: new Date().toISOString(),
  };

  usuarios.push(registro);
  salvarUsuarios(usuarios, caminho);

  // Devolve uma cópia sem o hash — quem chamou não precisa dele.
  const { hash, ...registroPublico } = registro;
  return registroPublico;
}

/**
 * Autentica um usuário.
 * @param {string} email E-mail informado.
 * @param {string} senha Senha informada.
 * @param {string} caminho Caminho do arquivo do banco.
 * @returns {{sucesso: true, usuario: object} | {sucesso: false, motivo: string}}
 */
export function autenticarUsuario(email, senha, caminho = CAMINHO_PADRAO) {
  if (typeof email !== 'string' || typeof senha !== 'string') {
    return { sucesso: false, motivo: MOTIVO_GENERICO };
  }

  const emailNormalizado = email.trim().toLowerCase();
  const usuario = lerUsuarios(caminho).find((u) => u.email === emailNormalizado);

  if (!usuario) {
    return { sucesso: false, motivo: MOTIVO_GENERICO };
  }
  if (!compararHash(senha, usuario.salt, usuario.hash)) {
    return { sucesso: false, motivo: MOTIVO_GENERICO };
  }

  const { hash, salt, ...usuarioPublico } = usuario;
  return { sucesso: true, usuario: usuarioPublico };
}
