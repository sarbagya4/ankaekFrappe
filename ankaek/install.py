import frappe

def after_install():
    rename_desktop_icons()

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

    # Fix ERPNext Settings icon_type and link
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
