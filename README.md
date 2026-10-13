# Slides de CDAD-1

Slides das aulas já dadas de Ciência de Dados Aplicada ao Direito I, publicados com GitHub Pages. Cada aula é um PDF só, com os decks na ordem em que foram projetados, e o visualizador (`ver.html`) mostra o PDF página a página no navegador.

## Animações dentro do deck

Quando uma página do PDF tem um link relativo para um arquivo `animacao-*.html`, o visualizador troca a página inteira pela animação, que mora na mesma pasta do PDF. O fragmento do link (`animacao-loop.html#partes`) escolhe o cenário em que ela abre. Quem baixa ou imprime o PDF vê o slide com o link.

Na página de animação, Page Down e a seta para a direita andam a animação até o último passo e só então vão para a página seguinte, de modo que o passador de slides funciona sem troca de controle. Voltar para a animação a mostra no último passo. Espaço toca e pausa; 1, 2 e 3 trocam o cenário, quando a animação tem cenários.

Com `&moldura=cheia` no endereço, que é como a página inicial abre toda aula, a animação ocupa o slide inteiro e mostra título e narração, sem a barra de botões e sem a contagem de passos: avançar, voltar e contar ficam com o visualizador. Cada cenário é uma página do deck, e trocar de cenário é avançar ou voltar slide. As animações antigas das aulas 8, 13 e 14 não conhecem esse modo e aparecem com a barra de sempre. Existe também `&moldura=slide`, em que a página de animação é desenhada como um slide comum, com seção, título e logo do PDF, e a animação fica só na área de conteúdo, sem título nem narração; a letra fica menor, e por isso não é o modo da página inicial.

## Estrutura

- `index.html`: lista das aulas, lida de `aulas.json`.
- `ver.html?deck=aulaNN/aulaNN.pdf#N`: abre o deck na página N.
- `aulaNN/`: o PDF da aula e as animações que ele referencia.
- Aula ainda não dada pode estar publicada sem aparecer na página inicial: abre pelo endereço direto e entra em `aulas.json` depois da aula.
- `tribunal-ficticio/`: o tribunal inventado das aulas de requisição e raspagem, descrito abaixo.
- `pdfjs/`: pdf.js 6.3.289, da Mozilla, sob a licença Apache 2.0 em `pdfjs/LICENSE`. Fica no repositório para o site não depender de CDN.

## Tribunal fictício

`tribunal-ficticio/` é um tribunal inventado, para as aulas de requisição e de raspagem: a turma faz os primeiros pedidos com `requests` a um endereço que é do curso, sem depender de tribunal de verdade nem arriscar bloqueio. Nada ali é real: o tribunal de código 99 não existe, e partes e processos são inventados.

- `tribunal-ficticio/decisoes.html`: página HTML com as decisões recentes, para raspagem com `find` e `find_all`.
- `tribunal-ficticio/api/`: documentação da API de mentira. Os dados saem em JSON: um processo por arquivo em `api/processos/NUMERO.json`, a lista inteira em `api/processos.json` e uma busca paginada em `api/decisoes/pagina-N.json`.

O site é estático, e por isso a API só responde a GET, ignora o que vem depois de `?` no endereço e devolve 404 em HTML para o que não existe. Os arquivos são gerados por `python3 tribunal-ficticio/gerar.py`, que guarda os dados; editar um arquivo gerado à mão desalinha os outros.

## Ver localmente

O visualizador busca o PDF por HTTP, então não abre como arquivo local. Na raiz do repositório:

```
python3 -m http.server 8000
```

e abrir `http://localhost:8000/`.
