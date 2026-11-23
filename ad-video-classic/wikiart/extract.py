"""Copy chosen WikiArt images (Hugging Face huggan/wikiart) into the ad's art folder with a provenance record.
    python3 -I extract.py key=shard:row ...   e.g. night=s51:451"""
import io, json, os, sys

import pyarrow.parquet as pq
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, '..', 'artad', 'art')
STYLES = ['Abstract_Expressionism', 'Action_painting', 'Analytical_Cubism', 'Art_Nouveau', 'Baroque', 'Color_Field_Painting', 'Contemporary_Realism',
          'Cubism', 'Early_Renaissance', 'Expressionism', 'Fauvism', 'High_Renaissance', 'Impressionism', 'Mannerism_Late_Renaissance', 'Minimalism',
          'Naive_Art_Primitivism', 'New_Realism', 'Northern_Renaissance', 'Pointillism', 'Pop_Art', 'Post_Impressionism', 'Realism', 'Rococo',
          'Romanticism', 'Symbolism', 'Synthetic_Cubism', 'Ukiyo_e']
by_shard = {}
for arg in sys.argv[1:]:
    key, ref = arg.split('=')
    shard, row = ref.split(':')
    by_shard.setdefault(shard, []).append((key, int(row), arg.split('=')[2] if arg.count('=') > 1 else ''))
for shard, items in by_shard.items():
    t = pq.read_table(os.path.join(HERE, shard + '.parquet'))
    for key, row, note in items:
        r = t.slice(row, 1).to_pylist()[0]
        im = Image.open(io.BytesIO(r['image']['bytes'])).convert('RGB')
        im.save(os.path.join(ART, key + '.jpg'), quality=95)
        json.dump({'key': key, 'source': 'WikiArt via Hugging Face dataset huggan/wikiart', 'ref': f'{shard}:{row}', 'style': STYLES[r['style']],
                   'licence': 'Public domain (old-master work; artist died more than 100 years ago)', 'size': f'{im.size[0]}x{im.size[1]}'},
                  open(os.path.join(ART, key + '.json'), 'w'), indent=1)
        print(key, im.size, STYLES[r['style']])
