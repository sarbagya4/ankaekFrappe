/**
 * Bikram Sambat (BS) date override for Frappe Desk, with a single global
 * BS<->AD toggle in the navbar.
 *
 * Mode is stored in localStorage["ankaek_date_mode"] and defaults to "AD".
 * Flipping the navbar toggle live re-renders every active ControlDate /
 * ControlDatetime / ControlDateRange (and refreshes the current list view
 * if any) so the UI updates without a page reload. Cross-tab sync is
 * handled via the `storage` event.
 *
 * Storage contract is unchanged regardless of mode: the model always
 * stores ISO Gregorian (`YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss`).
 *
 * Depends on `nepali.datepicker.js` (loaded via app_include_js before
 * this file), which exposes `NepaliFunctions` and
 * `$.fn.nepaliDatePicker`. AD mode uses Frappe's bundled air-datepicker.
 */
(function () {
	"use strict";

	if (typeof frappe === "undefined" || !frappe.ui || !frappe.ui.form) {
		return;
	}

	if (typeof NepaliFunctions === "undefined" || !window.jQuery || !window.jQuery.fn.nepaliDatePicker) {
		// eslint-disable-next-line no-console
		console.warn("[ankaek] nepalidate library not loaded; BS picker disabled");
		return;
	}

	var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
	var STORAGE_KEY = "ankaek_date_mode";
	var DEFAULT_MODE = "AD";

	// ---- Global mode store ---------------------------------------------------

	var subscribers = [];

	function notifySubscribers(mode) {
		for (var i = 0; i < subscribers.length; i++) {
			try {
				subscribers[i](mode);
			} catch (e) {
				/* one bad subscriber must not block the rest */
			}
		}
	}

	var globalMode = {
		get: function () {
			try {
				var v = localStorage.getItem(STORAGE_KEY);
				return v === "BS" || v === "AD" ? v : DEFAULT_MODE;
			} catch (e) {
				return DEFAULT_MODE;
			}
		},
		set: function (mode) {
			if (mode !== "BS" && mode !== "AD") return;
			if (globalMode.get() === mode) return;
			try {
				localStorage.setItem(STORAGE_KEY, mode);
			} catch (e) {
				/* private mode / quota — proceed in-memory */
			}
			notifySubscribers(mode);
		},
		subscribe: function (cb) {
			subscribers.push(cb);
		},
	};

	// Cross-tab sync: another tab flipping the toggle updates this tab too.
	window.addEventListener("storage", function (ev) {
		if (ev.key !== STORAGE_KEY) return;
		var mode = ev.newValue === "BS" || ev.newValue === "AD" ? ev.newValue : DEFAULT_MODE;
		notifySubscribers(mode);
	});

	// ---- BS<->AD helpers -----------------------------------------------------

	function adToBs(ad) {
		if (!ad || !ISO_DATE.test(ad)) return null;
		try {
			return NepaliFunctions.AD2BS(ad, "YYYY-MM-DD", "YYYY-MM-DD");
		} catch (e) {
			return null;
		}
	}

	function bsToAd(bs) {
		if (!bs || !ISO_DATE.test(bs)) return null;
		try {
			return NepaliFunctions.BS2AD(bs, "YYYY-MM-DD", "YYYY-MM-DD");
		} catch (e) {
			return null;
		}
	}

	// Split "YYYY-MM-DD HH:mm:ss" -> ["YYYY-MM-DD", "HH:mm:ss"].
	function splitDatetime(value) {
		if (!value) return ["", "00:00:00"];
		var parts = String(value).trim().split(/\s+/);
		return [parts[0] || "", parts[1] || "00:00:00"];
	}

	// Build a local-time JS Date from an ISO datetime string, sidestepping
	// `new Date("YYYY-MM-DD")` which JS interprets as UTC midnight (and
	// then renders one day off in negative-offset timezones).
	function isoToLocalDate(iso) {
		if (!iso) return null;
		var parts = String(iso).trim().split(/[\s\-T:]/);
		if (parts.length < 3) return null;
		var y = parseInt(parts[0], 10);
		var m = parseInt(parts[1], 10);
		var d = parseInt(parts[2], 10);
		if (!y || !m || !d) return null;
		var hh = parts[3] ? parseInt(parts[3], 10) : 0;
		var mm = parts[4] ? parseInt(parts[4], 10) : 0;
		var ss = parts[5] ? parseInt(parts[5], 10) : 0;
		return new Date(y, m - 1, d, hh, mm, ss);
	}

	// ---- Picker attach / detach ---------------------------------------------

	function destroyBsPicker($input) {
		// nepalidate's "remove" command only unbinds 4 of the 9 listeners
		// it attaches (focus / keydown / mouseenter / mouseleave). The
		// click/mouseup/change/blur handlers are anonymous and can never
		// be removed. So "remove" is best-effort cleanup of state — the
		// real teardown happens via swapInput() below, which replaces the
		// element so all native listeners go with the old DOM node.
		try {
			$input.nepaliDatePicker("remove");
		} catch (e) {
			/* best-effort */
		}
	}

	function destroyAdPicker(control) {
		if (control.datepicker && typeof control.datepicker.destroy === "function") {
			try {
				control.datepicker.destroy();
			} catch (e) {
				/* ignore */
			}
			control.datepicker = null;
		}
	}

	// Replace control.$input with a deep clone. jQuery's clone(true)
	// copies jQuery-bound handlers (Frappe's change/blur/etc) but does
	// NOT copy native addEventListener bindings — which is exactly how
	// we strip nepalidate's leftover click/mouseup/blur/change handlers
	// (and any flatpickr leftovers) without losing Frappe's wiring.
	function swapInput(control) {
		var $old = control.$input;
		var $new = $old.clone(true);
		$new.removeClass("ndp-nepali-calendar")
			.removeAttr("ndp-calendar-data")
			.removeAttr("readonly");
		$old.replaceWith($new);
		control.$input = $new;
		return $new;
	}

	function attachBsSingle($input, onPickedAd) {
		$input.attr("autocomplete", "off");
		$input.attr("placeholder", "YYYY-MM-DD (BS)");
		$input.nepaliDatePicker({
			ndpYear: true,
			ndpMonth: true,
			ndpYearCount: 100,
			dateFormat: "YYYY-MM-DD",
			disableAfter: "",
			disableBefore: "",
			onChange: function (e) {
				if (!e || !e.ad) return;
				onPickedAd(e.ad);
			},
		});
	}

	function attachAdSingle($input, control) {
		// Re-trigger Frappe's own picker init on the (swapped) $input.
		// Frappe uses air-datepicker as a jQuery plugin via `make_picker()`
		// -> `set_date_options()` + `set_datepicker()`, which attaches the
		// picker to control.$input and stores the instance at
		// control.datepicker.
		$input.attr("autocomplete", "off");
		$input.removeAttr("placeholder");
		if (typeof control.make_picker === "function") {
			control.make_picker();
		} else if (typeof control.set_datepicker === "function") {
			if (typeof control.set_date_options === "function") control.set_date_options();
			control.set_datepicker();
		}

		// Air-datepicker only auto-parses the input value when its
		// dateFormat exactly matches what's already there. In edge
		// cases — e.g., when our toggle ran before the model had a
		// value, or when Frappe's format string diverges from the
		// picker's parser grammar — it leaves the calendar empty AND
		// wipes the input on focus. Programmatically selecting the
		// date sidesteps both: it highlights the calendar and the
		// picker treats the input value as authoritative on focus.
		if (control.datepicker && control.value) {
			var d = isoToLocalDate(control.value);
			if (d && typeof control.datepicker.selectDate === "function") {
				try {
					control.datepicker.selectDate(d);
				} catch (e) {
					/* ignore */
				}
			}
		}
	}

	function attachBsRangePickers(control) {
		var opts = {
			ndpYear: true,
			ndpMonth: true,
			ndpYearCount: 100,
			dateFormat: "YYYY-MM-DD",
			onChange: function () {
				setTimeout(function () {
					var f = bsToAd((control.$bs_range_from.val() || "").trim());
					var t = bsToAd((control.$bs_range_to.val() || "").trim());
					if (f && t) control.set_value([f, t]);
				}, 0);
			},
		};
		control.$bs_range_from.nepaliDatePicker(opts);
		control.$bs_range_to.nepaliDatePicker(opts);
	}

	// ---- Per-control mode application ---------------------------------------

	function applyDateMode(control, mode) {
		if (!control.$input || !control.$input.length) return;
		destroyAdPicker(control);
		destroyBsPicker(control.$input);
		var $fresh = swapInput(control);
		// Re-render through Frappe's own pipeline. This routes the model
		// value through our patched format_for_input (which branches on
		// mode: BS -> nepalidate format, AD -> Frappe default), then writes
		// it to $fresh. The picker, attached next, reads $fresh.val() and
		// can highlight the date because the displayed format matches its
		// dateFormat option.
		if (typeof control.refresh_input === "function") {
			control.refresh_input();
		}
		if (mode === "AD") {
			attachAdSingle($fresh, control);
		} else {
			attachBsSingle($fresh, function (ad) {
				control.set_value(ad);
			});
		}
	}

	function applyDatetimeMode(control, mode) {
		if (!control.$input || !control.$input.length) return;
		destroyAdPicker(control);
		destroyBsPicker(control.$input);
		var $fresh = swapInput(control);
		if (mode === "AD") {
			if (control.$bs_time_input) control.$bs_time_input.hide();
		} else {
			if (control.$bs_time_input) control.$bs_time_input.show();
		}
		if (typeof control.refresh_input === "function") {
			control.refresh_input();
		}
		if (mode === "AD") {
			attachAdSingle($fresh, control);
		} else {
			attachBsSingle($fresh, function (ad) {
				var t = (control.$bs_time_input && control.$bs_time_input.val()) || "00:00:00";
				if (t.length === 5) t += ":00";
				control.set_value(ad + " " + t);
			});
		}
	}

	function applyDateRangeMode(control, mode) {
		if (!control.$input || !control.$input.length) return;
		if (mode === "AD") {
			if (control.$bs_range_from) destroyBsPicker(control.$bs_range_from);
			if (control.$bs_range_to) destroyBsPicker(control.$bs_range_to);
			destroyAdPicker(control);
			if (control.$bs_range_wrap) control.$bs_range_wrap.hide();
			control.$input.css("display", "");
			if (typeof control.refresh_input === "function") {
				control.refresh_input();
			}
			if (typeof control.make_picker === "function") {
				control.make_picker();
			} else if (typeof control.set_datepicker === "function") {
				if (typeof control.set_date_options === "function") control.set_date_options();
				control.set_datepicker();
			}
		} else {
			destroyAdPicker(control);
			control.$input.css("display", "none");
			if (control.$bs_range_wrap) control.$bs_range_wrap.show();
			// refresh_input writes to control.$input (hidden) but our
			// format_for_input also fills $bs_range_from/$bs_range_to
			// when in BS mode. Calling it ensures the BS pickers are
			// pre-populated even if the model changed since last render.
			if (typeof control.refresh_input === "function") {
				control.refresh_input();
			}
			attachBsRangePickers(control);
		}
	}

	// ---- Live-control trackers ----------------------------------------------

	var dateControls = new Set();
	var datetimeControls = new Set();
	var rangeControls = new Set();

	function applyToAll(set, applyFn, mode) {
		var stale = [];
		set.forEach(function (control) {
			var $in = control.$input;
			if (!$in || !$in.length || !document.contains($in[0])) {
				stale.push(control);
				return;
			}
			try {
				applyFn(control, mode);
			} catch (e) {
				/* one bad control must not block the rest */
			}
		});
		for (var i = 0; i < stale.length; i++) set.delete(stale[i]);
	}

	// ---- ControlDate ---------------------------------------------------------

	var ControlDate = frappe.ui.form.ControlDate;
	if (ControlDate && ControlDate.prototype) {
		var origMakeInput = ControlDate.prototype.make_input;
		var origParse = ControlDate.prototype.parse;
		var origFormatForInput = ControlDate.prototype.format_for_input;

		ControlDate.prototype.make_input = function () {
			origMakeInput.apply(this, arguments);
			if (!this.$input || !this.$input.length) return;
			dateControls.add(this);
			applyDateMode(this, globalMode.get());
		};

		ControlDate.prototype.parse = function (value) {
			var trimmed = value ? String(value).trim() : "";
			if (trimmed && ISO_DATE.test(trimmed) && globalMode.get() === "BS") {
				var ad = bsToAd(trimmed);
				if (ad) return ad;
			}
			return origParse.apply(this, [value]);
		};

		ControlDate.prototype.format_for_input = function (value) {
			var trimmed = value ? String(value).trim() : "";
			if (trimmed && ISO_DATE.test(trimmed) && globalMode.get() === "BS") {
				var bs = adToBs(trimmed);
				if (bs) return bs;
			}
			return origFormatForInput.apply(this, [value]);
		};
	}

	// ---- ControlDatetime -----------------------------------------------------
	//
	// Datetime stores "YYYY-MM-DD HH:mm:ss". We split: BS/AD picker handles
	// the date half, a sibling <input type="time"> handles the time. Both
	// inputs combine to write a "<date> <time>" AD ISO string to the model.

	var ControlDatetime = frappe.ui.form.ControlDatetime;
	if (ControlDatetime && ControlDatetime.prototype) {
		var origDtMakeInput = ControlDatetime.prototype.make_input;
		var origDtParse = ControlDatetime.prototype.parse;
		var origDtFormatForInput = ControlDatetime.prototype.format_for_input;

		ControlDatetime.prototype.make_input = function () {
			origDtMakeInput.apply(this, arguments);
			if (!this.$input || !this.$input.length) return;

			var control = this;
			var $time = jQuery(
				'<input type="time" step="1" class="form-control ankaek-bs-time-input" ' +
					'style="margin-top:4px;max-width:140px;">'
			);
			control.$input.after($time);
			control.$bs_time_input = $time;

			$time.on("change", function () {
				var dateStr = control.$input.val();
				var ad = globalMode.get() === "BS"
					? bsToAd(dateStr)
					: (ISO_DATE.test(dateStr) ? dateStr : null);
				if (!ad) return;
				var t = $time.val() || "00:00:00";
				if (t.length === 5) t += ":00";
				control.set_value(ad + " " + t);
			});

			datetimeControls.add(control);
			applyDatetimeMode(control, globalMode.get());
		};

		ControlDatetime.prototype.parse = function (value) {
			if (!value) return origDtParse.apply(this, [value]);
			var parts = splitDatetime(value);
			if (ISO_DATE.test(parts[0]) && globalMode.get() === "BS") {
				var ad = bsToAd(parts[0]);
				if (ad) return ad + " " + parts[1];
			}
			return origDtParse.apply(this, [value]);
		};

		ControlDatetime.prototype.format_for_input = function (value) {
			if (!value) return origDtFormatForInput.apply(this, [value]);
			var parts = splitDatetime(value);
			if (ISO_DATE.test(parts[0]) && globalMode.get() === "BS") {
				if (this.$bs_time_input && this.$bs_time_input.length) {
					this.$bs_time_input.val(parts[1]);
				}
				var bs = adToBs(parts[0]);
				if (bs) return bs + " " + parts[1];
			}
			return origDtFormatForInput.apply(this, [value]);
		};
	}

	// ---- ControlDateRange ----------------------------------------------------
	//
	// DateRange stores `["YYYY-MM-DD", "YYYY-MM-DD"]`. In BS mode we render
	// two BS inputs side-by-side (nepalidate is single-date). In AD mode we
	// re-show the original input and run Frappe's range picker.

	var ControlDateRange = frappe.ui.form.ControlDateRange;
	if (ControlDateRange && ControlDateRange.prototype) {
		var origDrMakeInput = ControlDateRange.prototype.make_input;
		var origDrParse = ControlDateRange.prototype.parse;
		var origDrFormatForInput = ControlDateRange.prototype.format_for_input;

		ControlDateRange.prototype.make_input = function () {
			origDrMakeInput.apply(this, arguments);
			if (!this.$input || !this.$input.length) return;

			var control = this;
			control.$input.attr("autocomplete", "off");
			control.$input.attr("placeholder", "YYYY-MM-DD to YYYY-MM-DD");

			var $wrap = jQuery('<div class="ankaek-bs-range-wrap" style="display:flex;gap:6px;align-items:center;"></div>');
			var $start = jQuery('<input type="text" class="form-control ankaek-bs-range-from" placeholder="From (BS)" style="max-width:160px;">');
			var $sep = jQuery('<span style="opacity:0.6;">to</span>');
			var $end = jQuery('<input type="text" class="form-control ankaek-bs-range-to" placeholder="To (BS)" style="max-width:160px;">');
			$wrap.append($start).append($sep).append($end);
			control.$input.after($wrap);

			control.$bs_range_from = $start;
			control.$bs_range_to = $end;
			control.$bs_range_wrap = $wrap;

			rangeControls.add(control);
			applyDateRangeMode(control, globalMode.get());
		};

		ControlDateRange.prototype.parse = function (value) {
			if (Array.isArray(value) && value.length === 2 && globalMode.get() === "BS") {
				var f = ISO_DATE.test(value[0]) ? bsToAd(value[0]) || value[0] : value[0];
				var t = ISO_DATE.test(value[1]) ? bsToAd(value[1]) || value[1] : value[1];
				return [f, t];
			}
			return origDrParse.apply(this, [value]);
		};

		ControlDateRange.prototype.format_for_input = function (value) {
			var arr = value;
			if (typeof value === "string" && value) {
				try {
					arr = JSON.parse(value);
				} catch (e) {
					arr = null;
				}
			}
			if (
				Array.isArray(arr) &&
				arr.length === 2 &&
				ISO_DATE.test(arr[0]) &&
				ISO_DATE.test(arr[1]) &&
				globalMode.get() === "BS"
			) {
				var bsFrom = adToBs(arr[0]);
				var bsTo = adToBs(arr[1]);
				if (bsFrom && bsTo) {
					if (this.$bs_range_from && this.$bs_range_from.length) this.$bs_range_from.val(bsFrom);
					if (this.$bs_range_to && this.$bs_range_to.length) this.$bs_range_to.val(bsTo);
					return bsFrom + " to " + bsTo;
				}
			}
			return origDrFormatForInput.apply(this, [value]);
		};
	}

	// ---- Read-only / list / report formatters -------------------------------
	//
	// These honor the same global mode. AD short-circuits to Frappe's
	// original formatter; BS converts.

	if (frappe.form && frappe.form.formatters) {
		var fmt = frappe.form.formatters;

		if (typeof fmt.Date === "function") {
			var origDateFmt = fmt.Date;
			fmt.Date = function (value) {
				if (globalMode.get() === "BS" && value && typeof value === "string" && ISO_DATE.test(value)) {
					var bs = adToBs(value);
					if (bs) return bs;
				}
				return origDateFmt.apply(this, arguments);
			};
		}

		if (typeof fmt.Datetime === "function") {
			var origDtFmt = fmt.Datetime;
			fmt.Datetime = function (value) {
				if (globalMode.get() === "BS" && value && typeof value === "string") {
					var parts = splitDatetime(value);
					if (ISO_DATE.test(parts[0])) {
						var bs = adToBs(parts[0]);
						if (bs) return bs + " " + parts[1];
					}
				}
				return origDtFmt.apply(this, arguments);
			};
		}
	}

	// ---- Master subscription: fan out a mode flip to every live control ----

	globalMode.subscribe(function (mode) {
		applyToAll(dateControls, applyDateMode, mode);
		applyToAll(datetimeControls, applyDatetimeMode, mode);
		applyToAll(rangeControls, applyDateRangeMode, mode);

		// Re-render the current list view so wrapped formatters re-run.
		// Forms get covered by the per-control applyMode calls above;
		// list rows render via the Date/Datetime formatter wrappers and
		// need an explicit refresh.
		if (window.cur_list && typeof window.cur_list.refresh === "function") {
			try {
				window.cur_list.refresh();
			} catch (e) {
				/* ignore */
			}
		}
	});

	// ---- Navbar toggle ------------------------------------------------------

	// Floating toggle — anchored to the viewport, not the page shell.
	// Frappe's top chrome moved between versions (v13/14 had a top
	// `.navbar`, v17 uses a left `.body-sidebar`); a fixed-position pill
	// sidesteps that whole moving target and stays visible on every
	// route. z-index 1040 sits above page content but below modals
	// (Frappe modals start at 1050).
	function injectStylesOnce() {
		if (document.getElementById("ankaek-date-mode-style")) return;
		var style = document.createElement("style");
		style.id = "ankaek-date-mode-style";
		style.textContent =
			"#ankaek-navbar-mode-toggle{position:fixed;bottom:16px;right:16px;z-index:1040;background:var(--card-bg,#fff);border:1px solid var(--border-color,#d1d8dd);border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.12);padding:4px;display:inline-flex;align-items:center;}" +
			"#ankaek-navbar-mode-toggle .ankaek-mode-label{font-size:10px;font-weight:600;color:var(--text-muted,#8d99a6);letter-spacing:.5px;text-transform:uppercase;margin:0 8px 0 4px;}" +
			"#ankaek-navbar-mode-toggle .ankaek-mode-pill{display:inline-flex;font-size:11px;line-height:1;border:1px solid var(--border-color,#d1d8dd);border-radius:4px;overflow:hidden;}" +
			"#ankaek-navbar-mode-toggle .ankaek-mode-pill button{border:0;padding:5px 12px;background:transparent;color:var(--text-color,inherit);cursor:pointer;font-size:11px;font-weight:600;letter-spacing:.3px;}" +
			"#ankaek-navbar-mode-toggle .ankaek-mode-pill button.active{background:var(--primary,#5e64ff);color:#fff;}" +
			"#ankaek-navbar-mode-toggle .ankaek-mode-pill button:hover:not(.active){background:var(--bg-light-gray,#f4f5f6);}";
		document.head.appendChild(style);
	}

	function buildToggleEl() {
		injectStylesOnce();
		var current = globalMode.get();
		var $el = jQuery(
			'<div id="ankaek-navbar-mode-toggle" role="group" aria-label="Date mode">' +
				'<span class="ankaek-mode-label">Date</span>' +
				'<span class="ankaek-mode-pill">' +
					'<button type="button" data-mode="BS">BS</button>' +
					'<button type="button" data-mode="AD">AD</button>' +
				"</span>" +
			"</div>"
		);
		$el.find('button[data-mode="' + current + '"]').addClass("active");
		$el.on("click", "button", function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			globalMode.set(jQuery(this).attr("data-mode"));
		});
		globalMode.subscribe(function (mode) {
			$el.find("button").removeClass("active");
			$el.find('button[data-mode="' + mode + '"]').addClass("active");
		});
		return $el;
	}

	function injectFloatingToggle() {
		if (document.getElementById("ankaek-navbar-mode-toggle")) return;
		if (!document.body) return;
		jQuery(document.body).append(buildToggleEl());
	}

	jQuery(function () {
		injectFloatingToggle();
	});
})();
