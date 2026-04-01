import frappe

def after_install():
    rename_desktop_icons()
    configure_website_settings()
    hide_erp_modules()
    rename_workspaces()

def rename_desktop_icons():
    renames = [
        ("Frappe HR", "ankaEK HR"),
        ("Framework", "ankaEK Build"),
        ("ERPNext Settings", "ankaEK Settings"),
    ]
    for name, label in renames:
        if frappe.db.exists("Desktop Icon", name):
            current = frappe.db.get_value("Desktop Icon", name, "label")
            if current != label:
                frappe.db.set_value("Desktop Icon", name, "label", label)

    # Fix ERPNext Settings icon type and link
    if frappe.db.exists("Desktop Icon", "ERPNext Settings"):
        frappe.db.set_value("Desktop Icon", "ERPNext Settings", {
            "icon_type": "App",
            "link_type": "External",
            "link": "/app/erpnext-settings",
            "link_to": None,
        })

    # Fix Frappe HR link — check which workspace exists
    if frappe.db.exists("Desktop Icon", "Frappe HR"):
        if frappe.db.exists("Workspace", "People"):
            link = "/desk/people"
        elif frappe.db.exists("Workspace", "HR Setup"):
            link = "/desk/hr-setup"
        else:
            link = "/desk/leaves"
        frappe.db.set_value("Desktop Icon", "Frappe HR", "link", link)

    frappe.db.commit()

def configure_website_settings():
    doc = frappe.get_doc("Website Settings")
    doc.app_logo = "/assets/ankaek/images/logo.jpg"
    doc.app_name = "ankaEK"
    doc.save(ignore_permissions=True)
    frappe.db.commit()

def hide_erp_modules():
    modules_to_hide = [
        "Accounting", "Assets", "Buying", "Manufacturing",
        "Organization", "Projects", "Quality", "Selling",
        "Stock", "Subcontracting", "ERPNext Settings",
        "Framework", "CRM", "Support", "Home",
        "Financial Reports", "Integrations", "Website",
        "Users", "Build", "Data", "Email", "Printing",
        "Automation", "System", "Banking", "Budget",
        "Taxes", "Accounts Setup", "Share Management",
        "Subscription", "Invoicing", "Payments",
    ]
    for name in modules_to_hide:
        if frappe.db.exists("Desktop Icon", name):
            frappe.db.set_value("Desktop Icon", name, "hidden", 1)
    frappe.db.commit()

def rename_workspaces():
    workspace_renames = [
        ("People", "ankaEK HR"),
        ("HR Setup", "ankaEK HR"),
    ]
    for name, title in workspace_renames:
        if frappe.db.exists("Workspace", name):
            frappe.db.set_value("Workspace", name, "title", title)
    frappe.db.commit()
