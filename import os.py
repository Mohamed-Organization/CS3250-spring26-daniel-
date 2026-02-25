import os
from PIL import Image

# Make sure your image is named 'master.png'
img = Image.open("master.png")
sizes = [16, 32, 48, 96, 128]

if not os.path.exists("icons"):
    os.makedirs("icons")

for size in sizes:
    img.resize((size, size)).save(f"icons/icon-{size}.png")
    print(f"Created icon-{size}.png")
    