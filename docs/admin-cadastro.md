# Guia de Administração: PDFs, Calibração e Tags

Este guia descreve como cadastrar PDFs técnicos, calibrar coordenadas e inserir tags no LocTag.

## 1. Acessar a área administrativa

1. Abra a aplicação publicada:

```txt
https://leojaime20.github.io/LocTag/
```

2. Clique em **Entrar com Google**.
3. Use o e-mail administrador:

```txt
leojaime20@gmail.com
```

4. Clique em **Administração** no topo da tela.

Link direto:

```txt
https://leojaime20.github.io/LocTag/#/admin
```

Se a tela informar que seu usuário não tem permissão, confira no Firestore se existe o documento:

```txt
authorizedUsers/leojaime20@gmail.com
```

Com o campo:

```txt
role = "admin"
```

## 2. Cadastrar ou editar uma região

Uma região representa um conjunto de desenhos técnicos. Normalmente ela terá:

- um PDF de planta;
- um PDF de lateral;
- uma calibração para cada PDF.

Na tela **Administração**:

1. Em **ID da região**, informe um identificador simples.

Exemplo:

```txt
default
```

ou:

```txt
modulo-01
```

2. Em **Nome da região**, informe um nome legível.

Exemplo:

```txt
P84/85 Hull - Módulo 01
```

3. Se estiver editando uma região existente, aguarde os dados carregarem.

## 3. Subir os PDFs

Na seção de upload:

1. Em **PDF Planta**, selecione o arquivo PDF da planta.
2. Em **PDF Lateral**, selecione o arquivo PDF da vista lateral.
3. Aguarde o envio terminar.

O sistema salva os PDFs no Firebase Storage com este padrão:

```txt
pdfs/{regionId}-planta.pdf
pdfs/{regionId}-lateral.pdf
```

Exemplo para `regionId = default`:

```txt
pdfs/default-planta.pdf
pdfs/default-lateral.pdf
```

Depois do upload, clique em **Salvar região** para gravar os caminhos no Firestore.

## 4. Calibrar a planta

A calibração converte coordenadas reais da tag para a posição correta no PDF.

Na seção **Calibração da planta**, preencha dois pontos conhecidos. O modo recomendado é:

1. Selecione **P1**.
2. Digite `P1 real X` e `P1 real Y` com os valores reais vindos do 3D/projeto.
3. Clique no mesmo ponto dentro do PDF exibido abaixo dos campos.
4. O sistema preencherá `P1 PDF X` e `P1 PDF Y`.
5. Repita o processo para **P2**.

Cada ponto tem:

```txt
realX
realY
pdfX
pdfY
```

Significado:

- `realX`: coordenada X real do projeto.
- `realY`: coordenada Y real do projeto.
- `pdfX`: posição X correspondente dentro do PDF.
- `pdfY`: posição Y correspondente dentro do PDF.

Exemplo simples para PDFs gerados em escala 1000 x 500:

```txt
P1 real X = 0
P1 real Y = 0
P1 PDF X  = 0
P1 PDF Y  = 0

P2 real X = 1000
P2 real Y = 500
P2 PDF X  = 1000
P2 PDF Y  = 500
```

Se o PDF real tiver outra escala, use dois pontos conhecidos do desenho.

Exemplo:

```txt
P1 real X = 120
P1 real Y = 40
P1 PDF X  = 82
P1 PDF Y  = 318

P2 real X = 850
P2 real Y = 430
P2 PDF X  = 906
P2 PDF Y  = 94
```

## 5. Calibrar a lateral

Na vista lateral, a aplicação usa:

```txt
X real da tag
Z real da tag
```

Ou seja:

- na planta: usa `x` e `y`;
- na lateral: usa `x` e `z`.

Na seção **Calibração da lateral**, preencha:

```txt
realX
realY
pdfX
pdfY
```

Mas aqui o campo `realY` representa a coordenada vertical usada na lateral, ou seja, o `z` da tag. Na interface, esse campo aparece como **real Z**.

O modo recomendado também é clicar no PDF:

1. Selecione **P1**.
2. Digite `P1 real X` e `P1 real Z`.
3. Clique no mesmo ponto na vista lateral.
4. Repita para **P2**.

Exemplo:

```txt
P1 real X = 0
P1 real Y = 0
P1 PDF X  = 0
P1 PDF Y  = 500

P2 real X = 1000
P2 real Y = 500
P2 PDF X  = 1000
P2 PDF Y  = 0
```

Use esse padrão quando a cota vertical cresce para cima, mas o PDF cresce para baixo.

## 6. Salvar a região

Depois de subir PDFs e ajustar calibração:

1. Clique em **Salvar região**.
2. Aguarde a mensagem **Região salva**.
3. Volte para a busca.
4. Selecione uma tag dessa região e confira o marcador.

