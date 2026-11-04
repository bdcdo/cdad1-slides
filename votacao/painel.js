// Painel de votação do visualizador de slides. Abre sobre a página atual, com o QR code para a turma responder pelo
// celular, a contagem ao vivo e, quando o professor pede, as respostas, uma por cartão. Se a página tem pergunta
// marcada no deck, a tela se divide ao meio: a pergunta em letra grande numa metade, o QR e a contagem na outra.
//
// A resposta é texto livre, e numa pergunta aberta quase todas são diferentes: com as respostas à mostra, a tela é
// delas, na maior letra em que todas cabem, e a contagem fica pequena no canto. Respostas iguais (sem diferença entre
// maiúsculas e minúsculas) viram um cartão só, com o número escrito. A ordem é a do servidor na hora em que R revela
// (do maior grupo para o menor); a resposta que chega depois entra no fim, para os cartões à vista não andarem.
//
// Fechar o painel não fecha a rodada: ela continua no servidor, recebendo respostas, e V de novo no mesmo slide a
// reabre (o servidor guarda a rodada de cada slide). V noutro slide abre a rodada daquele slide. Se esse slide não tem
// pergunta marcada, a rodada dele está vazia e a aba viu respostas noutro slide do mesmo deck, o V caiu no slide errado,
// e o painel diz em que slide as respostas estão. No slide com pergunta marcada, a rodada vazia é a da pergunta nova, e
// o painel não diz nada.
//
// O visualizador (ver.html) importa este módulo só quando a tecla V é usada e passa o deck, a página, a pergunta
// lida do PDF (ou nada) e a origem do servidor, já conferida pela regra de lá (origemAceita): este módulo não lê a URL nem revalida o servidor. O
// servidor da votação mora noutro domínio, e as rotas do professor só respondem com a chave no cabeçalho X-Chave.
//
// A chave do professor é digitada no próprio painel, num campo de senha, e nunca passa pelo endereço da página,
// que vai para o histórico do navegador e para o registro de acesso do site. Aceita pelo servidor, ela fica no
// localStorage deste navegador, num mapa da origem do servidor para a chave: outra aba e a aula seguinte abrem a
// votação sem pedir a chave, e a chave de uma origem não sobrescreve a de outra (a do servidor local de teste fica
// ao lado da do servidor de produção). A chave só vai ao servidor com que foi aceita; outra origem pede a sua.
// Só a chave digitada no campo se grava, quando abre a rodada: Nova rodada, ou a abertura com a chave que já veio
// do mapa, não grava, para que uma aba aberta não devolva ao mapa a chave que outra aba esqueceu. Chave recusada
// (403) sai do mapa só se for a que está guardada para aquela origem: a consulta atrasada de uma aba, ainda com a
// chave antiga, não apaga a chave nova que outra aba gravou. Em todo 403, o painel da aba volta a pedir.
//
// Risco aceito: o localStorage é da origem do site, e qualquer página servida dessa origem pode ler a chave,
// inclusive outro site publicado no mesmo domínio. Por isso o painel tem o botão Esquecer chave, que apaga a chave
// do servidor em uso neste navegador, para quando a máquina não for só do professor.
//
// A contagem é uma consulta a cada 2 s, e não um canal aberto pelo servidor (SSE): o servidor atende cada conexão
// com uma thread, e a consulta custa uma requisição curta, que também mantém a máquina do servidor acordada
// enquanto o painel está aberto.
import { encode } from '../uqr/uqr.mjs';

