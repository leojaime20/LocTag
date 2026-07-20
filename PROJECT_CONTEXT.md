# PROJECT_CONTEXT

## Visão geral do sistema

LocTag é uma aplicação web React/TypeScript para localizar tags de equipamentos em desenhos técnicos em PDF. O usuário autentica com Google, pesquisa uma tag armazenada no Firestore e, ao selecionar um resultado, vê um resumo da tag e duas vistas técnicas: planta e lateral. Cada vista mostra um PDF vindo do Firebase Storage com um marcador calculado a partir das coordenadas reais do equipamento e da calibração cadastrada para a região.

O sistema também tem uma área administrativa simples para usuários com papel `admin`. Nela é possível cadastrar ou editar regiões, enviar PDFs de planta/lateral para o Storage e configurar pontos de calibração usados na conversão de coordenadas reais para coordenadas do PDF.

## Problema que resolve

Em ambientes com muitos equipamentos e desenhos técnicos, encontrar visualmente uma TAG em PDFs de planta ou lateral costuma exigir conhecimento do desenho, busca manual e comparação de coordenadas. O LocTag centraliza a busca por TAG e posiciona automaticamente um marcador sobre os PDFs técnicos cadastrados, reduzindo o tempo para localizar equipamentos e melhorando a navegação entre vistas de planta e lateral.

## Público-alvo

- Técnicos, engenheiros, operadores, planejadores e pessoas de manutenção que precisam localizar equipamentos por TAG.
- Administradores técnicos responsáveis por cadastrar regiões, desenhos PDF e calibrações.
- Equipes que trabalham com ativos industriais, especialmente desenhos técnicos associados ao projeto P84/P85 citado na documentação.

## Fluxo principal

1. O usuário acessa a aplicação.
2. A aplicação verifica o estado de autenticação Firebase.
3. Se o usuário não estiver autenticado, a busca fica bloqueada e a tela solicita login com Google.
4. Após login, as regras do Firestore exigem que o e-mail exista em `authorizedUsers` para leitura de `tags` e `regions`.
5. O usuário digita pelo menos 2 caracteres no campo "Pesquisar TAG".
6. A aplicação consulta a coleção `tags` por prefixo nos campos `tag`, `description` e `descricao`.
7. O usuário seleciona um resultado.
8. A aplicação carrega a região vinculada por `regionId`.
9. A aplicação resolve os caminhos de PDF da região para URLs de download no Firebase Storage.
10. A aplicação calcula os marcadores da planta e da lateral usando coordenadas da tag e calibrações da região.
11. A tela exibe o resumo da tag e dois viewers, um para planta e outro para lateral.

## Arquitetura técnica explicada narrativamente

O projeto é uma SPA Vite com React 19 e TypeScript. O ponto de entrada `src/main.tsx` cria o `QueryClient` do TanStack Query, ativa `HashRouter` para compatibilidade com GitHub Pages e renderiza `App`.

`src/App.tsx` define duas rotas carregadas de forma lazy:

- `/`: tela principal de busca e localização de tags.
- `/admin`: tela administrativa de regiões, PDFs e calibração.

A camada de serviços Firebase fica em `src/services/firebase`. `config.ts` inicializa Firebase Auth, Firestore e Storage. `auth.ts` encapsula login/logout com Google. `storage.ts` resolve caminhos internos do Storage para URLs públicas autenticadas via `getDownloadURL`.

A camada de API fica em `src/services/api`. `tags.ts` implementa busca, carregamento de região e montagem do contexto completo da tag selecionada. `admin.ts` implementa leitura do perfil administrativo, leitura de região editável, upload de PDFs e gravação de região.

Os hooks em `src/hooks` ligam essas APIs ao React com estado de autenticação e TanStack Query. Isso mantém as telas relativamente declarativas: as páginas chamam hooks e passam dados para componentes de busca, resumo e viewer.

O estado visual dos viewers fica em Zustand em `src/stores/viewerStore.ts`. Cada vista (`plant` e `side`) tem zoom e pan independentes. A seleção da vista móvel também fica nesse store.

O cálculo geométrico fica isolado em `src/utils/calibration.ts`. A função `realToPdfPoint` recebe a tag, a vista e a calibração, escolhe `x/y` para planta ou `x/z` para lateral, calcula escala e translação a partir de dois pontos conhecidos e aplica rotação opcional.

O PDF é renderizado pela biblioteca EmbedPDF em `src/features/viewer/EmbedPdfSurface.tsx`, usando engine Pdfium e plugins de document manager, viewport, scroll e render. O marcador é desenhado como SVG absoluto por cima da primeira página do PDF.

## Decisões de design e por quê

