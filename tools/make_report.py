"""Create the common report for variants 1 and 2; keep the sample typography."""
from pathlib import Path
import json
import math
import shutil
import subprocess
import tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'reports'
FIG=OUT/'figures'
FIG.mkdir(parents=True,exist_ok=True)
metrics={}
for name in ['shapes','detail']:
    clean=np.asarray(Image.open(ROOT/'test_input'/f'{name}.png'),dtype=float)
    noisy=np.asarray(Image.open(ROOT/'test_input'/f'{name}_noisy.png'),dtype=float)
    methods={}
    for method in ['noisy','mean3','mean5','gauss5']:
        image=noisy if method=='noisy' else np.asarray(Image.open(ROOT/'test_output'/f'{name}_noisy'/f'{method}.png'),dtype=float)
        mse=float(np.mean((image-clean)**2))
        methods[method]={'mse':round(mse,2),'psnr':round(10*math.log10(255**2/mse),2),
                         'bias':round(float((image-clean).mean()),2)}
    metrics[name]={'noise_mean':float((noisy-clean).mean()),
                   'noise_std':float((noisy-clean).std()),'methods':methods}
(OUT/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',15)
def montage(name,items,columns):
    canvas=Image.new('RGB',(272*columns,224*math.ceil(len(items)/columns)),'white')
    draw=ImageDraw.Draw(canvas)
    for i,(label,path) in enumerate(items):
        x,y=(i%columns)*272,(i//columns)*224
        canvas.paste(Image.open(path).convert('RGB'),(x+8,y+28))
        draw.text((x+8,y+5),label,font=font,fill='black')
    path=FIG/(name+'.png')
    canvas.save(path)
    return path
inputs=montage('inputs',[(label,ROOT/'test_input'/name) for label,name in [
    ('А: фигуры, оригинал','shapes.png'),('А: гауссов шум','shapes_noisy.png'),
    ('Б: детали, оригинал','detail.png'),('Б: гауссов шум','detail_noisy.png')]],2)
edges=[]
averages=[]
for scene,label in [('shapes','А'),('detail','Б')]:
    for method,title in [('gray','Исходное'),('laplace','Лаплас'),('roberts','Робертс'),('sobel','Собел')]:
        edges.append((label+': '+title,ROOT/'test_output'/scene/(method+'.png')))
    for method,title in [('gray','С шумом'),('mean3','Среднее 3×3'),('mean5','Среднее 5×5'),('gauss5','Гаусс 5×5')]:
        averages.append((label+': '+title,ROOT/'test_output'/(scene+'_noisy')/(method+'.png')))
edge_figure=montage('edges',edges,4)
noise_edges=montage('edges_noisy',[(title,ROOT/'test_output'/'shapes_noisy'/(method+'.png')) for method,title in [
    ('gray','Вход с шумом'),('laplace','Лаплас'),('roberts','Робертс'),('sobel','Собел')]],4)
average_figure=montage('averages',averages,4)

doc=Document()
for style in doc.styles:
    if hasattr(style,'font'):
        style.font.name='Times New Roman'
        style.font.color.rgb=RGBColor(0,0,0)
        style.font.underline=False
for color in doc.styles.element.iter(qn('w:color')):
    color.attrib.clear()
    color.set(qn('w:val'),'000000')
section=doc.sections[0]
section.different_first_page_header_footer=True
footer=section.footer.paragraphs[0]
footer.alignment=WD_ALIGN_PARAGRAPH.CENTER
field=OxmlElement('w:fldSimple')
field.set(qn('w:instr'),'PAGE')
footer._p.append(field)
def p(text,center=False):
    paragraph=doc.add_paragraph(text)
    if center:paragraph.alignment=WD_ALIGN_PARAGRAPH.CENTER
    return paragraph
def h(text):doc.add_heading(text,level=1)
def eq(text):p(text,True)
def figure(path,caption,width=16.5):
    doc.add_picture(str(path),width=Cm(width))
    p(caption,True)
def table(headers,rows):
    t=doc.add_table(rows=1,cols=len(headers))
    t.style='Table Grid'
    for cell,value in zip(t.rows[0].cells,headers):cell.text=value
    for values in rows:
        for cell,value in zip(t.add_row().cells,values):cell.text=str(value)

p('МИНОБРНАУКИ РОССИИ',True)
p('Воронежский государственный университет\nФакультет прикладной математики, информатики и механики\nКафедра математического обеспечения ЭВМ',True)
p('\n\n\n')
p('Цифровая обработка изображений',True)
p('Лабораторная работа № 2',True)
p('Выделение контуров и усредняющая фильтрация\nВарианты 1 и 2',True)
p('\n\n\n')
p('Выполнил(а): __________________________\nГруппа: ______________________________\nПреподаватель: Сырых А. С.')
p('\n\n')
p('Воронеж, 2026',True)
doc.add_page_break()

h('1. Постановка задачи')
p('Вариант 1. Выделение контуров на изображении операторами Лапласа, Робертса и Собела.')
p('Вариант 2. Удаление шума с изображений в пространственной области усредняющими фильтрами. Для испытаний используется гауссов шум, добавленный в графическом редакторе.')
p('По условию для оценки «удовлетворительно» необходимо выполнить два варианта на выбор. В работе выбраны варианты 1 и 2. Реализация выполнена на C++17; поскольку цвет не является предметом исследования, изображения обрабатываются в градациях серого.')
p('Требуется также дописать заданный класс Image: обеспечить чтение и запись PNG, работу с 1–4 каналами, глубокое копирование и безопасный доступ к пикселям. Методы обработки реализуются отдельно без расширения интерфейса Image.')

h('2. Математическое описание')
p('Изображение представляется функцией яркости f(x,y) со значениями от 0 до 255. Для цветного входа яркость вычисляется по формуле (1); у одно- и двухканального изображения используется готовый канал яркости.')
eq('f = round(0.299R + 0.587G + 0.114B).  (1)')
p('На границах используется повторение ближайшего допустимого пикселя. После расчёта результат ограничивается и округляется по формуле (2). Это ограничение диапазона, а не нормализация по максимальному отклику изображения.')
eq('Q(t) = round(min(255, max(0,t))).  (2)')
h('2.1. Выделение контуров')
p('Лаплас оценивает вторую производную яркости. Используется маска [0 1 0; 1 −4 1; 0 1 0]. Для отображения берётся модуль результата:')
eq('L = f(x−1,y)+f(x+1,y)+f(x,y−1)+f(x,y+1)−4f(x,y);\ng(x,y) = Q(|L|).  (3)')
p('Робертс вычисляет диагональные разности в окне 2×2. Отсутствие усреднения делает его чувствительным к случайным перепадам:')
eq('a = f(x,y)−f(x+1,y+1); b = f(x+1,y)−f(x,y+1);\ng(x,y) = Q(√(a²+b²)).  (4)')
p('Собел вычисляет две компоненты градиента по маскам 3×3. В каждой маске разность по одной координате сочетается со сглаживанием по другой:')
eq('Sx = [−1 0 1; −2 0 2; −1 0 1];\nSy = [−1 −2 −1; 0 0 0; 1 2 1];\nGx = Σ_i Σ_j Sx[j,i] f(x+i,y+j);\nGy = Σ_i Σ_j Sy[j,i] f(x+i,y+j);\ng(x,y) = Q(√(Gx²+Gy²)), i,j = −1,0,1.  (5)')
p('Порядок обработки: получить полутоновый вход; для каждого пикселя вычислить отклик выбранного оператора; применить (2); записать результат в новое изображение. Исходный массив не изменяется. Пороговая бинаризация не выполняется.')
h('2.2. Усредняющие фильтры')
p('Для арифметического усреднения все k² пикселей окна имеют одинаковый вес. Используются нечётные размеры k=3 и k=5, радиус r=(k−1)/2:')
eq('g(x,y) = Q((1/k²) Σ_i Σ_j f(x+i,y+j)), i,j = −r,…,r.  (6)')
p('Гауссов фильтр сильнее учитывает соседей, расположенных ближе к центру. Веса нормируются, чтобы их сумма была равна единице и постоянная яркость сохранялась. Используется окно 5×5 при σ=1:')
eq('v(i,j) = exp(−(i²+j²)/(2σ²)); w(i,j) = v(i,j)/Σ_i Σ_j v(i,j);\ng(x,y) = Q(Σ_i Σ_j w(i,j) f(x+i,y+j)).  (7)')
p('Алгоритм усреднения: подготовить веса; нормировать их; пройти по всем пикселям и просуммировать взвешенные значения окна; округлить и записать результат. Функция applyBoxBlur использует равные веса по (6), а applyGaussianBlur — гауссовы веса по (7) и положительное σ.')
p('Для сравнения результата подавления шума с чистым эталоном используются средний квадрат ошибки и PSNR. Меньшая MSE и больший PSNR означают более близкое совпадение яркостей:')
eq('MSE = (1/(WH)) Σ_x Σ_y (g(x,y)−f(x,y))²;\nPSNR = 10 log₁₀(255²/MSE), дБ.  (8)')

h('3. Программная реализация')
p('Класс Image хранит данные в std::unique_ptr<uint8_t[]>. Конструктор копирования и присваивание создают независимый массив. Недопустимый доступ к пикселям игнорируется. Для серого входа getColor возвращает яркость в r, а g и b устанавливает в ноль. setColor сохраняет альфа-канал. Чтение и запись PNG используют библиотеки stb из задания.')
table(['Функция или файл','Назначение'],[
    ['toGrayscale','Преобразование RGB в яркость по (1).'],
    ['applyLaplacian, applyRoberts, applySobel','Операторы Лапласа, Робертса и Собела; формулы (3)–(5).'],
    ['applyBoxBlur, applyGaussianBlur','Арифметическое и гауссово усреднение; формулы (6), (7).'],
    ['sample и put','Повторение граничных пикселей; ограничение и округление результата.'],
    ['Source.cpp','Получение путей, запуск методов и проверка записи результатов.']])
p('Алгоритмы находятся в Filters.cpp, а интерфейс Image.h сохранён. Точка входа main находится в Source.cpp. Без аргументов запуска используются test_input/shapes_noisy.png и test_output/shapes_noisy. Два аргумента позволяют выбрать другой входной PNG и каталог результата. Один запуск создаёт семь PNG: полутоновый вход, три контурные карты и три результата усреднения. При ошибке чтения или записи выводится сообщение и возвращается код 1.')
p('В Visual Studio открывается Lab.sln, проект Lab назначается запускаемым, затем используется Ctrl+F5. Для проверки класса и фильтров запускается проект Tests. Исходники разделены на папки include, src и tests; подготовленные изображения лежат в test_input, результаты — в test_output. При сборке объектные файлы попадают в build, исполняемые — в bin. Приложение и тесты собираются отдельно, поскольку имеют разные точки входа main.')
p('Выполнено 18 тестовых случаев и 323 проверки, все успешно. Двенадцать случаев взяты из задания, шесть дополнительно проверяют постоянное поле, ступень яркости, импульс, параметры, присваивание и сохранение прозрачности. У ступени 0→40 проверены ответы Лапласа 40, Робертса 57 и Собела 160. У одиночного импульса 255 среднее 3×3 даёт 28, а гауссов фильтр 3×3 при σ=1 — 52.')

h('4. Тестовые изображения')
p('Подготовлены две сцены 256×192 пикселя. Набор А содержит крупные фигуры, однородные области и участок изменения яркости. Набор Б содержит тонкие штрихи, шахматный фрагмент, окружность и диагональ. Такие изображения позволяют оценить не только сглаживание фона, но и сохранение деталей.')
figure(inputs,'Рисунок 1. Чистые эталоны слева и соответствующие изображения с гауссовым шумом справа.',15)
p('Гауссов шум добавлен редактором ImageMagick вне C++-программы фильтрации: +noise Gaussian, -attenuate 0.9, глубина 8 бит, начальные значения генератора 731 и 1201. Это соответствует разрешению использовать другой графический редактор в варианте 2. Чистые эталоны сохранены отдельно.')
p(f"Измеренное стандартное отклонение разности с эталоном составляет {metrics['shapes']['noise_std']:.2f} для набора А и {metrics['detail']['noise_std']:.2f} для Б. Параметр шума в уровнях яркости отличается от σ пространственного гауссова фильтра.")

h('5. Результаты варианта 1')
figure(edge_figure,'Рисунок 2. Сверху набор А, снизу набор Б. В каждом ряду: вход, Лаплас, Робертс, Собел.')
p('На крупных фигурах все операторы выявляют границы. Лаплас показывает соседние отклики по обе стороны перепада, поскольку модуль второй разности отображает оба её знака. Робертс формирует компактный отклик, Собел — более широкий и яркий. Отличия связаны с размером окна и коэффициентами масок, поэтому одна яркость не определяет качество метода.')
p('На наборе Б видны близкие контуры тонких штрихов и клеток. На линейном градиенте внутренняя вторая разность близка к нулю, а первые разности реагируют на изменение яркости. Округление яркостей может создавать слабый остаточный отклик.')
figure(noise_edges,'Рисунок 3. Набор А с гауссовым шумом и результаты Лапласа, Робертса и Собела.')
p('После добавления шума контурные операторы реагируют на случайные перепады внутри однородных областей. У Собела присутствует поперечное сглаживание, но оно не устраняет шум полностью. Сильные отклики ограничиваются 255, поэтому после насыщения их яркость уже не пропорциональна точной величине производной.')

h('6. Результаты варианта 2')
figure(average_figure,'Рисунок 4. Сверху набор А, снизу набор Б. Шумный вход, среднее 3×3, среднее 5×5, Гаусс 5×5 с σ=1.')
rows=[]
for key,title in [('noisy','Вход с шумом'),('mean3','Среднее 3×3'),('mean5','Среднее 5×5'),('gauss5','Гаусс 5×5')]:
    a=metrics['shapes']['methods'][key];b=metrics['detail']['methods'][key]
    rows.append([title,f"{a['mse']:.2f}",f"{a['psnr']:.2f}",f"{b['mse']:.2f}",f"{b['psnr']:.2f}"])
table(['Метод','А: MSE','А: PSNR, дБ','Б: MSE','Б: PSNR, дБ'],rows)
p('На наборе А все три фильтра уменьшают ошибку по сравнению с шумным входом. Гауссов фильтр даёт наименьшую MSE из рассмотренных усредняющих методов: 95.38. Его удалённые соседи имеют меньшие веса, поэтому границы смешиваются слабее, чем при равномерном окне 5×5.')
p('Увеличение арифметического окна с 3×3 до 5×5 снижает зернистость фона, но повышает MSE на А с 111.66 до 147.53: размытие границ перевешивает дополнительное подавление шума. На наборе Б тонкие элементы сравнимы по ширине с окном. Все три фильтра ухудшают общую MSE относительно шумного входа, поскольку теряется часть полезных деталей.')
p('Таким образом, видимое сглаживание и близость к эталону — разные критерии. Размер окна следует выбирать по содержанию изображения. Из трёх проверенных усредняющих настроек гауссов фильтр 5×5 с σ=1 имеет меньшую ошибку на обеих сценах; это не утверждение о его превосходстве при любых входах.')

h('7. Вывод')
p('Выполнены два выбранных варианта: выделение контуров и подавление гауссова шума усредняющими фильтрами. Реализован заданный класс Image без добавления методов. Приложение обрабатывает четыре демонстрационных входа и сохраняет 28 выходных PNG; все 18 тестовых случаев пройдены.')
p('Лаплас, Робертс и Собел обнаруживают перепады яркости, но также реагируют на шум. Усреднение уменьшает колебания на ровных областях и размывает границы. Увеличение окна не гарантирует улучшения общей ошибки. Полученные результаты согласуются с формулами операторов и подтверждаются сравнением с чистыми эталонами.')
h('Источники')
p('1. Материалы задания: lab_1.pdf, image_env.pdf, ReadMe.pdf, интерфейс Image и тесты tests_image.cpp.')
p('2. Библиотеки stb_image и stb_image_write для чтения и записи PNG из материалов задания.')
p('3. Библиотека doctest и предоставленное тестовое окружение.')
p('4. Справочная документация ImageMagick по добавлению гауссова шума.')
for title,filename in [('Приложение А. Алгоритмы обработки','src/Filters.cpp'),('Приложение Б. Класс Image','src/Image.cpp')]:
    h(title)
    paragraph=doc.add_paragraph()
    run=paragraph.add_run((ROOT/filename).read_text())
    run.font.name='Courier New'
def apply_sample_format(document):
    """Typography measured from the supplied classmate report; no text is copied."""
    from docx.shared import Twips
    for section in document.sections:
        section.page_width=Twips(11906)
        section.page_height=Twips(16838)
        section.top_margin=Twips(1134)
        section.bottom_margin=Twips(1134)
        section.left_margin=Twips(1701)
        section.right_margin=Twips(850)
        section.header_distance=Twips(720)
        section.footer_distance=Twips(720)
        section.gutter=Twips(0)
        section.different_first_page_header_footer=True

    def font(run, name='Times New Roman', size=14, bold=False):
        run.font.name=name
        run.font.size=Pt(size)
        run.font.color.rgb=RGBColor(0,0,0)
        run.font.bold=bold
        run.font.italic=False
        run.font.underline=False
        fonts=run._r.get_or_add_rPr().get_or_add_rFonts()
        for key in list(fonts.attrib):
            if 'theme' in key.lower(): del fonts.attrib[key]
        for key in ['ascii','hAnsi','eastAsia','cs']: fonts.set(qn('w:'+key),name)

    normal=document.styles['Normal']
    normal.font.name='Times New Roman'
    normal.font.size=Pt(14)
    normal.font.bold=False
    normal.paragraph_format.first_line_indent=Twips(720)
    normal.paragraph_format.line_spacing=1.5
    normal.paragraph_format.space_before=Pt(0)
    normal.paragraph_format.space_after=Pt(0)
    normal.paragraph_format.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
    heading=document.styles['Heading 1']
    heading.font.name='Times New Roman'
    heading.font.size=Pt(14)
    heading.font.bold=True
    heading.paragraph_format.alignment=WD_ALIGN_PARAGRAPH.CENTER
    heading.paragraph_format.first_line_indent=Twips(0)
    heading.paragraph_format.space_before=Pt(0)
    heading.paragraph_format.space_after=Pt(0)
    heading.paragraph_format.line_spacing=1.5

    for i, paragraph in enumerate(document.paragraphs):
        pf=paragraph.paragraph_format
        is_code=any(run.font.name=='Courier New' for run in paragraph.runs)
        is_heading=paragraph.style.name.startswith('Heading')
        is_picture=bool(paragraph._p.xpath('.//w:drawing'))
        is_caption=paragraph.text.startswith('Рисунок ')
        is_equation=paragraph.alignment==WD_ALIGN_PARAGRAPH.CENTER and not is_heading and not is_caption and i>10
        pf.space_before=Pt(0)
        pf.space_after=Pt(0)
        pf.line_spacing=1.5
        pf.first_line_indent=Twips(720)
        pf.left_indent=Twips(0)
        pf.right_indent=Twips(0)
        pf.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
        pf.keep_together=False
        pf.keep_with_next=False
        # Old page breaks were positioned for 10–12 pt text. Let the larger
        # sample typography flow naturally, retaining title/appendix boundaries.
        for page_break in list(paragraph._p.xpath('.//w:br[@w:type="page"]')):
            page_break.getparent().remove(page_break)
        pf.page_break_before=(i==11 or paragraph.text.startswith('Приложение А.')
                              or paragraph.text.startswith('Приложение Б.'))
        for run in paragraph.runs:font(run,bold=is_heading)
        if is_heading:
            pf.alignment=WD_ALIGN_PARAGRAPH.CENTER
            pf.first_line_indent=Twips(0)
            pf.keep_with_next=True
            pf.keep_together=True
        elif is_code:
            pf.line_spacing=1.0
            pf.first_line_indent=Twips(0)
            pf.widow_control=False
            for run in paragraph.runs:font(run,'Consolas',12)
        elif is_picture or is_caption or is_equation:
            pf.alignment=WD_ALIGN_PARAGRAPH.CENTER
            pf.first_line_indent=Twips(720) if is_caption else Twips(0)
            pf.keep_together=True
            pf.keep_with_next=is_picture
        if not paragraph.text and not is_picture:
            pf.line_spacing=Pt(1)
            pf.line_spacing_rule=WD_LINE_SPACING.EXACTLY
            for run in paragraph.runs:font(run,size=1)
        if i<10:
            pf.alignment=WD_ALIGN_PARAGRAPH.CENTER
            pf.first_line_indent=Twips(0)
            pf.space_before=Pt(14) if paragraph.text.strip() and i else Pt(0)
            pf.space_after=Pt(14) if paragraph.text.strip() else Pt(0)
            if not paragraph.text.strip():
                pf.line_spacing=Pt(14)
                pf.line_spacing_rule=WD_LINE_SPACING.EXACTLY
            if i==0:pf.first_line_indent=Twips(720)
            if i==3:
                for run in paragraph.runs:font(run,bold=True)
            if i==7:pf.alignment=WD_ALIGN_PARAGRAPH.LEFT

    for shape in document.inline_shapes:
        if shape.width > Twips(9355):
            shape.height=round(shape.height*Twips(9355)/shape.width)
            shape.width=Twips(9355)
    for table in document.tables:
        table.autofit=False
        column_width=Twips(9355//len(table.columns))
        for column in table.columns:column.width=column_width
        width=table._tbl.tblPr.find(qn('w:tblW'))
        width.set(qn('w:type'),'dxa')
        width.set(qn('w:w'),'9355')
        for row_index,row in enumerate(table.rows):
            row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
            if row_index==0:row._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
            for cell in row.cells:
                cell.width=column_width
                for paragraph in cell.paragraphs:
                    pf=paragraph.paragraph_format
                    pf.space_before=pf.space_after=Pt(0)
                    pf.line_spacing=1.5
                    pf.first_line_indent=Twips(0)
                    pf.alignment=WD_ALIGN_PARAGRAPH.LEFT
                    pf.keep_with_next=(row_index==0)
                    for run in paragraph.runs:font(run)
    for section in document.sections:
        for paragraph in section.footer.paragraphs:
            paragraph.paragraph_format.line_spacing=1.15
            paragraph.paragraph_format.first_line_indent=Twips(0)
            paragraph.paragraph_format.space_before=paragraph.paragraph_format.space_after=Pt(0)
            paragraph.alignment=WD_ALIGN_PARAGRAPH.CENTER
            for run in paragraph.runs:font(run)

apply_sample_format(doc)
doc.core_properties.title='Лабораторная работа №2. Варианты 1 и 2'
doc.core_properties.author=''
doc.save(OUT/'Отчет.docx')
office=shutil.which('soffice') or shutil.which('libreoffice')
if not office:raise RuntimeError('LibreOffice is required for PDF export')
with tempfile.TemporaryDirectory(prefix='kg-report-') as directory:
    path=Path(directory)
    subprocess.run([office,'-env:UserInstallation='+(path/'profile').as_uri(),'--headless',
                    '--convert-to','pdf:writer_pdf_Export','--outdir',str(path),str(OUT/'Отчет.docx')],check=True)
    exported=path/'Отчет.pdf'
    if not exported.is_file():raise RuntimeError('PDF export failed')
    shutil.copyfile(exported,OUT/'Отчет.pdf')
print('Created the common report for variants 1 and 2.')
