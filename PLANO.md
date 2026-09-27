# Plano de Implementação — Proteção e Ocultação de Dados em Node.js

> **Instrução para o Claude Code:** leia este plano inteiro antes de começar. Implemente fase por fase, na ordem. Ao final de cada fase, rode os testes (`npm test`) e o script de demonstração correspondente, confirme que tudo passa e só então siga para a próxima. Não adicione dependências além das listadas sem perguntar. Todo o código, comentários, mensagens de console e documentação devem estar em **português**.

---

## 1. Visão geral

Projeto acadêmico com três módulos independentes:

| Módulo | Objetivo | Técnica escolhida |
|---|---|---|
| Hashing | Cadastro/login sem senha em texto puro | SHA-256 com salt aleatório de 16 bytes |
| Criptografia | Cifrar e decifrar dados financeiros | AES-256-GCM (simétrica, autenticada) |
| Esteganografia | Esconder texto numa imagem PNG | LSB nos canais R, G e B |

Cada módulo tem: uma biblioteca em `src/`, um script de demonstração em `scripts/` e testes em `test/`.

## 2. Stack e restrições

- Node.js 20+ com **ES Modules** (`"type": "module"` no `package.json`), JavaScript puro.
- Criptografia e hashing: somente o módulo nativo `node:crypto`.
- Imagem: `pngjs` (única dependência de produção).
- Testes: executor nativo `node:test` + `node:assert/strict` (sem Jest/Mocha).
- Sem frameworks, sem banco real — o "banco de dados" é um arquivo JSON.

## 3. Estrutura do repositório

```
seguranca-dados-node/
├── package.json
├── README.md
├── .gitignore
├── src/
│   ├── hashing/
│   │   ├── hash.js            # gerarSalt, gerarHash, compararHash
│   │   └── cadastro.js        # cadastrarUsuario, autenticarUsuario
│   ├── db/
│   │   └── bancoSimulado.js   # leitura/escrita em data/usuarios.json
│   ├── criptografia/
│   │   └── aes.js             # derivarChave, cifrar, decifrar
│   └── esteganografia/
│       ├── lsb.js             # ocultarMensagem, extrairMensagem, capacidade
│       └── metricas.js        # compararImagens (pixels alterados, diferença máx., PSNR)
├── scripts/
│   ├── demo-hashing.js
│   ├── demo-criptografia.js
│   ├── demo-esteganografia.js
│   ├── esteg-cli.js           # CLI: ocultar / extrair
│   └── gerar-imagem.js        # gera assets/original.png se não existir
├── assets/
│   └── original.png
├── output/                    # arquivos gerados pelas demos
├── data/                      # usuarios.json gerado pela demo
├── test/
│   ├── hashing.test.js
│   ├── criptografia.test.js
│   └── esteganografia.test.js
└── docs/
    └── RELATORIO.md
```

### Scripts do `package.json`

```json
{
  "scripts": {
    "demo:hash": "node scripts/demo-hashing.js",
    "demo:cripto": "node scripts/demo-criptografia.js",
    "demo:esteg": "node scripts/demo-esteganografia.js",
    "demo": "npm run demo:hash && npm run demo:cripto && npm run demo:esteg",
    "test": "node --test test/"
  }
}
```

### `.gitignore`

`node_modules/`, `output/`, `data/usuarios.json`. Manter `assets/original.png` versionado.

---

## 4. Fase 1 — Setup

1. `npm init -y`, ajustar `package.json` (nome, `"type": "module"`, `"engines": { "node": ">=20" }`, scripts acima).
2. `npm install pngjs`.
3. Criar a estrutura de pastas e o `.gitignore`.
4. Criar um `README.md` inicial com título, descrição de uma linha e seção "Como executar" (preencher no final).

**Commit:** `chore: estrutura inicial do projeto`

---

## 5. Fase 2 — Módulo de Hashing

### `src/hashing/hash.js`

- `gerarSalt(bytes = 16)` → `crypto.randomBytes(bytes).toString('hex')`.
- `gerarHash(senha, salt)` → SHA-256 de `salt + senha`, retorna hex. O salt é concatenado **antes** do processamento.
- `compararHash(senha, salt, hashArmazenado)` → recalcula e compara com `crypto.timingSafeEqual` (converter ambos para `Buffer`; se tamanhos diferirem, retornar `false`). Explicar em comentário por que não usar `===` (ataque de temporização).

