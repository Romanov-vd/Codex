"""Editable Word equations, built from LaTeX with Pandoc's OMML writer."""
from copy import deepcopy
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZipFile
from lxml import etree
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

# One entry per numbered formula in the report. Row breaks preserve readability.
FORMULAS = {
    1: r'f(x,y)=\operatorname{round}(0.299R+0.587G+0.114B)',
    2: r'''\begin{gathered}
        S_x=\begin{bmatrix}-1&0&1\\-2&0&2\\-1&0&1\end{bmatrix}\\
        S_y=\begin{bmatrix}-1&-2&-1\\0&0&0\\1&2&1\end{bmatrix}
        \end{gathered}''',
    3: r'''\begin{gathered}
        G_x=\sum_{i=-1}^{1}\sum_{j=-1}^{1}S_x[j,i]f(x+i,y+j)\\
        G_y=\sum_{i=-1}^{1}\sum_{j=-1}^{1}S_y[j,i]f(x+i,y+j)\\
        M(x,y)=\sqrt{G_x^2+G_y^2}
        \end{gathered}''',
    4: r'''\begin{gathered}
        Q(t)=\operatorname{round}(\min(255,\max(0,t)))\\
        g(x,y)=Q(M(x,y))\end{gathered}''',
    5: r'''R_x=\begin{bmatrix}1&0\\0&-1\end{bmatrix},\quad
        R_y=\begin{bmatrix}0&1\\-1&0\end{bmatrix}''',
    6: r'''\begin{gathered}
        a=f(x,y)-f(x+1,y+1)\\
        b=f(x+1,y)-f(x,y+1)\\
        M(x,y)=\sqrt{a^2+b^2}\end{gathered}''',
    7: r'\Delta f=\frac{\partial^2 f}{\partial x^2}+\frac{\partial^2 f}{\partial y^2}',
    8: r'K=\begin{bmatrix}0&1&0\\1&-4&1\\0&1&0\end{bmatrix}',
    9: r'''\begin{gathered}
        L=f(x-1,y)+f(x+1,y)\\
        {}+f(x,y-1)+f(x,y+1)-4f(x,y)\\
        g(x,y)=Q(\lvert L\rvert)\end{gathered}''',
    10: r'g(x,y)=Q\left(\frac{1}{k^2}\sum_{i=-r}^{r}\sum_{j=-r}^{r}f(x+i,y+j)\right)',
    11: r'G(i,j)=\frac{1}{2\pi\sigma^2}\exp\left(-\frac{i^2+j^2}{2\sigma^2}\right)',
    12: r'''\begin{gathered}
        w(i,j)=\frac{G(i,j)}{\sum_{i=-r}^{r}\sum_{j=-r}^{r}G(i,j)}\\
        \sum_{i=-r}^{r}\sum_{j=-r}^{r}w(i,j)=1\end{gathered}''',
    13: r'g(x,y)=Q\left(\sum_{i=-r}^{r}\sum_{j=-r}^{r}w(i,j)f(x+i,y+j)\right)',
    14: r'g(x,y)=v_{\frac{k^2-1}{2}}',
    15: r'g(x,y)=\min_{\substack{-r\le i\le r\\-r\le j\le r}} f(x+i,y+j)',
    16: r'g(x,y)=\max_{\substack{-r\le i\le r\\-r\le j\le r}} f(x+i,y+j)',
    17: r'''\begin{gathered}
        \mathrm{MSE}=\frac{1}{WH}\sum_{x=0}^{W-1}\sum_{y=0}^{H-1}\bigl(g(x,y)-f(x,y)\bigr)^2\\
        \mathrm{PSNR}=10\log_{10}\left(\frac{255^2}{\mathrm{MSE}}\right)\end{gathered}''',
}


