from io import BytesIO
from pathlib import Path
from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent.parent
IMAGE = Image.open(ROOT / 'assets/example/original.jpg').convert('RGB')
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
HEADER = 36

for name, bounds in [('planta', (0, 145, 1158, 420)), ('lateral', (0, 380, 1158, 810))]:
    crop = IMAGE.crop(bounds)
    width, height = crop.size
    image_bytes = BytesIO()
    crop.save(image_bytes, format='JPEG', quality=95, subsampling=0)
    image_bytes.seek(0)
    destination = OUT / f'loctag-exemplo-{name}.pdf'
    pdf = canvas.Canvas(str(destination), pagesize=(width, height + HEADER), pageCompression=1)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.rect(0, 0, width, height + HEADER, fill=1, stroke=0)
    # PDF coordinates increase upward; reportlab places the image below the heading.
    pdf.drawImage(ImageReader(image_bytes), 0, 0, width=width, height=height)
    # Hide fragments of the other view in the overlapping band of the source image.
    pdf.setFillColorRGB(240 / 255, 240 / 255, 238 / 255)
    if name == 'planta':
        pdf.rect(265, 0, 55, 25, fill=1, stroke=0)
    else:
        pdf.rect(0, height - 30, 280, 30, fill=1, stroke=0)
        pdf.rect(315, height - 30, width - 315, 30, fill=1, stroke=0)
    pdf.setFillColorRGB(0, 0.47, 0.25)
    pdf.rect(0, height + HEADER - 3, width, 3, fill=1, stroke=0)
    pdf.setFont('Helvetica-Bold', 13)
    pdf.drawString(14, height + 11, f'LOCTAG - EXEMPLO {name.upper()}')
    pdf.setFont('Helvetica', 10)
    pdf.setFillColorRGB(0.25, 0.3, 0.26)
    pdf.drawRightString(width - 14, height + 12, 'Coordenadas ilustrativas; sem escala verificada')
    pdf.showPage()
    pdf.save()
    print(destination, width, height + HEADER)
