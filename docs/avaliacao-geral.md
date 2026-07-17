# Avaliação geral — LocTag

Avaliação detalhada do projeto em arquitetura, interface, regras de negócio, segurança e qualidade. Nenhum código foi alterado nesta análise.

**Data:** 16 de julho de 2026

---

## Resumo executivo

O projeto é um **MVP bem organizado** para localizar tags em PDFs técnicos (React + Firebase). A estrutura por features, o uso de TanStack Query/Zustand e a busca limitada no Firestore são escolhas sólidas.

Ainda assim, há riscos importantes de segurança, calibração e importação em massa que precisam de atenção antes de um uso mais amplo com desenhos confidenciais.

### Principais riscos

1. **Crítico — Autorização de PDFs ineficaz:** qualquer conta Google autenticada pode ler caminhos previsíveis no Storage; `getDownloadURL()` gera URLs de longa duração.
2. **Alto — Calibração não é independente de resolução:** coordenadas são capturadas em pixels renderizados e podem deslocar o marcador entre viewports.
3. **Alto — Substituição em massa não é atômica:** falhas parciais deixam mistura de tags antigas e novas; CSV vazio pode apagar tudo.
4. **Alto — Race conditions no admin:** região existente pode ser salva com defaults enquanto ainda carrega.
5. **Alto — Dados do Firestore confiados sem validação runtime/schema.**
6. **Alto — Sem testes automatizados nem gate de qualidade no CI.**

---

## O que já funciona bem

- Separação clara: `pages` → `features` → `services` → `utils`
- Busca com `limit(25)` em vez de carregar todas as tags no cliente
- Lazy load de rotas e do viewer PDF
- Documentação operacional útil (`README` + `docs/admin-cadastro.md`)
- TypeScript estrito e deploy automatizado para GitHub Pages
- Firebase access majoritariamente fora dos componentes de apresentação
- Query keys claras; Zustand com seletores estreitos
- Marcadores só após seleção de tag; transformação isolada em `src/utils/calibration.ts`

---

## 1. Arquitetura

### Visão das camadas

| Camada | Papel |
|---|---|
| Bootstrap/routing | `main.tsx` (QueryClient + HashRouter), `App.tsx` (lazy routes) |
| Pages | `TagLocatorPage`, `AdminPage` — orquestração e estado de página |
| Features | `tags`, `viewer`, `admin` — fronteira UI mais forte |
| Hooks | Adaptadores de auth e TanStack Query |
| Services | Firebase (`auth`/`storage`/`config`) e API Firestore (`tags`/`admin`) |
| State | TanStack Query (servidor), Zustand (viewer), React local (forms/seleção) |
| Utils | Calibração e CSV independentes de framework |

### Fluxos principais

**Locator:** auth → busca (4 queries prefix) → seleção → região + URLs Storage → marcador nos PDFs.

**Admin:** perfil em `authorizedUsers` → edição de região → upload PDF → calibração embutida → import/replace de tags.

### Melhorias

| Prioridade | Melhoria |
|---|---|
| **Alta** | Coordenadas de calibração são capturadas em **pixels renderizados** (`CalibrationPdfPicker`), não em espaço do PDF. Mudança de viewport/zoom pode deslocar o marcador — isso afeta a função central do app. |
| **Alta** | Dados do Firestore são normalizados com defaults silenciosos (`normalizeTag`/`normalizeRegion`): coordenada ausente vira `0`, região ausente vira `default`. Erros de dados ficam invisíveis. |
| **Alta** | Substituição de tags (`replaceAllTags`) não é atômica: batches de 450 writes, sem versionamento nem rollback. |
| **Média** | `AdminPage` (~425 linhas) concentra ACL, upload, formulário, calibração e status — propenso a races (ex.: salvar região enquanto ainda carrega). |
| **Média** | Setup do EmbedPDF duplicado entre viewer e calibrador. |
| **Média** | Coleção `calibrations` nas rules existe, mas o modelo real embute calibração em `regions` — drift de modelo. |
| **Baixa** | Serviços Firebase são singletons globais; dificulta testes e ambientes (staging/emulator). |
| **Baixa** | Estado `panX`/`panY` no Zustand nunca é alterado de fato; “Centralizar” é praticamente no-op. |

