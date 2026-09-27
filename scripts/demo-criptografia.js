/**
 * Demonstração do Módulo 2 — Criptografia AES-256-GCM.
 * Simula uma comunicação local entre um remetente e um destinatário.
 * Execute com: npm run demo:cripto
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { derivarChave, cifrar, decifrar } from '../src/criptografia/aes.js';

function secao(titulo) {
  console.log(`\n${'='.repeat(70)}\n${titulo}\n${'='.repeat(70)}`);
}

const ARQUIVO = path.join('output', 'mensagem.enc.json');
/** Senha combinada previamente entre as duas partes (por um canal seguro). */
const SENHA_COMBINADA = 'combinamos-essa-senha-no-cafe';

secao('MÓDULO 2 — CRIPTOGRAFIA SIMÉTRICA AES-256-GCM');

// 1. Dados financeiros FICTÍCIOS.
const dadosFinanceiros = {
  titular: 'Maria Exemplo',
  banco: 'Banco Fictício S.A.',
  agencia: '0001',
  conta: '12345-6',
  saldo: 15320.5,
  // Número de teste padrão da Visa — não corresponde a nenhum cartão real.
  cartao: '4111 1111 1111 1111',
  ultimaTransacao: { valor: -289.9, descricao: 'Supermercado', data: '2026-09-20' },
};
const textoOriginal = JSON.stringify(dadosFinanceiros, null, 2);

console.log('Dados financeiros fictícios a proteger:\n');
console.log(textoOriginal);

// 2. REMETENTE: deriva a chave e cifra.
secao('1) REMETENTE — deriva a chave, cifra e envia');
const saltDerivacao = crypto.randomBytes(16);
console.log(`Senha combinada: "${SENHA_COMBINADA}"`);
console.log(`Salt da derivação (aleatório): ${saltDerivacao.toString('hex')}`);

const chaveRemetente = derivarChave(SENHA_COMBINADA, saltDerivacao);
console.log(`Chave derivada (scrypt, 32 bytes): ${chaveRemetente.toString('hex')}`);

const pacote = { ...cifrar(textoOriginal, chaveRemetente), salt: saltDerivacao.toString('base64') };

fs.mkdirSync('output', { recursive: true });
fs.writeFileSync(ARQUIVO, `${JSON.stringify(pacote, null, 2)}\n`, 'utf8');
console.log(`\nPacote gravado em ${ARQUIVO}`);

// 3. O que trafega é ilegível.
secao('2) O que trafega pelo canal (ilegível)');
console.log(JSON.stringify(pacote, null, 2));
console.log('\n✔ Nenhum dado financeiro é reconhecível no texto cifrado.');
console.log(
  `✔ "4111" aparece no texto cifrado? ${pacote.textoCifrado.includes('4111') ? 'sim' : 'não'}`,
);

// 4. DESTINATÁRIO: lê, deriva a mesma chave e decifra.
secao('3) DESTINATÁRIO — lê o arquivo, deriva a chave e decifra');
const recebido = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
const chaveDestinatario = derivarChave(SENHA_COMBINADA, Buffer.from(recebido.salt, 'base64'));
console.log(`Chave derivada pelo destinatário: ${chaveDestinatario.toString('hex')}`);
console.log(
  `Chaves iguais? ${chaveDestinatario.equals(chaveRemetente) ? 'sim' : 'não'} (mesma senha + mesmo salt)\n`,
);

const textoDecifrado = decifrar(recebido, chaveDestinatario);
console.log(textoDecifrado);

// 5. Conferência.
assert.equal(textoDecifrado, textoOriginal);
console.log('\n✔ Texto original recuperado');

// 6. Senha errada.
secao('4) Tentativa com a senha ERRADA');
try {
  const chaveIntruso = derivarChave('senha-errada-do-intruso', Buffer.from(recebido.salt, 'base64'));
  decifrar(recebido, chaveIntruso);
  console.log('✘ A decifragem funcionou (não deveria).');
} catch (erro) {
  console.log(`✔ Erro capturado: ${erro.message}`);
}

// 7. Adulteração de 1 byte do texto cifrado.
secao('5) Adulteração de 1 byte no texto cifrado');
const bytesCifrados = Buffer.from(recebido.textoCifrado, 'base64');
console.log(`Byte 0 antes:  ${bytesCifrados[0]}`);
bytesCifrados[0] ^= 0x01; // inverte 1 bit
console.log(`Byte 0 depois: ${bytesCifrados[0]}`);

try {
  decifrar({ ...recebido, textoCifrado: bytesCifrados.toString('base64') }, chaveDestinatario);
  console.log('✘ A decifragem funcionou (não deveria).');
} catch (erro) {
  console.log(`✔ Integridade violada e detectada pelo GCM: ${erro.message}`);
}

// 8. Adulteração da auth tag.
secao('6) Adulteração da auth tag');
const tag = Buffer.from(recebido.authTag, 'base64');
tag[0] ^= 0xff;
try {
  decifrar({ ...recebido, authTag: tag.toString('base64') }, chaveDestinatario);
  console.log('✘ A decifragem funcionou (não deveria).');
} catch (erro) {
  console.log(`✔ Erro capturado: ${erro.message}`);
}

console.log('\nDemonstração de criptografia concluída.\n');