### `src/db/bancoSimulado.js`

- Caminho padrão `data/usuarios.json`, configurável por parâmetro (para os testes usarem arquivo temporário).
- `lerUsuarios()` → retorna array (vazio se o arquivo não existir).
- `salvarUsuarios(lista)` → grava JSON formatado (cria a pasta se necessário).
- `limparBanco()` → apaga o arquivo (usado pela demo para começar do zero).

### `src/hashing/cadastro.js`

- `cadastrarUsuario({ nome, email, senha })`:
  - Validar campos obrigatórios e senha com no mínimo 8 caracteres.
  - Rejeitar e-mail duplicado.
  - Gerar salt e hash; gravar registro `{ id: crypto.randomUUID(), nome, email, salt, hash, algoritmo: 'sha256', criadoEm }`.
  - **Nunca** gravar nem retornar a senha. Retornar o registro sem o hash.
- `autenticarUsuario(email, senha)` → `{ sucesso: true, usuario }` ou `{ sucesso: false, motivo }`. Usar a mesma mensagem genérica para "usuário não existe" e "senha errada" (não revelar qual dos dois falhou).

### `scripts/demo-hashing.js`

Saída no console, com seções bem separadas:

1. Limpa o banco.
2. Cadastra **dois usuários com a mesma senha** e imprime salt e hash de cada — mostrar que os hashes são diferentes graças ao salt.
3. Imprime o conteúdo de `data/usuarios.json` e confirma programaticamente que a senha em texto puro não aparece no arquivo.
4. Login com senha correta → sucesso.
5. Login com senha errada → falha.
6. Tentativa de cadastro com e-mail duplicado → erro tratado.
7. Mostra o hash **sem** salt da mesma senha, para evidenciar que dois usuários teriam hashes idênticos sem ele.

### `test/hashing.test.js`

- Salts gerados são diferentes entre chamadas e têm 32 caracteres hex.
- Mesma senha + mesmo salt → mesmo hash (determinismo).
- Mesma senha + salts diferentes → hashes diferentes.
- `compararHash` aceita senha correta e rejeita incorreta.
- Arquivo do banco não contém a senha em texto puro.
- Cadastro com e-mail duplicado lança erro.

**Commit:** `feat: módulo de hashing com salt`

---

## 6. Fase 3 — Módulo de Criptografia (AES-256-GCM)

### `src/criptografia/aes.js`

- Constantes: algoritmo `aes-256-gcm`, chave de 32 bytes, IV de 12 bytes, auth tag de 16 bytes.
- `gerarChaveAleatoria()` → `crypto.randomBytes(32)`.
- `derivarChave(senha, salt)` → `crypto.scryptSync(senha, salt, 32)`. Permite que remetente e destinatário usem uma senha combinada em vez de trocar bytes brutos.
- `cifrar(textoPlano, chave)`:
  - Gerar IV novo e aleatório **a cada chamada** (comentar por que reutilizar IV no GCM é grave).
  - Retornar pacote `{ algoritmo, iv, authTag, textoCifrado }` com os binários em base64.
- `decifrar(pacote, chave)` → retorna o texto original; se chave estiver errada ou o pacote tiver sido adulterado, o GCM lança erro — capturar e relançar como `Error('Falha na decifragem: chave incorreta ou dados adulterados')`.

### `scripts/demo-criptografia.js` — simulação de comunicação local

Simular remetente e destinatário:

1. Dados financeiros **fictícios** em JSON, por exemplo:
   `{ titular: "Maria Exemplo", banco: "Banco Fictício S.A.", agencia: "0001", conta: "12345-6", saldo: 15320.50, cartao: "4111 1111 1111 1111", ultimaTransacao: { valor: -289.90, descricao: "Supermercado", data: "2026-09-20" } }`
   (o número de cartão é o padrão de testes da Visa — não é real).
2. **Remetente:** deriva a chave a partir de uma senha combinada + salt, cifra o JSON e grava o pacote em `output/mensagem.enc.json` (incluir o salt da derivação no pacote).
3. Imprimir o texto cifrado (base64) mostrando que é ilegível.
4. **Destinatário:** lê o arquivo, deriva a chave com a mesma senha, decifra e imprime o texto original.
5. Verificar com `assert` que o texto decifrado é idêntico ao original e imprimir "✔ Texto original recuperado".
6. Tentar decifrar com **senha errada** → erro capturado e exibido.
7. Alterar 1 byte do texto cifrado e tentar decifrar → erro de integridade capturado e exibido.

