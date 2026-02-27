#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime

def create_pdf():
    # Fájl elérési utak - dinamikus dátum
    date_str = datetime.now().strftime("%Y-%m-%d")
    base_path = "/Users/kovasznaimac/Library/CloudStorage/GoogleDrive-iszapfalo@gmail.com/Saját meghajtó/Iszapfalo/Motorháztető/AI Folyamatfigyelés/Claude code/Csabi ügynöke"
    output_path = f"{base_path}/Portfolio_1_Jelentes_{date_str}.pdf"

    # PDF dokumentum létrehozása
    doc = SimpleDocTemplate(output_path, pagesize=A4,
                            rightMargin=50, leftMargin=50,
                            topMargin=50, bottomMargin=40)

    # Tartalom tároló
    story = []

    # Stílusok
    styles = getSampleStyleSheet()

    # Egyedi stílusok
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=26,
        textColor=colors.HexColor('#1a365d'),
        spaceAfter=6,
        spaceBefore=10,
        alignment=TA_CENTER,
        leading=30,
        fontName='Helvetica-Bold'
    )

    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#2d3748'),
        spaceAfter=20,
        alignment=TA_CENTER,
        leading=18
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#2c5282'),
        spaceAfter=10,
        spaceBefore=15,
        leading=18,
        fontName='Helvetica-Bold'
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#2d3748')
    )

    # Cím - dinamikus dátum
    today = datetime.now()
    date_display = today.strftime("%Y. %B %d.").replace("January", "januar").replace("February", "februar").replace("March", "marcius").replace("April", "aprilis").replace("May", "majus").replace("June", "junius").replace("July", "julius").replace("August", "augusztus").replace("September", "szeptember").replace("October", "oktober").replace("November", "november").replace("December", "december")
    time_display = today.strftime("%Y. %B %d. %H:%M (GMT+1)").replace("January", "januar").replace("February", "februar").replace("March", "marcius").replace("April", "aprilis").replace("May", "majus").replace("June", "junius").replace("July", "julius").replace("August", "augusztus").replace("September", "szeptember").replace("October", "oktober").replace("November", "november").replace("December", "december")

    story.append(Paragraph("Investmentors Napi Portfolio Jelentes", title_style))
    story.append(Paragraph(f"Portfolio 1 - {date_display}", subtitle_style))
    story.append(Spacer(1, 0.3 * inch))

    # Összefoglaló
    story.append(Paragraph("OSSZEFOGLALO", heading_style))
    summary_data = [
        ["Jelentes idopontja:", time_display],
        ["Portfolio neve:", "Portfolio 1"],
        ["Osszes pozicio:", "114 reszveny"],
        ["Piacok allapota:", "Vegyes teljesitmeny"]
    ]
    summary_table = Table(summary_data, colWidths=[2.5*inch, 4*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e6f2ff')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e0'))
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.3 * inch))

    # Piaci környezet
    story.append(Paragraph("PIACI KORNYEZET", heading_style))
    market_data = [
        ["Index", "Arfolyam", "Valtozas", "%"],
        ["Dow Jones", "49,077.23", "+588.64", "+1.21%"],
        ["S&P 500", "6,875.62", "+78.76", "+1.16%"],
        ["Nasdaq", "23,224.82", "+270.50", "+1.18%"],
        ["FTSE 100", "10,138.09", "+11.32", "+0.11%"],
        ["DAX", "24,925.70", "+364.72", "+1.48%"],
        ["Nikkei 225", "53,824.00", "+1,049.36", "+1.99%"]
    ]
    market_table = Table(market_data, colWidths=[1.6*inch, 1.6*inch, 1.6*inch, 1.6*inch])
    market_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c5282')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f7fafc')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e0')),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
    ]))
    story.append(market_table)
    story.append(Spacer(1, 0.3 * inch))

    # TOP Movers - Nyertesek
    story.append(Paragraph("TOP NYERTESEK (5%+ emelkedes)", heading_style))
    winners_data = [
        ["Ticker", "Nev", "Arfolyam", "Valtozas %"],
        ["SSNLF", "Samsung Electronics", "$65.21", "+56.02%"],
        ["MNHFF", "Mayr-Melnhof Karton", "$95.00", "+35.76%"],
        ["FUPEFF", "Fuchs SE", "$39.60", "+25.11%"],
        ["INTC", "Intel Corporation", "$54.25", "+11.72%"],
        ["BAIDU", "Baidu Inc.", "$162.28", "+8.17%"],
        ["CLPBF", "Coloplast A/S", "$87.26", "+6.35%"],
        ["XRAY", "DENTSPLY SIRONA", "$12.74", "+5.73%"],
        ["VWAGY", "Volkswagen AG", "$11.99", "+5.18%"]
    ]
    winners_table = Table(winners_data, colWidths=[1.0*inch, 2.7*inch, 1.3*inch, 1.5*inch])
    winners_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#38a169')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f0fff4')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e0')),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(winners_table)
    story.append(Spacer(1, 0.15 * inch))

    story.append(Paragraph("KIEMELT ESZREVETEL: Samsung Electronics (SSNLF) extrem merteku, +56%-os emelkedes! Ez rendkivuli piaci esemenyre utal - erdemes tovabbi vizsgalat.", body_style))
    story.append(Spacer(1, 0.3 * inch))

    # TOP Movers - Vesztesek
    story.append(Paragraph("TOP VESZTESEK (-2%+ csokkenes)", heading_style))
    losers_data = [
        ["Ticker", "Nev", "Arfolyam", "Valtozas %"],
        ["HXGBF", "Hexagon AB", "$11.03", "-3.63%"],
        ["ORCL", "Oracle Corporation", "$173.88", "-3.36%"],
        ["CHKP", "Check Point Software", "$174.36", "-2.43%"],
        ["NVO", "Novo Nordisk", "$59.32", "-2.24%"],
        ["MSFT", "Microsoft", "$444.11", "-2.29%"],
        ["NFLX", "Netflix", "$85.36", "-2.18%"],
        ["MURGY", "Munchen Re", "$11.92", "-2.13%"]
    ]
    losers_table = Table(losers_data, colWidths=[1.0*inch, 2.7*inch, 1.3*inch, 1.5*inch])
    losers_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e53e3e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#fff5f5')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e0')),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
    ]))
    story.append(losers_table)
    story.append(Spacer(1, 0.3 * inch))

    # Figyelmeztetések
    story.append(Paragraph("FIGYELMEZTETESEK ES KOCKAZATOK", heading_style))
    story.append(Paragraph("OSZTALEK KOCKAZAT FIGYELMEZTETESEK", body_style))
    story.append(Spacer(1, 0.15 * inch))

    warnings_data = [
        ["Reszveny", "Ar", "Rating", "Ajanlas"],
        ["MURGY\n(Munchen Re)", "$11.92\n(-2.13%)", "Hold 2.90", "Figyelje az osztalekpolitikat,\nfontoljuk meg a pozicio csokkenteset"],
        ["NVZMY\n(Novozymes)", "$64.08\n(-0.09%)", "Sell 2.04", "Kritikus terulet,\nerdemes lehet poziciot zarni"]
    ]
    warnings_table = Table(warnings_data, colWidths=[1.4*inch, 1.2*inch, 1.2*inch, 2.7*inch])
    warnings_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ecc94b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#fffff0')),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e0')),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(warnings_table)
    story.append(Spacer(1, 0.3 * inch))

    # Javasolt akciók
    story.append(Paragraph("JAVASOLT AKCIOK", heading_style))

    action_style = ParagraphStyle(
        'ActionStyle',
        parent=body_style,
        fontSize=10,
        leading=14
    )

    actions = [
        "1. SSNLF (Samsung) - Rendkivuli +56% emelkedes - Reszleges profit realizalas megfontalasa",
        "2. NVZMY (Novozymes) - Osztalek kockazat - Pozicio felulvizsgalata, esetleg zaras",
        "3. MURGY (Munchen Re) - Osztalek kockazat - Monitoring, pozicio csokkentes merlegelese",
        "4. Microsoft (-2.29%) - Jo belepesi pont lehet hosszu tavra",
        "5. Netflix (-2.18%) - Korrecio utani lehetoseg"
    ]
    for action in actions:
        story.append(Paragraph(action, action_style))
        story.append(Spacer(1, 0.12 * inch))

    story.append(Spacer(1, 0.4 * inch))

    # Lábléc
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey,
        alignment=TA_CENTER
    )

    story.append(Paragraph("=" * 100, footer_style))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph("Investmentors Hungary Kft.", footer_style))
    story.append(Paragraph("Email: info@investmentors.hu | Website: investmentors.hu", footer_style))
    story.append(Paragraph("Automatikusan generalva: Claude Investmentors Portfolio Ugynok", footer_style))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph("Jogi Nyilatkozat: Ez a jelentes kizarolag informacios celokat szolgal, es nem minosul befektetesi tanacsadasnak.", footer_style))

    # PDF generálás
    doc.build(story)
    print(f"PDF sikeresen letrehozva: {output_path}")
    return output_path

if __name__ == "__main__":
    create_pdf()