### Direção sugerida

- Schemas em runtime na borda Firestore
- Coordenadas em user-space do PDF (com `pageIndex`)
- Import como “versão de dataset” publicável atomicamente
- Fatiar o admin em editores menores
- Infra compartilhada de PDF (engine/plugins/coordenadas)
- Remover ou implementar de fato a coleção top-level `calibrations`

---

## 2. Interface / UX

### Acessibilidade

**Pontos positivos:** alvos de toque ~44px, labels visíveis, `focus-visible`, labels em botões de zoom.

**Lacunas:**

- Busca sem roles de combobox/listbox, setas, Escape, `aria-expanded`
- Status assíncronos sem `aria-live` / `role="alert"`
- Input CSV oculto com `display:none` pouco usável por teclado
- Tabela sem `caption` / `scope`
- Marcador SVG `aria-hidden` sem anúncio equivalente
- Calibração por clique sem caminho de teclado
- Animação do marcador sem `prefers-reduced-motion`

### Busca

- Falha de backend aparece como “nenhuma tag encontrada”
- Match exato não é priorizado
- Dropdown não fecha com clique fora / Escape
- Prefix-only pouco explicado ao usuário
- Resultados e seleção podem permanecer após logout
- Sem filtros por região/tipo/status nem histórico recente

### Viewer

- “Centralizar” não usa a posição do marcador
- Nova seleção não reseta zoom/scroll nem centraliza
- CSS `zoom` externo (risco de blur / scroll aninhado)
- Vista mobile oculta continua montada e carrega PDF
- Marcador só na página 0
- Falha Storage/rede mostrada como “PDF ainda não configurado”
- Fullscreen sem feedback de erro

### Admin

- Region ID free-text consulta a cada tecla
- Loading da região não trava o editor
- Sem dirty-state / aviso de navegação
- Upload sobrescreve objeto Storage imediatamente
- Calibração sem score de validação nem preview de pontos de teste
- Replace total sem diff, backup ou confirmação tipada
- Tabela limita 200 linhas no DOM, sem paginação real
- Link **Administração** hardcoded para um e-mail; outros `role=admin` não veem o acesso

### Mobile

- Ambos PDFs montam mesmo com uma vista oculta
- Controles do viewer pedem scroll horizontal
- Calibração com altura fixa ~520px (orientação desktop)
- Tabela admin com min-width alto

### Melhorias

| Prioridade | Melhoria |
|---|---|
| **Alta** | Bloquear edição/salvamento de região enquanto `regionQuery` carrega — hoje dá para sobrescrever com defaults. |
| **Alta** | Ao selecionar tag, centralizar/scrollar até o marcador (API do EmbedPDF); limpar seleção e cache ao logout. |
| **Média** | Busca acessível (combobox completo); distinguir erro de rede de zero resultados. |
| **Média** | Import CSV: diff, backup, confirmação tipada, aviso de CSV vazio, progresso por chunk. |
| **Média** | Expor navegação admin por `role=admin`, não por e-mail hardcoded. |
| **Média** | Distinguir PDF não configurado, sem permissão, offline e corrompido. |
| **Baixa** | `prefers-reduced-motion`, semântica de tabela, seleção de arquivo por teclado. |

### Nota visual

A UI é funcional (slate/blue, cards), mas genérica. Para um app operacional isso é aceitável; para produto final, falta hierarquia mais forte e menos “dashboard de cards”.

---

## 3. Regras de negócio

### Calibração

- `buildTransform` resolve escala + translação eixo a eixo com 2 pontos
- Não modela bem rotação, skew, perspectiva ou frames diferentes
- `rotationDeg` existe no modelo, mas a fórmula aplica rotação depois da translação de forma inconsistente; a UI admin não expõe rotação
- Se dois pontos compartilham o mesmo X ou Y real, **ambos** os eixos caem no fallback
- Sem validação de pontos iguais, deltas ~0, NaN, escala implausível, residual
- Coordenadas capturadas do `width`/`height` renderizado — viewport-dependent
- Multi-página: hardcoded `pageIndex === 0`

### Busca de tags

