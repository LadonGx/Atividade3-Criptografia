# Relatório — Proteção e Ocultação de Dados

**Disciplina:** [Nome da disciplina]
**Professor(a):** [Nome]
**Equipe:** [Nome 1], [Nome 2], [Nome 3], [Nome 4]
**Data:** [dd/mm/aaaa]

> **Como usar este rascunho:** o texto abaixo já traz o conteúdo técnico de cada seção. Substitua os campos entre colchetes, revise a redação com as palavras da equipe e insira as capturas de tela nos pontos marcados com `[PRINT: ...]`.

---

## 1. Introdução

A segurança da informação costuma ser organizada em torno de três propriedades fundamentais:

- **Confidencialidade** — só quem está autorizado consegue ler o dado. É o que a criptografia garante.
- **Integridade** — é possível detectar se o dado foi alterado no caminho. É o que a auth tag do modo GCM e as funções de hash garantem.
- **Autenticidade** — é possível confirmar que o dado veio de quem diz ter enviado.

Este trabalho implementa três técnicas complementares que atuam sobre essas propriedades:

1. **Hashing com salt**, para que senhas de usuários nunca sejam armazenadas em texto puro;
2. **Criptografia simétrica AES-256-GCM**, para proteger dados financeiros em trânsito com confidencialidade e integridade;
3. **Esteganografia LSB**, para ocultar a própria existência de uma mensagem dentro de uma imagem.

Vale distinguir criptografia de esteganografia: a criptografia torna a mensagem **ilegível**, mas é evidente que existe algo cifrado; a esteganografia torna a mensagem **invisível**, escondendo que há qualquer comunicação. As duas se complementam, como discutido na seção 5.

Todo o código foi escrito em JavaScript puro sobre Node.js 20, usando o módulo nativo `node:crypto` e apenas uma dependência externa (`pngjs`) para manipular imagens.

---

## 2. Ferramentas utilizadas

| Ferramenta | Uso no projeto |
|---|---|
| **Node.js 20+** | Ambiente de execução; ES Modules (`"type": "module"`) |
| **`node:crypto`** | SHA-256, `randomBytes`, `randomUUID`, `scrypt`, AES-256-GCM, `timingSafeEqual` |
| **`pngjs`** | Leitura e escrita de PNG com acesso direto ao buffer RGBA |
| **`node:test` + `node:assert/strict`** | Testes automatizados, sem Jest nem Mocha |
| **`node:util` (`parseArgs`)** | Parsing de argumentos da CLI de esteganografia |
| **Git / GitHub** | Versionamento, com commits organizados por fase |

Nenhum framework foi usado. O "banco de dados" é um arquivo JSON (`data/usuarios.json`), suficiente para o propósito didático.

---

## 3. Módulo 1 — Hashing de senhas

### 3.1 Conceito de função hash

Uma função hash criptográfica transforma uma entrada de tamanho arbitrário em uma saída de tamanho fixo (256 bits no SHA-256) e tem três propriedades relevantes aqui:

- **Unidirecional** — a partir do hash é computacionalmente inviável recuperar a entrada. É isso que permite guardar o hash em vez da senha.
- **Determinística** — a mesma entrada sempre produz a mesma saída, o que torna possível verificar a senha no login.
- **Efeito avalanche** — mudar um único bit da entrada altera aproximadamente metade dos bits da saída, sem qualquer relação aparente com a mudança feita. A demonstração ilustra isso comparando os hashes de `senhaForte123` e `senhaForte124`.

### 3.2 Por que usar salt

Guardar apenas `SHA-256(senha)` tem dois problemas graves:

1. **Rainbow tables.** Como a função é pública e determinística, um atacante pode pré-computar o hash de bilhões de senhas comuns e simplesmente consultar a tabela. Quebrar a senha vira uma busca, não um ataque.
2. **Senhas iguais produzem hashes iguais.** Se dois usuários escolhem a mesma senha, isso fica visível no vazamento: quem quebrar uma, quebra as duas — e ainda descobre quais contas compartilham senha.

