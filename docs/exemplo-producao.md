# Exemplo ilustrativo em produção

O desenho enviado pelo usuário foi convertido em dois PDFs: planta e lateral. São material de demonstração sem escala de engenharia verificada. As coordenadas abaixo são **ilustrativas, em metros**, e foram escolhidas para posicionar marcadores nos elementos mostrados, sem representar levantamento dimensional do navio.

Os PDFs são `pdfs/exemplo-navio-planta-20261015.pdf` e `pdfs/exemplo-navio-lateral-20261015.pdf` no Firebase Storage. A região `EXEMPLO-NAVIO` ocupa X 9990–10950 m, Y 0–200 m e Z 0–100 m, distante das TAGs reais existentes. A configuração `settings/globalDrawings` contém `exampleRegionId: EXEMPLO-NAVIO`; somente uma TAG cuja posição resolva nessa região usa esses PDFs. As demais TAGs continuam nos desenhos regionais existentes.

| TAG             | Elemento             | X (m) | Y (m) | Z (m) |
| --------------- | -------------------- | ----: | ----: | ----: |
| DEMO-TURRET     | Sistema de ancoragem | 10100 |   100 |    37 |
| DEMO-MODULO     | Módulo de processo   | 10360 |   100 |    65 |
| DEMO-GUINDASTE  | Guindaste            | 10645 |    20 |    70 |
| DEMO-ACOMODACAO | Bloco de acomodação  | 10800 |   110 |    60 |

As calibrações afins usam seis referências em cada vista. O referencial ilustrativo é: U = X − 9830; V da planta = 96 + 0,81 × Y; V da lateral = 406 − 1,9 × Z. U/V são pontos PDF com origem no canto superior esquerdo. A transformação é uma sobreposição visual aproximada, não uma medição.

Para recriar em um projeto vazio, atualize as credenciais com `firebase projects:list`, confira `python3 scripts/seed_example.py` (prévia) e execute `python3 scripts/seed_example.py --apply`. O script exige que os seis documentos e os dois PDFs ainda não existam; não sobrescreve dados. Cria a configuração global por último para evitar ativar um par incompleto.

Para substituir pelos desenhos reais, carregue e calibre ambos na Administração e desmarque a restrição à região ilustrativa ao salvar. Preserve as revisões em `drawingRevisions` e os PDFs anteriores para reversão. A interface indica explicitamente quando uma TAG está no exemplo.
