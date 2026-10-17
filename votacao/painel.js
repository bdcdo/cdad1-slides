// Painel de votação do visualizador de slides. Abre sobre a página atual, com o QR code para a turma responder pelo
// celular, a contagem ao vivo e, quando o professor pede, as respostas agrupadas em barras.
//
// O visualizador (ver.html) importa este módulo só quando a tecla V é usada e passa o deck, a página e a origem do
// servidor, já conferida pela regra de lá (origemAceita): este módulo não lê a URL nem revalida o servidor. O
// servidor da votação mora noutro domínio, e as rotas do professor só respondem com a chave no cabeçalho X-Chave.
//
// A chave do professor é digitada no próprio painel, num campo de senha, e nunca passa pelo endereço da página,
// que vai para o histórico do navegador e para o registro de acesso do site. Aceita pelo servidor, ela fica no
// sessionStorage desta aba, presa à origem do servidor com que foi aceita: outra origem pede a chave de novo, e
// ela não vai para servidor nenhum além daquele. Chave recusada (403) sai da aba, e o painel volta a pedir.
//
// A contagem é uma consulta a cada 2 s, e não um canal aberto pelo servidor (SSE): o servidor atende cada conexão
// com uma thread, e a consulta custa uma requisição curta, que também mantém a máquina do servidor acordada
// enquanto o painel está aberto.
import { encode } from '../uqr/uqr.mjs';

const INTERVALO_MS = 2000;
const TEMPO_LIMITE_MS = 8000;
const SVG = 'http://www.w3.org/2000/svg';
const CHAVE_DA_ABA = 'votacao:chave';
// O servidor gera códigos de 4 caracteres de letras maiúsculas e algarismos (ALFABETO, no server.py). O código vai
// para o QR e para o endereço projetado; fora deste formato, a resposta não é usada.
const CODIGO_VALIDO = /^[A-Z0-9]{2,12}$/;

