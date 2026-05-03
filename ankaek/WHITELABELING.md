# ankaEK Whitelabeling & Frappe Customization

This document explains how the `ankaek` Frappe app overrides the default Frappe/ERPNext/HRMS appearance to produce the **Lahv+ Enterprise** branded product.

---

## Overview

The app uses **four distinct mechanisms** to replace Frappe's identity with the ankaEK brand:

| Mechanism                      | Where                      | When it fires                          |
| ------------------------------ | -------------------------- | -------------------------------------- |
| `hooks.py` metadata fields     | App-level config           | Every page load (runtime)              |
| `public/css/brand.css`         | CSS injection              | Every desk page load (runtime)         |
| `install.py` → `after_install` | Python functions           | `bench install-app` or `bench migrate` |
| Direct asset replacement       | File system copy + rebuild | Inside `after_install` at install time |

---

## Frappe Concepts

### App Layering & Override Model

Every Frappe site starts blank. When you run `bench new-site`, only the Frappe core is
present. ERPNext, HRMS, and custom apps like `ankaek` are installed on top in layers:

```
frappe        ← base framework: tables, auth, desk UI, asset pipeline
  ↑
erpnext       ← ERP doctypes and business logic
  ↑
hrms          ← HR-specific doctypes, icons, workspaces
  ↑
ankaek        ← sits on top; overrides brand, icons, settings
```

Frappe loads all installed apps in installation order and merges their `hooks.py`
entries. If two apps define the same key (e.g. `app_logo_url`), the **last installed
app wins**. `ankaek` must therefore be installed after Frappe, ERPNext, and HRMS.

**What a custom app can override**

| Target                               | Mechanism                                          | When it applies                       |
| ------------------------------------ | -------------------------------------------------- | ------------------------------------- |
| Brand identity (logo, name, favicon) | `hooks.py` keys                                    | Runtime — every page load             |
| UI labels / text                     | `app_include_css` CSS injection                    | Runtime — every desk page             |
| DB content (icons, settings)         | `install.py` `frappe.db.*` writes                  | Install time + every `bench migrate`  |
| Another app's DocType controller     | `override_doctype_class` in `hooks.py`             | Runtime — replaces the class entirely |
| Another app's DocType events         | `doc_events` in `hooks.py`                         | Runtime — appended to its hook chain  |
| Physical assets (SVGs, logo files)   | File copy into target app's source + `bench build` | Install time                          |

**Install order matters**

```bash
bench new-site mysite.com                    # bare Frappe only
bench --site mysite.com install-app erpnext
bench --site mysite.com install-app hrms
bench --site mysite.com install-app ankaek   # must come last
```

`ankaek`'s `after_install` runs immediately at install time and writes over the
defaults set by Frappe, ERPNext, and HRMS. If installed before those apps, the
defaults they set during their own installs would overwrite `ankaek`'s changes.

**Durability of overrides**

| Override type                      | Survives `bench migrate`?            | Survives `bench update`?                                                     |
| ---------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------- |
| `hooks.py` keys                    | Yes — read at runtime                | Yes — read at runtime                                                        |
| DB writes via `install.py`         | Yes — `after_migrate` re-runs them   | Yes — `after_migrate` re-runs them                                           |
| Filesystem overwrites (SVGs, logo) | Yes — `after_migrate` re-copies them | No — `bench update` restores original files; `after_migrate` then re-applies |

The filesystem overrides are the fragile ones. `bench update` pulls the latest source
for all apps, which restores Frappe's and HRMS's original files. `after_migrate`
firing immediately after is what keeps the brand intact — but there is a brief window
where the originals are live until migration completes.

---

### The `bench` Tool

`bench` is Frappe's project manager — the equivalent of a combined `npm`, `manage.py`, and
`systemctl` for a Frappe installation. It manages apps, sites, processes, and asset builds.

**Bench directory layout**

```
bench/
  apps/           ← one subdirectory per installed Frappe app (git repos)
    frappe/
    erpnext/
    hrms/
    ankaek/       ← this repo lives here
  sites/
    mysite.com/
      site_config.json   ← DB credentials, site-specific settings
      private/
      public/
        assets/   ← symlinked from each app's public/ after bench build
  env/            ← Python virtualenv shared by all apps
  Procfile        ← process definitions (web, worker, scheduler)
```