- Até 4 queries prefix por termo (`tag` original/upper, `description`, `descricao`)
- Case-sensitive no Firestore; descrição só na casing digitada
- Sem normalização de acentos / substring / relevância
- Tags `inactive` retornam igual às `active`
- Merge pode chegar a ~100 resultados; falhas parciais viram lista vazia via `allSettled`
- `useDeferredValue` não é debounce fixo — muitas leituras em digitação rápida

### CSV e replace-all

- CSV só com header válido → zero tags → UI permite substituir → apaga a coleção
- Export quoteia newlines; parser split por linha física — round-trip quebra
- `Number('')` / espaços → `0` passa validação
- Status inválido vira `unknown` sem erro
- Falta: IDs duplicados, tags case-insensitive, existência de `regionId`, bounds, tamanho máximo, CSV vazio bloqueado
- `replaceAllTags`: upsert chunks → depois deletes; não atômico; sem rollback; UI sem diff

### Região

- Reset do form ao mudar ID + save habilitado durante load → overwrite com defaults
- Upload completion pode atualizar form errado se o ID mudou no meio
- Sem validação de ID/nome; ID vazio ou com `/` cria path Storage fora do match esperado
- Upload sobrescreve objeto previsível antes de salvar a região
- Região ausente → fallback com calibração identidade (mascara referência quebrada)

### Status

- `active` / `inactive` / `unknown` sem efeito comportamental
- `unknown` mistura dado faltante, malformado e estado genuinamente desconhecido

### Melhorias

| Prioridade | Melhoria |
|---|---|
| **Alta** | Substituir o solver de calibração por transform affine/similarity consistente, com pontos não colineares e validação de residual. |
| **Alta** | Validar geometria antes de salvar (pontos degenerados, valores não finitos, escala, projeção fora da página). |
| **Alta** | Impedir replace vazio por padrão; tornar import recuperável (versão anterior). |
| **Alta** | Parser CSV standards-compliant (campos multilinha). |
| **Alta** | Validar IDs, unicidade case-insensitive, existência de região, ranges e status estrito. |
| **Média** | Definir comportamento de tags inactive (ocultar, avisar ou filtrar). |
| **Média** | Normalizar campos de busca na escrita (tokens) ou serviço de search. |
| **Média** | Tratar região ausente como erro de integridade, não fallback silencioso. |
| **Baixa** | Preservar ou migrar deliberadamente `deck` / `area` do modelo legado. |

---

## 4. Segurança

### Score das rules: 1/5 — mismatch crítico de autorização

**Pontos positivos:**

- Documentos Firestore sem match são negados por padrão
- Usuários comuns não escrevem tags/regions/calibrations/ACL
- Usuário só lê o próprio `authorizedUsers/{email}`
- Admin vem de documento Firestore existente

### Achados

| Prioridade | Achado |
|---|---|
| **Crítica** | Storage: leitura de PDFs exige só `request.auth != null`, **não** membership em `authorizedUsers`. Qualquer conta Google autenticada que adivinhe `pdfs/{regionId}-planta.pdf` lê o desenho. Paths previsíveis estão documentados publicamente. |
| **Crítica** | `getDownloadURL()` gera URL com token de longa duração — continua válida após logout até revogação/substituição do objeto. |
| **Alta** | Rules do Firestore não validam schema (tipos, status, geometria, paths). |
| **Alta** | Storage não restringe tamanho, content-type real, formato de nome, create vs update. |
| **Alta** | ACL por e-mail (não UID), sem `email_verified`; e-mail hardcoded em UI e em `storage.rules`. |
| **Média** | Sem App Check; config Firebase com fallback de produção no código. |
| **Média** | Cache do React Query / tag selecionada persistem após logout. |
| **Baixa** | Config Firebase duplicada em `js/`; pasta `js` fora do lint. |

### Nota sobre API key

A API key do Firebase web **não é segredo** — é esperado enviá-la ao browser. O problema real é o fallback silencioso para produção e a ausência de restrições/App Check documentadas.

---

## 5. Modelo de dados

### Fortalezas

- Tags compactas para o caminho principal de lookup/display
- Calibração colocada com referências de PDF da região (1 read)
- `x/y/z` top-level mais simples que o shape legado aninhado
- Status com domínio nominal fechado
- `regionId` evita duplicar PDFs/calibração em cada tag