const INTERVALO_MS = 2000;
const TEMPO_LIMITE_MS = 8000;
const SVG = 'http://www.w3.org/2000/svg';
// Tamanho da letra da pergunta, em fração da altura da janela: começa no maior e desce até a pergunta caber na
// metade dela. Abaixo do menor, a pergunta fica no menor e corta, em vez de virar letra que o fundo da sala não lê.
const LETRA_DA_PERGUNTA = { maior: 0.09, menor: 0.04, passo: 0.005 };
// Tamanho da letra das respostas, também em fração da altura da janela: começa no maior e desce até todas caberem.
// O menor é o piso de corpo de texto dos slides do curso, 20 pt numa página de 540 pt de altura; abaixo dele, as
// respostas rolam (setas, Page Down e espaço) em vez de encolher.
const LETRA_DAS_RESPOSTAS = { maior: 0.075, menor: 20 / 540, passo: 0.004 };
// A última página de cada deck em que esta aba viu respostas, para avisar quando V abre a rodada vazia de outro slide.
const COM_RESPOSTAS_NA_ABA = 'votacao:com-respostas';
const CHAVES_DO_NAVEGADOR = 'votacao:chaves';
// O servidor gera códigos de 4 caracteres de letras maiúsculas e algarismos (ALFABETO, no server.py). O código vai
// para o QR e para o endereço projetado; fora deste formato, a resposta não é usada.
const CODIGO_VALIDO = /^[A-Z0-9]{2,12}$/;

const MOLDE = `
<div class="votacao-corpo">
  <p class="votacao-pergunta" id="votacao-pergunta" hidden></p>
  <figure class="votacao-qr" hidden></figure>
  <div class="votacao-lado">
    <h2 class="votacao-titulo" id="votacao-titulo">Votação da turma</h2>
    <p class="votacao-endereco" hidden>Ou acesse <strong></strong></p>
    <div class="votacao-chave" hidden>
      <label for="votacao-chave-campo">Chave do professor</label>
      <div class="votacao-chave-linha">
        <input id="votacao-chave-campo" type="password" autocomplete="one-time-code" data-1p-ignore data-lpignore="true" autocapitalize="off" spellcheck="false">
        <button type="button" class="votacao-principal" data-acao="entrar">Entrar</button>
      </div>
    </div>
    <p class="votacao-contagem" hidden><span class="votacao-numero"></span> <span class="votacao-unidade"></span></p>
    <p class="votacao-estado" role="status"></p>
    <div class="votacao-acoes">
      <button type="button" class="votacao-principal" data-acao="revelar" hidden>Revelar respostas (R)</button>
      <button type="button" data-acao="nova" hidden>Nova rodada</button>
      <button type="button" data-acao="esquecer" hidden>Esquecer chave</button>
      <button type="button" data-acao="fechar">Fechar (V)</button>
    </div>
  </div>
  <section class="votacao-respostas" hidden aria-label="Respostas">
    <ol class="votacao-grupos"></ol>
    <p class="votacao-vazio" hidden>Nenhuma resposta ainda.</p>
  </section>
</div>`;

let painel = null;
let montagem = null;
// A rodada em tela: origem do servidor, chave, deck, página, código e se as respostas estão à mostra.
let estado = null;
// Sobe a cada abertura, fechamento, revelação e rodada nova. Cada consulta leva a geração em que nasceu, e a
// resposta que chega depois de a geração mudar é descartada: sem isso, a contagem de uma rodada antiga, ou a
// consulta lenta de antes do fechamento, voltaria a escrever no painel.
let geracao = 0;
let relogio = null;
// Destino da rolagem suave em curso. Duas teclas seguidas somam a partir dele, e não da posição no meio da animação,
// que o Chromium usaria e que faria a segunda tecla andar menos que a primeira.
let alvoDaRolagem = null;

function carregarEstilo() {
  const link = Object.assign(document.createElement('link'), {
    rel: 'stylesheet',
    href: new URL('./painel.css', import.meta.url).href,
  });
  // Espera o estilo antes de abrir, para o painel não aparecer um instante sem forma. Se o arquivo falhar, abre
  // assim mesmo: a contagem continua legível sem estilo.
  const pronto = new Promise(resolve => { link.onload = resolve; link.onerror = resolve; });
  document.head.append(link);
  // A Inter chega depois do estilo, e o painel não espera por ela: enquanto ela não chega, o texto sai na fonte
  // seguinte da lista. Quando chega, a letra da pergunta e a das respostas se medem de novo, porque a largura muda.
  pronto.then(() => document.fonts.load('600 1em "Inter Votacao"')).then(() => {
    if (!painel) return;
    ajustarPergunta();
    ajustarRespostas();
  }).catch(() => { /* sem a Inter, vale a fonte seguinte da lista */ });
  return pronto;
}