const MOLDE = `
<div class="votacao-corpo">
  <figure class="votacao-qr" hidden></figure>
  <div class="votacao-lado">
    <h2 class="votacao-titulo" id="votacao-titulo">Votação da turma</h2>
    <p class="votacao-endereco" hidden>Ou acesse <strong></strong></p>
    <div class="votacao-chave" hidden>
      <label for="votacao-chave-campo">Chave do professor</label>
      <div class="votacao-chave-linha">
        <input id="votacao-chave-campo" type="password" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button type="button" class="votacao-principal" data-acao="entrar">Entrar</button>
      </div>
    </div>
    <p class="votacao-contagem" hidden><span class="votacao-numero"></span> <span class="votacao-unidade"></span></p>
    <p class="votacao-estado" role="status"></p>
    <div class="votacao-acoes">
      <button type="button" class="votacao-principal" data-acao="revelar" hidden>Revelar respostas (R)</button>
      <button type="button" data-acao="nova" hidden>Nova rodada</button>
      <button type="button" data-acao="fechar">Fechar (Esc)</button>
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

function carregarEstilo() {
  const link = Object.assign(document.createElement('link'), {
    rel: 'stylesheet',
    href: new URL('./painel.css', import.meta.url).href,
  });
  // Espera o estilo antes de abrir, para o painel não aparecer um instante sem forma. Se o arquivo falhar, abre
  // assim mesmo: a contagem continua legível sem estilo.
  const pronto = new Promise(resolve => { link.onload = resolve; link.onerror = resolve; });
  document.head.append(link);
  return pronto;
}

async function montarDeVez() {
  await carregarEstilo();
  const dialogo = document.createElement('dialog');
  dialogo.className = 'votacao';
  dialogo.setAttribute('aria-labelledby', 'votacao-titulo');
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
    dialogo, qr: achar('.votacao-qr'), titulo: achar('.votacao-titulo'), endereco: achar('.votacao-endereco'),
    contagem: achar('.votacao-contagem'), numero: achar('.votacao-numero'), unidade: achar('.votacao-unidade'),
    estado: achar('.votacao-estado'), revelar: achar('[data-acao="revelar"]'), nova: achar('[data-acao="nova"]'),
    respostas: achar('.votacao-respostas'), grupos: achar('.votacao-grupos'), vazio: achar('.votacao-vazio'),
    chave: achar('.votacao-chave'), campo: achar('#votacao-chave-campo'),
  };
  // O campo não fica num <form>: não há envio que mude o endereço da página, e Enter no campo entra pela escuta de
  // teclas, mais abaixo.
  achar('[data-acao="entrar"]').addEventListener('click', entrar);
  painel.revelar.addEventListener('click', alternarRevelacao);
  painel.nova.addEventListener('click', () => abrirRodada(true));
  achar('[data-acao="fechar"]').addEventListener('click', () => dialogo.close());
  // Esc fecha o diálogo pelo próprio navegador; o evento close cobre o Esc e o botão.
  dialogo.addEventListener('close', parar);
  return painel;
}
// Uma montagem só, mesmo que a tecla seja apertada duas vezes antes de o estilo chegar.
const montar = () => (montagem ??= montarDeVez());

// A chave guardada para esta origem, ou null. Aba sem armazenamento: a chave é pedida a cada abertura.
function chaveGuardada(origem) {
  try {
    const par = JSON.parse(sessionStorage.getItem(CHAVE_DA_ABA));
    return par?.servidor === origem && typeof par.chave === 'string' ? par.chave : null;
  } catch {
    return null;
  }
}

function guardarChave(origem, chave) {
  try {
    if (chave) sessionStorage.setItem(CHAVE_DA_ABA, JSON.stringify({ servidor: origem, chave }));
    else sessionStorage.removeItem(CHAVE_DA_ABA);
  } catch { /* aba sem armazenamento: nada a guardar */ }
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
  painel.respostas.hidden = nome !== 'revelado';
  painel.revelar.textContent = nome === 'revelado' ? 'Esconder respostas (R)' : 'Revelar respostas (R)';
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
}

// Cada grupo é uma linha com o texto, a barra e o número escrito ao lado: o tamanho da barra repete o número, e
// nenhuma informação fica só na cor. A barra mais longa é a do maior grupo, e as outras são proporcionais a ela.
function itemDoGrupo({ texto, contagem }, maior) {
  const item = document.createElement('li');
  const rotulo = Object.assign(document.createElement('span'), { className: 'votacao-texto', textContent: texto });
  const medida = Object.assign(document.createElement('span'), { className: 'votacao-medida' });
  const barra = Object.assign(document.createElement('span'), { className: 'votacao-barra' });
  barra.style.setProperty('--fracao', String(contagem / maior));
  const numero = Object.assign(document.createElement('span'), { className: 'votacao-quantos', textContent: String(contagem) });
  const leitor = Object.assign(document.createElement('span'), {
    className: 'votacao-so-leitor', textContent: contagem === 1 ? ' resposta' : ' respostas',
  });
  medida.append(barra, numero, leitor);
  item.append(rotulo, medida);
  return item;
}

function mostrarGrupos(grupos) {
  const maior = Math.max(1, ...grupos.map(grupo => grupo.contagem));
  painel.grupos.replaceChildren(...grupos.map(grupo => itemDoGrupo(grupo, maior)));
  painel.vazio.hidden = grupos.length > 0;
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
    avisar('');
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

function recusarChave() {
  parar();
  guardarChave(null);
  estado.chave = null;
  estado.codigo = null;
  pedirChave('O servidor recusou a chave do professor. Digite de novo.', true);
}

function entrar() {
  const chave = painel.campo.value.trim();
  if (!chave) return avisar('Digite a chave do professor.', true);
  estado.chave = chave;
  return abrirRodada(false);
}

async function abrirRodada(nova) {
  parar();
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
  // Só a chave que abriu uma rodada fica guardada: a digitada errado, ou que não chegou ao servidor, não.
  guardarChave(estado.origem, estado.chave);
  avisar(nova ? 'Rodada nova aberta. As respostas anteriores ficaram de fora.' : '');
  agendar(minha);
}

function alternarRevelacao() {
  if (!estado?.codigo) return;
  parar();
  estado.revelado = !estado.revelado;
  modo(estado.revelado ? 'revelado' : 'coleta');
  if (estado.revelado) mostrarGrupos([]);
  consultar(geracao);
}

// Com o painel aberto, as teclas são dele: a seta e o espaço não mudam o slide que está por baixo, e o R revela em
// vez de reiniciar a animação. A escuta é na fase de captura, que roda antes da escuta do visualizador, e a
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

addEventListener('keydown', evento => {
  if (!painel?.dialogo.open || evento.altKey || evento.ctrlKey || evento.metaKey) return;
  if (evento.target === painel.campo) return teclaNoCampo(evento);
  const tecla = evento.key.toLowerCase();
  if (tecla === 'f') return;
  if (tecla === 'r') {
    evento.preventDefault();
    alternarRevelacao();
  }
  evento.stopImmediatePropagation();
}, true);

// `servidor` é a origem que o visualizador aceitou. `recusado` é o &servidor= que ele não aceitou: o painel só
// avisa, sem pedir nada a servidor nenhum. `chaveIgnorada` diz que o endereço trazia &chave=, de um link antigo.
export async function abrir({ deck, pagina, servidor, recusado = null, chaveIgnorada = false }) {
  await montar();
  if (painel.dialogo.open) return;
  parar();
  estado = null;
  painel.titulo.textContent = 'Votação da turma';
  modo('aviso');
  avisar('');
  painel.dialogo.showModal();
  painel.dialogo.focus();
  if (recusado) return avisar(`O servidor ${recusado} não é aceito pelo visualizador. Abra de novo com o endereço sem &servidor=.`, true);
  estado = { origem: servidor, chave: chaveGuardada(servidor), deck, pagina, codigo: null, revelado: false };
  const ignorada = chaveIgnorada ? 'A chave que veio no endereço foi ignorada e tirada da barra: ela agora se digita no painel.' : '';
  if (!estado.chave) return pedirChave(ignorada, chaveIgnorada);
  await abrirRodada(false);
  if (ignorada && estado.codigo) avisar(ignorada);
}
