# Segurança de Dados em Node.js

Projeto acadêmico que demonstra três técnicas de proteção e ocultação de dados, implementadas em JavaScript puro com Node.js.

| Módulo | Objetivo | Técnica |
|---|---|---|
| **1 — Hashing** | Cadastro e login sem guardar senha em texto puro | SHA-256 com salt aleatório de 16 bytes |
| **2 — Criptografia** | Cifrar e decifrar dados financeiros | AES-256-GCM (simétrica e autenticada) |
| **3 — Esteganografia** | Esconder texto dentro de uma imagem | LSB nos canais R, G e B de um PNG |

Cada módulo tem uma biblioteca em `src/`, um script de demonstração em `scripts/` e testes automatizados em `test/`.

## Pré-requisitos

- **Node.js 20 ou superior** (`node --version`)
- npm

## Instalação

```bash
npm install
```

A única dependência de produção é o [`pngjs`](https://www.npmjs.com/package/pngjs), usado para ler e escrever imagens PNG. Hashing e criptografia usam apenas o módulo nativo `node:crypto`; os testes usam o executor nativo `node:test`.

## Como executar

### Demonstrações

```bash
npm run demo          # executa os três módulos em sequência
npm run demo:hash     # Módulo 1 — hashing com salt
npm run demo:cripto   # Módulo 2 — AES-256-GCM
npm run demo:esteg    # Módulo 3 — esteganografia LSB
```

Cada demonstração imprime as etapas no console, incluindo os casos de falha (senha errada, dados adulterados, imagem sem mensagem).

### Testes automatizados

```bash
npm test
```

### CLI de esteganografia

```bash
# Esconder uma mensagem
node scripts/esteg-cli.js ocultar \
  --entrada assets/original.png \
  --saida output/secreta.png \
  --mensagem "texto confidencial"

# Recuperar a mensagem
node scripts/esteg-cli.js extrair --entrada output/secreta.png

# Consultar quantos bytes cabem em uma imagem
node scripts/esteg-cli.js capacidade --entrada assets/original.png
```

### Gerar a imagem de trabalho

`assets/original.png` já vem versionada. Para recriá-la (ou gerar outra), apague o arquivo e rode:

```bash
node scripts/gerar-imagem.js
```

Também é possível substituí-la por uma foto própria — desde que seja **PNG**, porque formatos com perdas como JPEG destroem os bits menos significativos e apagam a mensagem.

## Estrutura de pastas

```
.
├── src/
│   ├── hashing/          hash.js (salt/hash/comparação) e cadastro.js (cadastro/login)
│   ├── db/               bancoSimulado.js — persistência em data/usuarios.json
│   ├── criptografia/     aes.js — derivação de chave, cifragem e decifragem
│   └── esteganografia/   lsb.js (ocultar/extrair) e metricas.js (PSNR, mapa de diferenças)
├── scripts/              demonstrações, CLI e gerador de imagem
├── test/                 testes com node:test
├── assets/original.png   imagem portadora (versionada)
├── output/               arquivos gerados pelas demos (ignorado pelo Git)
├── data/                 banco simulado (ignorado pelo Git)
└── docs/RELATORIO.md     relatório do trabalho
```

## O que cada demonstração mostra

**`demo:hash`** — dois usuários com a mesma senha recebem hashes diferentes graças ao salt; o arquivo em disco é exibido e verificado para comprovar que a senha em texto puro não aparece; login correto, login incorreto e cadastro duplicado; comparação com o hash sem salt.

**`demo:cripto`** — um remetente deriva a chave de uma senha combinada (scrypt), cifra um JSON financeiro fictício e grava o pacote em `output/mensagem.enc.json`; o destinatário deriva a mesma chave e recupera o texto; em seguida são demonstradas as falhas com senha errada, com 1 byte do texto cifrado alterado e com a auth tag alterada.

**`demo:esteg`** — a mensagem é escondida em `output/imagem-com-segredo.png`; são impressas as métricas (canais alterados, diferença máxima de 1, PSNR acima de 80 dB); um mapa de diferenças é gerado em `output/mapa-diferencas.png`; a mensagem é extraída e conferida, e a extração da imagem original falha como esperado.

## Aviso

Os dados financeiros usados na demonstração são **fictícios**. O número de cartão `4111 1111 1111 1111` é o número de teste público da Visa e não corresponde a nenhum cartão real.

Este é um projeto didático. Para armazenamento de senhas em produção, o recomendado é bcrypt, scrypt ou Argon2 — algoritmos propositalmente lentos —, e não SHA-256. Veja a seção de limitações em [`docs/RELATORIO.md`](docs/RELATORIO.md).

## Equipe

- [Nome 1]
- [Nome 2]
- [Nome 3]
- [Nome 4]
