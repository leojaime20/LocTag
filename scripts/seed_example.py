"""Publish the isolated illustrative ship example to the production Firebase project.

Run `firebase projects:list` first to refresh Firebase CLI credentials. Dry-run by
default; pass --apply to create the objects. Existing documents are never changed.
"""

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT = 'loctag-p84-p85'
BUCKET = f'{PROJECT}.firebasestorage.app'
BASE = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'
REGION_ID = 'EXEMPLO-NAVIO'
FILES = {
    'plant': ('pdfs/exemplo-navio-planta-20261015.pdf', ROOT / 'output/pdf/loctag-exemplo-planta.pdf', 1158, 311),
    'side': ('pdfs/exemplo-navio-lateral-20261015.pdf', ROOT / 'output/pdf/loctag-exemplo-lateral.pdf', 1158, 466),
}
TAGS = [
    ('DEMO-TURRET', 'Sistema de ancoragem Turret', 10100, 100, 37, 'Estrutura'),
    ('DEMO-MODULO', 'Módulo de processo', 10360, 100, 65, 'Módulo'),
    ('DEMO-GUINDASTE', 'Guindaste', 10645, 20, 70, 'Guindaste'),
    ('DEMO-ACOMODACAO', 'Bloco de acomodação', 10800, 110, 60, 'Acomodação'),
]


def firestore_value(value):
    if isinstance(value, str):
        return {'stringValue': value}
    if isinstance(value, bool):
        return {'booleanValue': value}
    if isinstance(value, int):
        return {'integerValue': str(value)}
    if isinstance(value, float):
        return {'doubleValue': value}
    if isinstance(value, list):
        return {'arrayValue': {'values': [firestore_value(item) for item in value]}}
    if isinstance(value, dict):
        return {'mapValue': {'fields': {key: firestore_value(item) for key, item in value.items()}}}
    raise TypeError(type(value))


def document(value):
    return {'fields': {key: firestore_value(item) for key, item in value.items()}}


def request(method, url, token, data=None, content_type='application/json'):
    headers = {'Authorization': f'Bearer {token}'}
    if data is not None:
        headers['Content-Type'] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as response:
            raw = response.read()
            return json.loads(raw) if raw and response.headers.get_content_type() == 'application/json' else raw
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        body = error.read().decode('utf-8', 'replace')[:500]
        raise RuntimeError(f'{method} failed with HTTP {error.code}: {body}') from error


def calibration(view, path):
    if view == 'plant':
        xy = [(10000, 0), (10900, 0), (10000, 200), (10900, 200), (10450, 100), (10700, 60)]
        points = [{'realX': x, 'realY': y, 'pdfX': x - 9830, 'pdfY': 96 + .81 * y} for x, y in xy]
    else:
        xz = [(10000, 0), (10900, 0), (10000, 100), (10900, 100), (10450, 50), (10700, 70)]
        points = [{'realX': x, 'realY': z, 'pdfX': x - 9830, 'pdfY': 406 - 1.9 * z} for x, z in xz]
    return {'id': f'example-{view}-20261015', 'pdfId': path, 'model': 'affine', 'tolerance': 3, 'points': points}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    config = json.loads((Path.home() / '.config/configstore/firebase-tools.json').read_text())
    token = config['tokens']['access_token']
    docs = [('regions', REGION_ID)] + [('tags', item[0]) for item in TAGS] + [('settings', 'globalDrawings')]
    for collection, doc_id in docs:
        if request('GET', f'{BASE}/{collection}/{doc_id}', token) is not None:
            raise RuntimeError(f'Production document already exists: {collection}/{doc_id}')
    for path, source, _, _ in FILES.values():
        if not source.is_file() or source.read_bytes()[:5] != b'%PDF-':
            raise RuntimeError(f'Missing/invalid PDF: {source}')
        quoted = urllib.parse.quote(path, safe='')
        if request('GET', f'https://storage.googleapis.com/storage/v1/b/{BUCKET}/o/{quoted}', token) is not None:
            raise RuntimeError(f'Production object already exists: {path}')
    print('Preflight passed: six new documents and two PDFs; existing data untouched.')
    if not args.apply:
        print('Dry-run only. Use --apply to publish.')
        return
    for path, source, _, _ in FILES.values():
        url = f'https://storage.googleapis.com/upload/storage/v1/b/{BUCKET}/o?uploadType=media&name={urllib.parse.quote(path, safe="")}&ifGenerationMatch=0'
        request('POST', url, token, source.read_bytes(), 'application/pdf')
        quoted = urllib.parse.quote(path, safe='')
        download_token = str(uuid.uuid4())
        request('PATCH', f'https://storage.googleapis.com/storage/v1/b/{BUCKET}/o/{quoted}', token,
                json.dumps({'metadata': {'firebaseStorageDownloadTokens': download_token}}).encode())
        media_url = f'https://firebasestorage.googleapis.com/v0/b/{BUCKET}/o/{quoted}?alt=media&token={download_token}'
        media_req = urllib.request.Request(media_url, method='HEAD')
        with urllib.request.urlopen(media_req, timeout=45) as response:
            if response.status != 200:
                raise RuntimeError(f'Download check failed for {path}')
        print(f'Uploaded and verified: {path}')

    def create(collection, doc_id, body):
        url = f'{BASE}/{collection}?documentId={urllib.parse.quote(doc_id, safe="")}'
        request('POST', url, token, json.dumps(document(body)).encode())
        print(f'Created: {collection}/{doc_id}')

    create('regions', REGION_ID, {'name': 'Exemplo ilustrativo - navio', 'archived': False,
                                  'xMin': 9990, 'xMax': 10950, 'yMin': 0, 'yMax': 200,
                                  'zMin': 0, 'zMax': 100})
    for tag, description, x, y, z, kind in TAGS:
        create('tags', tag, {'tag': tag, 'description': f'Exemplo ilustrativo - {description}',
                            'regionId': REGION_ID, 'x': x, 'y': y, 'z': z,
                            'type': kind, 'status': 'active'})
    drawings = {'version': 2, 'units': 'm', 'exampleRegionId': REGION_ID,
                'initialZoom': 4, 'shareZoom': 3}
    for view, (path, _, width, height) in FILES.items():
        drawings[view] = {'path': path, 'pageIndex': 0,
                          'page': {'width': width, 'height': height, 'rotation': 0},
                          'calibration': calibration(view, path)}
    create('settings', 'globalDrawings', drawings)


if __name__ == '__main__':
    main()
