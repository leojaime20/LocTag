# LocTag 2.0 — configuração e operação

## Acesso

A consulta de dados e PDFs é pública, sem login ou cadastro prévio. Para administrar, acesse o link "Administração" e entre com Google usando um usuário cadastrado em `authorizedUsers/{email}` com `role: "admin"`. As regras do Firestore continuam restringindo a edição a administradores independentemente da interface.

Antes de publicar esta versão, publique as regras atualizadas, que acrescentam `settings` e `drawingRevisions`:

```sh
firebase deploy --only firestore:rules --project loctag-p84-p85
```

O deploy e o exemplo de produção são descritos em [exemplo-producao.md](exemplo-producao.md).

## Unidades e referencial

O responsável pela base confirmou em 14/10/2026 que X, Y e Z estão em **metros**. Os valores existentes não foram convertidos. Planta usa X/Y; Lateral usa X/Z. Todos os limites de região também são em metros.

U/V são coordenadas da página exibida pelo Pdfium, em pontos de página (não pixels de tela). A origem é o canto superior esquerdo da área efetiva da página; U cresce para a direita, V para baixo. A rotação nativa e o CropBox do PDF são aplicados pelo Pdfium. O aplicativo abre com `normalizeRotation: false` e renderiza com rotação adicional zero, evitando aplicar a rotação duas vezes. A página escolhida, dimensões e rotação nativa são salvas junto à calibração.

Calibração, navegação, minimapa e exportação usam o mesmo referencial. A conversão tela/página usa a área efetivamente exibida e o tamanho atual do painel. As tolerâncias dos resíduos são em **pontos PDF**, não em metros ou pixels de tela.

