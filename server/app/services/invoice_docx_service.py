from docxtpl import DocxTemplate
import os

# ================= BASE PATH FIX =================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

TEMPLATE_DIR = os.path.join(BASE_DIR, "storage", "templates", "invoices")


def generate_invoice_docx(invoice, client, spoc, matters):
    # ================= TEMPLATE SELECTION =================

    invoice_type = (invoice.invoice_type or "").strip().upper()

    TEMPLATE_MAP = {
        "PART1": "part1_template.docx",
        "PART2": "part2_template.docx",
    }

    if invoice_type not in TEMPLATE_MAP:
        raise Exception(f"❌ Invalid invoice type for template: {invoice_type}")

    template_file = TEMPLATE_MAP[invoice_type]

    template_path = os.path.join(TEMPLATE_DIR, template_file)

    print("📄 USING TEMPLATE:", template_path)

    if not os.path.exists(template_path):
        raise Exception(f"❌ Template not found: {template_path}")

    doc = DocxTemplate(template_path)

    # ================= BUILD ANNEXURE =================
    items = []
    total_amount = 0

    for i, m in enumerate(matters, start=1):
        amount = round(float(m.client_share or 0), 2)

        items.append({
            "sr_no": i,
            "matter_name": m.matter_name or "",
            "case_no": m.case_no or "",
            "forum_name": m.forum.name if m.forum else "",
            "amount": f"₹ {amount:,.2f}",
            "bill_type": "Part-1" if invoice_type == "PART1" else "Part-2",
        })

        total_amount += amount

    # ================= CONTEXT =================
    context = {
        "invoice_number": invoice.invoice_no,
        "invoice_date": invoice.created_at.strftime("%d/%m/%Y"),

        "client_name": client.legal_name,
        "client_address": getattr(client, "address", "") or "",

        "spoc_name": spoc.name if spoc else "",
        "spoc_email": spoc.email if spoc else "",
        "billing_email": getattr(client, "billing_email", "") or "",

        "items": items,

        "total_amount": f"{total_amount:,.0f}",
        "amount_words": number_to_words(total_amount),
    }

    # ================= RENDER =================
    doc.render(context)

    # ================= SAVE =================
    output_folder = os.path.join(BASE_DIR, "storage", "invoices", str(invoice.id))
    os.makedirs(output_folder, exist_ok=True)

    file_path = os.path.join(output_folder, f"invoice_{invoice.id}.docx")
    doc.save(file_path)

    print("✅ GENERATED DOCX:", file_path)

    return file_path


# ================= NUMBER TO WORDS =================

def number_to_words(n):
    try:
        from num2words import num2words
        return num2words(n, lang="en_IN").title()
    except:
        return str(n)