def build_equations():
    pandoc = shutil.which('pandoc')
    if not pandoc:
        raise RuntimeError('Pandoc is required to build editable Word equations')
    markdown = '\n\n'.join('$$\n' + formula + r'\qquad (' + str(number) + ')\n$$'
                           for number, formula in FORMULAS.items())
    with tempfile.TemporaryDirectory(prefix='kg-equations-') as directory:
        path = Path(directory) / 'equations.docx'
        result = subprocess.run([pandoc, '--from=markdown+tex_math_dollars', '--to=docx', '-o', str(path)],
                                input=markdown, text=True, capture_output=True, check=True)
        if result.stderr.strip():
            raise RuntimeError('Equation conversion warning: ' + result.stderr)
        with ZipFile(path) as archive:
            root = etree.fromstring(archive.read('word/document.xml'))
        ns = {'m': 'http://schemas.openxmlformats.org/officeDocument/2006/math'}
        equations = root.xpath('//m:oMathPara', namespaces=ns)
        if len(equations) != len(FORMULAS):
            raise RuntimeError('Not all formulas converted to Word equations')
        # Use the standard Windows math font; PDF rendering may use a math-font substitute.
        for equation in equations:
            for run in equation.xpath('.//m:r', namespaces=ns):
                props = run.find(qn('w:rPr'))
                if props is None:
                    props = OxmlElement('w:rPr')
                    run.insert(1 if run.find(qn("m:rPr")) is not None else 0, props)
                fonts = OxmlElement('w:rFonts')
                fonts.set(qn('w:ascii'), 'Cambria Math')
                fonts.set(qn('w:hAnsi'), 'Cambria Math')
                props.append(fonts)
                size = OxmlElement('w:sz')
                size.set(qn('w:val'), '28')
                props.append(size)
        return dict(zip(FORMULAS, equations))


def add_equation(document, equation):
    paragraph = document.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph._p.append(deepcopy(equation))
    return paragraph


def pdf_copy_with_typeset_equations(document, directory):
    """Avoid LibreOffice's OMML delimiter rendering defects in the PDF export.

    The delivered DOCX retains editable equations. Only the temporary PDF copy
    uses high-resolution TeX renderings of the same formula definitions.
    """
    from docx import Document
    from docx.shared import Inches
    from pypdf import PdfReader
    directory = Path(directory)
    source = (r'\documentclass[14pt]{extarticle}' '\n'
              r'\usepackage{amsmath,amssymb}' '\n'
              r'\usepackage[active,tightpage]{preview}' '\n'
              r'\PreviewEnvironment{displaymath}' '\n'
              r'\setlength\PreviewBorder{2pt}' '\n'
              r'\begin{document}' '\n')
    source += '\n'.join(r'\begin{displaymath}' + formula + r'\qquad (' + str(number)
                        + r')\end{displaymath}' for number, formula in FORMULAS.items())
    source += '\n' + r'\end{document}'
    tex = directory / 'equations.tex'
    tex.write_text(source)
    result = subprocess.run(['pdflatex', '-interaction=nonstopmode', '-halt-on-error', str(tex)],
                            cwd=directory, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('TeX equation rendering failed: ' + result.stdout[-2000:])
    rendered = PdfReader(directory / 'equations.pdf')
    if len(rendered.pages) != len(FORMULAS):
        raise RuntimeError('TeX did not produce all formula pages')
    subprocess.run(['pdftoppm', '-r', '450', '-png', str(directory / 'equations.pdf'),
                    str(directory / 'equation')], check=True, capture_output=True)
    images = sorted(directory.glob('equation-*.png'))
    # Re-open the complete package to preserve embedded figures and relationships.
    intermediate = directory / 'native.docx'
    document.save(intermediate)
    clone = Document(intermediate)
    paragraphs = [p for p in clone.paragraphs if p._p.xpath('.//m:oMathPara')]
    if len(paragraphs) != len(images):
        raise RuntimeError('Formula count differs in export copy')
    for paragraph, page, image in zip(paragraphs, rendered.pages, images):
        for math in list(paragraph._p.xpath('./m:oMathPara')):
            paragraph._p.remove(math)
        width = float(page.mediabox.width) / 72
        paragraph.add_run().add_picture(str(image), width=Inches(width))
    return clone
