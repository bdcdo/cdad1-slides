# Slides de CDAD-1

Slides das aulas já dadas de Ciência de Dados Aplicada ao Direito I, publicados com GitHub Pages. Cada aula é um PDF só, com os decks na ordem em que foram projetados, e o visualizador (`ver.html`) mostra o PDF página a página no navegador.

## Animações dentro do deck

Quando uma página do PDF tem um link relativo para um arquivo `animacao-*.html`, o visualizador troca a página inteira pela animação, que mora na mesma pasta do PDF. O fragmento do link (`animacao-loop.html#partes`) escolhe o cenário em que ela abre. Quem baixa ou imprime o PDF vê o slide com o link.

Na página de animação, Page Down e a seta para a direita andam a animação até o último passo e só então vão para a página seguinte, de modo que o passador de slides funciona sem troca de controle. Voltar para a animação a mostra no último passo. Espaço toca e pausa; 1, 2 e 3 trocam o cenário, quando a animação tem cenários.

Com `&moldura=slide` no endereço, a página de animação aparece como um slide comum: seção, título e logo vêm do PDF, e a animação ocupa só a área de conteúdo, sem título, botões, contador nem narração próprios. Cada cenário é uma página do deck, e trocar de cenário é avançar ou voltar slide. A página inicial abre assim toda aula cuja entrada em `aulas.json` traz `"moldura": "slide"`; as animações antigas das aulas 8, 13 e 14 não têm esse modo, e essas aulas abrem do jeito anterior.

## Estrutura

- `index.html`: lista das aulas, lida de `aulas.json`.
- `ver.html?deck=aulaNN/aulaNN.pdf#N`: abre o deck na página N.
- `aulaNN/`: o PDF da aula e as animações que ele referencia.
- Aula ainda não dada pode estar publicada sem aparecer na página inicial: abre pelo endereço direto e entra em `aulas.json` depois da aula.
- `pdfjs/`: pdf.js 6.3.289, da Mozilla, sob a licença Apache 2.0 em `pdfjs/LICENSE`. Fica no repositório para o site não depender de CDN.

## Ver localmente

O visualizador busca o PDF por HTTP, então não abre como arquivo local. Na raiz do repositório:

```
python3 -m http.server 8000
```

e abrir `http://localhost:8000/`.
