# Plano de implementação — TAG na visualização 3D

Status: implementado localmente. Validação em Safari/iOS e Chrome/Android físicos ainda depende de aparelhos reais.

## Objetivo

Adicionar à consulta uma visualização dos volumes das regiões e da coordenada XYZ da TAG selecionada. Priorizar o uso em celular. A cena não terá rótulos de regiões, inclusive na região destacada: essa informação já está no resumo acima. O marcador da TAG também dispensa um rótulo flutuante; a identificação permanece no resumo.

## Experiência e layout

- **Celular:** três abas de mesma largura, Planta / Lateral / 3D, abaixo do resumo. Somente uma visualização aparece por vez. A vista inicial continua sendo Planta; trocar a TAG preserva a aba escolhida.
- **Desktop:** alternância Desenhos / 3D. Desenhos mantém Planta e Lateral lado a lado; 3D ocupa toda a largura disponível.
- **Cena:** blocos proporcionais, sem nomes, com transparência e bordas. Destacar a região resolvida e desenhar um marcador de alto contraste na posição real da TAG. Manter os eixos XYZ e Z vertical.
- **Controles:** Centralizar TAG, Ver todas e Expandir, além de zoom +/−. Usar uma barra compacta que se reorganize em telas estreitas, com alvos de toque de pelo menos 44 × 44 px. Evitar painel lateral ou lista de regiões na consulta.
- **Altura:** aproximadamente metade da tela no celular, ajustada ao espaço disponível e à orientação. Usar unidades de viewport estáveis e evitar alturas mínimas que tornem a paisagem inutilizável. Não criar rolagem horizontal nem barras de rolagem dentro do painel.
- **Gestos:** um dedo gira; dois dedos aproximam e deslocam. Restringir a captura de gestos ao canvas, mantendo a rolagem da página fora dele. Instrução curta junto aos controles.
- **Modo expandido:** ocupar a área útil da tela, respeitando safe areas e mantendo o botão de saída acessível. Oferecer expansão dentro da página quando a API de tela cheia não estiver disponível. Restaurar o foco ao sair.
- **Resumo:** preservar o comportamento de recolher/expandir. Quando recolhido, manter a TAG e a região legíveis em formato compacto, sem levar seus nomes para a cena.
- **Compartilhamento:** manter o fluxo atual de Planta/Lateral. Na aba 3D, não apresentar a ação como se exportasse a cena; restringir sua apresentação ao modo de desenhos nesta entrega.

## Comportamento espacial

1. Usar as coordenadas XYZ em metros sem conversão, deslocamento artificial ou ajuste aos limites da região. Aplicar ao marcador a mesma transformação visual usada pelos blocos.
2. Na primeira abertura e ao trocar a TAG, enquadrar a região resolvida e o marcador. Conservar o conjunto de regiões na cena para permitir exploração. Evitar reposicionar a câmera em atualizações que não alterem a TAG, sua coordenada ou sua região.
3. Centralizar TAG retorna ao enquadramento local. Ver todas enquadra todas as regiões válidas ativas e inclui a TAG, mesmo quando estiver fora dos blocos.
4. Preservar exatamente as regras de `resolveRegion` usadas no resumo, incluindo fronteiras inclusivas e o desempate legado. Quando não houver região resolvida e existirem múltiplas correspondências, destacar as candidatas e manter o estado de ambiguidade no resumo.
5. TAG fora das regiões permanece na posição real. O enquadramento inicial deve incluir o marcador e as regiões para permitir entender a distância entre eles.
6. Sem regiões válidas, mostrar a TAG e a referência dos eixos com enquadramento seguro. Informar que não há volumes disponíveis; não confundir isso com erro de carregamento.
7. Coordenadas não finitas impedem desenhar o marcador e produzem uma mensagem clara. Nunca enviar NaN ou infinito para a geometria ou câmera.
8. O marcador deve manter tamanho aparente legível durante o zoom e permanecer distinguível através dos blocos transparentes. Evitar animação contínua e aparência de um objeto com dimensão física medida.

## Arquitetura e dados

### 1. Compartilhar o renderizador

Extrair `src/features/admin/RegionMapScene.tsx` para uma área compartilhada, por exemplo `src/features/spatial/RegionScene.tsx`. Manter `RegionMapPanel` como consumidor administrativo e criar `src/features/viewer/TagRegionViewer.tsx` como consumidor de consulta.

Adicionar suporte opcional ao marcador e uma política explícita de rótulos: na consulta, nenhum nome de região é renderizado, mesmo quando selecionada ou destacada. Hoje `labels=false` ainda permite nomes em blocos destacados, portanto apenas passar essa propriedade não atende ao requisito.

Preservar os recursos da administração e seus testes. A consulta usa apenas a cena e os cálculos necessários à localização, sem importar o painel ou executar `analyzeRegions` para comparar todos os pares.

### 2. Desacoplar a localização dos PDFs

Refatorar `useSelectedTagContext` para disponibilizar a TAG, as regiões e a resolução espacial independentemente da consulta das URLs dos desenhos. Hoje o contexto só é montado quando `urls.data` existe.

