import re
from pathlib import Path
from bs4 import BeautifulSoup
import cssutils
from typing import Dict, Set, Tuple

# 定义工具类映射
UTILITY_CLASSES = {
    # 布局类
    'flex-center': {
        'display': 'flex',
        'align-items': 'center',
        'justify-content': 'center'
    },
    'flex-between': {
        'display': 'flex',
        'align-items': 'center',
        'justify-content': 'space-between'
    },
    'flex-col': {
        'display': 'flex',
        'flex-direction': 'column'
    },
    'grid-2': {
        'display': 'grid',
        'grid-template-columns': 'repeat(2, 1fr)',
        'gap': '16px'
    },
    
    # 视觉效果类
    'glass': {
        'backdrop-filter': 'blur(20px)',
        '-webkit-backdrop-filter': 'blur(20px)',
        'background': 'var(--mica)',
        'border': '1px solid var(--border-1)'
    },
    'shadow-sm': {
        'box-shadow': '0 2px 8px var(--sd)'
    },
    'shadow-md': {
        'box-shadow': '0 8px 32px var(--sd)'
    },
    
    # 动画类
    'transition-normal': {
        'transition': 'all 0.2s ease'
    },
    'transition-slow': {
        'transition': 'all 0.3s ease'
    },
    'hover-scale': {
        'transition': 'transform 0.2s ease',
        'cursor': 'pointer'
    },
    
    # 圆角类
    'rounded-sm': {
        'border-radius': '4px'
    },
    'rounded': {
        'border-radius': '8px'
    },
    'rounded-lg': {
        'border-radius': '16px'
    },
    'rounded-full': {
        'border-radius': '9999px'
    },
    
    # 文本类
    'text-ellipsis': {
        'overflow': 'hidden',
        'text-overflow': 'ellipsis',
        'white-space': 'nowrap'
    },
    'text-center': {
        'text-align': 'center'
    },
    
    # 间距类
    'p-4': {
        'padding': '16px'
    },
    'gap-4': {
        'gap': '16px'
    }
}

class CSSRefactor:
    def __init__(self, css_path: Path, html_path: Path):
        self.css_path = css_path
        self.html_path = html_path
        self.css_rules = {}
        self.updated_rules = {}
        
    def parse_css_properties(self, css_text: str) -> Dict:
        """解析CSS规则中的属性"""
        properties = {}
        style = cssutils.css.CSSStyleDeclaration(cssText=css_text)
        for prop in style:
            properties[prop.name] = prop.value
        return properties

    def check_utility_match(self, properties: Dict, utility_props: Dict) -> bool:
        """检查属性是否匹配工具类"""
        return all(
            prop in properties and properties[prop] == value 
            for prop, value in utility_props.items()
        )

    def process_files(self) -> Tuple[int, int]:
        """处理CSS和HTML文件"""
        # 读取文件
        with open(self.css_path, encoding='utf-8') as f:
            css_content = f.read()
        with open(self.html_path, encoding='utf-8') as f:
            html_content = f.read()

        soup = BeautifulSoup(html_content, 'html.parser')
        sheet = cssutils.parseString(css_content)

        # 解析CSS规则
        for rule in sheet:
            if rule.type == rule.STYLE_RULE:
                self.css_rules[rule.selectorText] = self.parse_css_properties(rule.style.cssText)

        # 处理HTML元素
        for elem in soup.find_all(class_=True):
            self._process_element(elem)

        # 生成新文件
        self._generate_new_files(soup)
        
        return len(self.css_rules), len(self.updated_rules)

    def _process_element(self, elem):
        """处理单个HTML元素"""
        orig_classes = set(elem['class'])
        new_classes = set(orig_classes)

        for class_name in orig_classes:
            selector = f'.{class_name}'
            if selector in self.css_rules:
                props = self.css_rules[selector]
                
                # 检查工具类匹配
                for util_name, util_props in UTILITY_CLASSES.items():
                    if self.check_utility_match(props, util_props):
                        new_classes.add(util_name)
                        
                        # 更新原始规则
                        if selector not in self.updated_rules:
                            self.updated_rules[selector] = dict(props)
                        for prop in util_props:
                            self.updated_rules[selector].pop(prop, None)

        elem['class'] = list(new_classes)

    def _generate_new_files(self, soup):
        """生成新的CSS和HTML文件"""
        # 生成CSS
        new_css = self._generate_utility_css()
        new_css += self._generate_updated_css()
        
        # 保存文件
        output_dir = self.css_path.parent / 'refactored'
        output_dir.mkdir(exist_ok=True)
        
        with open(output_dir / 'style.new.css', 'w', encoding='utf-8') as f:
            f.write(new_css)
        
        with open(output_dir / 'index.new.html', 'w', encoding='utf-8') as f:
            f.write(str(soup.prettify()))

    def _generate_utility_css(self) -> str:
        """生成工具类CSS"""
        css = "/* 工具类 */\n"
        for util_name, util_props in UTILITY_CLASSES.items():
            css += f".{util_name} {{\n"
            for prop, value in util_props.items():
                css += f"    {prop}: {value};\n"
            css += "}\n\n"
        return css

    def _generate_updated_css(self) -> str:
        """生成更新后的原始CSS"""
        css = "/* 原始类 */\n"
        for selector, props in self.updated_rules.items():
            if props:  # 只添加还有剩余属性的类
                css += f"{selector} {{\n"
                for prop, value in props.items():
                    css += f"    {prop}: {value};\n"
                css += "}\n\n"
        return css

def main():
    """主函数"""
    css_path = Path('F:/Code/Web/NB_Music/src/style.css')
    html_path = Path('F:/Code/Web/NB_Music/src/main.html')
    
    refactor = CSSRefactor(css_path, html_path)
    orig_count, updated_count = refactor.process_files()
    
    print(f"原始CSS规则数: {orig_count}")
    print(f"更新后CSS规则数: {updated_count}")
    print(f"文件已保存到: {css_path.parent / 'refactored'}")

if __name__ == "__main__":
    main()