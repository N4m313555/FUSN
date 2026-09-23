# 由公司原信（26L0759 業戶佔用公眾地方）整理出可填充嘅 Word 範本。
# 用法：python3 tools/make-debris-template.py <原信.docx> templates/樓層雜物信範本.docx
# 之後跑 node tools/embed-template.mjs 將範本嵌入 js/debris-template.js。
import re, sys, zipfile, io

src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
files = {n: zin.read(n) for n in zin.namelist()}
x = files['word/document.xml'].decode('utf-8')

paras = list(re.finditer(r'<w:p[ >].*?</w:p>', x, flags=re.S))
def runs_of(p): return list(re.finditer(r'<w:r[ >].*?</w:r>', p, flags=re.S))
def set_run_text(run_xml, text): return re.sub(r'<w:t(?: [^>]*)?>[^<]*</w:t>', '<w:t xml:space="preserve">' + text + '</w:t>', run_xml, count=1)
def rebuild(p_xml, keep):  # keep: list of (run_index, new_text or None); runs not listed are dropped
    rs = runs_of(p_xml); out = p_xml
    # replace from the end so offsets stay valid
    for r in reversed(rs):
        idx = rs.index(r); spec = dict((i, t) for i, t in keep)
        if idx in spec:
            new = r.group(0) if spec[idx] is None else set_run_text(r.group(0), spec[idx])
        else:
            new = ''
        out = out[:r.start()] + new + out[r.end():]
    return out

texts = lambda p: re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p)
new_paras = {}
for i, m in enumerate(paras):
    p = m.group(0); t = texts(p)
    if i == 0:   new_paras[i] = rebuild(p, [(0, None), (1, None), (2, '{{FILEREF}}')])           # 本公司檔號：{{FILEREF}}
    elif i == 1: new_paras[i] = rebuild(p, [(0, '{{ESTATE}}')])
    elif i == 2: new_paras[i] = rebuild(p, [(0, '{{BLOCK}}'), (3, '{{UNIT}}'), (6, '室')])           # 善群樓707室 → {{BLOCK}}{{UNIT}}室
    elif i == 9:
        rs = runs_of(p)
        # 「管業處巡查時發現」「  」「閣下於樓層走廊擺放」「雜物」「，影響…公契」「。」
        # 原信 run 3、4、5、7 係空 run；6 係「雜物」，8 係「，影響……公契」，9 係「。」
        new = rebuild(p, [(0, '{{OFFICE}}巡查時發現'), (1, None), (2, '閣下於{{LOCATION}}擺放'), (6, '{{ITEMS}}'), (8, None), (9, '。{{PREV}}')])
        new_paras[i] = new
    elif i == 11: new_paras[i] = rebuild(p, [(0, '為確保大廈公共衛生及走火通道暢通無阻，現通知  閣下擺放於走火通道之物品將被視作垃圾處理，並不作另行通知或任何賠償。此外，{{OFFICE}}及法團將保留向  閣下追討衍生的相關費用及法律責任。')])
    elif i == 14: new_paras[i] = rebuild(p, [(0, '如有任何查詢，請於辦公時間內致電'), (1, '{{PHONE}}'), (2, '與{{OFFICE}}職員聯絡。')])
    elif i == 21: new_paras[i] = rebuild(p, [(0, '{{MANAGER_TITLE}}')])
    elif i == 22: new_paras[i] = rebuild(p, [(0, '{{MANAGER}}')])
    elif i == 23: new_paras[i] = rebuild(p, [(0, None), (1, '{{LEVELNUM}}'), (2, None), (3, None), (4, None), (5, '{{LICENCE}}'), (6, None)])
    elif i == 26: new_paras[i] = rebuild(p, [(0, '{{Y}}'), (1, None), (2, '{{M}}'), (3, None), (4, '{{D}}'), (6, None)])
    elif i == 29: new_paras[i] = rebuild(p, [(0, '副本抄送: {{IO}}')])
    elif i == 33:
        # 相片段落：換成一個淨係得 {{PHOTOS}} 嘅置中段落，生成時整段換成相片
        new_paras[i] = '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>{{PHOTOS}}</w:t></w:r></w:p>'
# apply from end
for i in sorted(new_paras, reverse=True):
    m = paras[i]; x = x[:m.start()] + new_paras[i] + x[m.end():]
files['word/document.xml'] = x.encode('utf-8')
# 刪除原相片同其 rels（header 嘅信頭 logo image3 保留）
rels = files['word/_rels/document.xml.rels'].decode('utf-8')
rels = re.sub(r'<Relationship Id="rId[67]"[^>]*/>', '', rels)
files['word/_rels/document.xml.rels'] = rels.encode('utf-8')
for n in ['word/media/image1.png', 'word/media/image2.jpeg']: files.pop(n, None)
ct = files['[Content_Types].xml'].decode('utf-8')
if 'Extension="jpeg"' not in ct: ct = ct.replace('</Types>', '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>')
if 'Extension="jpg"' not in ct: ct = ct.replace('</Types>', '<Default Extension="jpg" ContentType="image/jpeg"/></Types>')
files['[Content_Types].xml'] = ct.encode('utf-8')
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zout:
    for n, b in files.items(): zout.writestr(n, b)
open(dst, 'wb').write(buf.getvalue())
print('written', dst, len(buf.getvalue()), 'bytes; placeholders:', sorted(set(re.findall(r'\{\{[A-Z_]+\}\}', x))))
