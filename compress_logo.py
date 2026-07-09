import os
from PIL import Image

image_path = 'logo.jpg'
output_path = 'logo.webp'

if os.path.exists(image_path):
    img = Image.open(image_path)
    # Resize to 512x512 max (since it's used at 240px and 140px)
    img.thumbnail((512, 512))
    img.save(output_path, 'webp', quality=85)
    print(f"Compressed {image_path} to {output_path}")
else:
    print("Logo not found.")