O **salt** é um valor aleatório, único por usuário, gravado ao lado do hash (ele não é segredo). O hash passa a ser `SHA-256(salt + senha)`. Com isso, a rainbow table só valeria para um único salt — o atacante precisaria refazer todo o trabalho para cada usuário — e duas senhas iguais passam a gerar hashes completamente diferentes.

### 3.3 Implementação e decisões

Arquivos: `src/hashing/hash.js`, `src/hashing/cadastro.js`, `src/db/bancoSimulado.js`.

- **Salt de 16 bytes (128 bits)** gerado com `crypto.randomBytes`, um gerador criptograficamente seguro. É o tamanho recomendado pela OWASP; a probabilidade de colisão é desprezível.
- **Salt concatenado antes da senha**, de modo que ele já entra no estado interno da função antes de qualquer byte da senha ser processado.
- **Comparação com `crypto.timingSafeEqual`**, não com `===`. O operador `===` para na primeira diferença encontrada, então o tempo de resposta vaza quantos caracteres iniciais estão corretos; com medições repetidas, um atacante poderia reconstruir o valor byte a byte (*timing attack*). O `timingSafeEqual` percorre sempre todos os bytes e gasta o mesmo tempo independentemente de onde está a diferença.
- **Mensagem genérica no login.** Tanto "e-mail não cadastrado" quanto "senha errada" devolvem exatamente `E-mail ou senha inválidos`. Respostas distintas permitiriam a um atacante enumerar quais e-mails existem na base.
- **A senha nunca é persistida nem devolvida.** O registro gravado contém `{ id, nome, email, salt, hash, algoritmo, criadoEm }`; a função de cadastro devolve esse objeto já sem o hash, e a de login devolve o usuário sem hash nem salt.
- **Validações:** campos obrigatórios, mínimo de 8 caracteres e rejeição de e-mail duplicado (normalizado para minúsculas).

### 3.4 Resultados

A demonstração (`npm run demo:hash`) cadastra dois usuários com a **mesma senha** e exibe salt e hash de cada um, mostrando que os hashes são diferentes; imprime o conteúdo de `data/usuarios.json` e verifica programaticamente que a senha em texto puro não aparece no arquivo; executa login correto, login com senha errada e tentativa de cadastro duplicado; e, por fim, mostra qual seria o hash sem salt — idêntico para os dois usuários.

`[PRINT: saída completa de npm run demo:hash]`

`[PRINT: trecho de data/usuarios.json mostrando salt e hash, sem a senha]`

### 3.5 Limitação

**SHA-256 é rápido demais para armazenar senhas.** Ela foi projetada para ser veloz, o que é ótimo para verificar integridade de arquivos e péssimo para senhas: uma GPU moderna calcula bilhões de hashes SHA-256 por segundo, então um ataque de força bruta ou de dicionário sobre um vazamento continua viável mesmo com salt — o salt impede a pré-computação, mas não desacelera o ataque.

O recomendado em produção são funções de derivação **propositalmente lentas e custosas em memória**: **bcrypt**, **scrypt** ou **Argon2** (a preferência atual da OWASP). Elas têm um fator de custo ajustável, de modo que o tempo de verificação siga aceitável para o usuário legítimo (dezenas ou centenas de milissegundos) enquanto o ataque em massa se torna inviável. Neste projeto o scrypt é usado — mas no Módulo 2, para derivar a chave AES a partir de uma senha.

---

## 4. Módulo 2 — Criptografia AES-256-GCM

### 4.1 Simétrica × assimétrica

Na criptografia **simétrica**, a mesma chave cifra e decifra. É rápida e adequada a grandes volumes de dados, mas exige que as duas partes já compartilhem a chave por um canal seguro.

Na **assimétrica** (RSA, ECC), há um par de chaves: a pública cifra, a privada decifra. Resolve o problema da troca de chaves, mas é ordens de grandeza mais lenta e limitada no tamanho do que se pode cifrar.

Na prática usa-se **criptografia híbrida**: a mensagem vai em AES (simétrico) e apenas a chave AES é cifrada com RSA/ECDH (assimétrico). É assim que funciona o TLS.