- **React + Vite + TypeScript**: escolha adequada para SPA leve, tipada, com build simples e bom suporte a GitHub Pages.
- **HashRouter**: evita problemas de roteamento em GitHub Pages, onde recarregar rotas como `/admin` sem configuração de rewrite poderia falhar.
- **Firebase como backend**: reduz necessidade de servidor próprio. Auth, Firestore e Storage cobrem autenticação, dados estruturados e PDFs.
- **Google Sign-In**: simplifica identidade e evita cadastro próprio de senha.
- **Controle de autorização por coleção `authorizedUsers`**: permite liberar ou revogar acesso por e-mail sem alterar código.
- **TanStack Query**: centraliza cache, carregamento e revalidação de consultas remotas.
- **Zustand para viewer**: estado pequeno e local ao cliente, sem necessidade de Context complexo.
- **Calibração por dois pontos**: solução simples para mapear coordenadas reais em coordenadas do PDF quando não há georreferenciamento mais robusto.
- **Modelo com campos legados (`descricao`, `sistema`, `planta`, `lateral`)**: o normalizador aceita dados antigos ou importados de JSON, evitando migração imediata.
- **Marcador somente após seleção de tag**: reduz ruído visual e evita carregar PDFs sem contexto.
- **Duas vistas simultâneas em desktop e alternadas no mobile**: desktop favorece comparação planta/lateral; mobile evita layout apertado.

## Estrutura de pastas e arquivos

```txt
.
├── .github/workflows/deploy.yml
├── .firebaserc
├── .firebaserc.example
├── .prettierrc
├── README.md
├── PROJECT_CONTEXT.md
├── assets/
│   ├── lateral.svg
│   └── planta.svg
├── data/
│   └── tags.json
├── docs/
│   └── admin-cadastro.md
├── firebase.json
├── firestore.indexes.json
├── firestore.rules
├── index.html
├── js/
│   ├── firebase-config.example.js
│   └── firebase-config.js
├── package.json
├── storage.rules
├── tsconfig*.json
├── vite.config.ts
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── styles.css
    ├── components/
    ├── features/
    │   ├── tags/
    │   └── viewer/
    ├── hooks/
    ├── pages/
    ├── services/
    │   ├── api/
    │   └── firebase/
    ├── stores/
    ├── types/
    └── utils/
```

### Responsabilidades por arquivo

- `.github/workflows/deploy.yml`: CI/CD para GitHub Pages. Em push na `main` ou execução manual, usa Node 24, roda `npm ci`, faz build com `GITHUB_PAGES=true` e publica `dist`.
- `.firebaserc`: define o projeto Firebase padrão `loctag-p84-p85`.
- `.firebaserc.example`: modelo para outro projeto Firebase.
- `.prettierrc`: formatação com aspas simples, trailing comma e largura 100.
- `README.md`: documentação resumida do projeto, stack, Firebase, modelo de dados, desenvolvimento, validação e publicação.
- `docs/admin-cadastro.md`: guia operacional para administrar regiões, subir PDFs, calibrar vistas e inserir tags manualmente no Firestore.
- `assets/planta.svg` e `assets/lateral.svg`: ativos SVG incluídos no repositório. No código atual, os viewers usam PDFs/placeholder e esses SVGs não são importados por `src`.
- `data/tags.json`: massa de exemplo com 15 tags em formato legado, contendo `descricao`, `sistema`, `deck`, `area`, `planta` e `lateral`.
- `firebase.json`: aponta regras do Firestore e Storage para deploy via Firebase CLI.
- `firestore.indexes.json`: arquivo de índices sem índices compostos customizados.
- `firestore.rules`: regras de leitura/escrita do Firestore.
- `storage.rules`: regras de leitura/escrita dos PDFs no Firebase Storage.
- `index.html`: HTML base em `pt-BR`, título "LocTag - Visualização técnica" e elemento `#root`.
- `js/firebase-config.js`: configuração Firebase em formato JS fora do bundle TypeScript atual. Parece legado ou auxiliar.
- `js/firebase-config.example.js`: exemplo de configuração Firebase.
- `package.json`: scripts, dependências e metadados do app.
- `vite.config.ts`: configura React, Tailwind CSS e `base` `/LocTag/` quando `GITHUB_PAGES=true`.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: configuração TypeScript com modo estrito, JSX React e bundler resolution.
- `eslint.config.js`: ESLint com regras recomendadas JS/TypeScript, React Hooks e React Refresh; ignora `dist`, `node_modules`, `js`, `css` e `assets`.
- `src/main.tsx`: inicializa React, TanStack Query e `HashRouter`.
- `src/App.tsx`: declara rotas `/` e `/admin` com lazy loading e fallback.
- `src/styles.css`: importa Tailwind, define tema global e classes utilitárias customizadas para painéis, botões, viewer e marcador.
- `src/components/AuthStatus.tsx`: exibe estado de autenticação, botão de login Google ou botão de logout.
- `src/pages/TagLocatorPage.tsx`: tela principal de busca, resumo e viewer.
- `src/pages/AdminPage.tsx`: tela administrativa para editar região, subir PDFs e calibrar planta/lateral.
- `src/features/tags/TagSearch.tsx`: campo de busca de tags, status textual e dropdown de resultados.
- `src/features/tags/TagSummary.tsx`: resumo expansível/recolhível da tag selecionada.
- `src/features/viewer/ViewerWorkspace.tsx`: compõe os dois painéis de viewer e o seletor mobile planta/lateral.
- `src/features/viewer/PdfViewerPanel.tsx`: calcula marcador, aplica zoom/pan e renderiza PDF ou placeholder.
- `src/features/viewer/EmbedPdfSurface.tsx`: integração com EmbedPDF/Pdfium para renderizar o PDF.
- `src/features/viewer/MarkerOverlay.tsx`: SVG absoluto com pulso, núcleo e rótulo da tag.
- `src/features/viewer/ViewerControls.tsx`: botões de zoom, reset, centralizar e tela cheia.
- `src/hooks/useAuthUser.ts`: acompanha `onAuthStateChanged` do Firebase Auth.
- `src/hooks/useAdminProfile.ts`: consulta perfil administrativo do usuário autenticado.
- `src/hooks/useTagSearch.ts`: consulta busca de tags com cache e habilitação condicionada.
- `src/hooks/useSelectedTagContext.ts`: carrega região e URLs de PDF da tag selecionada.
- `src/services/firebase/config.ts`: inicializa Firebase com variáveis `VITE_FIREBASE_*` ou valores padrão do projeto.
- `src/services/firebase/auth.ts`: Google provider, login popup e logout.
- `src/services/firebase/storage.ts`: converte path do Storage ou URL HTTP em URL utilizável.
- `src/services/api/tags.ts`: busca tags, normaliza documentos, carrega região e monta `SelectedTagContext`.
- `src/services/api/admin.ts`: perfil admin, região editável, upload de PDF e gravação de região.
- `src/types/domain.ts`: tipos de domínio usados pelo app.
- `src/types/firebase.ts`: tipos crus do Firestore e normalizadores/fallbacks.
- `src/stores/viewerStore.ts`: estado global dos viewers com Zustand.
- `src/utils/calibration.ts`: transformação de coordenadas reais para coordenadas do PDF.
- `src/vite-env.d.ts`: tipos de ambiente do Vite.

