#!/usr/bin/env python3
"""Gera o site e a API de mentira do Tribunal Fictício, usados nas aulas de requisição e raspagem.

Uso: python3 tribunal-ficticio/gerar.py   (da raiz do repositório)

Tudo aqui é inventado: o tribunal de código 99 não existe, as partes não existem e nenhum processo
é real. Os números seguem o formato do CNJ, com dígito verificador válido, para que o material se
pareça com o que a turma encontra depois num tribunal de verdade.

Os dados moram só neste arquivo. As páginas e os arquivos JSON são gerados a partir deles, e editar
um deles à mão desalinha os outros.

O site é estático: cada "resposta da API" é um arquivo. Disso vêm três diferenças para uma API de
verdade, ditas na documentação gerada: só existe pedido GET, o que vem depois de `?` no endereço é
ignorado, e um endereço que não existe devolve 404 com uma página HTML, e não com JSON.
"""
import html
import json
from pathlib import Path

AQUI = Path(__file__).resolve().parent
BASE = "https://brunodcdo.com.br/cdad1-slides/tribunal-ficticio"
POR_PAGINA = 3
PESQUISA = "dano moral"

# numero, classe, assunto, resultado, data da decisão, valor da causa em salários mínimos, autor, réu
PROCESSOS = [
    ("0000101-95.2026.8.99.0001", "Procedimento Comum", "Dano moral", "improcedente", "14/09/2026", 60, "Marina Alves", "Banco Fictício"),
    ("0000202-35.2026.8.99.0001", "Juizado Especial", "Dano moral", "procedente", "15/09/2026", 15, "Otávio Bastos", "Loja Fictícia"),
    ("0000303-72.2026.8.99.0001", "Execução Fiscal", "Dívida ativa", "procedente", "16/09/2026", 120, "Município Fictício", "Carlos Souza"),
    ("0000404-12.2026.8.99.0001", "Procedimento Comum", "Dano moral", "procedente", "17/09/2026", 45, "Helena Prado", "Operadora Fictícia"),
    ("0000505-49.2026.8.99.0001", "Juizado Especial", "Cobrança indevida", "procedente", "18/09/2026", 8, "Rafael Nunes", "Banco Fictício"),
    ("0000606-86.2026.8.99.0001", "Juizado Especial", "Dano moral", "improcedente", "21/09/2026", 20, "Lívia Rocha", "Companhia Aérea Fictícia"),
    ("0000707-26.2026.8.99.0001", "Procedimento Comum", "Cobrança indevida", "improcedente", "22/09/2026", 75, "Sérgio Lima", "Loja Fictícia"),
]
# Um número com dígito válido que o cadastro não tem, para o exemplo do 404.
NUMERO_AUSENTE = "0000999-11.2026.8.99.0001"
# As decisões que aparecem na página HTML de decisões recentes.
RECENTES = 3


def digito_valido(numero):
    """Módulo 97 da Resolução CNJ 65/2008: os vinte dígitos, com o verificador no fim, deixam resto 1."""
    sequencial, resto = numero.split("-")
    digito, ano, segmento, tribunal, origem = resto.split(".")
    return int(sequencial + ano + segmento + tribunal + origem + digito) % 97 == 1


def registro(p):
    numero, classe, assunto, resultado, data, valor_sm, autor, reu = p
    return {
        "numero": numero,
        "classe": classe,
        "partes": {"autor": autor, "reu": reu},
        "assunto": assunto,
        "valor_da_causa_sm": valor_sm,
        "decisao": {"data": data, "resultado": resultado},
        "movimentos": [
            {"ordem": 1, "descricao": "Distribuição"},
            {"ordem": 2, "descricao": "Citação"},
            {"ordem": 3, "descricao": "Sentença"},
        ],
    }


def gravar(caminho, texto):
    destino = AQUI / caminho
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(texto, encoding="utf-8")


def gravar_json(caminho, dados):
    gravar(caminho, json.dumps(dados, ensure_ascii=False, indent=2) + "\n")


ESTILO = """
:root { --fundo: #f6f4ef; --papel: #ffffff; --texto: #1d1d1b; --apoio: #55534e; --traco: #c9c5ba; --marca: #2f4b3a; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--fundo); color: var(--texto); font: 18px/1.55 Georgia, "Times New Roman", serif; }
header { background: var(--marca); color: #ffffff; padding: 20px 16px; }
header p { margin: 0; font: 600 15px/1.3 system-ui, sans-serif; letter-spacing: .04em; text-transform: uppercase; }
main { max-width: 820px; margin: 0 auto; padding: 8px 16px 48px; }
h1 { font-size: 30px; margin: 28px 0 12px; }
h2 { font-size: 22px; margin: 32px 0 8px; }
a { color: var(--marca); }
main > ul { list-style: none; padding: 0; margin: 0; }
main > ul > li { background: var(--papel); border: 1px solid var(--traco); border-left: 6px solid var(--marca); padding: 12px 16px; margin: 0 0 10px; }
main > ul > li b { display: block; font: 600 17px/1.4 ui-monospace, Menlo, Consolas, monospace; }
span.classe { font-weight: 600; }
span.data { color: var(--apoio); }
span.data::before { content: " · decisão de "; }
pre { background: #1f2021; color: #f2f2f2; padding: 14px 16px; overflow-x: auto; font: 15px/1.5 ui-monospace, Menlo, Consolas, monospace; }
code { font: 0.9em ui-monospace, Menlo, Consolas, monospace; }
td code { white-space: nowrap; }
table { border-collapse: collapse; width: 100%; background: var(--papel); }
th, td { border: 1px solid var(--traco); padding: 8px 10px; text-align: left; vertical-align: top; }
.aviso { background: var(--papel); border: 1px solid var(--traco); padding: 12px 16px; font: 16px/1.5 system-ui, sans-serif; }
footer { max-width: 820px; margin: 0 auto; padding: 0 16px 32px; color: var(--apoio); font: 15px/1.5 system-ui, sans-serif; }
"""