Escolhemos **AES** por ser o padrão mundial (NIST FIPS 197), estar implementado em hardware nos processadores modernos (instruções AES-NI) e ser a cifra recomendada para proteger dados sensíveis. Usamos chave de **256 bits**, o maior tamanho padronizado.

### 4.2 O modo GCM

Uma cifra de bloco precisa de um **modo de operação** para cifrar mensagens maiores que um bloco. Escolhemos **GCM** (Galois/Counter Mode, NIST SP 800-38D), que é um modo **AEAD** — *Authenticated Encryption with Associated Data*. Ele entrega, de uma vez:

- **Confidencialidade**, transformando o AES em uma cifra de fluxo baseada em contador;
- **Integridade e autenticidade**, através de uma **auth tag** de 128 bits calculada sobre o texto cifrado.

A diferença prática em relação a um modo mais antigo como o CBC é decisiva: no CBC, alterar bytes do texto cifrado produz um texto decifrado corrompido, mas a decifragem "funciona" e cabe à aplicação perceber o problema — o que abre espaço para ataques de *padding oracle*. No GCM, a tag é verificada antes de qualquer saída ser entregue: se um único bit do texto cifrado, do IV ou da própria tag mudar, a operação **falha**.

**IV (vetor de inicialização).** O GCM usa um IV de 96 bits, gerado novo e aleatório a cada cifragem. O IV não é secreto e viaja junto do pacote, mas **nunca pode ser reutilizado com a mesma chave**. Como o GCM é uma cifra de fluxo, duas mensagens cifradas com o mesmo par (chave, IV) usam o mesmo keystream: o XOR dos dois textos cifrados elimina o keystream e revela a relação entre os textos claros. Pior ainda, a reutilização permite recuperar a subchave de autenticação e **forjar mensagens com tag válida**, destruindo também a integridade.

**Derivação de chave com scrypt.** Uma senha digitada por uma pessoa não tem 256 bits de entropia nem o tamanho certo para virar chave AES. `crypto.scryptSync(senha, salt, 32)` converte a senha em uma chave de 32 bytes através de uma função lenta e custosa em memória, encarecendo muito um ataque de força bruta sobre a senha. O salt da derivação é aleatório e é transmitido dentro do pacote — sem ele o destinatário não consegue derivar a mesma chave.

### 4.3 Implementação

Arquivo: `src/criptografia/aes.js`.

O pacote produzido por `cifrar()` tem a forma:

```json
{
  "algoritmo": "aes-256-gcm",
  "iv": "<12 bytes em base64>",
  "authTag": "<16 bytes em base64>",
  "textoCifrado": "<base64>",
  "salt": "<salt da derivação, em base64>"
}
```

Os binários vão em base64 para que o pacote inteiro seja um JSON transportável como texto. A função `decifrar()` captura qualquer falha do GCM e a relança como `Falha na decifragem: chave incorreta ou dados adulterados` — mensagem propositalmente genérica, para não informar a um atacante se o que falhou foi a chave ou a integridade.

A demonstração (`scripts/demo-criptografia.js`) simula remetente e destinatário no mesmo computador, usando `output/mensagem.enc.json` como "canal". Os dados financeiros são fictícios; o número de cartão `4111 1111 1111 1111` é o número público de testes da Visa.

### 4.4 Resultados

A demonstração mostra, em sequência: a derivação da chave a partir da senha combinada; o pacote cifrado, no qual nenhum dado financeiro é reconhecível; a decifragem pelo destinatário com `assert` confirmando que o texto recuperado é idêntico ao original; e três cenários de falha — senha errada, 1 byte do texto cifrado invertido e auth tag alterada —, todos rejeitados pelo GCM.

`[PRINT: saída completa de npm run demo:cripto]`

`[PRINT: conteúdo de output/mensagem.enc.json]`

### 4.5 Limitação

**A troca da chave é o ponto frágil.** Toda a segurança depende de remetente e destinatário compartilharem a senha por um canal seguro — e combinar uma senha pessoalmente não escala para milhões de usuários.

