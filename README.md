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
2. Em **Settings > Pages**, escolha a branch `main` e a pasta **/ (root)**.
3. A URL ficará em `https://<seu-usuario>.github.io/LocTag/` (ajuste se o repositório tiver outro nome).

Todos os caminhos são relativos; não é necessário build.

## Firebase privado

O GitHub Pages publica apenas a interface. Os dados reais devem ficar no Firestore e só serão lidos depois do login Google.

Projeto Firebase criado:

- Project ID: `loctag-p84-p85`
- Firestore: banco padrão `(default)`
- Região: `asia-east2`
- Modo: Firestore Native / Standard
- Delete protection: ativada
- Console: [https://console.firebase.google.com/project/loctag-p84-p85/overview](https://console.firebase.google.com/project/loctag-p84-p85/overview)
- Web App: `LocTag P84 P85`
- Dados iniciais: 15 documentos em `tags`
- Usuário autorizado inicial: `leojaime20@gmail.com`

Arquivos preparados:

| Arquivo | Função |
|---------|--------|
| `firebase.json` | Configuração do Firebase CLI para regras do Firestore |
| `firestore.rules` | Permite ler `tags` apenas para usuários autorizados |
| `firestore.indexes.json` | Índices do Firestore |
| `.firebaserc.example` | Modelo para apontar o projeto Firebase correto |
| `js/firebase-config.example.js` | Modelo da configuração pública do Web App Firebase |

Passos restantes:

1. Ative **Authentication > Sign-in method > Google** no Console Firebase.
2. Em **Authentication > Settings > Authorized domains**, adicione `leojaime20.github.io`.
3. No Firestore, crie a coleção `authorizedUsers`. Cada usuário autorizado deve ter um documento cujo ID é o e-mail completo, por exemplo `usuario@empresa.com`.
4. Para liberar mais pessoas, adicione novos documentos em `authorizedUsers` usando o e-mail completo como ID.

As regras já podem ser publicadas novamente com:

```bash
firebase deploy --only firestore:rules
```

Não publique dados reais em `data/tags.json`; ele deve ficar apenas para desenvolvimento ou demonstração.

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
2. Atualize `data/tags.json` com as posições calibradas (pontos de referência no desenho ajudam a converter metros para pixels SVG).

## Próximas melhorias

- Firebase / Firestore para dados dinâmicos e regras de acesso
- Zoom e pan nas vistas
- Importação de planilha CSV
- Painel de administração

## Piloto

Os ~15 registros e os desenhos são **fictícios**, apenas para validar a interface com operadores.
