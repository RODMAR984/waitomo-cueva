#!/usr/bin/env python3
"""
Genera PDFs descargables desde los informes Markdown en docs/audit/.
Uso: python3 docs/audit/generate_pdfs.py
"""

from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

AUDIT_DIR = Path(__file__).resolve().parent
REPORTS = [
    "INFORME_SNIPER_RSI_V2.md",
    "INFORME_AUTO_AUDITOR.md",
    "INFORME_CONSOLIDADO_MEJORAS.md",
]


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def md_inline_to_reportlab(text: str) -> str:
    text = esc(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`([^`]+)`", r'<font face="Courier">\1</font>', text)
    return text


def parse_table(lines: list[str]) -> Table | None:
    if len(lines) < 2:
        return None
    rows = []
    for line in lines:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        rows.append([Paragraph(md_inline_to_reportlab(c), styles["TableCell"]) for c in cells])
    if not rows:
        return None
    col_count = max(len(r) for r in rows)
    widths = [16.0 * cm / col_count] * col_count
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a3a4a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f8fa")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return t


def md_to_flowables(md_path: Path) -> list:
    flow = []
    text = md_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    i = 0
    in_code = False
    code_buf: list[str] = []
    table_buf: list[str] = []

    def flush_table():
        nonlocal table_buf
        if table_buf:
            tbl = parse_table(table_buf)
            if tbl:
                flow.append(tbl)
                flow.append(Spacer(1, 0.25 * cm))
            table_buf = []

    while i < len(lines):
        line = lines[i]

        if in_code:
            if line.strip().startswith("```"):
                flow.append(
                    Preformatted(
                        "\n".join(code_buf),
                        styles["Code"],
                        maxLineLength=90,
                    )
                )
                flow.append(Spacer(1, 0.2 * cm))
                code_buf = []
                in_code = False
            else:
                code_buf.append(line)
            i += 1
            continue

        if line.strip().startswith("```"):
            flush_table()
            in_code = True
            i += 1
            continue

        if line.strip().startswith("|"):
            table_buf.append(line)
            i += 1
            continue
        flush_table()

        if line.strip() == "---":
            flow.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
            flow.append(Spacer(1, 0.15 * cm))
            i += 1
            continue

        if line.startswith("# "):
            flow.append(Paragraph(md_inline_to_reportlab(line[2:]), styles["H1"]))
            flow.append(Spacer(1, 0.3 * cm))
        elif line.startswith("## "):
            flow.append(Paragraph(md_inline_to_reportlab(line[3:]), styles["H2"]))
            flow.append(Spacer(1, 0.2 * cm))
        elif line.startswith("### "):
            flow.append(Paragraph(md_inline_to_reportlab(line[4:]), styles["H3"]))
            flow.append(Spacer(1, 0.15 * cm))
        elif line.startswith("- [ ] ") or line.startswith("- [x] "):
            mark = "☑" if "[x]" in line[:6] else "☐"
            flow.append(
                Paragraph(
                    f"{mark} {md_inline_to_reportlab(line[6:])}",
                    styles["Bullet"],
                )
            )
        elif line.startswith("- "):
            flow.append(
                Paragraph(f"• {md_inline_to_reportlab(line[2:])}", styles["Bullet"])
            )
        elif re.match(r"^\d+\.\s", line):
            flow.append(Paragraph(md_inline_to_reportlab(line), styles["Bullet"]))
        elif line.strip() == "":
            flow.append(Spacer(1, 0.1 * cm))
        else:
            flow.append(Paragraph(md_inline_to_reportlab(line), styles["Body"]))
        i += 1

    flush_table()
    return flow


def build_styles():
    global styles
    base = getSampleStyleSheet()
    styles = {
        "H1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontSize=16,
            textColor=colors.HexColor("#0d3b4c"),
            spaceAfter=6,
        ),
        "H2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontSize=12,
            textColor=colors.HexColor("#155263"),
            spaceBefore=8,
            spaceAfter=4,
        ),
        "H3": ParagraphStyle(
            "H3",
            parent=base["Heading3"],
            fontSize=10,
            textColor=colors.HexColor("#1a6b7a"),
            spaceAfter=3,
        ),
        "Body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            alignment=TA_LEFT,
        ),
        "Bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            leftIndent=12,
            bulletIndent=6,
        ),
        "Code": ParagraphStyle(
            "Code",
            parent=base["Code"],
            fontSize=7,
            leading=9,
            backColor=colors.HexColor("#f0f4f8"),
            borderPadding=4,
        ),
        "TableCell": ParagraphStyle(
            "TableCell",
            parent=base["Normal"],
            fontSize=8,
            leading=10,
        ),
        "Footer": ParagraphStyle(
            "Footer",
            parent=base["Normal"],
            fontSize=7,
            textColor=colors.grey,
        ),
    }


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.grey)
    canvas.drawString(1.5 * cm, 1 * cm, f"Auditoría bots · {doc.page}")
    canvas.drawRightString(A4[0] - 1.5 * cm, 1 * cm, "2026-07-20")
    canvas.restoreState()


def generate_pdf(md_name: str) -> Path:
    md_path = AUDIT_DIR / md_name
    pdf_path = md_path.with_suffix(".pdf")
    build_styles()
    story = md_to_flowables(md_path)
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title=md_path.stem,
        author="Auditoría técnica FitEngine",
    )
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    return pdf_path


def main():
    print("Generando PDFs en", AUDIT_DIR)
    for name in REPORTS:
        pdf = generate_pdf(name)
        print(f"  OK  {pdf.name}  ({pdf.stat().st_size // 1024} KB)")
    print("Listo.")


if __name__ == "__main__":
    main()