**Common commands**

```bash
# install a new app from a git repo into apps/
bench get-app https://github.com/your-org/ankaek

# install the app onto a site (runs after_install hook)
bench --site mysite.com install-app ankaek

# run DB migrations for all apps on a site (runs after_migrate hooks)
bench --site mysite.com migrate

# compile frontend assets for one or all apps
bench build --app ankaek
bench build                  # all apps

# start all processes (web server, workers, scheduler)
bench start

# restart production services
bench restart
```

**Installing `ankaek` on a site — full sequence**

```bash
# 1. clone this repo into the bench apps directory
cd /path/to/bench
bench get-app ankaek https://github.com/your-org/ankaek
# or manually: git clone ... apps/ankaek

# 2. install onto your site
bench --site mysite.com install-app ankaek
# → reads hooks.py, runs after_install() from install.py

# 3. build assets so /assets/ankaek/ URLs resolve
bench build --app ankaek

# 4. on subsequent Frappe/HRMS upgrades, re-apply DB settings
bench --site mysite.com migrate
# → after_migrate fires after_install() again automatically
```

Step 3 is what makes the `/assets/ankaek/...` URL paths live — without it, logos
and CSS will 404 even though the DB rows point to them correctly.

---

### DocType System & Hook Chain

#### What is a DocType

A DocType is Frappe's schema unit — the equivalent of a Django model, but defined in JSON
rather than Python. Frappe reads the JSON on `bench migrate` and creates or alters the
database table automatically. No migration scripts to write.

```
apps/hrms/hrms/hr/doctype/employee/
  employee.json    ← field definitions, permissions, naming rules
  employee.py      ← controller class (optional; hook methods go here)
  employee.js      ← client-side form logic
```

Table name convention: `tab` + DocType name (spaces preserved).

```
"Desktop Icon"  →  tabDesktop Icon
"Website Settings"  →  tabWebsite Settings
"Employee"  →  tabEmployee
```

`frappe.get_doc("Desktop Icon", "Frappe HR")` resolves to
`SELECT * FROM tabDesktop Icon WHERE name = 'Frappe HR'`.

#### Controller hook chain

When you call `doc.save()`, `doc.submit()`, etc., Frappe fires a fixed sequence of
methods on the controller class in `employee.py`. Override the ones you need:

```
save() sequence
───────────────
autoname()          ← generate the `name` PK (naming series, custom logic)
before_insert()     ← new records only
validate()          ← every save; call frappe.throw() here to block
before_save()
── SQL write ──
after_insert()      ← new records only
on_update()         ← every save, post-write

submit() sequence (Draft → Submitted, docstatus 0 → 1)
───────────────────────────────────────────────────────
validate()
before_submit()
── SQL write ──
on_submit()

cancel() sequence (docstatus 1 → 2)
────────────────────────────────────
before_cancel()
── SQL write ──
on_cancel()

delete() sequence
─────────────────
before_delete()
── SQL delete ──
after_delete()
```

`frappe.db.set_value()` bypasses this entire chain — it issues a raw `UPDATE` with no
validation or hooks. That is why `install.py` uses it for bulk icon/module updates:
speed matters and there is nothing to validate.

#### App-level hooks (hooks.py) — a separate system

`hooks.py` events are application-scoped, not per-DocType. They fire on Frappe lifecycle
events (install, migrate, request) rather than document operations.

```python
# fire once at bench install-app
after_install = "ankaek.install.after_install"

# fire on every bench migrate
after_migrate = ["ankaek.install.after_install"]

# inject into every desk page <head>
app_include_css = "/assets/ankaek/css/brand.css"

# attach to any DocType's lifecycle from a separate app — no forking needed
doc_events = {
    "Employee": {
        "on_update": "ankaek.handlers.after_employee_save"
    }
}

# replace a DocType's controller class entirely
override_doctype_class = {
    "Employee": "ankaek.overrides.CustomEmployee"
}
```

`doc_events` is the standard extension point — it lets this app hook into any installed
DocType's save/submit/cancel lifecycle without modifying the original app's source.
Frappe merges `doc_events` from all installed apps and calls them all in sequence.

**Summary — two hook systems side by side**