## Modelo de dados completo

### Coleção `authorizedUsers`

Documento: `authorizedUsers/{email}`

O ID do documento deve ser o e-mail completo do usuário.

Campos:

| Campo | Tipo | Significado |
|---|---|---|
| `role` | string | Papel do usuário. O código reconhece `admin`; qualquer outro valor vira `user` na UI administrativa. |

Regras:

- O próprio usuário autenticado pode ler apenas o documento cujo ID é seu e-mail.
- Apenas admin pode escrever documentos nessa coleção.
- A função `isAuthorized()` considera autorizado qualquer usuário autenticado cujo documento exista em `authorizedUsers`, independentemente do `role`.
- A função `isAdmin()` exige `role == "admin"`.

### Coleção `tags`

Documento recomendado: `tags/{tagId}`, frequentemente com ID igual à própria TAG.

Campos canônicos:

| Campo | Tipo | Obrigatório no comportamento esperado | Significado |
|---|---|---:|---|
| `tag` | string | Sim | Código/texto pesquisável da TAG. Se ausente, o normalizador usa o ID do documento. |
| `description` | string | Sim | Descrição pesquisável. Se ausente, tenta `descricao`; se também ausente, usa `"Sem descrição"`. |
| `regionId` | string | Sim | ID da região em `regions`. Se ausente, usa `"default"`. |
| `x` | number | Sim | Coordenada real X. Usada em planta e lateral. Se ausente, tenta `planta.x`; se ausente, `0`. |
| `y` | number | Sim | Coordenada real Y da planta. Se ausente, tenta `planta.y`; se ausente, `0`. |
| `z` | number | Sim | Coordenada real vertical da lateral. Se ausente, tenta `lateral.z`, depois `lateral.y`; se ausente, `0`. |
| `type` | string | Sim | Tipo/sistema exibido no resumo. Se ausente, tenta `sistema`; se ausente, `"Equipamento"`. |
| `status` | string | Não | Status da tag. Tipo TypeScript aceita `active`, `inactive` e `unknown`; se ausente, `"unknown"`. |

Campos legados aceitos:

| Campo | Tipo | Uso |
|---|---|---|
| `descricao` | string | Alternativa legada para `description` e campo pesquisado. |
| `sistema` | string | Alternativa legada para `type`. |
| `deck` | string | Presente no JSON de exemplo, mas não usado pela UI atual. |
| `area` | string | Presente no JSON de exemplo, mas não usado pela UI atual. |
| `planta.x` | number | Fallback para `x`. |
| `planta.y` | number | Fallback para `y`. |
| `planta.z` | number | Tipado como possível, mas não usado. |
| `lateral.x` | number | Presente no JSON de exemplo, mas o normalizador usa `x` geral ou `planta.x`; não usa `lateral.x`. |
| `lateral.y` | number | Fallback secundário para `z`. |
| `lateral.z` | number | Fallback primário para `z`. |

