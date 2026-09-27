/**
 * Módulo de criptografia simétrica AES-256-GCM.
 *
 * AES é uma cifra simétrica: a MESMA chave cifra e decifra.
 * O modo GCM (Galois/Counter Mode) é um modo AEAD — além de confidencialidade,
 * ele produz uma "auth tag" que garante integridade e autenticidade: se um único
 * bit do texto cifrado, do IV ou da tag for alterado, a decifragem falha em vez
 * de devolver lixo silenciosamente.
 */
import crypto from 'node:crypto';

/** Algoritmo usado em todo o módulo. */
export const ALGORITMO = 'aes-256-gcm';
/** Tamanho da chave: 32 bytes = 256 bits. */
export const TAMANHO_CHAVE = 32;
/** Tamanho do IV: 12 bytes = 96 bits, o valor recomendado pelo NIST SP 800-38D para GCM. */
export const TAMANHO_IV = 12;
/** Tamanho da auth tag: 16 bytes = 128 bits. */
export const TAMANHO_TAG = 16;

/**
 * Gera uma chave AES-256 totalmente aleatória.
 * @returns {Buffer} 32 bytes aleatórios.
 */
export function gerarChaveAleatoria() {
  return crypto.randomBytes(TAMANHO_CHAVE);
}

/**
 * Deriva uma chave AES-256 a partir de uma senha combinada entre as partes.
 *
 * Uma senha digitada por humano não tem 256 bits de entropia nem o tamanho certo,
 * então usamos scrypt — uma função de derivação propositalmente lenta e custosa em
 * memória, o que encarece muito um ataque de força bruta sobre a senha.
 * O salt evita que a mesma senha gere sempre a mesma chave.
 *
 * @param {string} senha Senha combinada entre remetente e destinatário.
 * @param {string|Buffer} salt Salt da derivação (deve ser transmitido junto do pacote).
 * @returns {Buffer} Chave de 32 bytes.
 */
export function derivarChave(senha, salt) {
  if (typeof senha !== 'string' || senha === '') {
    throw new Error('A senha de derivação é obrigatória');
  }
  if (salt === undefined || salt === null || salt === '') {
    throw new Error('O salt de derivação é obrigatório');
  }
  return crypto.scryptSync(senha, salt, TAMANHO_CHAVE);
}

/** Valida o formato da chave antes de usá-la. */
function validarChave(chave) {
  if (!Buffer.isBuffer(chave) || chave.length !== TAMANHO_CHAVE) {
    throw new Error(`A chave deve ser um Buffer de ${TAMANHO_CHAVE} bytes (AES-256)`);
  }
}

/**
 * Cifra um texto com AES-256-GCM.
 *
 * O IV é gerado novo e aleatório A CADA CHAMADA. Reutilizar um IV com a mesma chave
 * no modo GCM é uma falha grave: como o GCM é uma cifra de fluxo (contador), dois
 * textos cifrados com o mesmo par (chave, IV) podem ser combinados por XOR para
 * eliminar o keystream e revelar a relação entre os textos claros — e, pior, permite
 * recuperar a subchave de autenticação e forjar mensagens válidas.
 *
 * @param {string} textoPlano Texto a cifrar (UTF-8).
 * @param {Buffer} chave Chave de 32 bytes.
 * @returns {{algoritmo: string, iv: string, authTag: string, textoCifrado: string}}
 *          Pacote com os binários em base64.
 */
export function cifrar(textoPlano, chave) {
  if (typeof textoPlano !== 'string') {
    throw new Error('O texto a cifrar deve ser uma string');
  }
  validarChave(chave);

  const iv = crypto.randomBytes(TAMANHO_IV);
  const cifrador = crypto.createCipheriv(ALGORITMO, chave, iv);

  const textoCifrado = Buffer.concat([
    cifrador.update(textoPlano, 'utf8'),
    cifrador.final(),
  ]);
  const authTag = cifrador.getAuthTag();

  return {
    algoritmo: ALGORITMO,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    textoCifrado: textoCifrado.toString('base64'),
  };
}

/**
 * Decifra um pacote produzido por cifrar().
 * @param {{algoritmo?: string, iv: string, authTag: string, textoCifrado: string}} pacote Pacote cifrado.
 * @param {Buffer} chave Chave de 32 bytes.
 * @returns {string} Texto original em UTF-8.
 * @throws {Error} Se a chave estiver errada ou os dados tiverem sido adulterados.
 */
export function decifrar(pacote, chave) {
  if (!pacote || typeof pacote !== 'object') {
    throw new Error('Pacote cifrado inválido');
  }
  const { algoritmo = ALGORITMO, iv, authTag, textoCifrado } = pacote;

  if (algoritmo !== ALGORITMO) {
    throw new Error(`Algoritmo não suportado: ${algoritmo}`);
  }
  if (typeof iv !== 'string' || typeof authTag !== 'string' || typeof textoCifrado !== 'string') {
    throw new Error('Pacote cifrado incompleto: são necessários iv, authTag e textoCifrado');
  }
  validarChave(chave);

  try {
    const decifrador = crypto.createDecipheriv(ALGORITMO, chave, Buffer.from(iv, 'base64'));
    // A tag é verificada em final(): se não bater, o Node lança.
    decifrador.setAuthTag(Buffer.from(authTag, 'base64'));

    return Buffer.concat([
      decifrador.update(Buffer.from(textoCifrado, 'base64')),
      decifrador.final(),
    ]).toString('utf8');
  } catch {
    // A mensagem é propositalmente genérica: não distinguimos "chave errada" de
    // "dados adulterados" para não dar pistas a quem está atacando.
    throw new Error('Falha na decifragem: chave incorreta ou dados adulterados');
  }
}
