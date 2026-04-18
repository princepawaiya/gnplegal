import os
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.models.invoice import Invoice


def build_invoice_pdf(invoice: Invoice) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)

    y = 800

    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(50, y, "Invoice")
    y -= 30

    pdf.setFont("Helvetica", 11)
    pdf.drawString(50, y, f"Invoice No: {invoice.invoice_no or '-'}")
    y -= 20

    pdf.drawString(50, y, f"Status: {invoice.status or '-'}")
    y -= 20

    pdf.drawString(50, y, f"Subtotal: INR {invoice.subtotal or 0}")
    y -= 20

    pdf.drawString(50, y, f"Tax: INR {invoice.tax or 0}")
    y -= 20

    pdf.drawString(50, y, f"Final Total: INR {invoice.final_total or 0}")
    y -= 30

    if invoice.notes:
        pdf.drawString(50, y, f"Notes: {invoice.notes}")
        y -= 20

    pdf.showPage()
    pdf.save()

    buffer.seek(0)
    return buffer.read()


def save_invoice_pdf(invoice: Invoice, pdf_bytes: bytes) -> str:
    folder = os.path.join("storage", "invoices", str(invoice.id))
    os.makedirs(folder, exist_ok=True)

    file_path = os.path.join(folder, f"invoice_{invoice.id}.pdf")

    with open(file_path, "wb") as f:
        f.write(pdf_bytes)

    return file_path