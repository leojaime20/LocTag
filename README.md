# P84/85 Hull · LocTag

Piloto web para localização de tags de equipamentos no casco P84/85: busca, lista e destaque sincronizado em vista em planta e lateral. Interface escura com identidade visual Petrobras (verde e amarelo).

## Executar localmente

O navegador bloqueia `fetch` em arquivos abertos diretamente (`file://`). Use um servidor estático na pasta do projeto:

```bash
# Python 3
python3 -m http.server 8080

# ou Node (npx)
npx --yes serve -p 8080
```

Abra [http://localhost:8080](http://localhost:8080).

## Publicar no GitHub Pages

1. Envie o repositório para o GitHub.
2. Em **Settings ? Pages**, escolha a branch `main` e a pasta **/ (root)**.
3. A URL ficará em `https://<seu-usuario>.github.io/LocTag/` (ajuste se o repositório tiver outro nome).

Todos os caminhos são relativos; não é necessário build.

## Estrutura

| Arquivo | Função |
|---------|--------|
| `index.html` | Layout da interface |
| `css/styles.css` | Estilos responsivos |
| `js/app.js` | Busca, tabela e marcadores |
| `data/tags.json` | Catálogo de tags e coordenadas |
| `assets/planta.svg` | Desenho de fundo — planta (esquemático) |
| `assets/lateral.svg` | Desenho de fundo — lateral (esquemático) |

## Dados e coordenadas

Cada tag em `data/tags.json` inclui:

- Metadados: `tag`, `descricao`, `sistema`, `deck`, `area`
- `planta`: `{ "x", "y" }` no viewBox **0 0 1000 500**
- `lateral`: `{ "x", "z" }` — o mesmo `x` alinha as duas vistas; `z` é a cota vertical no corte

Para usar layouts reais:

1. Substitua `assets/planta.svg` e `assets/lateral.svg` mantendo o mesmo `viewBox` (ou ajuste `index.html` e as coordenadas no JSON).
2. Atualize `data/tags.json` com as posições calibradas (pontos de referência no desenho ajudam a converter metros ? pixels SVG).

## Próximas melhorias

- Firebase / Firestore para dados dinâmicos e regras de acesso
- Zoom e pan nas vistas
- Importação de planilha CSV
- Painel de administração

## Piloto

Os ~15 registros e os desenhos são **fictícios**, apenas para validar a interface com operadores.