Leitura/escrita:

- Leitura permitida para usuários autorizados.
- Escrita permitida para admin.

### Coleção `regions`

Documento: `regions/{regionId}`

Campos:

| Campo | Tipo | Significado |
|---|---|---|
| `name` | string | Nome legível da região. |
| `plantPdf` | string | Caminho no Firebase Storage ou URL HTTP(S) para o PDF da planta. Exemplo: `pdfs/default-planta.pdf`. |
| `sidePdf` | string | Caminho no Firebase Storage ou URL HTTP(S) para o PDF da lateral. Exemplo: `pdfs/default-lateral.pdf`. |
| `plantCalibration` | object | Calibração para converter `x/y` reais da tag em coordenadas de marcador na planta. |
| `sideCalibration` | object | Calibração para converter `x/z` reais da tag em coordenadas de marcador na lateral. |
| `updatedAt` | timestamp | Atualizado por `saveRegion` com `serverTimestamp()`. |

Se uma região não existir, `getRegion(regionId)` retorna uma região fallback com:

- `id`: o `regionId` solicitado.
- `name`: o próprio `regionId`.
- PDFs vazios.
- calibrações padrão.

Leitura/escrita:

- Leitura permitida para usuários autorizados.
- Escrita permitida para admin.

### Objeto `Calibration`

Usado dentro de documentos de região.

Campos:

| Campo | Tipo | Significado |
|---|---|---|
| `id` | string | Identificador lógico da calibração. |
| `pdfId` | string | Identificador lógico do PDF associado. |
| `points` | array de `CalibrationPoint` | Pontos conhecidos para calcular escala e translação. O editor trabalha com dois pontos. |
| `scale` | number opcional | Escala fallback se os pontos forem inválidos ou degenerados. |
| `translateX` | number opcional | Translação adicional em X. |
| `translateY` | number opcional | Translação adicional em Y. |
| `rotationDeg` | number opcional | Rotação em graus aplicada após escala. Default prático: `0`. |

`CalibrationPoint`:

| Campo | Tipo | Significado |
|---|---|---|
| `realX` | number | Coordenada X real conhecida. |
| `realY` | number | Coordenada Y real conhecida. Na lateral, representa a coordenada vertical usada pelo app, isto é, o `z` da tag. |
| `pdfX` | number | Coordenada X correspondente no sistema do marcador/PDF. |
| `pdfY` | number | Coordenada Y correspondente no sistema do marcador/PDF. |

### Coleção `calibrations`

Existe apenas nas regras do Firestore:

- `match /calibrations/{calibrationId}`
- Leitura para autorizados.
- Escrita para admin.

No código atual, calibrações são embutidas em `regions` e nenhuma API/tela lê ou escreve a coleção `calibrations`.

### Firebase Storage

Pasta usada:

```txt
pdfs/{regionId}-planta.pdf
pdfs/{regionId}-lateral.pdf
```

Regras:

- Leitura em `/pdfs/{fileName}` permitida para qualquer usuário autenticado, mesmo que não exista em `authorizedUsers`.
- Escrita em `/pdfs/{fileName}` permitida somente para admin segundo o documento `authorizedUsers/{email}`.

## Funcionalidades

### Autenticação

- Login com Google via popup.
- Logout.
- Exibição do e-mail autenticado.
- Estado inicial "Autenticação..." enquanto o Firebase Auth resolve a sessão.

### Controle de acesso

- A UI principal bloqueia a busca se não houver usuário autenticado.
- As regras do Firestore bloqueiam leitura de tags/regiões para usuários autenticados que não estejam em `authorizedUsers`.
- A área admin só renderiza os controles quando `useAdminProfile` encontra `role: "admin"`.
- O link "Administração" na tela principal aparece somente para o e-mail hardcoded `leojaime20@gmail.com`, mas a rota `/admin` verifica `role: "admin"` no Firestore. Isso significa que outros admins podem acessar por URL direta, mesmo sem o link aparecer.

### Busca de tags

- Campo de busca com placeholder `Ex.: P-101A, bomba, válvula...`.
- Desabilitada sem login.
- Requer pelo menos 2 caracteres.
- Usa `useDeferredValue` para reduzir consultas imediatas durante digitação.
- Consulta Firestore por prefixo em:
  - `tag` com termo original.
  - `tag` com termo em uppercase.
  - `description` com termo original.
  - `descricao` com termo original.
- Cada consulta tem limite de 25 documentos.
- Resultados são deduplicados por ID.
- Falhas parciais de uma consulta não quebram a busca inteira porque `Promise.allSettled` descarta apenas as consultas rejeitadas.

### Seleção de tag

- Ao selecionar um resultado, o campo recebe o valor da TAG.
- O dropdown fecha.
- O contexto da tag selecionada é carregado:
  - documento de região por `regionId`;
  - URLs dos PDFs da região;
  - calibrações normalizadas.

### Resumo da tag

Exibe:

- TAG.
- Descrição.
- Região.
- X.
- Y.
- Z.
- Status.
- Tipo.

