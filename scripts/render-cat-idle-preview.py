"""Make a cropped motion preview from real browser captures (no synthesized poses)."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

root = Path('test-results/cat-idle')
state = json.loads((root / 'chromium-report.json').read_text(encoding='utf-8'))['samples'][0]
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
frames = []
for source in sorted((root / 'frames').glob('*.png')):
    image = Image.open(source).convert('RGB')
    frame = Image.new('RGB', (408, 238), '#f8f6ef')
    draw = ImageDraw.Draw(frame)
    for i, (side, label) in enumerate([('player', '我的猫咪'), ('enemy', '大胖橘')]):
        pose = state[side]
        size = pose['scaleX'] * 160
        x, y = pose['x'], pose['y']
        crop = image.crop(tuple(round(v * 2) for v in (x-size*.68, y-size*1.12, x+size*.68, y+size*.24)))
        frame.paste(crop.resize((194, 194), Image.Resampling.LANCZOS), (6+i*202, 36))
        draw.text((65+i*202, 8), label, fill='#695343', font=font)
    frames.append(frame)
frames[0].save(root / 'camp-cats-idle.gif', save_all=True, append_images=frames[1:], duration=200, loop=0, disposal=2)
sheet = Image.new('RGB', (408*3, 266*2), '#f8f6ef')
for i, index in enumerate([0, 2, 7, 12, 20, 28]):
    sheet.paste(frames[index], ((i%3)*408, (i//3)*266+28))
    ImageDraw.Draw(sheet).text(((i%3)*408+12, (i//3)*266+3), f'{index*.2+.1:.1f}s', fill='#695343', font=font)
sheet.save(root / 'motion-contact-sheet.png')
print(f'{len(frames)} actual frames -> {root / "camp-cats-idle.gif"}')
