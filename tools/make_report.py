"""Build the common DOCX/PDF report from actual PNG results and source files."""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image as PILImage, ImageDraw, ImageFont
from docx import Document
from docx.shared import Cm, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                               Image, Table, TableStyle, Preformatted)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports'
FIG = OUT / 'figures'
FIG.mkdir(parents=True, exist_ok=True)
metrics = {}
for name in ['shapes', 'detail']:
    original = np.asarray(PILImage.open(ROOT/'input'/f'{name}.png'), dtype=float)
    noise = np.asarray(PILImage.open(ROOT/'input'/f'{name}_noisy.png'), dtype=float)
    methods = {}
    for method in ['noisy','mean3','mean5','gauss5','median3','median5','min3','max3']:
        a = noise if method == 'noisy' else np.asarray(PILImage.open(ROOT/'output'/f'{name}_noisy'/f'{method}.png'), dtype=float)
        mse = float(np.mean((a-original)**2))
        methods[method] = {'mse':round(mse,2), 'psnr':round(10*math.log10(255**2/mse),2),
                           'bias':round(float((a-original).mean()),2)}
    metrics[name] = {'noise_mean':float((noise-original).mean()),
                     'noise_std':float((noise-original).std()), 'methods':methods}
(OUT/'metrics.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')

font_path = '/usr/share/fonts/truetype/dejavu/'
font = ImageFont.truetype(font_path+'DejaVuSans.ttf', 15)
def montage(name, items, columns):
    tile_w, tile_h = 272, 224
    canvas = PILImage.new('RGB', (columns*tile_w, math.ceil(len(items)/columns)*tile_h), 'white')
    draw = ImageDraw.Draw(canvas)
    for i, (label, path) in enumerate(items):
        x, y = (i % columns)*tile_w, (i//columns)*tile_h
        im = PILImage.open(path).convert('RGB')
        canvas.paste(im, (x+8,y+28))
        draw.text((x+8,y+5), label, fill='black', font=font)
    path = FIG / (name+'.png')
    canvas.save(path)
    return path

inputs = montage('inputs', [(label, ROOT/'input'/name) for label,name in [
    ('A: фигуры, оригинал','shapes.png'), ('A: гауссов шум','shapes_noisy.png'),
    ('Б: детали, оригинал','detail.png'), ('Б: гауссов шум','detail_noisy.png')]],2)
edge_items = []
for scene,label in [('shapes','A'),('detail','Б')]:
    for method,caption in [('gray','Исходное'),('laplace','Лаплас'),('roberts','Робертс'),('sobel','Собел')]:
        edge_items.append((label+': '+caption,ROOT/'output'/scene/(method+'.png')))
edge_fig = montage('edges',edge_items,4)
noise_edges = montage('edges_noisy',[(caption,ROOT/'output'/'shapes_noisy'/(method+'.png')) for method,caption in [
    ('gray','Вход с шумом'),('laplace','Лаплас'),('roberts','Робертс'),('sobel','Собел')]],4)
mean_items=[]
rank_items=[]
for scene,label in [('shapes','A'),('detail','Б')]:
    for method,caption in [('gray','С шумом'),('mean3','Среднее 3×3'),('mean5','Среднее 5×5'),('gauss5','Гаусс 5×5')]:
        mean_items.append((label+': '+caption,ROOT/'output'/(scene+'_noisy')/(method+'.png')))
    for method,caption in [('median3','Медиана 3×3'),('median5','Медиана 5×5'),('min3','Минимум 3×3'),('max3','Максимум 3×3')]:
        rank_items.append((label+': '+caption,ROOT/'output'/(scene+'_noisy')/(method+'.png')))
mean_fig=montage('averages',mean_items,4)
rank_fig=montage('ranks',rank_items,4)

for name,file in [('Body','DejaVuSerif.ttf'),('Bold','DejaVuSerif-Bold.ttf'),('Mono','DejaVuSansMono.ttf')]:
    pdfmetrics.registerFont(TTFont(name,font_path+file))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='Body',boldItalic='Bold')
