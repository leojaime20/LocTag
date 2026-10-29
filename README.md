# LocTag 2.0

Aplicação React/TypeScript para localizar tags de equipamentos sobre desenhos técnicos em PDF.

Manual simples de busca e compartilhamento, com capturas no formato de celular:
[PDF](output/pdf/loctag-manual-celular.pdf) · [Versão em texto](docs/manual-usuario.md).

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- EmbedPDF headless components
- Firebase Authentication, Firestore e Storage
- TanStack Query
- React Router
- Zustand
- ESLint + Prettier

## Firebase

Projeto criado:

- Project ID: `loctag-p84-p85`
- Firestore: `(default)`, região `asia-east2`
- Web App: `LocTag P84 P85`
- A base de produção contém TAGs e PDFs regionais anteriores, preservados pela versão 2.0.
- O exemplo ilustrativo usa a região `EXEMPLO-NAVIO` e quatro TAGs `DEMO-*`.
- Consulta pública de TAGs, regiões e PDFs, sem login ou cadastro prévio. Login com e-mail e senha ou Google é necessário apenas na administração.

## Projetos e modelo de dados

A tela inicial permite escolher o projeto. **P84** é o projeto inicial e continua lendo e gravando nas coleções e nos PDFs existentes, sem migração dos dados. Projetos adicionais são cadastrados pelo administrador master e usam `projects/{id}/tags`, `regions`, `settings` e `drawingRevisions`, além de PDFs em `projects/{id}/pdfs/`. A busca, os desenhos e o CSV são isolados por projeto.

- `settings/globalDrawings` (ou `projects/{id}/settings/globalDrawings`): dois PDFs, página, calibrações e zoom.
- `drawingRevisions`: histórico das configurações globais.
- `regions`: nome e limites XYZ em metros.
- `tags`: TAGs e metadados opcionais.
- `authorizedUsers/{email}`: `role: "admin"` e `projectIds: ["p84", "p85"]` concedem administração apenas aos projetos listados. Perfis antigos sem `projectIds` continuam administrando apenas P84. Uma lista vazia revoga o acesso administrativo.
- O e-mail `leojaime20@gmail.com` é o administrador master nas regras do Firestore e Storage. Apenas ele pode criar projetos e definir permissões. A conta precisa existir no Firebase Authentication.

A consulta continua pública; apenas a administração requer login. Publique **as regras do Firestore e do Storage antes da interface nova**: `firebase deploy --only firestore:rules,storage --project loctag-p84-p85`. O aplicativo não altera nem copia os documentos atuais de P84 durante a atualização.

A configuração, calibração, migração, reversão, regras espaciais e CSV estão em [docs/admin-cadastro.md](docs/admin-cadastro.md).
O cadastro do exemplo de produção está em [docs/exemplo-producao.md](docs/exemplo-producao.md).

## Desenvolvimento

```bash
npm install
npm run dev
```

## Administração

O passo a passo para cadastrar PDFs, calibrar as vistas e inserir coordenadas/tags está em:

[docs/admin-cadastro.md](docs/admin-cadastro.md)

## Validação

```bash
npm run lint
npx playwright install chromium
npm test
npm run build
```

## Publicação

O projeto está configurado para GitHub Pages:

- `vite.config.ts` usa base path `/LocTag/` quando `GITHUB_PAGES=true`.
- A SPA usa `HashRouter`, compatível com GitHub Pages.
- `.github/workflows/deploy.yml` executa `npm ci`, build e deploy automático quando houver push na branch `main`.

## Estrutura

```txt
src/
  components/
  features/
    tags/
    viewer/
  hooks/
  pages/
  services/
    api/
    firebase/
  stores/
  types/
  utils/
```

## Observações

- A busca consulta Firestore com limite e não carrega milhares de tags no cliente.
- Marcadores só aparecem após seleção de uma tag.
- A transformação de coordenadas reais para PDF fica isolada em `src/utils/calibration.ts`.
- Cada visualizador mantém estado independente de zoom e centro em Zustand, com minimapa e renderização por recortes.
- Compartilhamento gera PNG local com Planta e Lateral; usa Web Share quando disponível.
- Publique as regras atualizadas de Firestore antes de ativar os desenhos globais.
- A base existente foi confirmada em metros; não há conversão automática de coordenadas.