### `test/criptografia.test.js`

- Ida e volta (cifrar → decifrar) recupera o texto exato, incluindo acentos e emojis.
- Duas cifragens do mesmo texto com a mesma chave geram textos cifrados diferentes (IV aleatório).
- Chave errada lança erro.
- Texto cifrado adulterado lança erro.
- Auth tag adulterada lança erro.

**Commit:** `feat: módulo de criptografia AES-256-GCM`

---

## 7. Fase 4 — Módulo de Esteganografia (LSB)

### Protocolo de gravação (documentar no topo de `lsb.js`)

- Usar apenas os canais **R, G e B**; o canal alfa nunca é alterado.
- Cada canal guarda 1 bit: `novoValor = (valor & 0xFE) | bit`.
- Layout dos bits gravados, em ordem:
  1. Assinatura mágica `STG1` (4 bytes) — permite detectar se a imagem contém mensagem.
  2. Tamanho da mensagem em bytes (inteiro de 32 bits, big-endian).
  3. Bytes da mensagem codificada em UTF-8, bit mais significativo primeiro.
- Capacidade em bytes: `floor(largura × altura × 3 / 8) − 8` (8 bytes de cabeçalho).

### `src/esteganografia/lsb.js`

- `capacidade(png)` → bytes disponíveis.
- `ocultarMensagem(caminhoEntrada, caminhoSaida, mensagem)`:
  - Ler PNG com `PNG.sync.read`.
  - Lançar erro claro se a mensagem não couber (informar capacidade e tamanho necessário).
  - Gravar os bits e salvar com `PNG.sync.write`.
  - Recusar caminho de saída que não termine em `.png` (explicar em comentário: JPEG tem compressão com perdas e destrói os LSBs).
- `extrairMensagem(caminho)`:
  - Ler assinatura; se não for `STG1`, lançar `Error('Nenhuma mensagem oculta encontrada')`.
  - Ler tamanho, validar contra a capacidade, ler os bytes e decodificar UTF-8.
- Separar funções internas puras (`bytesParaBits`, `bitsParaBytes`, `escreverBits(data, bits)`, `lerBits(data, quantidade)`) que operam sobre o buffer RGBA, para facilitar testes.

### `src/esteganografia/metricas.js`

`compararImagens(caminhoA, caminhoB)` retorna:
- total de canais comparados e quantos foram alterados (e %),
- diferença máxima por canal (deve ser **1**),
- PSNR em dB (`10 × log10(255² / MSE)`; retornar `Infinity` se MSE = 0).

Função extra `gerarMapaDiferencas(caminhoA, caminhoB, caminhoSaida)`: gera um PNG onde pixels alterados ficam brancos e os demais pretos — útil como figura no relatório.

### `scripts/gerar-imagem.js`

Se `assets/original.png` não existir, gerar uma imagem 512×512 com gradiente colorido + ruído leve (para ter textura realista). Se a equipe preferir, substituir por uma foto própria em PNG.

### `scripts/esteg-cli.js`

```
node scripts/esteg-cli.js ocultar --entrada assets/original.png --saida output/secreta.png --mensagem "texto"
node scripts/esteg-cli.js extrair --entrada output/secreta.png
```
Parse de argumentos com `node:util` → `parseArgs`. Mensagens de uso claras em caso de argumentos faltando.

### `scripts/demo-esteganografia.js`

1. Garante que `assets/original.png` existe (chama o gerador se preciso).
2. Mostra dimensões e capacidade da imagem.
3. Oculta a frase confidencial (ex.: `"Reunião confidencial: servidor de backup migra na sexta às 22h."`) em `output/imagem-com-segredo.png`.
4. Imprime as métricas: canais alterados, diferença máxima = 1, PSNR (esperado > 50 dB, visualmente imperceptível).
5. Gera `output/mapa-diferencas.png`.
6. Extrai a mensagem da imagem alterada e confirma com `assert` que é idêntica à original.
7. Tenta extrair da imagem **original** → erro "Nenhuma mensagem oculta encontrada".

### `test/esteganografia.test.js`