O resumo pode ser recolhido e expandido.

### Viewer de planta e lateral

- Desktop: mostra planta e lateral em duas colunas.
- Mobile: mostra uma vista por vez com controle segmentado "Planta" / "Lateral".
- Cada painel indica se o PDF está vindo do Firebase Storage ou se ainda não foi configurado.
- Com PDF configurado, renderiza via EmbedPDF.
- Sem PDF configurado, mostra placeholder com grade e ainda tenta desenhar o marcador.
- O marcador aparece apenas se houver tag e região.
- O marcador é renderizado só na primeira página do PDF.

### Controles do viewer

- Zoom menos.
- Exibição do percentual de zoom.
- Zoom mais.
- Reset.
- Centralizar.
- Tela cheia.

Regras atuais:

- Zoom mínimo: `0.5`.
- Zoom máximo: `3`.
- Incremento/decremento: `0.15`.
- Reset volta zoom e pan para valores padrão.
- Centralizar atualmente apenas zera `panX` e `panY`; não calcula centralização real baseada na posição do marcador.
- Não há arrasto/pan por mouse implementado na store; o canvas usa scroll nativo do container.

### Administração de regiões

- Exige login e perfil admin.
- Campo de ID da região.
- Campo de nome da região.
- Carrega região existente se houver documento em `regions/{regionId}`.
- Se a região existir, hidrata o formulário com os dados do Firestore.
- Se a região não existir, mantém o formulário atual/default e permite salvar como novo documento.
- Salva região com `setDoc(..., { merge: true })`, preservando campos não sobrescritos no documento.
- Atualiza `updatedAt` com timestamp do servidor.

### Upload de PDFs

- Admin escolhe arquivo PDF para planta ou lateral.
- O arquivo é enviado para:
  - planta: `pdfs/{regionId}-planta.pdf`
  - lateral: `pdfs/{regionId}-lateral.pdf`
- O upload força metadata `contentType: "application/pdf"`.
- Após upload, a função obtém `getDownloadURL` para validar disponibilidade, mas retorna e grava no formulário apenas o path do Storage.
- O usuário ainda precisa salvar a região para persistir o caminho no Firestore.

### Calibração

- Tela admin expõe dois pontos conhecidos por vista.
- Cada ponto permite editar `realX`, `realY`, `pdfX`, `pdfY`.
- Na planta, o app usa `tag.x` e `tag.y`.
- Na lateral, o app usa `tag.x` e `tag.z`.
- A transformação calcula escala independente em X e Y:
  - `scaleX = (pdfX2 - pdfX1) / (realX2 - realX1)`
  - `scaleY = (pdfY2 - pdfY1) / (realY2 - realY1)`
- A translação base posiciona o primeiro ponto real no primeiro ponto PDF.
- `translateX` e `translateY`, se existirem no documento, são somados.
- `rotationDeg`, se existir, é aplicado em radianos.
- Se os pontos forem ausentes ou degenerados (`realX` igual ou `realY` igual entre os dois pontos), usa fallback:
  - escala `calibration.scale ?? 1`;
  - translação opcional;
  - rotação opcional.

## Fluxos do usuário detalhados

### Usuário comum autorizado localiza uma tag

1. Acessa a URL da aplicação.
2. Clica em "Entrar com Google".
3. Escolhe uma conta Google.
4. Se o e-mail existir em `authorizedUsers`, as leituras de Firestore funcionam.
5. Digita parte da TAG ou descrição.
6. Aguarda resultados no dropdown.
7. Clica em uma tag.
8. Confere resumo de descrição, região, coordenadas, status e tipo.
9. Observa o marcador na planta e na lateral.
10. Ajusta zoom ou usa tela cheia conforme necessário.

### Usuário não autenticado

1. Acessa a aplicação.
2. Vê botão "Entrar com Google".
3. Campo de busca fica desabilitado.
4. Mensagem principal informa que precisa entrar com Google para buscar tags no Firestore.

### Usuário autenticado mas não autorizado

1. Consegue autenticar via Google.
2. A UI principal habilita a busca porque há `user`.
3. Ao buscar, as regras Firestore negam leitura se não existir `authorizedUsers/{email}`.
4. O componente de busca mostra "Nenhuma tag encontrada" quando as consultas falham, porque as rejeições são descartadas por `Promise.allSettled`.
5. Não há mensagem explícita de "sem autorização" na busca principal.

### Admin cadastra ou edita região

1. Entra com Google.
2. Acessa `/admin`.
3. O app consulta `authorizedUsers/{email}`.
4. Se `role` for `admin`, o formulário aparece.
5. Informa ou altera o ID da região.
6. Se já existir documento, o formulário é preenchido após a consulta.
7. Ajusta nome, caminhos/PDFs e calibrações.
8. Clica em "Salvar região".
9. O Firestore recebe `name`, `plantPdf`, `sidePdf`, `plantCalibration`, `sideCalibration` e `updatedAt`.

