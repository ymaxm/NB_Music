import re
from collections import defaultdict


def extract_and_replace_colors(css_content):
    color_map = defaultdict(str)
    color_counter = 1

    # 预定义颜色变量映射（可根据需要扩展）
    predefined_colors = {
        "#ad6eca": "--theme-1",
        "#3b91d8": "--theme-2",
        "#ffffff": "--text",
        "rgba(28, 28, 28, 0.95)": "--bg-1",
        "rgba(255, 255, 255, 0.1)": "--border-1"
    }

    # 匹配CSS颜色值的正则表达式
    color_pattern = re.compile(
        r'(#(?:[0-9a-fA-F]{3}){1,2})|'
        r'(rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:,\s*[\d.]+)?\s*\))',
        re.IGNORECASE
    )

    # 查找所有颜色值
    matches = color_pattern.findall(css_content)

    # 生成颜色映射
    for match in matches:
        color = match[0] or match[1]
        if color not in predefined_colors and color not in color_map:
            if color.startswith("#"):
                color_map[color] = f"--color-{color_counter}"
                color_counter += 1
            elif "rgba" in color:
                color_map[color] = f"--rgba-{color_counter}"
                color_counter += 1

    # 合并预定义颜色
    color_map.update(predefined_colors)

    # 替换颜色值为变量
    def replace_match(match):
        color = match.group(0)
        return f"var({color_map[color]})"

    modified_css = color_pattern.sub(replace_match, css_content)

    # 生成变量声明
    var_declarations = "\n".join(
        [f"    {var}: {color};" for color, var in color_map.items()]
    )

    return f":root {{\n{var_declarations}\n}}\n\n{modified_css}"


# 使用示例
with open("style.css", "r", encoding='utf-8') as f:
    css = f.read()

processed_css = extract_and_replace_colors(css)

with open("styles-processed.css", "w", encoding='utf-8') as f:
    f.write(processed_css)