A solução real é a **criptografia híbrida**: gera-se uma chave AES aleatória para cada mensagem (chave de sessão), cifra-se a mensagem com ela e cifra-se **apenas a chave** com a chave pública RSA do destinatário (RSA-OAEP), ou negocia-se a chave com **ECDH**. Assim, ninguém precisa combinar segredo nenhum antecipadamente. É exatamente o que o TLS faz em cada conexão HTTPS. Essa extensão está listada como item opcional no plano do projeto.

Uma segunda limitação: o AES-GCM protege a mensagem, mas não esconde que houve comunicação, nem o tamanho aproximado dos dados. É aí que entra o Módulo 3.

---

## 5. Módulo 3 — Esteganografia LSB

### 5.1 Conceito

Esteganografia é a arte de esconder a **existência** da mensagem. A técnica **LSB** (*Least Significant Bit*) explora o fato de que, numa imagem, cada canal de cor de um pixel é um byte de 0 a 255, e o bit menos significativo desse byte contribui com apenas **1 unidade** no valor final.

Trocar esse bit muda, por exemplo, um vermelho de valor 182 para 183 — uma variação de menos de 0,4% em um único canal, que o olho humano não distingue, ainda mais espalhada por pixels isolados. Usando os canais R, G e B, escondem-se **3 bits por pixel**.

O canal **alfa (transparência) não é alterado**: mexer nele pode produzir artefatos visíveis, e alguns editores normalizam ou descartam o alfa, o que corromperia a mensagem.

### 5.2 Protocolo de gravação

Escrever só os bytes da mensagem não basta — na extração é preciso saber se há mensagem e onde ela termina. O formato implementado grava, em ordem:

| Campo | Tamanho | Função |
|---|---|---|
| Assinatura `STG1` | 4 bytes | Identifica que a imagem contém mensagem neste formato |
| Tamanho | 4 bytes (uint32 big-endian) | Quantos bytes de mensagem ler em seguida |
| Mensagem | N bytes | Texto em UTF-8 |

Cada byte é gravado bit a bit, do mais significativo para o menos significativo, em `novoValor = (valor & 0xFE) | bit`, percorrendo os canais R, G e B em sequência e pulando o alfa.

Na extração, lê-se primeiro o cabeçalho de 8 bytes. Se a assinatura não for `STG1`, a função lança `Nenhuma mensagem oculta encontrada` — é o que acontece ao tentar extrair de uma imagem comum. Em seguida o tamanho é validado contra a capacidade da imagem antes de qualquer leitura, evitando que um cabeçalho corrompido peça uma leitura absurda.

**Capacidade:**

```
capacidade_em_bytes = floor(largura × altura × 3 / 8) − 8
```

Para a imagem de 512×512 usada na demonstração: `floor(512 × 512 × 3 / 8) − 8 = 98.296 bytes`, cerca de 96 KB de texto — mais de 40 páginas. A mensagem da demonstração ocupa 65 bytes, ou **0,066%** da capacidade.

### 5.3 Implementação

Arquivos: `src/esteganografia/lsb.js` (ocultar/extrair, com as funções puras `bytesParaBits`, `bitsParaBytes`, `escreverBits` e `lerBits` separadas para permitir testes unitários) e `src/esteganografia/metricas.js` (comparação e mapa de diferenças).

A saída **precisa ser PNG**, e a biblioteca recusa qualquer outra extensão. PNG usa compressão sem perdas, preservando os bytes dos pixels exatamente. Um JPEG recalcularia os pixels via DCT e quantização, destruindo justamente os bits menos significativos e apagando a mensagem.

### 5.4 Resultados

Medidas obtidas com `npm run demo:esteg` sobre a imagem de 512×512, ocultando a frase *"Reunião confidencial: servidor de backup migra na sexta às 22h."* (65 bytes):

| Métrica | Valor |
|---|---|
| Canais comparados | 786.432 |
| Canais alterados | 310 (0,0394%) |
| Diferença máxima por canal | **1** (de 255) |
| MSE | 3,94 × 10⁻⁴ |
| **PSNR** | **82,17 dB** |
| Canal alfa | intacto |

> Os valores acima foram obtidos em uma execução; refaça a medição com a imagem final da equipe e atualize a tabela.