async function montarDeVez() {
  await carregarEstilo();
  const dialogo = document.createElement('dialog');
  dialogo.className = 'votacao';
  dialogo.setAttribute('aria-labelledby', 'votacao-titulo');
  dialogo.setAttribute('aria-describedby', 'votacao-pergunta');
  // O foco inicial fica no próprio diálogo, e não no primeiro botão, que é o que showModal() escolhe: o espaço do
  // passador de slides acionaria esse botão (Fechar ou Revelar) sem ninguém querer. O atributo autofocus no diálogo
  // diria o mesmo pela norma, mas o Chromium o ignora; daí o tabindex e o focus() depois de abrir. Tab entra nos
  // botões.
  dialogo.tabIndex = -1;
  // MOLDE é fixo e não leva dado de fora; todo texto que vem do servidor, inclusive as respostas, entra depois por
  // textContent.
  dialogo.innerHTML = MOLDE;
  document.body.append(dialogo);
  const achar = seletor => dialogo.querySelector(seletor);
  painel = {
    dialogo, corpo: achar('.votacao-corpo'), pergunta: achar('.votacao-pergunta'), qr: achar('.votacao-qr'), titulo: achar('.votacao-titulo'), endereco: achar('.votacao-endereco'),
    contagem: achar('.votacao-contagem'), numero: achar('.votacao-numero'), unidade: achar('.votacao-unidade'),
    estado: achar('.votacao-estado'), revelar: achar('[data-acao="revelar"]'), nova: achar('[data-acao="nova"]'),
    respostas: achar('.votacao-respostas'), grupos: achar('.votacao-grupos'), vazio: achar('.votacao-vazio'),
    chave: achar('.votacao-chave'), campo: achar('#votacao-chave-campo'), esquecer: achar('[data-acao="esquecer"]'),
  };
  // O campo não fica num <form>: não há envio que mude o endereço da página, e Enter no campo entra pela escuta de
  // teclas, mais abaixo.
  achar('[data-acao="entrar"]').addEventListener('click', entrar);
  painel.revelar.addEventListener('click', alternarRevelacao);
  painel.nova.addEventListener('click', () => abrirRodada(true));
  painel.esquecer.addEventListener('click', esquecerChave);
  painel.respostas.addEventListener('scrollend', () => { alvoDaRolagem = null; });
  achar('[data-acao="fechar"]').addEventListener('click', () => dialogo.close());
  // Esc fecha o diálogo pelo próprio navegador; o evento close cobre o Esc, o V e o botão.
  dialogo.addEventListener('close', () => {
    painel.campo.value = '';
    parar();
  });
  return painel;
}
// Uma montagem só, mesmo que a tecla seja apertada duas vezes antes de o estilo chegar.
const montar = () => (montagem ??= montarDeVez());

// O mapa das chaves aceitas, da origem do servidor para a chave. Navegador sem armazenamento, ou valor que não é um
// mapa: mapa vazio, e a chave é pedida a cada abertura.
function chavesGuardadas() {
  try {
    const mapa = JSON.parse(localStorage.getItem(CHAVES_DO_NAVEGADOR));
    return mapa && typeof mapa === 'object' && !Array.isArray(mapa) ? mapa : {};
  } catch {
    return {};
  }
}

// A chave guardada para esta origem, ou null.
function chaveGuardada(origem) {
  const mapa = chavesGuardadas();
  return typeof mapa[origem] === 'string' && mapa[origem] ? mapa[origem] : null;
}

// Grava a chave de uma origem, ou a apaga quando `chave` é null, sem mexer nas chaves das outras origens.
function guardarChave(origem, chave) {
  const mapa = chavesGuardadas();
  if (chave) mapa[origem] = chave;
  else delete mapa[origem];
  try {
    if (Object.keys(mapa).length) localStorage.setItem(CHAVES_DO_NAVEGADOR, JSON.stringify(mapa));
    else localStorage.removeItem(CHAVES_DO_NAVEGADOR);
  } catch { /* navegador sem armazenamento: nada a guardar */ }
}

