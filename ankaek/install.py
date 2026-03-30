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
            frappe.db.set_value("Desktop Icon", name, "label", label)

    # Fix ERPNext Settings icon_type
    if frappe.db.exists("Desktop Icon", "ERPNext Settings"):
        frappe.db.set_value("Desktop Icon", "ERPNext Settings", {
            "icon_type": "App",
            "link_type": "External",
            "link": "/desk/erpnext-settings",
            "link_to": None,
        })

    frappe.db.commit()
