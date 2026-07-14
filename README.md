# LocTag

Aplicação React/TypeScript para localizar tags de equipamentos sobre desenhos técnicos em PDF.

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
- Dados iniciais: 15 documentos em `tags`, 1 documento em `regions`
- Usuário autorizado inicial: `leojaime20@gmail.com`

Firestore já está com regras publicadas. Storage ainda precisa ser provisionado uma vez no Console:

1. Abra [Firebase Storage](https://console.firebase.google.com/project/loctag-p84-p85/storage).
2. Clique em **Get Started**.
3. Depois rode:

```bash
firebase deploy --only storage --project loctag-p84-p85
```

Também falta ativar o provider:

1. Abra **Authentication > Sign-in method**.
2. Ative **Google**.
3. Em **Authentication > Settings > Authorized domains**, adicione `leojaime20.github.io`.

## Modelo de Dados

`regions`

```ts
{
  id: string;
  name: string;
  plantPdf: string;
  sidePdf: string;
  plantCalibration: Calibration;
  sideCalibration: Calibration;
}
```

`tags`

```ts
{
  id: string;
  tag: string;
  description: string;
  regionId: string;
  x: number;
  y: number;
  z: number;
  type: string;
  status: string;
}
```

`authorizedUsers`

O ID do documento deve ser o e-mail completo do usuário autorizado.

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
- Cada viewer mantém estado independente de zoom/pan em Zustand.
