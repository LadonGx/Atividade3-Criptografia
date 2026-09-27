/**
 * "Banco de dados" simulado: um arquivo JSON em disco.
 *
 * O objetivo do projeto é demonstrar as técnicas de segurança, não persistência,
 * então um arquivo JSON basta. O caminho é configurável para que os testes possam
 * usar um arquivo temporário e não interferir na demonstração.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Caminho padrão do arquivo de usuários, relativo ao diretório de execução. */
export const CAMINHO_PADRAO = path.join('data', 'usuarios.json');

/**
 * Lê a lista de usuários gravada.
 * @param {string} caminho Caminho do arquivo JSON.
 * @returns {Array<object>} Lista de usuários (vazia se o arquivo não existir).
 */
export function lerUsuarios(caminho = CAMINHO_PADRAO) {
  if (!fs.existsSync(caminho)) return [];

  const conteudo = fs.readFileSync(caminho, 'utf8').trim();
  if (conteudo === '') return [];

  const dados = JSON.parse(conteudo);
  if (!Array.isArray(dados)) {
    throw new Error(`Arquivo de banco inválido (esperado um array): ${caminho}`);
  }
  return dados;
}

/**
 * Grava a lista de usuários, criando a pasta se necessário.
 * @param {Array<object>} lista Lista completa de usuários.
 * @param {string} caminho Caminho do arquivo JSON.
 */
export function salvarUsuarios(lista, caminho = CAMINHO_PADRAO) {
  if (!Array.isArray(lista)) {
    throw new Error('A lista de usuários deve ser um array');
  }
  const pasta = path.dirname(caminho);
  if (pasta && pasta !== '.') fs.mkdirSync(pasta, { recursive: true });

  fs.writeFileSync(caminho, `${JSON.stringify(lista, null, 2)}\n`, 'utf8');
}

/**
 * Apaga o arquivo do banco (usado pela demonstração para começar do zero).
 * @param {string} caminho Caminho do arquivo JSON.
 */
export function limparBanco(caminho = CAMINHO_PADRAO) {
  fs.rmSync(caminho, { force: true });
}
