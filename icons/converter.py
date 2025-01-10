from PIL import Image
import os

def create_icons(png_path, output_dir):
    # 检查输入的 PNG 文件是否存在
    if not os.path.isfile(png_path):
        raise FileNotFoundError("输入的 PNG 文件不存在！")

    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)

    # 加载 PNG 图片
    img = Image.open(png_path)
    img = img.convert("RGBA")  # 确保有 alpha 通道

    # 生成 Windows 的 .ico 文件
    ico_path = os.path.join(output_dir, "icon.ico")
    img.save(ico_path, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])
    print(f"生成 Windows 图标: {ico_path}")

    # 生成 macOS 的 .icns 文件
    icns_path = os.path.join(output_dir, "icon.icns")
    img.save(icns_path, format="ICNS")
    print(f"生成 macOS 图标: {icns_path}")

    # 生成 Linux 的多尺寸 PNG 图标
    sizes = [512, 256, 128, 64, 32, 16]
    for size in sizes:
        resized_img = img.resize((size, size), Image.Resampling.LANCZOS)  # 使用 LANCZOS 代替 ANTIALIAS
        png_path = os.path.join(output_dir, f"icon_{size}x{size}.png")
        resized_img.save(png_path, format="PNG")
        print(f"生成 {size}x{size} PNG 图标: {png_path}")

if __name__ == "__main__":
    input_png = "NB Music.png"  # 替换为你的 PNG 文件路径
    output_directory = "./"  # 替换为你想保存图标的输出目录

    try:
        create_icons(input_png, output_directory)
    except Exception as e:
        print(f"发生错误: {e}")