### Admin sobe PDFs

1. Na tela admin, define o ID da região.
2. Seleciona arquivo em "PDF Planta" ou "PDF Lateral".
3. O upload grava no Storage conforme o padrão de path.
4. O caminho aparece no cartão do PDF.
5. Admin salva a região para persistir o path no Firestore.

### Admin calibra planta/lateral

1. Identifica dois pontos conhecidos no desenho.
2. Preenche coordenadas reais e coordenadas correspondentes do PDF para planta.
3. Preenche coordenadas reais e coordenadas correspondentes do PDF para lateral.
4. Na lateral, interpreta `realY` como `z`.
5. Salva região.
6. Volta para a busca e valida uma tag conhecida.

## Regras de negócio explícitas

- É preciso estar autenticado para tentar buscar tags pela UI.
- É preciso estar em `authorizedUsers` para ler `tags`, `regions` e `calibrations` no Firestore.
- É preciso ter `role: "admin"` para escrever `tags`, `regions`, `calibrations` e `authorizedUsers`.
- O documento de usuário autorizado deve ter ID igual ao e-mail.
- Região conecta tags a PDFs e calibrações via `regionId`.
- Planta usa coordenadas reais `x` e `y`.
- Lateral usa coordenadas reais `x` e `z`.
- Busca exige no mínimo 2 caracteres.
- Busca retorna no máximo 25 resultados por campo consultado, deduplicados por ID.
- PDFs são armazenados por padrão em `pdfs/{regionId}-planta.pdf` e `pdfs/{regionId}-lateral.pdf`.
- Upload de PDF não salva automaticamente o documento de região; é necessário salvar a região.
- O marcador só é exibido quando há tag selecionada e calibração/região disponível.

## Regras de negócio implícitas

- TAGs deveriam ter valores normalizados em maiúsculas para maximizar acerto, porque a busca só tenta termo original e uppercase para o campo `tag`.
- Descrições não têm normalização de caixa; busca por descrição pode ser sensível à ordenação/case do Firestore.
- O sistema assume que todos os PDFs relevantes podem ser representados pelo mesmo sistema visual do marcador `1000 x 500` ou por calibração compatível com esse sistema.
- A primeira página do PDF é a página onde o marcador deve aparecer.
- `regionId` ausente significa região `default`.
- Coordenadas ausentes viram `0`, o que pode posicionar marcador no canto sem indicar erro de dado.
- `status` ausente significa `unknown`, não bloqueia exibição.
- `type` ausente significa `Equipamento`, não bloqueia exibição.
- O acesso administrativo real é controlado pelo Firestore, mas a visibilidade do link administrativo na home está hardcoded para `leojaime20@gmail.com`.
- Qualquer usuário autenticado consegue ler PDFs no Storage se souber/obtiver o path, mesmo que não seja autorizado no Firestore.

## Casos de borda tratados

- Usuário ainda não carregado: UI mostra estados de verificação/autenticação.
- Usuário não logado: busca desabilitada e admin informa necessidade de login.
- Termo curto: busca não executa antes de 2 caracteres.
- Consultas parciais falhando na busca: resultados de consultas bem-sucedidas ainda são retornados.
- Tags duplicadas entre consultas: deduplicação por ID.
- Região sem ID: retorna região fallback.
- Região inexistente ao selecionar tag: retorna fallback com nome igual ao `regionId` e PDFs vazios.
- Caminho de PDF vazio: retorna `null` e viewer mostra placeholder.
- Caminho de PDF já é URL HTTP(S): usa a URL diretamente, sem Storage.
- Falha ao resolver URL de PDF: `buildSelectedTagContext` captura por PDF e usa `null`.
- Engine PDF carregando: mostra placeholder "Carregando engine PDF...".
- Erro na engine PDF: mostra "PDF indisponível.".
- Erro ao abrir PDF: mostra "Falha ao abrir PDF." e detalhe quando disponível.
- Pontos de calibração ausentes ou degenerados: usa escala/translação/rotação fallback.
- Mobile: evita duas colunas apertadas usando alternância de vistas.
- Fullscreen: usa optional chaining para não quebrar se `requestFullscreen` não existir.

## Casos de borda não tratados ou tratados parcialmente