style = ParagraphStyle('body',fontName='Body',fontSize=10.5,leading=14.5,spaceAfter=7,alignment=TA_JUSTIFY)
heading = ParagraphStyle('heading',parent=style,fontName='Bold',fontSize=14,leading=18,spaceAfter=13,alignment=0)
small = ParagraphStyle('small',parent=style,fontSize=8.4,leading=11,alignment=0)
center = ParagraphStyle('center',parent=style,alignment=TA_CENTER)
equation = ParagraphStyle('equation',parent=style,fontName='Mono',fontSize=9,leading=13,alignment=TA_CENTER)
code_style=ParagraphStyle('code',fontName='Mono',fontSize=7.1,leading=9.1)
story=[]
doc=Document()
section=doc.sections[0]
section.top_margin=Cm(2);section.bottom_margin=Cm(2)
section.left_margin=Cm(2);section.right_margin=Cm(2)
doc.styles['Normal'].font.name='Times New Roman'
doc.styles['Normal'].font.size=Pt(12)
doc.styles['Normal'].paragraph_format.space_after=Pt(6)


def p(text, kind='body'):
    ps = {'body':style,'center':center,'small':small,'eq':equation}[kind]
    story.append(Paragraph(escape(text).replace('\n','<br/>'),ps))
    para=doc.add_paragraph(text)
    if kind in ['center','eq']: para.alignment=WD_ALIGN_PARAGRAPH.CENTER
    if kind in ['small','eq']:
        for run in para.runs:run.font.size=Pt(10)
    return para

def h(text):
    story.append(Paragraph(escape(text),heading));doc.add_heading(text,level=1)

def page():
    story.append(PageBreak());doc.add_page_break()

def figure(path, caption, width=170):
    im=PILImage.open(path)
    story.append(Image(str(path),width=width*2.83465,height=width*2.83465*im.height/im.width))
    doc.add_picture(str(path),width=Cm(width/10))
    p(caption,'small')