AVISO = "Tribunal, partes e processos desta página são inventados, para uso em aula. Nada aqui é real."


def pagina(titulo, corpo):
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{html.escape(titulo)} · Tribunal Fictício</title>
<style>{ESTILO}</style>
</head>
<body>
<header><p>Tribunal Fictício · página de aula</p></header>
<main>
{corpo}
</main>
<footer>{AVISO}</footer>
</body>
</html>
"""


def decisoes_recentes():
    """A lista que a turma raspa. Só estas tags usam as classes `classe` e `data`."""
    linhas = ["<h1>Decisões recentes</h1>", "<ul>"]
    for numero, classe, _, _, data, *_ in PROCESSOS[:RECENTES]:
        linhas += ["  <li>", f"    <b>{numero}</b>", f'    <span class="classe">{classe}</span>',
                   f'    <span class="data">{data}</span>', "  </li>"]
    return "\n".join(linhas + ["</ul>"])


def documentacao():
    primeiro = PROCESSOS[0][0]
    exemplo = json.dumps(registro(PROCESSOS[0]), ensure_ascii=False, indent=2)
    paginas = -(-len(PROCESSOS) // POR_PAGINA)
    return f"""<h1>API do Tribunal Fictício</h1>
<p class="aviso">Esta API é de mentira e existe para a aula. Ela só responde a pedidos de leitura (GET), todo endereço termina em <code>.json</code>, e o que vier depois de um <code>?</code> no endereço é ignorado.</p>

<h2>Endereços</h2>
<table>
<tr><th>Endereço</th><th>O que devolve</th></tr>
<tr><td><code>/api/processos/NUMERO.json</code></td><td>Um dicionário com os dados de um processo.</td></tr>
<tr><td><code>/api/processos.json</code></td><td>Uma lista com os {len(PROCESSOS)} processos do cadastro, um dicionário por processo.</td></tr>
<tr><td><code>/api/decisoes/pagina-N.json</code></td><td>A página N da busca por "{PESQUISA}", com {POR_PAGINA} números por página. São {paginas} páginas com resultado; a página {paginas + 1} existe e vem vazia.</td></tr>
</table>
<p>Todos começam por <code>{BASE}</code>.</p>

<h2>Um processo</h2>
<pre>import requests

base = "{BASE}"
url = base + "/api/processos/{primeiro}.json"
resposta = requests.get(url)
print(resposta.status_code)
dados = resposta.json()
print(dados["partes"]["autor"])</pre>
<p>A resposta tem status 200 e este corpo:</p>
<pre>{html.escape(exemplo)}</pre>

<h2>Um número que não está no cadastro</h2>
<p>O processo <code>{NUMERO_AUSENTE}</code> não existe aqui. O pedido volta com status 404, e o corpo é uma página HTML de erro, e não JSON: chamar <code>resposta.json()</code> nesse caso dá erro. Confira o <code>status_code</code> antes de ler o corpo.</p>

<h2>Números do cadastro</h2>
<ul>
{chr(10).join(f"<li><b>{p[0]}</b> {html.escape(p[1])}</li>" for p in PROCESSOS)}
</ul>
<p><a href="../">Voltar à página do tribunal</a></p>"""


def inicio():
    return f"""<h1>Tribunal Fictício</h1>
<p class="aviso">{AVISO}</p>
<h2>Para ler com um programa</h2>
<ul>
<li><b><a href="decisoes.html">decisoes.html</a></b> Uma página HTML com as decisões recentes, para raspagem.</li>
<li><b><a href="api/">api/</a></b> A documentação da API, que devolve os mesmos dados em JSON.</li>
</ul>"""


if __name__ == "__main__":
    numeros = [p[0] for p in PROCESSOS]
    assert len(set(numeros)) == len(numeros), "número repetido"
    assert all(digito_valido(n) for n in numeros + [NUMERO_AUSENTE]), "dígito verificador inválido"
    assert NUMERO_AUSENTE not in numeros
    registros = [registro(p) for p in PROCESSOS]
    for r in registros:
        gravar_json(f"api/processos/{r['numero']}.json", r)
    gravar_json("api/processos.json", registros)
    # A busca devolve todos os números do cadastro, de três em três, mais uma página vazia depois da última.
    paginas = -(-len(numeros) // POR_PAGINA)
    for n in range(1, paginas + 2):
        gravar_json(f"api/decisoes/pagina-{n}.json",
                    {"pagina": n, "total": len(numeros), "registros": numeros[(n - 1) * POR_PAGINA:n * POR_PAGINA]})
    gravar("decisoes.html", pagina("Decisões recentes", decisoes_recentes()))
    gravar("api/index.html", pagina("API", documentacao()))
    gravar("index.html", pagina("Início", inicio()))
    print(f"{len(registros)} processos, {paginas + 1} páginas de busca, 3 páginas HTML em {AQUI.name}/")
