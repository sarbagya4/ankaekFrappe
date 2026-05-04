import frappe
import os
import shutil
import base64

def after_install():
    rename_desktop_icons()
    configure_website_settings()
    hide_erp_modules()
    update_desktop_icon_logos()
    replace_hrms_icons()
    replace_frappe_logo()
    patch_hrms_roster_bundle()

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

    if frappe.db.exists("Desktop Icon", "ERPNext Settings"):
        frappe.db.set_value("Desktop Icon", "ERPNext Settings", {
            "icon_type": "App",
            "link_type": "External",
            "link": "/app/erpnext-settings",
            "link_to": None,
        })

    if frappe.db.exists("Desktop Icon", "Frappe HR"):
        if frappe.db.exists("Workspace", "People"):
            link = "/desk/people"
        elif frappe.db.exists("Workspace", "HR Setup"):
            link = "/desk/hr-setup"
        else:
            link = "/desk/leaves"
        frappe.db.set_value("Desktop Icon", "Frappe HR", "link", link)

    child_icons = [
        "People", "Leaves", "HR Setup", "Payroll", "Expenses",
        "Performance", "Recruitment", "Shift & Attendance",
        "Tenure", "Tax & Benefits",
    ]
    for name in child_icons:
        if frappe.db.exists("Desktop Icon", name):
            frappe.db.set_value("Desktop Icon", name, "parent_icon", "ankaEK HR")

    frappe.db.commit()

def configure_website_settings():
    doc = frappe.get_doc("Website Settings")
    doc.app_logo = "/assets/ankaek/images/lahv_plus.jpg"
    doc.app_name = "Lahv+ Enterprise"
    doc.save(ignore_permissions=True)
    frappe.db.commit()

def hide_erp_modules():
    modules_to_hide = [
        "Accounting", "Buying", "Manufacturing",
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

def update_desktop_icon_logos():
    icon_map = {
        "Frappe HR":          "/assets/ankaek/images/icons/hr_main_outer.jpg",
        "Expenses":           "/assets/ankaek/images/icons/expenses.jpg",
        "HR Setup":           "/assets/ankaek/images/icons/hr_setup.jpg",
        "Leaves":             "/assets/ankaek/images/icons/leave.jpg",
        "Assets":              "/assets/ankaek/images/icons/assets.jpg",
        "Payroll":            "/assets/ankaek/images/icons/payroll.jpg",
        "Performance":        "/assets/ankaek/images/icons/performance.jpg",
        "Recruitment":        "/assets/ankaek/images/icons/recruitment.jpg",
        "Shift & Attendance": "/assets/ankaek/images/icons/shift_and_attendance.jpg",
        "Tax & Benefits":     "/assets/ankaek/images/icons/tax_and_benifits.jpg",
        "Tenure":             "/assets/ankaek/images/icons/tenure.jpg",
    }
    for name, logo_url in icon_map.items():
        if frappe.db.exists("Desktop Icon", name):
            frappe.db.set_value("Desktop Icon", name, "logo_url", logo_url)
    frappe.db.commit()

def replace_hrms_icons():
    bench_path = frappe.utils.get_bench_path()
    icons_source = os.path.join(bench_path, "apps", "ankaek", "ankaek", "public", "icons", "solid")
    icons_dest = os.path.join(bench_path, "apps", "hrms", "hrms", "public", "icons", "desktop_icons", "solid")

    if os.path.exists(icons_source) and os.path.exists(icons_dest):
        for f in os.listdir(icons_source):
            shutil.copy2(os.path.join(icons_source, f), os.path.join(icons_dest, f))
        os.system(f"cd {bench_path} && bench build --app hrms")

def patch_hrms_roster_bundle():
    bench_path = frappe.utils.get_bench_path()
    assets_dir = os.path.join(bench_path, "sites", "assets", "hrms", "roster", "assets")
    if not os.path.exists(assets_dir):
        return
    for fname in os.listdir(assets_dir):
        if fname.startswith("index-") and fname.endswith(".js"):
            fpath = os.path.join(assets_dir, fname)
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
            if "Frappe HR" in content:
                content = content.replace("Frappe HR", "ankaEK HR")
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(content)

def replace_frappe_logo():
    bench_path = frappe.utils.get_bench_path()
    logo_source = os.path.join(bench_path, "apps", "ankaek", "ankaek", "public", "images", "lahv_plus.jpg")
    logo_dest = os.path.join(bench_path, "apps", "frappe", "frappe", "public", "images", "frappe-framework-logo.svg")

    if os.path.exists(logo_source):
        with open(logo_source, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <image href="data:image/jpeg;base64,{b64}" width="100" height="100"/>
</svg>'''
        with open(logo_dest, "w") as f:
            f.write(svg_content)
        os.system(f"cd {bench_path} && bench build --app frappe")