O **PSNR** (*Peak Signal-to-Noise Ratio*) mede a razão entre o sinal máximo e o ruído introduzido, em escala logarítmica: `PSNR = 10 × log10(255² / MSE)`. Na literatura de processamento de imagens, valores acima de 40 dB já indicam degradação imperceptível; os **82 dB** obtidos estão muito acima disso, confirmando numericamente que a alteração é invisível.

Note que apenas 310 canais foram alterados, e não os 584 que receberam gravação (8 bytes de cabeçalho + 65 da mensagem = 73 bytes × 8 bits). A razão é que um bit só altera o pixel quando difere do que já estava lá: como os bits menos significativos de uma imagem com ruído são aproximadamente aleatórios, em média **metade** das gravações não muda valor nenhum — de fato, 310/584 = 53%.

O **mapa de diferenças** (`output/mapa-diferencas.png`) marca em branco os pixels que tiveram algum canal alterado. Como a gravação é sequencial a partir do primeiro pixel, os pontos brancos ficam concentrados no canto superior esquerdo — e apenas 173 dos 262.144 pixels aparecem.

`[PRINT: saída completa de npm run demo:esteg]`

`[PRINT: assets/original.png e output/imagem-com-segredo.png lado a lado — visualmente idênticas]`

`[PRINT: output/mapa-diferencas.png]`

### 5.5 Limitações

- **Fragilidade a transformações.** Qualquer operação que recalcule os pixels destrói a mensagem: salvar como JPEG, redimensionar, aplicar filtros, ajustar brilho ou até recortar a imagem. O portador precisa chegar ao destino byte a byte idêntico.
- **Detectável por esteganálise.** Embora invisível ao olho, o LSB clássico é detectável estatisticamente. Os bits menos significativos de uma imagem natural têm correlações próprias; substituí-los por dados de texto — que são longe de aleatórios — altera essa distribuição de forma mensurável por técnicas como a análise de pares de valores (*chi-square attack*) ou RS analysis.
- **Sem cifragem, a mensagem está em claro.** Quem descobrir o formato simplesmente lê o texto. **A combinação com o Módulo 2 resolve os dois últimos pontos de uma vez:** cifrar a frase com AES-256-GCM antes de ocultá-la faz com que os bits gravados sejam indistinguíveis de ruído aleatório (dificultando a esteganálise) e garante que, mesmo se extraídos, não revelem nada sem a chave. Essa combinação está listada como extra opcional no plano do projeto.
- **Capacidade limitada.** Cabe 1 bit por canal; esconder arquivos grandes exigiria imagens muito grandes, e aumentar a taxa (usar 2 ou mais bits por canal) tornaria a alteração visível e a detecção trivial.

---

## 6. Testes automatizados

Os testes usam o executor nativo `node:test` com `node:assert/strict`, sem dependências externas. São **49 casos** distribuídos em três arquivos:

**`test/hashing.test.js`** — unicidade e formato do salt (32 caracteres hex); determinismo do hash; hashes diferentes com salts diferentes; aceitação e rejeição em `compararHash`, inclusive com hash de tamanho inválido; ausência da senha em texto puro no arquivo gravado; cadastro que não devolve hash nem senha; rejeição de e-mail duplicado, senha curta e campos ausentes; salts e hashes distintos para a mesma senha; login correto; mensagem genérica idêntica para senha errada e usuário inexistente.

**`test/criptografia.test.js`** — ida e volta preservando acentos e emojis, texto vazio e texto de 100 mil caracteres; formato do pacote (IV de 12 bytes, tag de 16); textos cifrados diferentes a cada chamada por causa do IV aleatório; erro com chave errada, com texto cifrado adulterado, com auth tag adulterada e com IV adulterado; rejeição de chave com tamanho inválido e de pacote incompleto; ausência do texto original dentro do texto cifrado.