### Fraquezas

**Tags:** `id` e `tag` podem divergir; sem unicidade enforced; sem integridade referencial de `regionId`; sem unidades/CRS; sem auditoria (`createdAt`/`updatedBy`); `type` texto livre; status não enforced nas rules; assume projeção lateral X/Z.

**Regions:** exatamente 1 planta + 1 lateral; sem revisão de desenho, checksum, page count, units; substituir PDF muta a mesma região; missing → fallback.

**Calibration:** `id`/`pdfId` pouco usados; sem page number; sem crop-box/dimensões; sem units/CRS; sem solver version / residual; points podem ser malformados; rules da coleção top-level `calibrations` estão “mortas” frente ao modelo embutido.

**authorizedUsers:** e-mail como identidade (não UID); sem active/disabled/expiry; só `admin` vs implícito `user`; sem revogação de URLs já emitidas; sem proteção de “último admin”.

---

## 6. Performance

### Positivo

- Pages e surface PDF lazy-loaded
- Busca com limites
- EmbedPDF virtualiza páginas visíveis
- Tabela admin capada em 200 linhas no DOM
- Seletores Zustand estreitos

### Preocupações

- Até 4 queries Firestore por termo; sem debounce fixo
- Contexto selecionado cacheado por tag ID (não por região) → refetch repetido da mesma região/URLs
- Replace de tags invalida search mas não o contexto selecionado
- PDFs em `mode: 'full-fetch'`; desktop monta 2 viewers; mobile monta ambos mesmo ocultos
- `usePdfiumEngine` por painel (e no calibrador mesmo sem PDF)
- `getAllTags` lê a coleção inteira
- Sem bundle analyzer / size budget (PDFium + EmbedPDF dominam o payload)

---

## 7. Qualidade / DevOps

### Testes

Não há framework de teste nem scripts de test no `package.json`.

Cobertura mínima recomendada:

- Transformações de calibração e pontos degenerados
- Normalização de coordenadas entre viewports
- CSV (quotes, multilinha, blanks, IDs duplicados, import vazio)
- Falha parcial de batch / recovery
- Busca (casing, falhas parciais)
- Limpeza de cache no logout
- Races de load/upload no admin
- Firestore/Storage Rules no Emulator
- Acessibilidade da busca
- E2E: login → busca → viewer → admin import

### CI/CD

Workflow atual: `npm ci` → build → deploy GitHub Pages.

Faltam:

- lint / format-check
- testes unitários / rules / E2E
- dependency scanning
- bundle-size budget
- staging / preview
- deploy coordenado de Firebase Rules/indexes/Storage
- pin de Actions por SHA
- falha de build se env Firebase não estiver definido (hoje cai no fallback de produção)

---

## Priorização sugerida

1. **Corrigir Storage + download URLs** (acesso aos PDFs).
2. **Calibração em coordenadas estáveis do PDF** + validação geométrica.
3. **Import seguro** (não apagar com CSV vazio; parser robusto; versionamento/rollback).
4. **Travar races no admin** (load/save/upload).
5. **Validação runtime + rules de schema**.
6. **Testes mínimos** (calibração, CSV, rules) e gate no CI.
7. **UX de busca/viewer/admin** e papel de admin dinâmico.

---

## Referências de código citadas na análise

| Área | Arquivos |
|---|---|
| Calibração | `src/utils/calibration.ts`, `src/features/admin/CalibrationPdfPicker.tsx` |
| Busca / contexto | `src/services/api/tags.ts`, `src/hooks/useTagSearch.ts`, `src/hooks/useSelectedTagContext.ts` |
| Admin / replace | `src/services/api/admin.ts`, `src/pages/AdminPage.tsx`, `src/features/admin/TagDataManager.tsx` |
| CSV | `src/utils/csv.ts` |
| Normalização | `src/types/firebase.ts`, `src/types/domain.ts` |
| Auth UI | `src/pages/TagLocatorPage.tsx`, `src/components/AuthStatus.tsx` |
| Rules | `firestore.rules`, `storage.rules` |
| Deploy | `.github/workflows/deploy.yml` |
| Docs | `README.md`, `docs/admin-cadastro.md` |
