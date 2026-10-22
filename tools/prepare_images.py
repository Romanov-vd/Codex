"""Create two grayscale scenes; add Gaussian noise using ImageMagick editor."""
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / "input"
folder.mkdir(exist_ok=True)

image = Image.new("L", (256, 192), 60)
draw = ImageDraw.Draw(image)
draw.rectangle((20, 22, 110, 108), fill=195)
draw.ellipse((143, 22, 227, 106), fill=155)
draw.polygon([(140, 165), (190, 115), (238, 165)], fill=220)
for x in range(20, 113):
    draw.line((x, 136, x, 170), fill=round(60 + (x-20)*140/92))
image.save(folder / "shapes.png")

image = Image.new("L", (256, 192), 0)
draw = ImageDraw.Draw(image)
for x in range(256):
    draw.line((x, 0, x, 191), fill=round(40+175*x/255))
for y in range(16, 82, 8):
    draw.line((16,y,118,y), fill=225, width=2)
for x in range(144, 240, 12):
    draw.line((x,16,x,84), fill=35, width=3)
for y in range(112, 176, 8):
    for x in range(16, 112, 8):
        draw.rectangle((x,y,x+7,y+7), fill=70 if (x+y)//8 % 2 else 190)
draw.ellipse((145,108,232,180), outline=45, width=2)
draw.line((140,180,236,108), fill=230, width=1)
image.save(folder / "detail.png")

for seed, name in [(731, "shapes"), (1201, "detail")]:
    subprocess.run([
        "magick", str(folder / (name+".png")), "-seed", str(seed),
        "-attenuate", "0.9", "+noise", "Gaussian", "-depth", "8",
        "-define", "png:color-type=0", str(folder / (name+"_noisy.png"))
    ], check=True)
print("Prepared 2 clean and 2 noisy grayscale images.")