def table(headers, rows):
    cells=[[Paragraph(escape(str(x)),small) for x in row] for row in [headers]+rows]
    count=len(headers)
    t=Table(cells,colWidths=[(170*2.83465)/count]*count,repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eeeeee')),
        ('GRID',(0,0),(-1,-1),0.4,colors.grey),('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5)]))
    story.append(t);story.append(Spacer(1,8))
    tdoc=doc.add_table(rows=1, cols=count);tdoc.style='Table Grid'
    for cell,value in zip(tdoc.rows[0].cells,headers):cell.text=str(value)
    for row in rows:
        for cell,value in zip(tdoc.add_row().cells,row):cell.text=str(value)

def metric_rows(methods):
    rows=[]
    for key,label in methods:
        a=metrics['shapes']['methods'][key];b=metrics['detail']['methods'][key]
        rows.append([label,f"{a['mse']:.2f}",f"{a['psnr']:.2f}",f"{b['mse']:.2f}",f"{b['psnr']:.2f}"])
    return rows

p('МИНОБРНАУКИ РОССИИ','center')
p('Воронежский государственный университет\nФакультет прикладной математики, информатики и механики\nКафедра математического обеспечения ЭВМ','center')
story.append(Spacer(1,95));doc.add_paragraph('\n\n\n')
p('Цифровая обработка изображений','center')
p('Лабораторная работа № 2','center')
p('Выделение контуров и пространственная фильтрация\nВарианты 1, 2 и 3','center')
story.append(Spacer(1,95));doc.add_paragraph('\n\n\n')
p('Выполнил(а): __________________________\nГруппа: ______________________________\nПреподаватель: Сырых А. С.','body')
story.append(Spacer(1,80));doc.add_paragraph('\n\n')
p('Воронеж, 2026','center')
page()

h('1. Постановка задачи')
p('Вариант 1. Выделение контуров на изображении операторами Лапласа, Робертса и Собела. Вариант 2. Удаление гауссова шума в пространственной области усредняющими фильтрами. Вариант 3. Удаление гауссова шума порядковыми фильтрами.')
p('Требуется реализовать программу на C++, подготовить изображения, демонстрирующие различия методов, и проанализировать результаты. Цвет не является предметом работы, поэтому обработка выполняется в градациях серого. Все варианты представлены в одном проекте и одном отчёте.')
p('Дополнительно реализуется заданный класс Image: чтение и запись PNG, поддержка 1–4 каналов, работа с пикселями, глубокое копирование и безопасное поведение пустого объекта. Интерфейс Image.h сохранён без добавления методов.')
h('2. Математическая модель')
p('Пусть f(x,y) — яркость пикселя, 0 ≤ f ≤ 255. Цветной вход преобразуется в полутоновый по формуле (1); для одно- и двухканального входа используется непосредственно канал яркости.')
p('f = round(0.299 R + 0.587 G + 0.114 B).  (1)','eq')
p('Все окрестности за пределами растра продолжаются ближайшим граничным значением: координаты ограничиваются диапазонами [0,W−1] и [0,H−1]. Это предотвращает появление ложного контура на постоянном фоне у края изображения.')
p('Итоговые значения округляются до ближайшего целого и ограничиваются диапазоном байта. Ограничение амплитуды не является нормализацией по максимуму конкретного изображения:')
p('Q(t) = round(min(255, max(0, t))).  (2)','eq')
h('2.1. Операторы выделения контуров')
p('Для Лапласа используется четырёхсвязная дискретная вторая производная (3). Модуль позволяет отобразить положительные и отрицательные отклики одной яркостью.')
p('L = f(x−1,y)+f(x+1,y)+f(x,y−1)+f(x,y+1)−4f(x,y);\ng(x,y) = Q(|L|).  (3)','eq')
p('Робертс вычисляет две диагональные разности в окне 2×2. Результат определяется длиной вектора (4). Малое окно обеспечивает компактный отклик, но не содержит усреднения шума.')
p('a = f(x,y)−f(x+1,y+1); b = f(x+1,y)−f(x,y+1);\ng(x,y) = Q(√(a²+b²)).  (4)','eq')
page()

h('2.2. Собел и фильтры подавления шума')
p('Собел использует две маски 3×3 (5). Каждая совмещает разность по одной координате и усреднение по другой. Суммирование выполняется по соответствующим смещениям маски.')
p('Sx = [−1 0 1; −2 0 2; −1 0 1];\nSy = [−1 −2 −1; 0 0 0; 1 2 1];\nGx = ΣᵢΣⱼ Sx[j,i] f(x+i,y+j),  i,j = −1,0,1;\nGy = ΣᵢΣⱼ Sy[j,i] f(x+i,y+j);\ng(x,y) = Q(√(Gx²+Gy²)).  (5)','eq')
p('Порядок для всех трёх операторов: получить яркостное изображение; вычислить разности по (3), (4) или (5) для каждого пикселя; применить (2); записать результат в новый объект Image. Исходное изображение не изменяется.')
p('При арифметическом усреднении (6) все k² пикселей окна имеют одинаковый вес. В работе сравниваются k=3 и k=5; радиус окна r=(k−1)/2.')
p('g(x,y) = Q((1/k²) Σ_i Σ_j f(x+i,y+j)), i,j = −r,…,r.  (6)','eq')
p('Гауссово усреднение (7) придаёт больший вес близким пикселям. Постоянный множитель гауссовой функции сокращается при нормировании. Используется окно 5×5, σ=1.0.')
p('v(i,j) = exp(−(i²+j²)/(2σ²)); w(i,j) = v(i,j)/ΣᵢΣⱼv(i,j);\ng(x,y) = Q(ΣᵢΣⱼ w(i,j) f(x+i,y+j)).  (7)','eq')
p('Алгоритм усреднения: сформировать и нормировать веса; для каждого пикселя суммировать взвешенные значения окна; округлить результат по (2). При σ=0 программа выбирает равные веса (6), не подставляя ноль в гауссову формулу.')
p('Для порядковых фильтров составляется набор значений окна, расположенный по возрастанию z₁ ≤ … ≤ zₙ, где n=k². Тогда (8) определяет три разные операции:')
p('g_min = z₁;  g_med = z[(n+1)/2];  g_max = zₙ.  (8)','eq')
p('Минимум сужает светлые области, максимум расширяет их. Медиана выбирает центральное значение и менее чувствительна к отдельным выбросам, однако также способна удалять мелкие детали. В программе медиана находится через std::nth_element без полной сортировки.')
p('Для численного сравнения с чистым эталоном используются средняя квадратичная ошибка MSE и PSNR (9). Меньшая MSE и больший PSNR соответствуют лучшему совпадению яркостей, но не заменяют оценку сохранности деталей.')
p('MSE = (1/(WH)) Σ_x Σ_y (g(x,y)−f(x,y))²;\nPSNR = 10 log₁₀(255²/MSE), дБ.  (9)','eq')
page()

h('3. Программная реализация и проверка')
p('Реализация написана на C++17. Внешние библиотеки из задания используются только для PNG (stb_image, stb_image_write) и тестов (doctest). Готовые функции фильтрации сторонних библиотек не используются.')
table(['Файл / функция','Назначение'],[
    ['Image.h, Image.cpp','Заданный интерфейс и работа с памятью, пикселями и PNG.'],
    ['Processing.h, Processing.cpp','Отдельные функции обработки без расширения Image.'],
    ['processing::grayscale','Преобразование яркости по (1).'],
    ['processing::edges','Выбор Лапласа, Робертса или Собела; формулы (3)–(5).'],
    ['processing::average','Равные или гауссовы веса; формулы (6), (7).'],
    ['processing::rank','Минимум, медиана и максимум; формула (8).'],
    ['main.cpp','Чтение пути входа и каталога выхода, последовательный запуск всех методов.'],
])
p('Данные Image хранятся в std::unique_ptr<uint8_t[]>. Копирование выделяет отдельную память. Для 1–2 каналов getColor возвращает яркость в r, а g и b устанавливает в ноль согласно смыслу предоставленных тестов. Для 3–4 каналов возвращается RGB. setColor сохраняет альфа-канал; при создании двух- и четырёхканального изображения он равен 255. При недопустимых координатах объект и выходные аргументы не меняются.')
p('Сборка и запуск из корня проекта: make; make test; make demo. Для своего файла: ./build/lab input.png output/my_image. Программа сохраняет 11 PNG: полутоновый вход, три результата выделения контуров, три усреднения и четыре порядковых фильтра. Ошибка чтения или записи приводит к ненулевому коду завершения.')
p('В текущей проверке выполнено 18 тестовых случаев, 474 проверки; ошибок и пропущенных тестов нет. Из них 12 случаев взяты из задания и активированы, ещё 6 проверяют дополнительные свойства. Тесты и приложение собираются отдельно, поэтому конфликт двух main исключён.')
p('Дополнительные проверки: нулевой отклик контурных операторов на постоянном поле; сохранение его яркости всеми фильтрами, включая края; ручной расчёт отклика на ступень; результат обработки одиночного импульса; сохранение альфа-канала после PNG-записи; независимость присваиваемой копии; отклонение некорректных размеров окна.')
p('Для ступени 0→40 проверены отклики Лапласа 40, Робертса round(40√2)=57 и Собела 160. Для импульса 255 среднее 3×3 даёт 28, гауссово окно 3×3 при σ=1 даёт 52, медиана и минимум — 0. Такие проверки связывают реализацию с математическими формулами, а не только с успешным запуском.')
page()

h('4. Тестовые изображения')
p('Подготовлены две самостоятельные сцены 256×192 пикселя. Набор А содержит прямоугольник, круг, треугольник, крупные однородные области и участок линейного изменения яркости. Набор Б содержит тонкие горизонтальные и вертикальные штрихи, шахматный фрагмент, окружность и диагональ на градиентном фоне. Первый набор удобен для оценки шума на ровном фоне, второй — для обнаружения потери деталей.')
figure(inputs,'Рисунок 1. Чистые эталоны (слева) и соответствующие изображения с гауссовым шумом (справа).',150)
p('Шум добавлен вне программы фильтрации редактором ImageMagick: -seed 731 (А) / 1201 (Б), -attenuate 0.9 +noise Gaussian, глубина 8 бит. После добавления результат сохранён в PNG. Тестовые сцены подготовлены специально для сравнения этих методов.')
p(f"Измеренное стандартное отклонение разности с эталоном составляет {metrics['shapes']['noise_std']:.2f} для А и {metrics['detail']['noise_std']:.2f} для Б. Средняя разность равна {metrics['shapes']['noise_mean']:.2f} и {metrics['detail']['noise_mean']:.2f}; небольшое смещение связано в том числе с дискретизацией. Значения после добавления шума ограничиваются диапазоном 0–255.")
p('Для обоих вариантов подавления шума используются одинаковые зашумлённые входы. Чистые эталоны сохранены отдельно, поэтому ошибка по (9) вычисляется относительно известного исходного сигнала.')
page()

h('5. Вариант 1: выделение контуров')
figure(edge_fig,'Рисунок 2. Сверху набор А, снизу набор Б. В каждом ряду: вход, Лаплас, Робертс, Собел.')
p('На наборе А Лаплас выделяет обе стороны скачка яркости, поскольку соседние значения второй разности имеют разные знаки, а отображается их модуль (3). Робертс даёт компактный отклик на границах фигур и реагирует на диагональные перепады. Собел формирует более широкий яркий контур из-за окна 3×3 и коэффициентов ±2.')
p('Набор Б показывает, что тонкие штрихи создают близко расположенные отклики; при пересечении или сближении линий они могут сливаться. На линейном градиенте внутренняя вторая разность Лапласа близка к нулю, а операторы первого порядка реагируют на изменение яркости. В местах целочисленного округления возможен слабый остаточный отклик.')
figure(noise_edges,'Рисунок 3. Набор А с шумом и результаты тех же трёх операторов.')
p('На зашумлённом входе появляются отклики внутри однородных областей: дифференцирование усиливает локальные колебания. У Собела есть сглаживание в поперечном направлении, однако его ненормированные маски также усиливают амплитуду. Сравнивать только яркость шумового фона у трёх выходов некорректно, поскольку коэффициенты операторов различаются. Во всех случаях изображения по рисунку 2 позволяют отделить полезную реакцию на границу от реакции на шум.')
p('При сильных перепадах результат ограничивается 255 по (2). Поэтому яркость контура после насыщения уже не пропорциональна точной величине производной. Предварительное подавление шума могло бы уменьшить ложные отклики, но в этом сравнении операторы применены непосредственно ко входу, чтобы показать их собственные свойства.')
page()

h('6. Вариант 2: усредняющие фильтры')
figure(mean_fig,'Рисунок 4. Сверху набор А, снизу набор Б. Вход с шумом; среднее 3×3; среднее 5×5; Гаусс 5×5, σ=1.')
table(['Метод','А: MSE','А: PSNR, дБ','Б: MSE','Б: PSNR, дБ'],metric_rows([
    ('noisy','Вход с шумом'),('mean3','Среднее 3×3'),('mean5','Среднее 5×5'),('gauss5','Гаусс 5×5')]))
p('На крупных фигурах все три фильтра уменьшают ошибку относительно зашумлённого входа. Из усредняющих методов лучшие значения на обоих наборах получены для гауссова окна 5×5 с σ=1. Более низкие веса удалённых пикселей снижают смешивание яркостей по разные стороны границы по сравнению с равными весами окна 5×5.')
p('Увеличение арифметического окна с 3×3 до 5×5 сильнее сглаживает фон, но не обязательно улучшает результат целиком: MSE на А возрастает с 111.66 до 147.53 из-за размытия краёв. На Б тонкие штрихи имеют ширину, сопоставимую с окном, поэтому усреднение смешивает их с фоном. Ошибка всех трёх усредняющих методов на этом наборе оказывается выше, чем у входа с шумом.')
p('Такой результат согласуется с (6), (7): усредняется не только шум, но и полезное изменение яркости. Шум на однородных участках ослабляется, однако общий PSNR может ухудшиться из-за утраты мелких объектов. Следовательно, размер окна следует выбирать с учётом масштаба деталей, а не только видимой гладкости изображения.')
page()

h('7. Вариант 3: порядковые фильтры')
figure(rank_fig,'Рисунок 5. Сверху набор А, снизу набор Б. Медиана 3×3; медиана 5×5; минимум 3×3; максимум 3×3.')
table(['Метод','А: MSE','А: PSNR, дБ','Б: MSE','Б: PSNR, дБ'],metric_rows([
    ('noisy','Вход с шумом'),('median3','Медиана 3×3'),('median5','Медиана 5×5'),('min3','Минимум 3×3'),('max3','Максимум 3×3')]))
p('На наборе А медиана 5×5 даёт наименьшую ошибку среди проверенных методов: MSE=44.62. Большинство элементов окна на широком однородном участке относятся к одному уровню яркости; медиана подавляет колебания без арифметического смешивания яркостей всех элементов. Однако около углов и малых фигур граница изменяется.')
p('На наборе Б медиана 3×3 сохраняет больше деталей и даёт MSE=124.90. Для окна 5×5 ошибка возрастает до 830.54: тонкая светлая линия может занимать меньше половины окна, поэтому медиана заменяет её фоном. Таким образом, выигрыш большого окна на первом наборе не переносится на второй.')
p('Минимум и максимум не являются универсальными средствами устранения гауссова шума. Первый выбирает преимущественно отрицательные отклонения и затемняет изображение; второй выбирает положительные и осветляет его. Среднее смещение относительно эталона для А равно −29.71 и +28.41, для Б — −38.96 и +37.80 соответственно. При этом светлые детали сужаются после минимума и расширяются после максимума, что прямо следует из (8).')
p('На данных двух сценах медианные фильтры с подходящим размером окна превосходят проверенные усредняющие методы по MSE. Это наблюдение относится к выбранным изображениям и уровню шума; оно не устанавливает преимущество медианы для любого гауссова шума или любого содержания изображения.')
page()

h('8. Вывод')
p('Реализован заданный класс Image с неизменённым интерфейсом и единая программа для всех трёх вариантов. Операторы Лапласа, Робертса и Собела выделяют разные по форме и ширине отклики на границы. Непосредственная обработка зашумлённого входа показывает появление ложных контуров.')
p('Усредняющие фильтры уменьшают колебания на равномерном фоне, но размывают мелкие объекты. Гауссово окно 5×5 с σ=1 показало меньшую ошибку, чем два рассмотренных арифметических окна. Медиана 5×5 эффективна на крупных фигурах, а на изображении с тонкими деталями лучше сработало окно 3×3. Минимум и максимум меняют геометрию светлых областей и дают значительное смещение яркости.')
p('Все 18 тестовых случаев пройдены. Демонстрационный запуск обработал четыре входных PNG и сохранил 44 выходных файла. Выводы основаны на полученных изображениях и сравнении с чистыми эталонами; заранее заданного универсального победителя среди методов нет.')
h('Источники')
p('1. Материалы задания: lab_1.pdf (внутри — «Лабораторная работа №2»), image_env.pdf, ReadMe.pdf, исходный интерфейс Image и tests_image.cpp.')
p('2. Библиотеки stb_image / stb_image_write: https://github.com/nothings/stb — чтение и запись PNG; файлы предоставлены в задании.')
p('3. doctest: https://github.com/doctest/doctest — тестовое окружение из задания.')
p('4. ImageMagick: https://imagemagick.org/script/command-line-options.php — параметры -seed, -attenuate, +noise Gaussian.')
h('Приложения')
p('В приложении А приведён модуль обработки: вспомогательные функции, преобразование в оттенки серого и реализации всех трёх вариантов. В приложении Б приведена реализация класса Image. Точка входа и тесты находятся в проекте; сторонние заголовки в текст отчёта не включены.')

# Fixed-size code pages keep PDF and DOCX appendices legible and prevent overflow.
for title, filename in [('Приложение А. Алгоритмы обработки','src/Processing.cpp'),
                        ('Приложение Б. Класс Image','src/Image.cpp')]:
    lines=(ROOT/filename).read_text().splitlines()
    wrapped=[]
    import textwrap
    for line in lines:
        if len(line)>100:
            wrapped.extend(textwrap.wrap(line,width=100,replace_whitespace=False,
                                        subsequent_indent='    ',drop_whitespace=False))
        else:wrapped.append(line)
    for start in range(0,len(wrapped),65):
        page();h(title if start==0 else title+' (продолжение)')
        code='\n'.join(wrapped[start:start+65])
        story.append(Preformatted(code,code_style))
        para=doc.add_paragraph()
        para.paragraph_format.line_spacing=1.0
        run=para.add_run(code);run.font.name='Courier New';run.font.size=Pt(8)


def footer(canvas, document):
    if document.page>1:
        canvas.setFont('Body',9)
        canvas.drawCentredString(A4[0]/2,27,str(document.page))

pdf=SimpleDocTemplate(str(OUT/'Отчет.pdf'),pagesize=A4,rightMargin=20*2.83465,
    leftMargin=20*2.83465,topMargin=18*2.83465,bottomMargin=18*2.83465,
    title='Лабораторная работа №2. Варианты 1–3',author='')
pdf.build(story,onFirstPage=footer,onLaterPages=footer)
doc.save(OUT/'Отчет.docx')
print('Created reports/Отчет.pdf and reports/Отчет.docx')