- Ida e volta recupera a mensagem exata (incluir acentos e emoji).
- Nenhum canal difere em mais de 1 entre original e alterada.
- Canal alfa permanece intacto.
- Mensagem maior que a capacidade lança erro.
- Imagem sem mensagem lança erro na extração.
- Usar imagens pequenas geradas em memória/arquivo temporário (`os.tmpdir()`) nos testes.

**Commit:** `feat: módulo de esteganografia LSB`

---

## 8. Fase 5 — Documentação

### `README.md`

- Descrição do projeto e dos três módulos.
- Pré-requisitos (Node 20+), instalação (`npm install`), comandos de demo, testes e CLI.
- Estrutura de pastas resumida.
- Nomes dos integrantes da equipe (deixar placeholders `[Nome 1]`, `[Nome 2]`...).

### `docs/RELATORIO.md` — rascunho do relatório

Gerar o esqueleto com texto inicial em cada seção, marcando com `[PRINT: ...]` onde a equipe deve inserir capturas de tela:

1. **Introdução** — contexto de segurança da informação (confidencialidade, integridade, autenticidade) e objetivo do trabalho.
2. **Ferramentas utilizadas** — Node.js, `node:crypto`, `pngjs`, `node:test`, Git/GitHub.
3. **Módulo 1 — Hashing**
   - Conceito de função hash (unidirecional, determinística, efeito avalanche).
   - Por que usar salt (rainbow tables, senhas iguais → hashes iguais).
   - Implementação e decisões (salt de 16 bytes, `timingSafeEqual`, mensagem genérica de erro no login).
   - Resultados `[PRINT: demo:hash]`.
   - Limitação: SHA-256 é rápido demais para senhas em produção; o recomendado seria bcrypt, scrypt ou Argon2, que são propositalmente lentos.
4. **Módulo 2 — Criptografia**
   - Simétrica × assimétrica; justificativa do AES.
   - Modo GCM: IV, auth tag e integridade; derivação de chave com scrypt.
   - Resultados: decifragem correta, falha com chave errada, detecção de adulteração `[PRINT: demo:cripto]`.
   - Limitação: troca segura da chave (em cenário real, usar RSA/ECDH para trocar a chave AES — criptografia híbrida).
5. **Módulo 3 — Esteganografia**
   - Conceito de LSB e por que a alteração é imperceptível (variação máxima de 1 em 255 por canal).
   - Protocolo (assinatura, tamanho, dados) e cálculo de capacidade.
   - Resultados: métricas, PSNR, imagens lado a lado e mapa de diferenças `[PRINT: original × alterada × mapa]`.
   - Limitações: não resiste a compressão com perdas nem redimensionamento; LSB sem cifragem é detectável por esteganálise — combinar com o Módulo 2 aumentaria a segurança.
6. **Testes automatizados** — resumo dos casos e `[PRINT: npm test]`.
7. **Conclusão**
8. **Referências** — documentação do Node.js `crypto`, NIST FIPS 197 (AES), NIST SP 800-38D (GCM), NIST FIPS 180-4 (SHA), OWASP Password Storage Cheat Sheet.
9. **Repositório** — `[LINK DO GITHUB]`.

**Commit:** `docs: README e rascunho do relatório`

---

## 9. Extras opcionais (só se sobrar tempo)

- **Hashing:** adicionar variante com `crypto.scrypt` (campo `algoritmo: 'scrypt'`) e comparar tempo de execução com SHA-256 na demo — reforça no relatório por que algoritmos lentos são melhores para senhas.
- **Criptografia híbrida:** gerar par RSA-2048 com `crypto.generateKeyPairSync`, cifrar a chave AES com RSA-OAEP e mostrar o destinatário recuperando a chave com a chave privada.
- **Esteganografia + criptografia:** cifrar a frase com o Módulo 2 antes de ocultá-la na imagem.

## 10. Critérios de pronto

- [ ] `npm install && npm test` passa sem erros.
- [ ] `npm run demo` executa os três módulos com saída legível e sem exceções não tratadas.
- [ ] `data/usuarios.json` não contém nenhuma senha em texto puro.
- [ ] Texto decifrado é idêntico ao original; chave errada e adulteração são rejeitadas.
- [ ] Imagem alterada é visualmente idêntica (diferença máx. 1 por canal) e a mensagem é extraída corretamente.
- [ ] README e rascunho do relatório criados.
- [ ] Histórico de commits organizado por fase.
