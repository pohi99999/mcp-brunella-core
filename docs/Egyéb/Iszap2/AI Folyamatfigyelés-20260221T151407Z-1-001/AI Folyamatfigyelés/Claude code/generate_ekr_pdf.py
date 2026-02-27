#!/usr/bin/env python3
"""
EKR PDF Jelentés Generátor
Létrehoz egy professzionális PDF riportot az EKR keresési eredményekről
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from datetime import datetime
import json

def create_pdf_report(json_file, output_pdf):
    """PDF riport generálása JSON adatokból."""

    # JSON adatok betöltése
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # PDF dokumentum létrehozása
    doc = SimpleDocTemplate(
        output_pdf,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    # Tartalom elemek listája
    story = []

    # Stílusok
    styles = getSampleStyleSheet()

    # Egyéni stílusok
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a5490'),
        spaceAfter=30,
        alignment=TA_CENTER
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#1a5490'),
        spaceAfter=12,
        spaceBefore=12
    )

    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6
    )

    # Cím
    story.append(Paragraph("EKR Keresési Riport", title_style))
    story.append(Paragraph("Aktív és Jövőbeli Tenderek", heading_style))
    story.append(Spacer(1, 0.5*cm))

    # Session információk
    session = data['search_session']
    session_info = [
        ["Session ID:", session['session_id']],
        ["Dátum:", session['start_time'][:10]],
        ["Státusz:", session['status'].upper()],
        ["Szűrők:", "Aktuális + Jövőbeli üzleti lehetőségek"]
    ]

    session_table = Table(session_info, colWidths=[4*cm, 12*cm])
    session_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e8f4f8')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
    ]))

    story.append(session_table)
    story.append(Spacer(1, 1*cm))

    # Összesítés
    story.append(Paragraph("Összesítés", heading_style))
    metrics = data['performance_metrics']

    summary_info = [
        ["Tervezett keresések:", str(metrics['total_searches_planned'])],
        ["Végrehajtott keresések:", str(metrics['searches_completed'])],
        ["Összes találat:", str(metrics['total_results_found']) + " aktív/jövőbeli tender"],
        ["Lefedettség:", str(metrics['coverage_percentage']) + "%"]
    ]

    summary_table = Table(summary_info, colWidths=[6*cm, 10*cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e8f4f8')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
    ]))

    story.append(summary_table)
    story.append(Spacer(1, 1*cm))

    # Részletes eredmények
    story.append(Paragraph("Részletes Eredmények", heading_style))

    # Táblázat fejléc
    table_data = [
        ["#", "Kulcsszó", "Találatok", "Link"]
    ]

    # Adatok hozzáadása
    for result in data['search_results']:
        keyword = result['keyword']
        count = result['results_count']
        url = result['url']

        # Rövidített URL a PDF-hez
        link_text = f'<link href="{url}" color="blue">Keresés megtekintése</link>'

        table_data.append([
            str(result['search_id']),
            keyword,
            str(count),
            Paragraph(link_text, normal_style)
        ])

    results_table = Table(table_data, colWidths=[1*cm, 4*cm, 2*cm, 9*cm])
    results_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5490')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')])
    ]))

    story.append(results_table)
    story.append(Spacer(1, 1*cm))

    # Új oldal a kiemelt eredményekhez
    story.append(PageBreak())

    # Kiemelt eredmények
    story.append(Paragraph("Kiemelt Eredmények", heading_style))
    story.append(Spacer(1, 0.5*cm))

    # Top 5 kulcsszó
    story.append(Paragraph("Top 5 Kulcsszó Találatok Szerint:", heading_style))

    top_keywords = data['summary']['high_value_keywords']
    top_data = [["Helyezés", "Kulcsszó", "Találatok"]]

    for idx, item in enumerate(top_keywords, 1):
        emoji = "🏆" if idx == 1 else ""
        top_data.append([
            str(idx),
            item['keyword'] + " " + emoji,
            str(item['results'])
        ])

    top_table = Table(top_data, colWidths=[2*cm, 8*cm, 6*cm])
    top_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5490')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')])
    ]))

    story.append(top_table)
    story.append(Spacer(1, 1*cm))

    # Nulla találatú kulcsszavak
    story.append(Paragraph("Nulla Találatú Kulcsszavak:", heading_style))

    zero_keywords = data['summary']['zero_results_keywords']
    zero_text = ", ".join(zero_keywords)
    story.append(Paragraph(zero_text, normal_style))
    story.append(Spacer(1, 1*cm))

    # Következtetések
    story.append(Paragraph("Következtetések", heading_style))

    conclusions = [
        f"✓ {metrics['total_results_found']} aktív/jövőbeli tender azonosítva az Iszapfalo tevékenységi köréhez kapcsolódóan",
        f"✓ Legjelentősebb kategória: Csapadékvíz projektek ({top_keywords[0]['results']} tender)",
        f"✓ Egyéb releváns területek: Vízépítés, Víztelenített iszap, Kotrási munkák",
        "⚠ Az 'iszapkotrás' kifejezés jelenleg nem szerepel aktív tenderekben, de 26 korábbi eljárás található az archívumban"
    ]

    for conclusion in conclusions:
        story.append(Paragraph(conclusion, normal_style))
        story.append(Spacer(1, 0.3*cm))

    story.append(Spacer(1, 1*cm))

    # Lábléc
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey,
        alignment=TA_CENTER
    )

    story.append(Spacer(1, 2*cm))
    story.append(Paragraph("Generálva: Claude Code EKR Automation Agent", footer_style))
    story.append(Paragraph(f"Verzió: {datetime.now().strftime('%Y-%m-%d')}", footer_style))

    # PDF generálás
    doc.build(story)
    print(f"✅ PDF riport sikeresen létrehozva: {output_pdf}")

if __name__ == "__main__":
    json_file = "ekr_search_results_aktiv_2026-01-28.json"
    output_pdf = "EKR_Jelentes_Aktiv_2026-01-28.pdf"

    create_pdf_report(json_file, output_pdf)
