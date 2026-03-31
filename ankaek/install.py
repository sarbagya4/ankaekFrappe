import frappe

def after_install():
    rename_desktop_icons()
    configure_website_settings()

def rename_desktop_icons():
    renames = [
        ("Frappe HR", "ankaEK HR"),
        ("Framework", "ankaEK Build"),
        ("ERPNext Settings", "ankaEK Settings"),
    ]
    for name, label in renames:
        if frappe.db.exists("Desktop Icon", name):
            current_label = frappe.db.get_value("Desktop Icon", name, "label")
            if current_label != label:
                frappe.db.set_value("Desktop Icon", name, "label", label)

    # Fix ERPNext Settings — icon type and link
    if frappe.db.exists("Desktop Icon", "ERPNext Settings"):
        frappe.db.set_value("Desktop Icon", "ERPNext Settings", {
            "icon_type": "App",
            "link_type": "External",
            "link": "/app/erpnext-settings",
            "link_to": None,
        })

    # Fix Frappe HR link to valid workspace
    if frappe.db.exists("Desktop Icon", "Frappe HR"):
        frappe.db.set_value("Desktop Icon", "Frappe HR", "link", "/desk/hr-setup")

    frappe.db.commit()

def configure_website_settings():
    doc = frappe.get_doc("Website Settings")
    doc.app_logo = "/assets/ankaek/images/logo.jpg"
    doc.app_name = "Lahv+ Enterprise by ankaEK"
    doc.save(ignore_permissions=True)
    frappe.db.commit()