function avisar(texto, erro = false) {
  painel.estado.textContent = texto;
  painel.estado.classList.toggle('votacao-erro', erro);
}

function modo(nome) {
  painel.dialogo.dataset.modo = nome;
  const comRodada = nome === 'coleta' || nome === 'revelado';
  painel.chave.hidden = nome !== 'chave';
  painel.qr.hidden = !comRodada;
  painel.endereco.hidden = !comRodada;
  painel.contagem.hidden = !comRodada;
  painel.revelar.hidden = !comRodada;
  painel.nova.hidden = !comRodada;
  // Fora do campo, a chave em uso já foi aceita ou veio guardada: esquecê-la vale também com o servidor fora do ar.
  painel.esquecer.hidden = nome === 'chave' || !estado?.chave;
  painel.respostas.hidden = nome !== 'revelado';
  painel.revelar.textContent = nome === 'revelado' ? 'Esconder respostas (R)' : 'Revelar respostas (R)';
  // Com as respostas à mostra, a pergunta é o título delas, dentro da seção; fora disso, volta a ser a metade da
  // grade. Uma área própria na grade revelada, dividindo linhas com o QR, empurrava os botões para fora do painel.
  if (nome === 'revelado') painel.respostas.prepend(painel.pergunta);
  else painel.corpo.prepend(painel.pergunta);
  ajustarPergunta();
  ajustarRespostas();
}

// A maior letra em que a pergunta cabe inteira na sua metade da tela, medida na tela, porque o espaço depende do
// projetor e do tamanho do texto. Com as respostas à mostra, a pergunta é o título dos cartões, com o tamanho da folha
// de estilo.
function ajustarPergunta() {
  const { pergunta, dialogo } = painel;
  pergunta.style.removeProperty('font-size');
  if (pergunta.hidden || !dialogo.open || dialogo.dataset.modo === 'revelado') return;
  const { maior, menor, passo } = LETRA_DA_PERGUNTA;
  for (let fracao = maior; fracao >= menor - passo / 2; fracao -= passo) {
    pergunta.style.fontSize = `${Math.round(fracao * innerHeight)}px`;
    if (pergunta.scrollHeight <= pergunta.clientHeight) return;
  }
}

// A maior letra em que todas as respostas cabem na seção, sem passar do piso. Medida na tela, como a da pergunta.
function ajustarRespostas() {
  const { respostas, dialogo } = painel;
  if (!dialogo.open || dialogo.dataset.modo !== 'revelado') return;
  const { maior, menor, passo } = LETRA_DAS_RESPOSTAS;
  for (let fracao = maior; fracao >= menor - passo / 2; fracao -= passo) {
    respostas.style.setProperty('--v-letra-resposta', `${Math.round(fracao * innerHeight)}px`);
    if (respostas.scrollHeight <= respostas.clientHeight) return;
  }
  respostas.style.setProperty('--v-letra-resposta', `${Math.ceil(menor * innerHeight)}px`);
}

function paginaComRespostas(deck) {
  try {
    return JSON.parse(sessionStorage.getItem(COM_RESPOSTAS_NA_ABA))?.[deck] ?? null;
  } catch {
    return null;
  }
}

function lembrarPaginaComRespostas(deck, pagina) {
  try {
    const mapa = JSON.parse(sessionStorage.getItem(COM_RESPOSTAS_NA_ABA)) ?? {};
    if (mapa[deck] === pagina) return;
    mapa[deck] = pagina;
    sessionStorage.setItem(COM_RESPOSTAS_NA_ABA, JSON.stringify(mapa));
  } catch { /* aba sem armazenamento: o aviso de outro slide não aparece */ }
}