|                 | Controller methods (`.py`) | `hooks.py` events                     |
| --------------- | -------------------------- | ------------------------------------- |
| Defined in      | DocType's own `.py` file   | This app's `hooks.py`                 |
| Scope           | That DocType only          | Any DocType, cross-app                |
| Extension point | `override_doctype_class`   | `doc_events` dict                     |
| Typical use     | Validation, business logic | Whitelabeling, cross-app side effects |

---

## File-by-File Breakdown

### `hooks.py` — App Identity & Runtime Overrides

The primary Frappe configuration file. Every key-value pair here is read by the Frappe framework at runtime.

**Active whitelabeling entries (bottom of file):**

```python
brand_html      = "Lahv+ Enterprise by ankaEK"
app_logo_url    = "/assets/ankaek/images/lahv_plus.jpg"
login_logo_url  = "/assets/ankaek/images/logo.jpg"
favicon         = "/assets/ankaek/images/favicon.ico"
app_include_css = "/assets/ankaek/css/brand.css"
after_install   = "ankaek.install.after_install"
after_migrate   = ["ankaek.install.after_install"]
```

| Key               | What it controls                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `brand_html`      | The text/HTML shown in the Frappe navbar brand slot                                            |
| `app_logo_url`    | Logo shown in the desk header / app switcher                                                   |
| `login_logo_url`  | Logo shown on the `/login` page                                                                |
| `favicon`         | Browser tab icon for all Frappe pages                                                          |
| `app_include_css` | Injects `brand.css` into every desk (admin UI) page `<head>`                                   |
| `after_install`   | Python function called once when `bench install-app ankaek` runs                               |
| `after_migrate`   | Same function also re-runs on every `bench migrate` — keeps DB settings in sync after upgrades |

All other entries in `hooks.py` are commented-out Frappe boilerplate (no effect).

---

### `install.py` — Database & Asset Customization at Install Time

Contains one exported function `after_install()`, which is the entry point called by both `after_install` and `after_migrate` hooks. It runs six steps in order:

```
after_install()
 │
 ├── rename_desktop_icons()       [DB]  frappe.db.set_value × ~14 rows
 ├── configure_website_settings() [DB]  frappe.get_doc().save() × 1 doc
 ├── hide_erp_modules()           [DB]  frappe.db.set_value × 30+ rows
 ├── update_desktop_icon_logos()  [DB]  frappe.db.set_value × 10 rows
 ├── replace_hrms_icons()         [FS]  file copy + bench build --app hrms
 └── replace_frappe_logo()        [FS]  file overwrite + bench build --app frappe
```

**Function responsibility at a glance**

| Function                       | Layer      | DocType(s) touched | What changes                                                                              |
| ------------------------------ | ---------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `rename_desktop_icons()`       | DB         | `Desktop Icon`     | `label`, `link`, `parent_icon` fields on named icon rows                                  |
| `configure_website_settings()` | DB         | `Website Settings` | `app_logo`, `app_name` on the singleton settings doc                                      |
| `hide_erp_modules()`           | DB         | `Desktop Icon`     | `hidden = 1` on 30+ ERP module icons                                                      |
| `update_desktop_icon_logos()`  | DB         | `Desktop Icon`     | `logo_url` on 10 HRMS module icons                                                        |
| `replace_hrms_icons()`         | Filesystem | —                  | Overwrites SVG files inside `apps/hrms/`, then rebuilds HRMS assets                       |
| `replace_frappe_logo()`        | Filesystem | —                  | Overwrites `frappe-framework-logo.svg` inside `apps/frappe/`, then rebuilds Frappe assets |

The DB functions are safe to re-run (idempotent — `frappe.db.exists()` guards every
write). The filesystem functions are also re-runnable but destructive: they overwrite
files in other apps' source trees and trigger a full `bench build` each time.

#### Frappe DB Layer

Frappe has its own ORM — not SQLAlchemy or Django ORM. It maps DocTypes to tables
using the convention `tab` + DocType name (e.g. `"Desktop Icon"` → `tabDesktop Icon`).
Two patterns are used throughout `install.py`:

**`frappe.db.*` — direct, hook-free SQL operations**