## 7. Gerenciar tags pela área administrativa

Na seção **Tabela de tags** da área administrativa, você pode:

- ver os dados atuais da coleção `tags`;
- filtrar a tabela por tag, descrição, região, tipo ou status;
- baixar um arquivo modelo;
- baixar os dados atuais;
- importar um CSV validado;
- substituir a coleção inteira após revisar a prévia.

Fluxo recomendado:

1. Clique em **Baixar dados atuais** se já existirem tags cadastradas.
2. Se ainda não houver dados, clique em **Baixar modelo**.
3. Abra o arquivo no Excel, Google Sheets ou Numbers.
4. Mantenha as colunas do padrão.
5. Edite ou adicione as tags.
6. Exporte/salve a planilha como CSV.
7. Clique em **Importar CSV**.
8. Revise a prévia e os erros, se houver.
9. Clique em **Confirmar e substituir tabela**.

Colunas obrigatórias:

```txt
tag,description,regionId,x,y,z,type,status
```

A coluna `id` é opcional. Se ela não existir, o sistema usa a própria `tag` como ID do documento.

Formato recomendado:

```csv
id,tag,description,regionId,x,y,z,type,status
P-101A,P-101A,Bomba de drenagem,default,420,280,380,Processo,active
V-201,V-201,Separador trifásico,default,580,260,320,Processo,active
```

O importador aceita CSV separado por vírgula, ponto e vírgula ou tabulação. Arquivos `.xlsx` devem ser exportados como `.csv` antes do envio.

Validações feitas antes da substituição:

- colunas obrigatórias presentes;
- `tag`, `description` e `regionId` preenchidos;
- tags duplicadas bloqueadas;
- `x`, `y` e `z` numéricos;
- `status` padronizado como `active`, `inactive` ou `unknown`.

Importante: ao confirmar, a coleção `tags` é sobrescrita. Tags que não estiverem no CSV serão removidas.

## 8. Inserir tags manualmente no Firestore

As tags ficam na coleção:

```txt
tags
```

Cada documento pode ter o ID igual à própria tag.

Exemplo de documento:

```txt
tags/P-101A
```

Campos obrigatórios:

```txt
tag: "P-101A"
description: "Bomba de drenagem"
regionId: "default"
x: 420
y: 280
z: 380
type: "Processo"
status: "active"
```

Regras importantes:

- `regionId` deve ser igual ao ID cadastrado na área admin.
- `x` e `y` posicionam o marcador na planta.
- `x` e `z` posicionam o marcador na lateral.
- `tag` é o texto pesquisado pelo usuário.
- `description` também entra na busca.

## 9. Inserir tags manualmente pelo Console Firebase

1. Abra o Firebase Console.
2. Vá em **Firestore Database**.
3. Abra a coleção `tags`.
4. Clique em **Add document**.
5. Use como Document ID o nome da tag.

Exemplo:

```txt
P-101A
```

6. Adicione os campos:

| Campo         | Tipo   | Exemplo             |
| ------------- | ------ | ------------------- |
| `tag`         | string | `P-101A`            |
| `description` | string | `Bomba de drenagem` |
| `regionId`    | string | `default`           |
| `x`           | number | `420`               |
| `y`           | number | `280`               |
| `z`           | number | `380`               |
| `type`        | string | `Processo`          |
| `status`      | string | `active`            |

7. Salve.

## 10. Inserir muitas tags

Para milhares de tags, não cadastre manualmente uma por uma.

Recomendação:

1. Preparar uma planilha CSV com colunas:

```txt
tag,description,regionId,x,y,z,type,status
```

2. Usar a seção **Tabela de tags** da área administrativa para importar.

Formato recomendado:

```csv
tag,description,regionId,x,y,z,type,status
P-101A,Bomba de drenagem,default,420,280,380,Processo,active
V-201,Separador trifásico,default,580,260,320,Processo,active
```

## 11. Validar se está correto

Depois de cadastrar:

1. Abra a tela principal.
2. Pesquise a tag.
3. Clique no resultado.
4. Verifique:

- resumo carregou;
- região está correta;
- PDF de planta abriu;
- PDF lateral abriu;
- marcador aparece na planta;
- marcador aparece na lateral.

Se o PDF não abrir:

- confirme que o arquivo está no Firebase Storage em `pdfs/`;
- confirme que o caminho salvo em `regions/{regionId}` está correto;
- confirme que as regras de Storage foram publicadas;
- faça refresh forte no navegador.

Se o marcador aparecer deslocado:

- revise os pontos de calibração da região;
- confirme se a tag está com `x`, `y`, `z` corretos;
- lembre que a lateral usa `x` e `z`.