- Usuário autenticado mas sem autorização recebe experiência ambígua na busca: consultas negadas podem aparecer como "Nenhuma tag encontrada".
- Não há validação de que upload selecionado é realmente PDF além do `accept` no input e content type enviado.
- Não há validação de tamanho máximo de PDF.
- Não há validação de campos obrigatórios no formulário admin antes de salvar.
- Não há validação de formato do `regionId`.
- Não há validação para impedir `regionId` vazio no upload; a query de região é desabilitada, mas o botão/upload não tem bloqueio explícito baseado nisso.
- Não há UI para criar/editar tags; inserção é manual no Console ou por import externo não incluído.
- Não há UI para gerenciar usuários autorizados.
- Não há feedback visual detalhado para falha de upload ou falha de salvamento.
- Não há testes automatizados no repositório.
- Não há observabilidade, logs estruturados ou tracking de erros.
- Não há paginação ou busca avançada.
- Não há ranking de resultados; resultados são união das consultas por prefixo.
- Não há busca case-insensitive completa.
- Não há suporte explícito a acentos/normalização textual.
- O marcador é desenhado apenas na primeira página do PDF.
- O SVG de marcador usa `viewBox="0 0 1000 500"` fixo, independente do tamanho real de página informado pelo PDF.
- O botão "Centralizar" não centraliza no marcador; apenas reseta pan.
- Não há pan por drag implementado.
- `lateral.x` do formato legado é ignorado se `x` geral estiver ausente; o normalizador usa `planta.x` como fallback de `x`.
- Campos `deck` e `area` existem nos dados de exemplo, mas não aparecem na UI nem no tipo final `EquipmentTag`.
- Storage permite leitura de PDFs para qualquer usuário autenticado, mais amplo que a regra de leitura de tags/regiões.
- `js/firebase-config.js` contém config real fora do sistema Vite atual, possivelmente legado.
- As chaves de config Firebase públicas aparecem como fallback no código. Isso é comum em apps Firebase client-side, mas o projeto depende integralmente das regras para segurança.

## Configuração e variáveis de ambiente

### Variáveis Vite Firebase

`src/services/firebase/config.ts` lê:

| Variável | Fallback atual |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIzaSyAV6spTj7ssqy9XfyTSTD-Jx2jx7ojeAH4` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `loctag-p84-p85.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `loctag-p84-p85` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `loctag-p84-p85.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `495538846299` |
| `VITE_FIREBASE_APP_ID` | `1:495538846299:web:088fcc2cec2de71d2a5d7e` |

### Variáveis de build

| Variável | Uso |
|---|---|
| `GITHUB_PAGES=true` | Faz `vite.config.ts` usar `base: "/LocTag/"` no build. |

### Firebase Console

Segundo `README.md`, o projeto Firebase é:

- Project ID: `loctag-p84-p85`.
- Firestore `(default)`, região `asia-east2`.
- Web App: `LocTag P84 P85`.
- Usuário autorizado inicial: `leojaime20@gmail.com`.

Configurações operacionais citadas:

- Provisionar Firebase Storage pelo Console antes de publicar rules.
- Ativar provider Google em Authentication > Sign-in method.
- Adicionar `leojaime20.github.io` em Authentication > Settings > Authorized domains.

### Scripts

| Script | Função |
|---|---|
| `npm run dev` | Inicia Vite em desenvolvimento. |
| `npm run build` | Executa `tsc -b` e `vite build`. |
| `npm run preview` | Serve build local via Vite preview. |
| `npm run lint` | Executa ESLint. |
| `npm run format` | Aplica Prettier. |
| `npm run format:check` | Verifica formatação. |

## Integrações externas

- **Firebase Authentication**: login Google e sessão do usuário.
- **Cloud Firestore**: coleções `authorizedUsers`, `tags`, `regions` e regra existente para `calibrations`.
- **Firebase Storage**: armazenamento e download de PDFs em `pdfs/`.
- **EmbedPDF/Pdfium**: renderização client-side dos PDFs.
- **GitHub Pages**: hospedagem estática da SPA.
- **GitHub Actions**: build e deploy automático para Pages.
- **TanStack Query**: cache e estado de consultas remotas.
- **Zustand**: estado client-side dos viewers.
- **Tailwind CSS via plugin Vite**: utilitários CSS e estilos globais.

## Limitações conhecidas

- Não há backend próprio para validações complexas, auditoria ou processamento assíncrono.
- Não há CRUD completo de tags na UI.
- Não há CRUD de usuários autorizados na UI.
- Não há importador formal para `data/tags.json`.
- Não há testes unitários, integração ou e2e.
- Não há monitoramento de erros em produção.
- Não há versionamento de regiões, PDFs, calibrações ou tags.
- Não há histórico/auditoria de alterações administrativas.
- Não há suporte explícito a múltiplas páginas de PDF para marcador.
- A calibração por dois pontos não cobre distorções, rotação complexa, múltiplas escalas por área ou desenhos não lineares.
- A busca por prefixo em Firestore é simples e pode não atender busca textual avançada.
- O limite de resultados pode omitir itens relevantes sem paginação.
- A experiência para usuário sem autorização é pouco clara.
- A política de Storage é mais permissiva que Firestore para leitura.
- Admin link hardcoded para um e-mail específico pode divergir dos papéis reais no Firestore.

## Funcionalidades planejadas e TODOs encontrados

Não foram encontrados comentários `TODO`, `FIXME`, `XXX`, `HACK`, `@todo`, `planned`, `planejado` ou `future/futuro` no código e documentos pesquisados.

Possíveis funcionalidades planejáveis inferidas pelas lacunas do produto:

- CRUD/importação de tags pela UI.
- CRUD de usuários autorizados.
- Busca mais robusta, com normalização de caixa/acentos, paginação e filtros por região, tipo, status, deck e área.
- Exibição dos campos `deck` e `area`.
- Validação de formulário admin.
- Feedback detalhado de erro para permissão, upload, salvamento e abertura de PDFs.
- Centralização real do marcador.
- Pan por arrasto e melhor navegação no PDF.
- Suporte a marcadores em páginas específicas.
- Auditoria/versionamento de alterações em regiões, PDFs e calibrações.
- Observabilidade de erros client-side.
- Testes automatizados.

## Perguntas para o Product Owner antes de considerar o produto completo

### Regras de negócio

1. Uma TAG pode existir em mais de uma região ou deve ser globalmente única?
2. O ID do documento em `tags` deve obrigatoriamente ser igual ao campo `tag`?
3. Quais status são válidos além de `active`, `inactive` e `unknown`?
4. O que deve acontecer com tags inativas: aparecer na busca, aparecer com aviso ou ser ocultada?
5. `deck` e `area` fazem parte do modelo oficial? Devem ser exibidos e filtráveis?
6. Uma região sempre tem exatamente dois PDFs, planta e lateral, ou pode ter mais vistas?
7. A lateral sempre usa `x` e `z`? Existem desenhos que usam outro eixo ou referência?
8. O marcador deve aparecer em qual página quando o PDF tiver múltiplas páginas?
9. O que define uma calibração válida e quem é responsável por aprová-la?
10. O sistema precisa suportar revisão ou aprovação antes de publicar mudanças administrativas?

### Experiência do usuário

11. Usuários sem autorização devem receber uma mensagem clara de acesso negado?
12. A busca deve aceitar erros de digitação, busca por contains, acentos e case-insensitive real?
13. O usuário precisa filtrar por região, sistema, área, deck, tipo ou status?
14. O resultado deve mostrar mais metadados antes da seleção?
15. O marcador deve ser centralizado automaticamente após selecionar uma tag?
16. O app deve lembrar a última tag pesquisada ou histórico de buscas?
17. Deve existir modo de compartilhamento de link direto para uma tag?
18. O viewer precisa de download, impressão, medição ou anotações?

### Segurança e permissões

19. Usuários autenticados mas não autorizados devem conseguir ler PDFs no Storage?
20. Admins devem ser separados por permissões, por exemplo gerenciar tags, gerenciar PDFs e gerenciar usuários?
21. Como será feito o primeiro cadastro de admin sem depender de edição manual no Console?
22. Deve haver bloqueio por domínio de e-mail?
23. É necessário registrar quem alterou uma região, PDF ou calibração?
24. As regras devem validar schema e tipos de documentos no Firestore?
25. Os PDFs podem conter informação sensível que exige controles mais rígidos?

### Versionamento

26. Tags, regiões, PDFs e calibrações precisam ter histórico de versões?
27. Deve ser possível reverter para uma calibração anterior?
28. A troca de PDF deve invalidar ou revisar a calibração automaticamente?
29. Como identificar qual versão do desenho técnico está sendo exibida?
30. O usuário final precisa ver data de atualização do desenho ou da tag?

### Escalabilidade

31. Qual volume esperado de tags: centenas, milhares ou milhões?
32. A busca por prefixo em Firestore será suficiente para o volume esperado?
33. Será necessário usar Algolia, Typesense ou outro motor de busca?
34. Quantas regiões e PDFs podem existir?
35. Qual tamanho médio e máximo dos PDFs?
36. O app precisa funcionar bem em conexões lentas ou tablets embarcados?
37. Deve haver cache offline ou suporte PWA?

### Manutenção

38. Quem vai cadastrar tags e como os dados serão importados de fontes oficiais?
39. Qual é a fonte de verdade das coordenadas?
40. Existe processo para validar coordenadas antes de publicar?
41. Como lidar com dados legados (`descricao`, `sistema`, `planta`, `lateral`) no longo prazo?
42. A configuração Firebase deve continuar com fallback hardcoded ou migrar para `.env` obrigatório?
43. Os arquivos `js/firebase-config.js` e SVGs em `assets/` ainda são necessários?

### Observabilidade

44. Quais erros devem ser monitorados em produção?
45. É necessário registrar busca de tags para entender uso?
46. Há métricas desejadas, como tempo até localizar TAG ou taxa de PDF indisponível?
47. Quem recebe alerta se Storage, Firestore ou Auth falhar?
48. Logs de auditoria precisam ser consultáveis pela equipe?

### Recuperação de falhas

49. O que o usuário deve ver quando Firestore negar permissão?
50. O que o usuário deve ver quando um PDF não existir no Storage?
51. Deve existir fallback para PDF anterior se o upload novo falhar?
52. Como recuperar região/calibração apagada ou corrompida?
53. Há rotina de backup para Firestore e Storage?
54. O app precisa degradar para modo somente dados quando o PDF falhar?
55. Como garantir que upload de PDF e salvamento da região não fiquem inconsistentes?