**`test/esteganografia.test.js`** — funções puras de conversão bits/bytes, inclusive a ordem MSB; gravação e leitura pulando o canal alfa; fórmula da capacidade; ida e volta com acentos e emoji; mensagem exatamente no limite da capacidade; diferença máxima de 1 por canal e PSNR acima de 50 dB; canal alfa intacto; erro para mensagem maior que a capacidade, para imagem sem mensagem, para saída que não é `.png` e para mensagem vazia; imagem original preservada no disco; regravação sobrescrevendo a mensagem anterior; geração e conferência do mapa de diferenças; recusa de imagens com dimensões diferentes e PSNR infinito para imagens idênticas.

Os testes que precisam de disco usam arquivos temporários em `os.tmpdir()`, de modo que não interferem no banco nem nas imagens da demonstração.

```
# tests 49
# pass 49
# fail 0
```

`[PRINT: saída de npm test]`

---

## 7. Conclusão

O trabalho implementou e demonstrou três técnicas que atacam problemas distintos de segurança da informação.

O **hashing com salt** mostrou que armazenar senhas de forma segura não é apenas "aplicar um hash": sem salt, dois usuários com a mesma senha ficam expostos juntos e rainbow tables tornam o ataque trivial. Também ficou claro que detalhes de implementação importam — a comparação em tempo constante e a mensagem de erro genérica no login são decisões que não afetam o funcionamento visível do sistema, mas fecham vetores reais de ataque.

A **criptografia AES-256-GCM** evidenciou a diferença entre apenas cifrar e cifrar com autenticação: a alteração de um único bit foi detectada e rejeitada, em vez de produzir silenciosamente um texto corrompido. A necessidade de um IV novo a cada operação e de uma derivação de chave adequada mostrou que a escolha do algoritmo é só parte do problema — o modo de operação e o gerenciamento das chaves pesam tanto quanto.

A **esteganografia LSB** demonstrou uma abordagem complementar: em vez de proteger o conteúdo, esconder a existência da comunicação. As métricas confirmaram numericamente a imperceptibilidade (diferença máxima de 1 por canal, PSNR de 82 dB), e as limitações levantadas — fragilidade a recompressão e detectabilidade por esteganálise — reforçam que a esteganografia é uma camada adicional, não um substituto da criptografia.

A conclusão mais ampla é que essas técnicas se complementam e que segurança se constrói em camadas: o cenário mais robusto seria cifrar a mensagem com AES-GCM, ocultar o resultado em uma imagem por LSB e proteger as credenciais de acesso com uma função de derivação lenta como Argon2.

---

## 8. Referências

1. **Node.js.** *Crypto — Node.js v20 Documentation.* Disponível em: https://nodejs.org/api/crypto.html
2. **NIST.** *FIPS PUB 197: Advanced Encryption Standard (AES).* National Institute of Standards and Technology, 2001 (atualizado em 2023). https://csrc.nist.gov/pubs/fips/197/final
3. **NIST.** *SP 800-38D: Recommendation for Block Cipher Modes of Operation — Galois/Counter Mode (GCM) and GMAC.* 2007. https://csrc.nist.gov/pubs/sp/800/38/d/final
4. **NIST.** *FIPS PUB 180-4: Secure Hash Standard (SHS).* 2015. https://csrc.nist.gov/pubs/fips/180-4/upd1/final
5. **OWASP.** *Password Storage Cheat Sheet.* https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
6. **PERCIVAL, C.; JOSEFSSON, S.** *RFC 7914: The scrypt Password-Based Key Derivation Function.* IETF, 2016. https://www.rfc-editor.org/rfc/rfc7914
7. **FRIDRICH, J.; GOLJAN, M.; DU, R.** *Detecting LSB Steganography in Color and Gray-Scale Images.* IEEE Multimedia, v. 8, n. 4, 2001.
8. **pngjs.** Biblioteca de leitura/escrita de PNG para Node.js. https://www.npmjs.com/package/pngjs

---

## 9. Repositório

Código-fonte completo: **https://github.com/LadonGx/Atividade3-Criptografia**

Histórico de commits organizado por fase:

```
chore: estrutura inicial do projeto
feat: módulo de hashing com salt
feat: módulo de criptografia AES-256-GCM
feat: módulo de esteganografia LSB
docs: README e rascunho do relatório
```
