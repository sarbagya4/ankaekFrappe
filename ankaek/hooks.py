app_name = "ankaek"
app_title = "ankaEK"
app_publisher = "ankaEK"
app_description = "ankaEK "
app_email = "ankaEK@gmail.com"
app_license = "mit"
# Nepali date picker assets pinned by commit SHA on jsDelivr's GitHub mirror.
# Pinned ref is immutable; bump it deliberately when upstream changes need pulling in.
NEPALIDATE_CDN_REF = "5e1f5378c3b1"
app_include_css = [
	"/assets/ankaek/css/brand.css",
	f"https://cdn.jsdelivr.net/gh/rbnkoirala/nepalidate@{NEPALIDATE_CDN_REF}/nepalidate/public/css/nepali.datepicker.css",
]
app_include_js = [
	f"https://cdn.jsdelivr.net/gh/rbnkoirala/nepalidate@{NEPALIDATE_CDN_REF}/nepalidate/public/js/nepali.datepicker.js",
	"/assets/ankaek/js/nepali_date.js",
	"/assets/ankaek/js/brand.js",
]

# Injected into Frappe website pages
web_include_js = "/assets/ankaek/js/brand.js"
web_include_css = "/assets/ankaek/css/brand.css"

# Injected into the HRMS "hr" Page — covers /hr/* custom pages (roster, shifts, etc.)
# These pages use a standalone template that bypasses app_include_* and web_include_*
page_js = {"hr": "public/js/brand.js"}

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "ankaek",
# 		"logo": "/assets/ankaek/logo.png",
# 		"title": "ankaEK",
# 		"route": "/ankaek",
# 		"has_permission": "ankaek.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/ankaek/css/ankaek.css"
# app_include_js = "/assets/ankaek/js/ankaek.js"

# include js, css files in header of web template
# web_include_css = "/assets/ankaek/css/ankaek.css"
# web_include_js = "/assets/ankaek/js/ankaek.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "ankaek/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "ankaek/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "ankaek.utils.jinja_methods",
# 	"filters": "ankaek.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "ankaek.install.before_install"
# after_install = "ankaek.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "ankaek.uninstall.before_uninstall"
# after_uninstall = "ankaek.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "ankaek.utils.before_app_install"
# after_app_install = "ankaek.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "ankaek.utils.before_app_uninstall"
# after_app_uninstall = "ankaek.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "ankaek.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"ankaek.tasks.all"
# 	],
# 	"daily": [
# 		"ankaek.tasks.daily"
# 	],
# 	"hourly": [
# 		"ankaek.tasks.hourly"
# 	],
# 	"weekly": [
# 		"ankaek.tasks.weekly"
# 	],
# 	"monthly": [
# 		"ankaek.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "ankaek.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "ankaek.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "ankaek.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "ankaek.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["ankaek.utils.before_request"]
# after_request = ["ankaek.utils.after_request"]

# Job Events
# ----------
# before_job = ["ankaek.utils.before_job"]
# after_job = ["ankaek.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"ankaek.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []
brand_html = "Lahv+ Enterprise by ankaEK"
app_logo_url = "/assets/ankaek/images/lahv_plus.jpg"
login_logo_url = "/assets/ankaek/images/logo.jpg"
favicon = "/assets/ankaek/images/favicon.ico"
after_install = "ankaek.install.after_install"
after_migrate = ["ankaek.install.after_install"]