Implementação verificada contra os tipos e o código instalado do EmbedPDF 2.14.4 e sua [documentação de renderPageRect](https://www.embedpdf.com/docs/engines/rendering/render-page-rect). A suíte inclui PDFs com rotações nativas 0°, 90°, 180°, 270° e CropBox deslocado.

## Desenhos globais

1. Abra **Administração → Desenhos globais**.
2. Envie o PDF de Planta e o de Lateral. O upload é retomável e exibe progresso. Cada envio cria um caminho único `pdfs/global-{plant|side}-{uuid}.pdf`; não sobrescreve arquivos antigos.
3. Se quiser reaproveitar um arquivo existente, informe seu caminho `pdfs/…pdf` no Storage. Use arquivos imutáveis: para uma revisão, envie um novo PDF.
4. Escolha a página do desenho, contando a partir de 1. PDFs com várias páginas são aceitos, mas cada vista utiliza uma única página calibrada.
5. Calibre cada vista e confira os resíduos.
6. Ajuste o zoom inicial e o zoom de compartilhamento. São multiplicadores do ajuste ao desenho completo, entre 1× e 32×; valores iniciais sugeridos na interface: 4× e 3×.
7. Clique em **Salvar desenhos globais**. O par é ativado em uma transação somente se ambos os PDFs e calibrações forem válidos.

Enquanto o par for apenas um exemplo, marque **Usar estes PDFs apenas na região ilustrativa** e informe a região. Assim, TAGs reais continuam usando seus PDFs regionais. Desmarque quando os desenhos reais completos estiverem calibrados para a base toda.

O envio por si só não ativa o PDF. Alterar o PDF ou a página limpa os pontos do rascunho para evitar reaproveitar coordenadas incompatíveis. Rascunhos são locais e não sobrevivem ao fechamento/recarregamento da página. Um upload abandonado permanece no Storage e pode ser reaproveitado; não há limpeza automática.

## Calibração multiponto

1. Use zoom e arraste para encontrar uma referência conhecida.
2. Clique em **Adicionar ponto por clique** e clique no desenho.
3. Preencha X e Y (Planta) ou X e Z (Lateral). U/V são preenchidos pelo clique.
4. Repita. São necessários ao menos três pontos não colineares; recomenda-se 6 a 10 bem distribuídos, sem limite de quantidade imposto pela interface.
5. Para reposicionar, selecione P1/P2/etc. e clique novamente. Também é possível editar os quatro valores ou excluir uma referência.
6. Revise o erro de cada ponto, o erro médio e o RMSE antes de salvar. Pontos acima da tolerância ficam vermelhos na lista e no desenho.

O ajuste afim permite translação, rotação, escalas independentes e cisalhamento. O sistema usa mínimos quadrados com QR e centralização/normalização das coordenadas. Rejeita valores não finitos, referências insuficientes, colinearidade/quase colinearidade, transformação singular e pontos fora da página. Erros elevados são avisos; cabe ao administrador revisar as referências e a tolerância.

Com exatamente três referências o resíduo pode ser zero mesmo quando um ponto está incorreto. Acrescente referências independentes para avaliar a confiabilidade. Regiões não participam dessa transformação.

## Regiões

Em **Regiões**, informe ID único, nome e os seis limites. Para cada eixo, mínimo < máximo. O ID deve ser válido para o Firestore: não vazio, sem `/`, com até 1500 bytes e sem nomes reservados. Documentos legados sem limites aparecem para edição e não participam da identificação espacial.

A interface detecta sobreposição parcial, contenção total e contato de fronteira. Contatos por face, aresta ou ponto podem produzir ambiguidade porque os limites são inclusivos. Para salvar conflitos, é necessário marcar que os limites foram revisados. Qualquer alteração nos valores ou conflitos exige novo reconhecimento. A criação verifica IDs existentes em transação, inclusive os arquivados.

**Excluir** retira a região da identificação após confirmação e marca `archived: true`, preservando o documento e campos legados. **Restaurar / editar**, seguido de salvar, reativa a região. Nenhum PDF é apagado.

## Identificação e altura

As regiões são carregadas em cache compartilhado e acompanhadas em tempo real. Para cada TAG:

- Uma região contendo X/Y/Z: é usada.
- Nenhuma: mostra **Região não identificada**.
- Várias: `regionId` só desempata se corresponder a uma das regiões contendo a TAG. Sem esse desempate, mostra **Região ambígua** e os nomes.

A região efetiva é sempre calculada em memória. O sistema nunca atualiza `regionId` automaticamente. Mudanças na TAG selecionada ou nas regiões recalculam os resultados.

**Altura aproximada** = Z da TAG − Z mínimo da região resolvida. O campo fica vazio quando não há região válida ou há ambiguidade. Zero é exibido apenas quando Z coincide com o limite inferior. É a distância da coordenada de referência da TAG ao limite inferior cadastrado, não a altura física do equipamento nem uma medição de piso irregular.

## Navegação e compartilhamento

Ao alternar a TAG, as vistas recalculam e centralizam a posição sem reabrir PDFs cujos caminhos/páginas continuam iguais. Os controles são independentes. Use arraste (inclusive toque), botões de zoom, setas do teclado, **Centralizar TAG**, **Desenho completo** e **Tela cheia** (conforme suporte do navegador).

O minimapa mostra uma miniatura, a TAG e o retângulo visível. Clique ou arraste para navegar. Pode ser recolhido e fica compacto em celulares. As abas Planta/Lateral mantêm ambos os documentos montados.

**Compartilhar** gera uma prévia PNG com dados da TAG e dois recortes, com zoom próprio e marcadores. A imagem não captura menus ou controles. O download está sempre disponível; **Compartilhar imagem** aparece quando o navegador suporta Web Share com arquivos. Cancelar o compartilhamento nativo não é um erro. Em caso de falha, revise a mensagem e tente novamente.

A exportação exige os dois desenhos carregados, calibrações afins válidas, metadados de página compatíveis e a TAG dentro das páginas. A imagem é gerada localmente; não altera permissões do Storage ou Firestore.

## TAGs e CSV

A busca principal continua iniciando em dois caracteres, com consultas limitadas por prefixo em `tag`, `description` e `descricao`. Não lê a coleção inteira. A busca legada é por prefixo, não uma pesquisa textual arbitrária no meio de qualquer frase. A tabela administrativa mantém sua leitura completa para filtragem e exportação, exibindo até 200 registros.

Em **TAGs e dados CSV** há filtro, exportação dos dados atuais e modelo. A tabela distingue região calculada de `regionId` legado. Campos legados `descricao`, `sistema`, `planta` e `lateral` continuam reconhecidos na leitura.

Formato (ordem das colunas pode variar):

```csv
id,tag,description,regionId,moduleRegion,owner,elevation,x,y,z,type,status
P-101A,P-101A,"Bomba de água, circuito principal",engine-first,Módulo 01,Operação,EL +20.000,150,75,15,Pump,active
P-102,P-102,Bomba reserva,,,,,170,70,16,Pump,inactive
```

- Cabeçalhos obrigatórios: `tag,description,regionId,x,y,z,type,status`.
- `id` é opcional; preservado quando exportado. Quando ausente, é derivado da TAG com codificação para ID Firestore. IDs existentes não são recodificados.
- `regionId` pode ficar vazio; não substitui o cálculo espacial.
- `moduleRegion`, `owner` e `elevation` são metadados opcionais. O CSV exportado os inclui; arquivos legados sem essas três colunas continuam aceitos e não apagam os valores já cadastrados. `elevation` é independente de Z.
- X/Y/Z são obrigatórios e finitos, com ponto decimal. Valores vazios não viram zero.
- Status aceitos: `active`, `inactive`, `unknown`. Outros valores são erros.
- São aceitos vírgula, ponto e vírgula e tabulação, BOM, acentos, aspas escapadas e quebras de linha dentro de campos entre aspas. Cabeçalhos `descricao`/`sistema` podem representar `description`/`type`.
- Cabeçalhos/IDs/TAGs duplicados, aspas malformadas e quantidade incorreta de colunas são rejeitados.
- A prévia mostra contagens, primeiras 20 linhas válidas e erros com número de linha. Havendo qualquer erro, não permite confirmar nenhuma linha.

**Confirmar e substituir tabela** mantém a estratégia anterior: atualiza as TAGs do arquivo e remove as que estiverem ausentes. Nenhuma escrita acontece antes desse clique. Campos legados/extra dos documentos mantidos são preservados por merge. Exporte os dados atuais antes de confirmar uma substituição.

Até 450 operações, a substituição é atômica. Acima disso, usa lotes e pode ser interrompida por falha de rede/permissão: o erro informa a etapa e as operações confirmadas; a tabela é recarregada. A remoção só começa após gravar todas as TAGs do CSV. Corrija o problema, confira a base e repita o arquivo completo. Não há promessa de atomicidade entre lotes grandes.

## Modelo de dados e migração reversível

Documento novo `settings/globalDrawings`:

```ts
{
  version: 2,
  units: 'm',
  initialZoom: 4,
  shareZoom: 3,
  plant: {
    path: 'pdfs/global-plant-UUID.pdf',
    pageIndex: 0,
    page: { width: 2400, height: 1600, rotation: 0 },
    calibration: {
      id: 'global-plant', pdfId: 'pdfs/global-plant-UUID.pdf',
      model: 'affine', tolerance: 3,
      points: [{ realX: 0, realY: 0, pdfX: 100, pdfY: 200 } /* mínimo 3 */]
    }
  },
  side: { /* mesmo formato; realY representa Z */ },
  updatedAt: Timestamp
}
```

Os parâmetros do ajuste são derivados dos pontos, evitando duas fontes de verdade. `rotation` segue o enum do EmbedPDF: 0, 1, 2, 3 para 0°, 90°, 180°, 270°.

`regions/{id}` recebe `name,xMin,xMax,yMin,yMax,zMin,zMax,archived,updatedAt`. Os campos regionais antigos `plantPdf`, `sidePdf`, `plantCalibration` e `sideCalibration` são preservados por merge. As novas regiões não recebem PDFs individuais. TAGs mantêm o modelo existente; região efetiva e altura não são persistidas.

Migração:

1. Faça backup/exportação dos dados atuais; não altere seus arquivos regionais.
2. Publique as regras novas e a aplicação.
3. Sem `settings/globalDrawings`, ou fora da região ilustrativa enquanto `exampleRegionId` estiver ativo, a busca ainda pode abrir os desenhos/calibrações regionais legados indicados pelo `regionId`.
4. Cadastre os limites XYZ das regiões e configure os dois desenhos globais.
5. Calibre, salve e verifique TAGs conhecidas distribuídas pelas duas páginas. A presença do documento global ativa o novo fluxo para todas as TAGs.

Cada atualização posterior arquiva a configuração anterior em `drawingRevisions/{id}` na mesma transação. Para reverter uma configuração, copie seus campos de uma revisão para `settings/globalDrawings` no Console Firebase (sem `archivedAt`), mantendo todos os arquivos. Para voltar à transição regional, faça backup da configuração global e remova **apenas** `settings/globalDrawings` de forma explícita. Os documentos e PDFs regionais permanecem intactos. Não há migração em massa nem exclusão automática de dados antigos.

## Desempenho, testes e limites

O Pdfium roda em worker e usa WASM empacotado com a aplicação. Renderizamos somente o recorte visível, com atualização adiada durante movimentos rápidos, DPR até 2 e orçamento aproximado de seis milhões de pixels por quadro. A miniatura é gerada uma vez por documento/página, com dimensão alvo de até 360 px. URLs de imagens e documentos são liberados ao desmontar.

O carregamento usa `full-fetch`, como a implementação anterior: o arquivo precisa caber na memória disponível, além da memória de trabalho do Pdfium. A renderização por recorte evita bitmaps do desenho inteiro em alta resolução, mas não elimina o custo de baixar/analisar PDFs grandes. Valide arquivos industriais representativos em celulares antes da publicação operacional.

```sh
npm ci
npx playwright install chromium
npm test
npm run lint
npm run build
```

Os testes exercitam ajuste afim, degenerações, região/altura, conflitos, CSV, transformações de navegação e um PDF real no Chromium. A fixture local em `tests/fixtures/viewer.html` é apenas de desenvolvimento e não integra o build de produção. Autenticação Google, regras publicadas e desempenho com os PDFs reais exigem uma verificação no ambiente Firebase autorizado.