```python
frappe.db.exists("Desktop Icon", name)    # SELECT 1 WHERE name = %s
frappe.db.get_value("Desktop Icon", name, "label")  # SELECT label WHERE name = %s
frappe.db.set_value("Desktop Icon", name, "label", value)  # UPDATE single column
frappe.db.set_value("Desktop Icon", name, {"hidden": 1, "label": "x"})  # UPDATE multi
frappe.db.commit()  # explicit COMMIT — Frappe does not auto-commit after db.* calls
```

**`frappe.get_doc().save()` — full DocType lifecycle**

```python
doc = frappe.get_doc("Website Settings")
doc.app_name = "Lahv+ Enterprise"
doc.save(ignore_permissions=True)  # runs validators + before/after_save hooks, then commits
```

| Method                    | Fires hooks? | Use when                                        |
| ------------------------- | ------------ | ----------------------------------------------- |
| `frappe.db.set_value()`   | No           | Fast bulk field updates (most of `install.py`)  |
| `frappe.get_doc().save()` | Yes          | Need full DocType validation / hook chain       |
| `frappe.db.commit()`      | —            | Required after any `frappe.db.*` write sequence |

`install.py` uses `frappe.db.*` for all bulk icon/module updates (speed, no hooks needed)
and `frappe.get_doc().save()` only for `Website Settings` (a singleton doc where hook
execution and field validation matter).

---

#### `rename_desktop_icons()`

Renames three Frappe-default desktop icons in the database:

| Original name      | New label         |
| ------------------ | ----------------- |
| `Frappe HR`        | `ankaEK HR`       |
| `Framework`        | `ankaEK Build`    |
| `ERPNext Settings` | `ankaEK Settings` |

Also re-parents the ten HRMS workspace icons (`People`, `Leaves`, `HR Setup`, `Payroll`, `Expenses`, `Performance`, `Recruitment`, `Shift & Attendance`, `Tenure`, `Tax & Benefits`) so they appear under the `ankaEK HR` parent icon in the desk sidebar.

Sets the `Frappe HR` icon link to point to the first workspace that exists: `People` → `HR Setup` → `Leaves` (fallback chain).

#### `configure_website_settings()`

Writes directly to the `Website Settings` DocType in the database:

- `app_logo` → `/assets/ankaek/images/lahv_plus.jpg`
- `app_name` → `Lahv+ Enterprise`

This controls what appears in Frappe's public-facing website pages and the desk header.

#### `hide_erp_modules()`

Sets `hidden = 1` on 30+ Desktop Icon records — every ERP module that isn't needed for the HR-only product:

`Accounting`, `Assets`, `Buying`, `Manufacturing`, `Organization`, `Projects`, `Quality`, `Selling`, `Stock`, `Subcontracting`, `ERPNext Settings`, `Framework`, `CRM`, `Support`, `Home`, `Financial Reports`, `Integrations`, `Website`, `Users`, `Build`, `Data`, `Email`, `Printing`, `Automation`, `System`, `Banking`, `Budget`, `Taxes`, `Accounts Setup`, `Share Management`, `Subscription`, `Invoicing`, `Payments`

Result: users only see the HRMS modules in their desk.

#### `update_desktop_icon_logos()`

Replaces the `logo_url` field on ten Desktop Icon DB records with custom branded JPG paths:

| Icon               | Custom image                     |
| ------------------ | -------------------------------- |
| Frappe HR          | `icons/hr_main_outer.jpg`        |
| Expenses           | `icons/expenses.jpg`             |
| HR Setup           | `icons/hr_setup.jpg`             |
| Leaves             | `icons/leave.jpg`                |
| Payroll            | `icons/payroll.jpg`              |
| Performance        | `icons/performance.jpg`          |
| Recruitment        | `icons/recruitment.jpg`          |
| Shift & Attendance | `icons/shift_and_attendance.jpg` |
| Tax & Benefits     | `icons/tax_and_benifits.jpg`     |
| Tenure             | `icons/tenure.jpg`               |

#### `replace_hrms_icons()`

A **file-system level** override. Physically copies the custom SVG icons from:

```
apps/ankaek/ankaek/public/icons/solid/*.svg   ← path in code (wrong)
apps/ankaek/public/icons/solid/*.svg          ← actual repo layout (correct)
```

