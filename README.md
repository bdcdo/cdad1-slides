# Slides de CDAD-1

Slides das aulas já dadas de Ciência de Dados Aplicada ao Direito I, publicados com GitHub Pages. Cada aula é um PDF só, com os decks na ordem em que foram projetados, e o visualizador (`ver.html`) mostra o PDF página a página no navegador.

## Animações dentro do deck

Quando uma página do PDF tem um link relativo para um arquivo `animacao-*.html`, o visualizador troca a página inteira pela animação, que mora na mesma pasta do PDF. O fragmento do link (`animacao-loop.html#partes`) escolhe o cenário em que ela abre. Quem baixa ou imprime o PDF vê o slide com o link.

Na página de animação, Page Down e a seta para a direita andam a animação até o último passo e só então vão para a página seguinte, de modo que o passador de slides funciona sem troca de controle. Voltar para a animação a mostra no último passo. Espaço toca e pausa; 1, 2 e 3 trocam o cenário, quando a animação tem cenários.

Com `&moldura=cheia` no endereço, que é como a página inicial abre toda aula, a animação ocupa o slide inteiro e mostra título e narração, sem a barra de botões e sem a contagem de passos: avançar, voltar e contar ficam com o visualizador. Cada cenário é uma página do deck, e trocar de cenário é avançar ou voltar slide. As animações antigas das aulas 8, 13 e 14 não conhecem esse modo e aparecem com a barra de sempre. Existe também `&moldura=slide`, em que a página de animação é desenhada como um slide comum, com seção, título e logo do PDF, e a animação fica só na área de conteúdo, sem título nem narração; a letra fica menor, e por isso não é o modo da página inicial.

## Votação da turma

Em slide de pergunta, a tecla V abre sobre a página atual um painel com um QR code: a turma responde pelo celular, com texto livre, e o painel mostra quantos já responderam. R revela as respostas, uma por cartão, e a tela passa a ser delas: a letra é a maior em que todas cabem, sem descer de 20 pt de slide, e abaixo disso as setas, Page Down e o espaço rolam os cartões, que é o que o passador de slides manda; Home e End vão ao começo e ao fim. Respostas iguais, sem diferença entre maiúsculas e minúsculas, viram um cartão só, com o número escrito (×3) e à frente das outras; a contagem total fica pequena, ao lado do QR. Esc fecha. Ninguém é identificado e nada fica gravado.

Fechar o painel não fecha a rodada: a turma continua respondendo pelo mesmo QR enquanto os slides seguem, inclusive em outra página. Voltar ao mesmo slide e apertar V reabre a mesma rodada, com as respostas acumuladas e escondidas até R; recarregar a aba não muda isso, e a rodada vale por duas horas no servidor. V noutro slide abre a rodada daquele slide. Se esse slide não tem pergunta marcada, a rodada dele está vazia e a aba já viu respostas noutro slide do mesmo deck, o painel diz em que slide elas estão; no slide com pergunta marcada, a rodada vazia é a da pergunta nova, sem aviso. Só Nova rodada começa outra do zero.

Slide com a pergunta marcada no deck, por `#pergunta("…")` do template de slides, abre o painel com a tela dividida ao meio: a pergunta em letra grande numa metade, e o QR, o endereço curto e a contagem na outra. A marca é um link invisível na página, com endereço `votacao:pergunta?` e o texto em percent-encoding, que o `ver.html` lê do PDF como lê o link de animação. Slide sem marca abre o painel só com o QR, como antes. A pergunta ainda não aparece na página de resposta da turma.

As respostas passam por um servidor de votação à parte, cujo endereço fica na constante `SERVIDOR_DA_VOTACAO` do `ver.html`. A chave do professor não fica neste repositório nem passa pelo endereço da página, que vai para o histórico do navegador e para o registro de acesso do site. Na primeira vez que V é apertada num navegador, o painel pede a chave num campo de senha; aceita pelo servidor, ela fica guardada naquele navegador (`localStorage`), presa àquele servidor: outra aba e a aula seguinte abrem a votação sem pedir a chave, e outro servidor pede a sua, sem apagar nem substituir a do primeiro. Chave recusada não é guardada, e a guardada que o servidor passa a recusar é apagada, só a daquele servidor; nos dois casos o painel volta a pedir. O risco aceito é que o armazenamento é da origem do site, e qualquer página servida dessa origem, inclusive outro site publicado no mesmo domínio, pode ler a chave. Por isso o painel tem o botão Esquecer chave, que apaga a chave do servidor em uso neste navegador e volta ao campo; vale usá-lo ao projetar de uma máquina que não é do professor. Um link antigo com `&chave=` não guarda nada: o valor é ignorado, sai da barra e o painel avisa que a chave agora se digita nele; a visita com a chave, porém, já ficou no histórico do navegador e no registro de acesso, e por isso a chave que circulou assim deve ser trocada.

`&servidor=<endereço>` troca o servidor padrão por um servidor local de desenvolvimento (`localhost`, `127.0.0.1` ou `[::1]`); qualquer outro é recusado. Sem chave, nada muda no visualizador, e nenhum pedido sai para o servidor antes de a chave ser digitada.

O painel mora em `votacao/` e só é baixado quando a tecla é usada. O QR é gerado no navegador por `uqr/`: uqr 0.1.2, de Anthony Fu, derivado do gerador de QR de Project Nayuki, sob a licença MIT em `uqr/LICENSE`.

O JavaScript do painel passa pelo lint de `eslint.config.mjs`: `npx --yes eslint@10.12.0 .`

## Estrutura

- `index.html`: lista das aulas, lida de `aulas.json`.
- `ver.html?deck=aulaNN/aulaNN.pdf#N`: abre o deck na página N.
- `aulaNN/`: o PDF da aula e as animações que ele referencia.
- Aula ainda não dada pode estar publicada sem aparecer na página inicial: abre pelo endereço direto e entra em `aulas.json` depois da aula.
- `pdfjs/`: pdf.js 6.3.289, da Mozilla, sob a licença Apache 2.0 em `pdfjs/LICENSE`. Fica no repositório para o site não depender de CDN.
- `votacao/`: o painel de votação da tecla V. `uqr/`: o gerador de QR que ele usa, também no repositório para não depender de CDN.

## Tribunal fictício

O tribunal inventado das aulas de requisição e raspagem saiu daqui em 14/10/2026 e virou um servidor próprio, em <https://tribunal-ficticio-cdad.fly.dev>: um site estático não lê o que vem depois de `?` no endereço, e a turma precisava pedir como se pede a um tribunal de verdade.

## Ver localmente

O visualizador busca o PDF por HTTP, então não abre como arquivo local. Na raiz do repositório:

```
python3 -m http.server 8000
```

e abrir `http://localhost:8000/`.