// O aviso que fica no painel enquanto a consulta segue sem erro: a rodada vazia de um slide sem pergunta marcada,
// quando as respostas estão noutro slide. A rodada que o professor abriu por Nova rodada é de propósito, e não leva o
// aviso.
function avisoDaRodada(total) {
  const outra = paginaComRespostas(estado.deck);
  if (estado.comPergunta || estado.novaDeProposito || total > 0 || !Number.isInteger(outra) || outra === estado.pagina) return '';
  return `Esta é a rodada do slide ${estado.pagina}, ainda vazia. As respostas que a turma já mandou estão na rodada do slide ${outra}: feche, volte ao slide ${outra} e aperte V.`;
}

function parar() {
  geracao += 1;
  clearTimeout(relogio);
}

async function pedir(caminho, corpo) {
  const resposta = await fetch(estado.origem + caminho, {
    method: corpo ? 'POST' : 'GET',
    headers: corpo ? { 'X-Chave': estado.chave, 'Content-Type': 'application/json' } : { 'X-Chave': estado.chave },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    // Redirecionamento levaria o cabeçalho X-Chave a outro destino: recusa.
    redirect: 'error',
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  const dado = await resposta.json().catch(() => ({}));
  return { status: resposta.status, ok: resposta.ok, dado };
}

function mensagemDeErro({ status, dado }) {
  if (status === 404) return 'Esta rodada expirou. Use Nova rodada para abrir outra.';
  return dado.erro ?? `O servidor da votação respondeu com erro ${status}.`;
}

// O QR é desenhado como um caminho SVG só, com uma linha horizontal por sequência de módulos escuros: fica nítido
// em qualquer tamanho de projetor, e as bordas retas (crispEdges) não borram entre módulos. A margem de 4 módulos
// é a zona de silêncio que a norma do QR pede para a leitura pelo celular.
function trechosEscuros(linha) {
  const trechos = [];
  let inicio = -1;
  linha.forEach((escuro, x) => {
    if (escuro && inicio < 0) inicio = x;
    if (!escuro && inicio >= 0) { trechos.push([inicio, x - inicio]); inicio = -1; }
  });
  if (inicio >= 0) trechos.push([inicio, linha.length - inicio]);
  return trechos;
}

function desenharQr(texto) {
  const { size: lado, data: modulos } = encode(texto, { ecc: 'M', border: 4 });
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${lado} ${lado}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `QR code para ${texto}`);
  const fundo = document.createElementNS(SVG, 'rect');
  fundo.setAttribute('class', 'votacao-qr-fundo');
  fundo.setAttribute('width', lado);
  fundo.setAttribute('height', lado);
  const caminho = document.createElementNS(SVG, 'path');
  caminho.setAttribute('class', 'votacao-qr-modulos');
  caminho.setAttribute('d', modulos.flatMap((linha, y) => trechosEscuros(linha).map(([x, n]) => `M${x} ${y}h${n}v1h-${n}z`)).join(''));
  svg.append(fundo, caminho);
  return svg;
}

function mostrarContagem(total) {
  painel.numero.textContent = String(total);
  painel.unidade.textContent = total === 1 ? 'resposta' : 'respostas';
  if (total > 0) lembrarPaginaComRespostas(estado.deck, estado.pagina);
}

// Cada grupo é um cartão com o texto. Respostas repetidas levam o número escrito, "×3", e vêm primeiro, na ordem do
// servidor (do maior grupo para o menor); a resposta única não leva número, que numa pergunta aberta seria um "1" em
// cada cartão.
function itemDoGrupo({ texto, contagem }) {
  const item = document.createElement('li');
  const rotulo = Object.assign(document.createElement('span'), { className: 'votacao-texto', textContent: texto });
  item.append(rotulo);
  if (contagem > 1) {
    const numero = Object.assign(document.createElement('span'), { className: 'votacao-quantos', textContent: `×${contagem}` });
    numero.setAttribute('aria-hidden', 'true');
    const leitor = Object.assign(document.createElement('span'), { className: 'votacao-so-leitor', textContent: `, ${contagem} respostas iguais` });
    item.append(numero, leitor);
  }
  return item;
}

// A chave de um grupo, para reconhecê-lo de uma consulta para outra: o texto mostrado pode trocar de variante
// ("Regex" vira "regex" quando a segunda forma passa a ser a mais enviada), e a chave não. É mais fina que a do
// servidor (normalizar, no server.py), que usa casefold: dois grupos do servidor nunca caem na mesma chave daqui.
const chaveDoGrupo = texto => texto.normalize('NFC').toLowerCase().split(/\s+/).filter(Boolean).join(' ');

// A posição de cada grupo na tela desde que R revelou. O grupo novo entra no fim; os que já estavam não mudam de
// lugar, nem quando ganham resposta, porque o servidor ordena em ordem alfabética entre contagens iguais, e a resposta
// nova entraria no meio da lista que o professor está lendo.
let ordemDaRevelacao = new Map();
function naOrdemDaTela(grupos) {
  for (const { texto } of grupos) {
    const chave = chaveDoGrupo(texto);
    if (!ordemDaRevelacao.has(chave)) ordemDaRevelacao.set(chave, ordemDaRevelacao.size);
  }
  const posicao = ({ texto }) => ordemDaRevelacao.get(chaveDoGrupo(texto));
  return [...grupos].sort((a, b) => posicao(a) - posicao(b));
}

// A consulta chega a cada 2 s: só redesenha, e só reajusta a letra, quando as respostas mudaram, para a rolagem e o
// tamanho da letra não pularem à toa.
let gruposEmTela = '';
function mostrarGrupos(grupos) {
  const chave = JSON.stringify(grupos);
  if (chave === gruposEmTela) return;
  gruposEmTela = chave;
  painel.grupos.replaceChildren(...naOrdemDaTela(grupos).map(itemDoGrupo));
  painel.vazio.hidden = grupos.length > 0;
  ajustarRespostas();
}

function agendar(minha) {
  if (minha === geracao) relogio = setTimeout(() => consultar(minha), INTERVALO_MS);
}

async function consultar(minha) {
  const caminho = `/api/professor/rodadas/${estado.codigo}${estado.revelado ? '/respostas' : ''}`;
  let resposta;
  try {
    resposta = await pedir(caminho);
  } catch {
    if (minha === geracao) avisar('Sem resposta do servidor da votação. Tentando de novo…', true);
    return agendar(minha);
  }
  if (minha !== geracao) return undefined;
  // Chave recusada e rodada expirada não melhoram com o tempo: a consulta para e o painel diz o que fazer.
  if (resposta.status === 403) return recusarChave();
  if (resposta.status === 404) return avisar(mensagemDeErro(resposta), true);
  if (!resposta.ok) avisar(mensagemDeErro(resposta), true);
  else {
    avisar(avisoDaRodada(resposta.dado.total));
    mostrarContagem(resposta.dado.total);
    if (resposta.dado.grupos) mostrarGrupos(resposta.dado.grupos);
  }
  return agendar(minha);
}

// Devolve false, sem mexer no painel, se o código não tem o formato dos que o servidor gera.
function mostrarRodada(rodada) {
  if (typeof rodada.codigo !== 'string' || !CODIGO_VALIDO.test(rodada.codigo)) return false;
  estado.codigo = rodada.codigo;
  estado.revelado = false;
  const endereco = new URL(`/${rodada.codigo}`, estado.origem);
  painel.qr.replaceChildren(desenharQr(endereco.href));
  painel.endereco.querySelector('strong').textContent = endereco.host + endereco.pathname;
  painel.titulo.textContent = 'Responda pelo celular';
  mostrarContagem(rodada.total);
  modo('coleta');
  return true;
}

function pedirChave(texto, erro = false) {
  painel.titulo.textContent = 'Votação da turma';
  painel.campo.value = '';
  modo('chave');
  avisar(texto, erro);
  painel.campo.focus();
}

// Interrompe a consulta, tira a chave da aba e volta ao campo. O mapa do navegador fica a cargo de quem chama.
function largarChave(texto, erro) {
  parar();
  estado.chave = null;
  estado.codigo = null;
  pedirChave(texto, erro);
}

// Apaga do mapa só a chave que levou o 403 (as das outras origens ficam). Se outra aba já gravou uma chave nova
// para esta origem, ela fica.
function recusarChave() {
  if (chaveGuardada(estado.origem) === estado.chave) guardarChave(estado.origem, null);
  largarChave('O servidor recusou a chave do professor. Digite de novo.', true);
}

// Apaga a chave da origem em uso sem conferir qual é: o professor pediu que este navegador não a guarde.
function esquecerChave() {
  guardarChave(estado.origem, null);
  largarChave('Chave esquecida neste navegador. Digite a chave para abrir a votação.', false);
}

async function entrar() {
  const chave = painel.campo.value.trim();
  // A chave sai do campo assim que lida: só o navegador guarda, e só depois de aceita.
  painel.campo.value = '';
  if (!chave) return avisar('Digite a chave do professor.', true);
  estado.chave = chave;
  // Só a chave digitada que abriu uma rodada fica guardada: a digitada errado, ou que não chegou ao servidor, não.
  // Quem abre a rodada com a chave que já veio do mapa (a abertura do painel, Nova rodada) não grava.
  if (await abrirRodada(false)) guardarChave(estado.origem, chave);
}

// Devolve true quando a rodada abriu e a consulta começou.
async function abrirRodada(nova) {
  parar();
  if (nova) estado.novaDeProposito = true;
  const minha = geracao;
  avisar(nova ? 'Abrindo uma rodada nova…' : 'Abrindo a votação…');
  let resposta;
  try {
    resposta = await pedir('/api/professor/rodadas', { deck: estado.deck, pagina: estado.pagina, nova });
  } catch {
    if (minha === geracao) avisar('Sem conexão com o servidor da votação. Tente de novo.', true);
    return;
  }
  if (minha !== geracao) return;
  if (resposta.status === 403) return recusarChave();
  if (!resposta.ok) return avisar(mensagemDeErro(resposta), true);
  if (!mostrarRodada(resposta.dado)) return avisar('O servidor da votação respondeu com um código de rodada inválido.', true);
  avisar(nova ? 'Rodada nova aberta. As respostas anteriores ficaram de fora.' : avisoDaRodada(resposta.dado.total));
  agendar(minha);
  return true;
}

function alternarRevelacao() {
  if (!estado?.codigo) return;
  parar();
  estado.revelado = !estado.revelado;
  modo(estado.revelado ? 'revelado' : 'coleta');
  // Cada revelação começa da ordem do servidor.
  ordemDaRevelacao = new Map();
  if (estado.revelado) mostrarGrupos([]);
  painel.respostas.scrollTop = 0;
  alvoDaRolagem = null;
  consultar(geracao);
}

// Com o painel aberto, as teclas são dele: a seta e o espaço não mudam o slide que está por baixo, e o R revela em
// vez de reiniciar a animação. V fecha o painel, como Esc: em tela cheia, o Esc do navegador também sai da tela cheia,
// e o V não. Com as respostas à mostra, as setas, Page Up e Page Down e o espaço (fora de um botão)
// rolam as respostas, que é o que o passador de slides manda; Home e End vão ao começo e ao fim delas. A escuta é na fase de captura, que roda antes da escuta do visualizador, e a
// interrompe. Tab, Enter e Esc seguem o comportamento do próprio diálogo, que não depende de escuta nenhuma; F
// continua com o visualizador, para a tela cheia funcionar com o painel aberto. No campo da chave, toda tecla é
// do campo, inclusive R e F, e Enter entra.
function teclaNoCampo(evento) {
  evento.stopImmediatePropagation();
  if (evento.key === 'Enter') {
    evento.preventDefault();
    entrar();
  }
}

const ROLAR_PARA_BAIXO = ['ArrowDown', 'ArrowRight', 'PageDown', ' '];
const ROLAR_PARA_CIMA = ['ArrowUp', 'ArrowLeft', 'PageUp'];
// O ponto da seção a que a tecla leva, ou null se a tecla não rola. A seta e as teclas de página andam 85% da altura
// visível, para a última linha de uma tela continuar à vista no alto da seguinte.
function destinoDaRolagem(tecla, { scrollTop, scrollHeight, clientHeight }) {
  const fim = scrollHeight - clientHeight;
  if (tecla === 'Home') return 0;
  if (tecla === 'End') return fim;
  const sentido = ROLAR_PARA_BAIXO.includes(tecla) ? 1 : ROLAR_PARA_CIMA.includes(tecla) ? -1 : 0;
  if (!sentido) return null;
  return Math.min(fim, Math.max(0, (alvoDaRolagem ?? scrollTop) + sentido * 0.85 * clientHeight));
}

function rolarRespostas(evento) {
  if (evento.key === ' ' && evento.target.closest?.('button')) return;
  const destino = destinoDaRolagem(evento.key, painel.respostas);
  if (destino === null) return;
  evento.preventDefault();
  alvoDaRolagem = destino;
  const suave = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  painel.respostas.scrollTo({ top: destino, behavior: suave ? 'smooth' : 'auto' });
}

addEventListener('resize', () => {
  if (!painel) return;
  ajustarPergunta();
  ajustarRespostas();
});

// V fecha, R revela ou esconde, e com as respostas à mostra as teclas do passador rolam.
function teclaNoPainel(evento) {
  const tecla = evento.key.toLowerCase();
  if (tecla === 'v') {
    evento.preventDefault();
    painel.dialogo.close();
  } else if (tecla === 'r') {
    evento.preventDefault();
    alternarRevelacao();
  } else if (painel.dialogo.dataset.modo === 'revelado') rolarRespostas(evento);
}

addEventListener('keydown', evento => {
  if (!painel?.dialogo.open || evento.altKey || evento.ctrlKey || evento.metaKey) return;
  if (evento.target === painel.campo) return teclaNoCampo(evento);
  if (evento.key.toLowerCase() === 'f') return;
  teclaNoPainel(evento);
  evento.stopImmediatePropagation();
}, true);

// `servidor` é a origem que o visualizador aceitou. `recusado` é o &servidor= que ele não aceitou: o painel só
// avisa, sem pedir nada a servidor nenhum. `chaveIgnorada` diz que o endereço trazia &chave=, de um link antigo.
// `pergunta` é o texto marcado no slide, ou nada; só entra no painel por textContent. Com ela, o atributo
// data-pergunta divide a tela (painel.css).
function mostrarPergunta(pergunta) {
  painel.pergunta.textContent = pergunta ?? '';
  painel.pergunta.hidden = !pergunta;
  painel.dialogo.toggleAttribute('data-pergunta', Boolean(pergunta));
}

export async function abrir({ deck, pagina, pergunta = null, servidor, recusado = null, chaveIgnorada = false }) {
  await montar();
  if (painel.dialogo.open) return;
  parar();
  estado = null;
  painel.titulo.textContent = 'Votação da turma';
  mostrarPergunta(pergunta);
  painel.dialogo.showModal();
  painel.dialogo.focus();
  modo('aviso');
  avisar('');
  if (recusado) return avisar(`O servidor ${recusado} não é aceito pelo visualizador. Abra de novo com o endereço sem &servidor=.`, true);
  estado = { origem: servidor, chave: chaveGuardada(servidor), deck, pagina, comPergunta: Boolean(pergunta), codigo: null, revelado: false };
  const ignorada = chaveIgnorada ? 'A chave que veio no endereço foi ignorada e tirada da barra: ela agora se digita no painel.' : '';
  if (!estado.chave) return pedirChave(ignorada, chaveIgnorada);
  // De novo, agora com a chave guardada em estado: o botão Esquecer chave aparece antes da resposta do servidor.
  modo('aviso');
  // Sem esperar a rodada: o visualizador trava as teclas do slide até `abrir` terminar (abrindoVotacao, no ver.html),
  // e o diálogo já aberto toma as teclas. Esperar o pedido, que pode levar até TEMPO_LIMITE_MS, deixava as setas presas
  // depois de o professor fechar o painel.
  // `abrirRodada` só devolve true ao pedido que ainda vale: a resposta de um painel já fechado não escreve no seguinte.
  abrirRodada(false)
    .then(abriu => { if (abriu && ignorada) avisar(ignorada); })
    .catch(erro => console.error('Votação:', erro));
}