> **Bug:** `install.py:98` constructs the source path with an extra `"ankaek"` segment —
> `os.path.join(bench_path, "apps", "ankaek", "ankaek", "public", "icons", "solid")`.
> This repo does **not** have a nested `ankaek/ankaek/` structure; `public/` sits directly
> at the repo root. The `os.path.exists()` guard on line 101 silently swallows the failure,
> so `replace_hrms_icons()` is a no-op until this path is corrected.
>
> Fix: remove the inner `"ankaek"` segment:
>
> ```python
> icons_source = os.path.join(bench_path, "apps", "ankaek", "public", "icons", "solid")
> ```

into the HRMS app's own icon source directory:

```
apps/hrms/hrms/public/icons/desktop_icons/solid/
```

Then runs `bench build --app hrms` to compile the HRMS front-end assets with the new icons baked in. This means the replacement survives even if Frappe caches are cleared.

#### `replace_frappe_logo()`

A **deep asset override**. Reads `lahv_plus.jpg` from:

```
apps/ankaek/ankaek/public/images/lahv_plus.jpg   ← path in code (wrong)
apps/ankaek/public/images/lahv_plus.jpg          ← actual repo layout (correct)
```

> **Bug:** `install.py:108` has the same extra `"ankaek"` segment as `replace_hrms_icons`.
> The `os.path.exists()` guard on line 111 silently skips the entire function when the
> source file isn't found, so no logo replacement or `bench build` occurs.
>
> Fix:
>
> ```python
> logo_source = os.path.join(bench_path, "apps", "ankaek", "public", "images", "lahv_plus.jpg")
> ```

Base64-encodes it, and writes a new SVG file that wraps the JPEG as an inline data URI — saving it directly over Frappe's own logo file:

```
apps/frappe/frappe/public/images/frappe-framework-logo.svg
```

Then runs `bench build --app frappe` to compile it into Frappe's bundle. This replaces the Frappe logo wherever it's referenced in Frappe's own UI components (e.g. the loading spinner, certain modals).

> **Note:** This modifies files inside the `frappe` app source. After a `pip install --upgrade frappe` or `bench update`, the original file may be restored, and `after_migrate` will re-apply the override.

---

### `public/css/brand.css` — Runtime CSS Text Replacement

Injected into every desk page via `app_include_css`. Handles one specific label that can't be changed through the DB:

```css
/* Hides the rendered "Frappe HR" sidebar header text */
.sidebar-item-label.header-subtitle {
  font-size: 0 !important;
}
/* Injects "ankaEK HR" in its place via pseudo-element */
.sidebar-item-label.header-subtitle::after {
  content: "ankaEK HR";
  font-size: var(--text-sm);
}
```

This targets the sidebar group header for the Frappe HR workspace. The `font-size: 0` trick collapses the original text without removing the element (which would break layout), and `::after` renders the replacement at the correct size.

---

### Asset URL Resolution

Frappe's build system (`bench build`) symlinks every app's `public/` directory into the bench's shared static root:

```
bench/apps/ankaek/public/  →  bench/sites/assets/ankaek/
```

This means any file under `public/` in this repo is served at `/assets/ankaek/<relative-path>`. Example:

```
public/images/icons/hr_main_outer.jpg
      ↓ served as
/assets/ankaek/images/icons/hr_main_outer.jpg
```

The URL strings written into the database by `configure_website_settings()` and `update_desktop_icon_logos()` rely on this mapping being in place. If `bench build` has not been run after install, these URLs will 404.

---

### `public/images/` — Brand Assets

