/**
 * Módulo de hashing de senhas com salt.
 *
 * Uma função hash criptográfica é:
 *  - unidirecional: a partir do hash não se recupera a senha;
 *  - determinística: a mesma entrada sempre produz a mesma saída;
 *  - sensível (efeito avalanche): mudar 1 bit da entrada muda ~metade dos bits da saída.
 *
 * O salt é um valor aleatório gravado junto do hash. Ele garante que duas pessoas
 * com a mesma senha tenham hashes diferentes e inutiliza tabelas pré-computadas
 * (rainbow tables), porque o atacante precisaria de uma tabela por salt.
 */
import crypto from 'node:crypto';

/** Algoritmo de hash usado em todo o módulo. */
export const ALGORITMO = 'sha256';

/**
 * Gera um salt aleatório criptograficamente seguro.
 * @param {number} bytes Quantidade de bytes aleatórios (16 = 128 bits, padrão).
 * @returns {string} Salt em hexadecimal (2 caracteres por byte).
 */
export function gerarSalt(bytes = 16) {
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new Error('A quantidade de bytes do salt deve ser um inteiro positivo');
  }
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Calcula o hash SHA-256 de (salt + senha).
 * O salt é concatenado ANTES da senha, de modo que ele já entra no estado interno
 * da função antes de qualquer byte da senha ser processado.
 * @param {string} senha Senha em texto puro (nunca é gravada em lugar nenhum).
 * @param {string} salt Salt em hexadecimal.
 * @returns {string} Hash em hexadecimal (64 caracteres).
 */
export function gerarHash(senha, salt) {
  if (typeof senha !== 'string' || typeof salt !== 'string') {
    throw new Error('Senha e salt devem ser strings');
  }
  return crypto.createHash(ALGORITMO).update(salt + senha, 'utf8').digest('hex');
}

/**
 * Compara uma senha candidata com o hash armazenado.
 *
 * A comparação usa crypto.timingSafeEqual e NÃO o operador ===. O === para na
 * primeira diferença encontrada, então o tempo de resposta vaza quantos caracteres
 * iniciais estão corretos — um atacante poderia descobrir o hash byte a byte
 * (ataque de temporização / timing attack). O timingSafeEqual sempre percorre
 * todos os bytes, gastando o mesmo tempo independentemente de onde está a diferença.
 *
 * @param {string} senha Senha candidata.
 * @param {string} salt Salt gravado no cadastro.
 * @param {string} hashArmazenado Hash gravado no cadastro.
 * @returns {boolean} true se a senha confere.
 */
export function compararHash(senha, salt, hashArmazenado) {
  if (typeof hashArmazenado !== 'string') return false;

  const calculado = Buffer.from(gerarHash(senha, salt), 'utf8');
  const armazenado = Buffer.from(hashArmazenado, 'utf8');

  // timingSafeEqual lança se os buffers tiverem tamanhos diferentes; nesse caso
  // o hash armazenado nem sequer é um SHA-256 válido, então já falhou.
  if (calculado.length !== armazenado.length) return false;

  return crypto.timingSafeEqual(calculado, armazenado);
}
