/**
 * Gera assets/original.png caso o arquivo não exista.
 *
 * A imagem tem 512x512 com um gradiente colorido e um ruído leve, para ter uma
 * textura mais parecida com a de uma foto real (uma imagem de cor chapada tornaria
 * a alteração dos LSBs mais fácil de detectar visualmente e por esteganálise).
 *
 * A equipe pode substituir este arquivo por uma foto própria em PNG.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

/** Caminho padrão da imagem de trabalho. */
export const CAMINHO_PADRAO = path.join('assets', 'original.png');

/**
 * Cria a imagem de exemplo se ela ainda não existir.
 * @param {string} caminho Destino do PNG.
 * @param {number} largura Largura em pixels.
 * @param {number} altura Altura em pixels.
 * @returns {{caminho: string, criada: boolean, largura: number, altura: number}}
 */
export function garantirImagem(caminho = CAMINHO_PADRAO, largura = 512, altura = 512) {
  if (fs.existsSync(caminho)) {
    const existente = PNG.sync.read(fs.readFileSync(caminho));
    return { caminho, criada: false, largura: existente.width, altura: existente.height };
  }

  const png = new PNG({ width: largura, height: altura });

  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const i = (y * largura + x) * 4;

      // Gradiente diagonal em tons de azul/roxo/laranja.
      const gradienteX = x / (largura - 1);
      const gradienteY = y / (altura - 1);

      const r = Math.round(255 * gradienteX * (1 - gradienteY * 0.4));
      const g = Math.round(255 * (0.3 + 0.5 * gradienteY) * (1 - gradienteX * 0.5));
      const b = Math.round(255 * (1 - gradienteX * 0.7) * (0.4 + 0.6 * gradienteY));

      // Ruído leve (+/- 6) para dar textura.
      const ruido = () => Math.round((Math.random() - 0.5) * 12);
      const limitar = (v) => Math.min(255, Math.max(0, v));

      png.data[i] = limitar(r + ruido());
      png.data[i + 1] = limitar(g + ruido());
      png.data[i + 2] = limitar(b + ruido());
      png.data[i + 3] = 255; // totalmente opaco
    }
  }

  const pasta = path.dirname(caminho);
  if (pasta && pasta !== '.') fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(caminho, PNG.sync.write(png));

  return { caminho, criada: true, largura, altura };
}

// Permite rodar o arquivo diretamente: node scripts/gerar-imagem.js
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const resultado = garantirImagem();
  console.log(
    resultado.criada
      ? `Imagem criada: ${resultado.caminho} (${resultado.largura}x${resultado.altura})`
      : `Imagem já existente: ${resultado.caminho} (${resultado.largura}x${resultado.altura})`,
  );
}