| File                             | Used by                                                                                         | Purpose                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `lahv_plus.jpg`                  | `hooks.py` (`app_logo_url`), `install.py` (`replace_frappe_logo`, `configure_website_settings`) | Primary product logo — desk header, app switcher, and Frappe's own logo slot |
| `logo.jpg`                       | `hooks.py` (`login_logo_url`)                                                                   | Login page logo                                                              |
| `favicon.ico`                    | `hooks.py` (`favicon`)                                                                          | Browser tab icon (ICO format, broadest compatibility)                        |
| `favicon.png`                    | Available as fallback                                                                           | PNG version of favicon                                                       |
| `icons/hr_main_outer.jpg`        | `install.py` (`update_desktop_icon_logos`)                                                      | Desktop card for the parent HR icon                                          |
| `icons/expenses.jpg`             | `install.py`                                                                                    | Desktop card for Expenses module                                             |
| `icons/hr_setup.jpg`             | `install.py`                                                                                    | Desktop card for HR Setup module                                             |
| `icons/leave.jpg`                | `install.py`                                                                                    | Desktop card for Leaves module                                               |
| `icons/payroll.jpg`              | `install.py`                                                                                    | Desktop card for Payroll module                                              |
| `icons/performance.jpg`          | `install.py`                                                                                    | Desktop card for Performance module                                          |
| `icons/recruitment.jpg`          | `install.py`                                                                                    | Desktop card for Recruitment module                                          |
| `icons/shift_and_attendance.jpg` | `install.py`                                                                                    | Desktop card for Shift & Attendance module                                   |
| `icons/tax_and_benifits.jpg`     | `install.py`                                                                                    | Desktop card for Tax & Benefits module                                       |
| `icons/tenure.jpg`               | `install.py`                                                                                    | Desktop card for Tenure module                                               |

---

### `public/icons/solid/` — SVG Module Icons (Source Replacements)

Ten custom SVG files that replace HRMS's built-in vector icons. These are the icons used inside the HRMS sidebar and workspace navigation (as opposed to the desktop card thumbnails above, which are JPGs).

| File                     | Replaces                          |
| ------------------------ | --------------------------------- |
| `people.svg`             | People workspace icon             |
| `leaves.svg`             | Leaves workspace icon             |
| `hr_setup.svg`           | HR Setup workspace icon           |
| `payroll.svg`            | Payroll workspace icon            |
| `expenses.svg`           | Expenses workspace icon           |
| `performance.svg`        | Performance workspace icon        |
| `recruitment.svg`        | Recruitment workspace icon        |
| `shift_&_attendance.svg` | Shift & Attendance workspace icon |
| `tax_&_benefits.svg`     | Tax & Benefits workspace icon     |
| `tenure.svg`             | Tenure workspace icon             |

These are copied into the HRMS source tree and compiled by `replace_hrms_icons()` at install time.

---

### `modules.txt` — Module Declaration

```
ankaEK
```

Declares a single Frappe module named `ankaEK`. Required by the framework to recognize this as a valid app module. No doctypes or controllers currently live under this module.

---

### `patches.txt` — Database Migration Patches

Empty `[pre_model_sync]` and `[post_model_sync]` sections. No data migration patches have been added yet. Patch entries added here run once per instance during `bench migrate`.

---

### `__init__.py` (root) — Package Version

```python
__version__ = "0.0.1"
```

Standard Python package init. Sets the app version string.

### `ankaek/__init__.py` — Inner Module Init

Empty. Required for Python to treat `ankaek/` as a package (so `ankaek.install` can be imported by hooks).

### `ankaek/.frappe` — Frappe App Marker

An empty file. Frappe uses its presence to confirm that the `ankaek/` subdirectory is the app's Python module (as opposed to the outer repo root).

---

## How It All Fits Together

```
bench install-app ankaek
        │
        ├─ Frappe reads hooks.py
        │     └─ Registers: brand_html, logos, favicon, CSS injection, hooks
        │
        └─ after_install hook fires → install.py:after_install()
              ├─ rename_desktop_icons()     → DB writes (Desktop Icon labels + parent)
              ├─ configure_website_settings() → DB write (Website Settings doc)
              ├─ hide_erp_modules()         → DB writes (hidden=1 on 30+ icons)
              ├─ update_desktop_icon_logos() → DB writes (logo_url on 10 icons)
              ├─ replace_hrms_icons()       → File copy into hrms/ + bench build hrms
              └─ replace_frappe_logo()      → File overwrite in frappe/ + bench build frappe

Every page load (runtime):
  └─ hooks.py values applied:
        ├─ brand_html      → Navbar brand slot
        ├─ app_logo_url    → Desk header logo
        ├─ login_logo_url  → Login page logo
        ├─ favicon         → Browser tab
        └─ brand.css       → Injected into <head> → sidebar label replacement
```

`after_migrate` re-runs the full `after_install` function on every `bench migrate`, ensuring the DB settings and file-level replacements are re-applied after any Frappe or HRMS upgrade.
