# Slides de CDAD-1

Slides das aulas já dadas de Ciência de Dados Aplicada ao Direito I, publicados com GitHub Pages. Cada deck é um PDF, e o visualizador (`ver.html`) mostra o PDF página a página no navegador.

## Animações dentro do deck

Quando uma página do PDF tem um link relativo para um arquivo `animacao-*.html`, o visualizador troca a página inteira pela animação, que mora na mesma pasta do PDF. Quem baixa ou imprime o PDF vê o slide com o link.

Na página de animação, Page Down e a seta para a direita andam a animação até o último passo e só então vão para a página seguinte, de modo que o passador de slides funciona sem troca de controle. Voltar para a animação a mostra no último passo. Espaço toca e pausa; 1 e 2 trocam o cenário, quando a animação tem cenários.

## Estrutura

- `index.html`: lista das aulas, lida de `aulas.json`.
- `ver.html?deck=aulaNN/arquivo.pdf#N`: abre o deck na página N.
- `aulaNN/`: os PDFs da aula e as animações que eles referenciam.
- `pdfjs/`: pdf.js 6.3.289, da Mozilla, sob a licença Apache 2.0 em `pdfjs/LICENSE`. Fica no repositório para o site não depender de CDN.

## Ver localmente

O visualizador busca o PDF por HTTP, então não abre como arquivo local. Na raiz do repositório:

```
python3 -m http.server 8000
```

e abrir `http://localhost:8000/`.
