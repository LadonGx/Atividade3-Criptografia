/**
 * Demonstração do Módulo 1 — Hashing de senhas com salt.
 * Execute com: npm run demo:hash
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { gerarSalt, gerarHash } from '../src/hashing/hash.js';
import { cadastrarUsuario, autenticarUsuario } from '../src/hashing/cadastro.js';
import { limparBanco, CAMINHO_PADRAO } from '../src/db/bancoSimulado.js';

function secao(titulo) {
  console.log(`\n${'='.repeat(70)}\n${titulo}\n${'='.repeat(70)}`);
}

const SENHA_COMPARTILHADA = 'senhaForte123';

secao('MÓDULO 1 — HASHING DE SENHAS COM SALT (SHA-256)');
console.log(`Banco simulado: ${CAMINHO_PADRAO}`);

// 1. Começa do zero.
limparBanco();
console.log('Banco limpo.');

// 2. Dois usuários com EXATAMENTE a mesma senha.
secao('1) Dois usuários, a MESMA senha → hashes diferentes');
console.log(`Senha usada pelos dois: "${SENHA_COMPARTILHADA}"\n`);

cadastrarUsuario({ nome: 'Ana Souza', email: 'ana@exemplo.com', senha: SENHA_COMPARTILHADA });
cadastrarUsuario({ nome: 'Bruno Lima', email: 'bruno@exemplo.com', senha: SENHA_COMPARTILHADA });

const usuarios = JSON.parse(fs.readFileSync(CAMINHO_PADRAO, 'utf8'));
for (const u of usuarios) {
  console.log(`${u.nome} <${u.email}>`);
  console.log(`  salt: ${u.salt}`);
  console.log(`  hash: ${u.hash}\n`);
}
console.log(
  usuarios[0].hash === usuarios[1].hash
    ? '✘ Os hashes são iguais (não deveria acontecer)'
    : '✔ Os hashes são DIFERENTES mesmo com a mesma senha — mérito do salt aleatório.',
);

// 3. Conteúdo do arquivo e verificação de que a senha não vazou.
secao('2) Conteúdo gravado em disco');
const conteudoBruto = fs.readFileSync(CAMINHO_PADRAO, 'utf8');
console.log(conteudoBruto);
console.log(
  conteudoBruto.includes(SENHA_COMPARTILHADA)
    ? '✘ A senha em texto puro aparece no arquivo!'
    : '✔ A senha em texto puro NÃO aparece no arquivo.',
);

// 4. Login correto.
secao('3) Login com senha correta');
console.log(autenticarUsuario('ana@exemplo.com', SENHA_COMPARTILHADA));

// 5. Login com senha errada.
secao('4) Login com senha errada');
console.log(autenticarUsuario('ana@exemplo.com', 'senhaErrada999'));
console.log('\nObservação: o mesmo motivo é devolvido para e-mail inexistente:');
console.log(autenticarUsuario('nao-existe@exemplo.com', SENHA_COMPARTILHADA));

// 6. E-mail duplicado.
secao('5) Cadastro com e-mail duplicado');
try {
  cadastrarUsuario({ nome: 'Ana Clone', email: 'ana@exemplo.com', senha: SENHA_COMPARTILHADA });
  console.log('✘ O cadastro duplicado foi aceito (não deveria).');
} catch (erro) {
  console.log(`✔ Erro tratado: ${erro.message}`);
}

// 7. O mesmo hash SEM salt.
secao('6) E se não houvesse salt?');
const semSalt = crypto.createHash('sha256').update(SENHA_COMPARTILHADA, 'utf8').digest('hex');
console.log(`SHA-256("${SENHA_COMPARTILHADA}") sem salt:`);
console.log(`  Ana:   ${semSalt}`);
console.log(`  Bruno: ${semSalt}`);
console.log('\n✘ Hashes IDÊNTICOS: um vazamento revelaria que os dois usam a mesma senha,');
console.log('  e uma rainbow table quebraria os dois de uma só vez.');

// Curiosidade: efeito avalanche.
secao('7) Efeito avalanche (bônus)');
const salt = gerarSalt();
console.log(`salt fixo: ${salt}`);
console.log(`hash("senhaForte123") = ${gerarHash('senhaForte123', salt)}`);
console.log(`hash("senhaForte124") = ${gerarHash('senhaForte124', salt)}`);
console.log('\n✔ Um único caractere diferente muda o hash inteiro.');

console.log('\nDemonstração de hashing concluída.\n');