Separar estados de carregamento e erro espacial dos estados dos PDFs. Uma falha no Storage ou na configuração do desenho não deve impedir a cena 3D; falhas ao obter a TAG ou as regiões precisam continuar explícitas. Ao trocar ou remover a seleção, não exibir a TAG anterior como se fosse a atual.

Reutilizar o cache e as assinaturas existentes em `useSpatialData`; passar os dados ao novo visualizador, sem criar uma segunda assinatura Firestore das regiões. Usar somente regiões ativas com limites válidos e a única TAG selecionada. Não alterar documentos, regras de segurança ou o esquema persistido.

### 3. Integrar a navegação

Modificar `ViewerWorkspace` e seu estado de navegação para suportar o 3D. Separar o tipo de aba da interface do `ViewKind`, que continua representando apenas as duas projeções PDF e suas calibrações.

Preservar câmeras e documentos PDF já carregados ao alternar as abas. Ocultar os painéis PDF de fato quando o modo 3D estiver ativo, inclusive no desktop: a classe atual `hidden md:flex` tornaria um painel novamente visível em telas grandes. Validar que a transição não dispara novo download dos PDFs.

Guardar a câmera 3D fora do canvas para restaurá-la quando o usuário voltar à aba com a mesma TAG. A seleção de outra TAG prevalece sobre essa restauração e reenquadra o marcador.

## Desempenho e ciclo de vida

- Carregar o código 3D com importação dinâmica somente ao abrir a aba, sem antecipar o download na consulta inicial.
- Montar o canvas apenas enquanto a aba estiver ativa e desmontá-lo ao sair, liberando os recursos WebGL. Preservar somente os dados simples da câmera necessários à restauração.
- Renderizar sob demanda, sem rotação automática, pulsação permanente ou loop de animação contínuo. Atualizar a cena apenas por interação, redimensionamento ou mudança relevante de dados.
- Limitar a densidade de pixels no celular, começando com DPR máximo de 1,5; confirmar a legibilidade e fluidez em aparelho real antes de ajustar.
- Reutilizar geometrias e materiais quando adequado e garantir descarte dos recursos ao desmontar. Nomes de regiões não geram sprites ou texturas na consulta.
- Medir com quantidade representativa de regiões da base e com um cenário maior. Só introduzir desenho em lote dos blocos se a medição justificar essa complexidade.
- Sem WebGL, exibir uma mensagem local no painel e manter resumo, abas e consulta de PDFs utilizáveis.

## Ordem de execução

1. Extrair a cena compartilhada e implementar a política de rótulos e o marcador, validando a administração.
2. Separar dados espaciais das dependências dos PDFs e passar regiões/resolução ao novo painel.
3. Implementar a navegação responsiva, enquadramentos e ciclo de vida da câmera.
4. Ajustar toque, modo expandido, acessibilidade e apresentação do resumo/compartilhamento.
5. Executar testes funcionais, inspeção visual e medição em celular; atualizar a documentação e preparar a entrega para revisão.

## Critérios de aceite e validação

- Nenhum nome de região aparece na cena da consulta, inclusive após destaque, mudança de TAG ou retorno à aba. A administração mantém seus rótulos.
- Marcador e blocos usam o mesmo referencial. Testar coordenadas negativas e grandes, TAG interna, na fronteira, com múltiplas correspondências, fora de todos os volumes e sem volumes válidos.
- Alterar a TAG atualiza o marcador e o enquadramento sem deixar dados anteriores na tela. Atualizações em tempo real continuam funcionando.
- Erro ou ausência de PDF não impede o 3D. Erros espaciais, coordenadas inválidas, seleção removida e indisponibilidade de WebGL têm estados próprios.
- Antes de abrir a aba, não há download do pacote 3D nem contexto WebGL. Ao sair, não fica canvas ativo; alternar repetidamente não acumula recursos ou assinaturas.
- Trocar entre Planta, Lateral e 3D preserva as posições dos PDFs e não repete seus downloads. O compartilhamento existente continua funcionando no modo de desenhos.
- Conferir 320, 360, 390 e 430 px de largura, orientação paisagem, tablet e desktop. Abas cabem em uma linha, textos não estouram a largura, controles têm alvos de toque adequados e a página permanece rolável fora do canvas.
- Verificar gestos e modo expandido em Safari/iOS e Chrome/Android, com atenção a barras do navegador, safe areas e retorno de foco. Não considerar a emulação desktop suficiente para validar fluidez no celular.
- Testes Playwright cobrem navegação, marcador, falhas de dados, ausência de rótulos, isolamento do carregamento 3D e regressões dos PDFs/administração. Registrar erros de console e inspecionar capturas responsivas.
- Executar build de produção, testes e lint dos arquivos versionados. Registrar separadamente limitações de validação em aparelhos reais, caso não estejam disponíveis.

## Limites desta entrega

O foco é consultar a TAG selecionada no contexto dos volumes existentes. Edição de regiões, listas de conflitos, corte horizontal e exportação de imagem 3D permanecem fora desta primeira entrega. A nova visualização não afirma cobertura completa nem detecta automaticamente lacunas.
