/**
 * Bikram Sambat (BS) date override for Frappe Desk, with a per-field
 * BS<->AD toggle.
 *
 * Each ControlDate / ControlDatetime / ControlDateRange renders a small
 * "BS | AD" segmented toggle next to the input. Default is BS (nepalidate
 * picker). Switching to AD destroys the BS picker, re-attaches flatpickr
 * (Frappe's bundled AD picker), and converts the displayed value to AD.
 *
 * Storage contract is unchanged regardless of mode: the model always
 * stores ISO Gregorian (`YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss`).
 *
 * Depends on `nepali.datepicker.js` (loaded via app_include_js before
 * this file), which exposes `NepaliFunctions` and
 * `$.fn.nepaliDatePicker`. AD mode uses `window.flatpickr`, which Frappe
 * bundles globally.
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

	function getMode(control) {
		return control._ankaek_date_mode || "BS";
	}

	function setMode(control, mode) {
		control._ankaek_date_mode = mode;
	}

	function injectStylesOnce() {
		if (document.getElementById("ankaek-date-mode-style")) return;
		var style = document.createElement("style");
		style.id = "ankaek-date-mode-style";
		style.textContent =
			".ankaek-date-mode-toggle{display:inline-flex;margin-left:6px;font-size:11px;line-height:1;vertical-align:middle;border:1px solid var(--border-color,#d1d8dd);border-radius:4px;overflow:hidden;}" +
			".ankaek-date-mode-toggle button{border:0;padding:2px 8px;background:transparent;color:inherit;cursor:pointer;font-size:11px;font-weight:500;}" +
			".ankaek-date-mode-toggle button.active{background:var(--primary,#5e64ff);color:#fff;}";
		document.head.appendChild(style);
	}

	function buildToggle(initialMode, onChange) {
		injectStylesOnce();
		var $toggle = jQuery(
			'<span class="ankaek-date-mode-toggle">' +
				'<button type="button" data-mode="BS">BS</button>' +
				'<button type="button" data-mode="AD">AD</button>' +
			"</span>"
		);
		$toggle.find('button[data-mode="' + initialMode + '"]').addClass("active");
		$toggle.on("click", "button", function (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			var newMode = jQuery(this).attr("data-mode");
			if ($toggle.find("button.active").attr("data-mode") === newMode) return;
			$toggle.find("button").removeClass("active");
			jQuery(this).addClass("active");
			onChange(newMode);
		});
		return $toggle;
	}

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
		// control.datepicker. We don't pass an onChange callback because
		// Frappe's existing change/blur wiring (preserved by clone(true))
		// already calls parse() -> set_value(), and our parse pass-through
		// in AD mode keeps the value as ISO AD.
		$input.attr("autocomplete", "off");
		$input.removeAttr("placeholder");
		if (typeof control.make_picker === "function") {
			control.make_picker();
		} else if (typeof control.set_datepicker === "function") {
			if (typeof control.set_date_options === "function") control.set_date_options();
			control.set_datepicker();
		}
	}

	// ---- ControlDate ----------------------------------------------------------

	var ControlDate = frappe.ui.form.ControlDate;
	if (ControlDate && ControlDate.prototype) {
		var origMakeInput = ControlDate.prototype.make_input;
		var origParse = ControlDate.prototype.parse;
		var origFormatForInput = ControlDate.prototype.format_for_input;

		ControlDate.prototype.make_input = function () {
			origMakeInput.apply(this, arguments);
			if (!this.$input || !this.$input.length) return;

			var control = this;
			destroyAdPicker(control);
			setMode(control, "BS");

			attachBsSingle(this.$input, function (ad) {
				control.set_value(ad);
			});

			var $toggle = buildToggle("BS", function (mode) {
				destroyAdPicker(control);
				destroyBsPicker(control.$input);
				var $fresh = swapInput(control);
				if (mode === "AD") {
					setMode(control, "AD");
					$fresh.val(control.value || "");
					attachAdSingle($fresh, control);
				} else {
					setMode(control, "BS");
					var v = control.value || "";
					var bs = v && ISO_DATE.test(v) ? adToBs(v) : "";
					$fresh.val(bs || v);
					attachBsSingle($fresh, function (ad) {
						control.set_value(ad);
					});
				}
			});
			this.$input.after($toggle);
			this.$ankaek_toggle = $toggle;
		};

		ControlDate.prototype.parse = function (value) {
			var trimmed = value ? String(value).trim() : "";
			if (trimmed && ISO_DATE.test(trimmed)) {
				if (getMode(this) === "BS") {
					var ad = bsToAd(trimmed);
					if (ad) return ad;
				} else {
					return trimmed;
				}
			}
			return origParse.apply(this, [value]);
		};

		ControlDate.prototype.format_for_input = function (value) {
			var trimmed = value ? String(value).trim() : "";
			if (trimmed && ISO_DATE.test(trimmed)) {
				if (getMode(this) === "BS") {
					var bs = adToBs(trimmed);
					if (bs) return bs;
				} else {
					return trimmed;
				}
			}
			return origFormatForInput.apply(this, [value]);
		};
	}

	// ---- ControlDatetime ------------------------------------------------------
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
			destroyAdPicker(control);
			setMode(control, "BS");

			var $time = jQuery(
				'<input type="time" step="1" class="form-control ankaek-bs-time-input" ' +
					'style="margin-top:4px;max-width:140px;">'
			);
			this.$input.after($time);
			this.$bs_time_input = $time;

			function getTime() {
				var t = $time.val() || "00:00:00";
				if (t.length === 5) t += ":00";
				return t;
			}

			function emitWithDate(ad) {
				control.set_value(ad + " " + getTime());
			}

			attachBsSingle(this.$input, emitWithDate);

			$time.on("change", function () {
				var dateStr = control.$input.val();
				var ad = getMode(control) === "BS" ? bsToAd(dateStr) : (ISO_DATE.test(dateStr) ? dateStr : null);
				if (!ad) return;
				control.set_value(ad + " " + getTime());
			});

			var $toggle = buildToggle("BS", function (mode) {
				destroyAdPicker(control);
				destroyBsPicker(control.$input);
				var $fresh = swapInput(control);
				if (mode === "AD") {
					setMode(control, "AD");
					// Frappe's native datetime picker handles both date and
					// time, so hide our BS-mode time sibling.
					$time.hide();
					var parts = splitDatetime(control.value || "");
					$fresh.val(parts[0] + (parts[1] ? " " + parts[1] : ""));
					attachAdSingle($fresh, control);
				} else {
					setMode(control, "BS");
					$time.show();
					var p2 = splitDatetime(control.value || "");
					var bs = p2[0] && ISO_DATE.test(p2[0]) ? adToBs(p2[0]) : "";
					$fresh.val(bs || p2[0]);
					if (p2[1]) $time.val(p2[1]);
					attachBsSingle($fresh, emitWithDate);
				}
			});
			$time.after($toggle);
			this.$ankaek_toggle = $toggle;
		};

		ControlDatetime.prototype.parse = function (value) {
			if (!value) return origDtParse.apply(this, [value]);
			var parts = splitDatetime(value);
			if (ISO_DATE.test(parts[0])) {
				if (getMode(this) === "BS") {
					var ad = bsToAd(parts[0]);
					if (ad) return ad + " " + parts[1];
				} else {
					return parts[0] + " " + parts[1];
				}
			}
			return origDtParse.apply(this, [value]);
		};

		ControlDatetime.prototype.format_for_input = function (value) {
			if (!value) return origDtFormatForInput.apply(this, [value]);
			var parts = splitDatetime(value);
			if (ISO_DATE.test(parts[0])) {
				if (this.$bs_time_input && this.$bs_time_input.length) {
					this.$bs_time_input.val(parts[1]);
				}
				if (getMode(this) === "BS") {
					var bs = adToBs(parts[0]);
					if (bs) return bs + " " + parts[1];
				} else {
					return parts[0] + " " + parts[1];
				}
			}
			return origDtFormatForInput.apply(this, [value]);
		};
	}

	// ---- ControlDateRange -----------------------------------------------------
	//
	// DateRange stores `["YYYY-MM-DD", "YYYY-MM-DD"]`. In BS mode we render
	// two BS inputs side-by-side (nepalidate is single-date). In AD mode we
	// re-show the original input and run flatpickr in range mode.

	var ControlDateRange = frappe.ui.form.ControlDateRange;
	if (ControlDateRange && ControlDateRange.prototype) {
		var origDrMakeInput = ControlDateRange.prototype.make_input;
		var origDrParse = ControlDateRange.prototype.parse;
		var origDrFormatForInput = ControlDateRange.prototype.format_for_input;

		ControlDateRange.prototype.make_input = function () {
			origDrMakeInput.apply(this, arguments);
			if (!this.$input || !this.$input.length) return;

			var control = this;
			destroyAdPicker(control);
			setMode(control, "BS");

			this.$input.attr("autocomplete", "off");
			this.$input.attr("placeholder", "YYYY-MM-DD to YYYY-MM-DD");
			this.$input.css("display", "none");

			var $wrap = jQuery('<div class="ankaek-bs-range-wrap" style="display:flex;gap:6px;align-items:center;"></div>');
			var $start = jQuery('<input type="text" class="form-control ankaek-bs-range-from" placeholder="From (BS)" style="max-width:160px;">');
			var $sep = jQuery('<span style="opacity:0.6;">to</span>');
			var $end = jQuery('<input type="text" class="form-control ankaek-bs-range-to" placeholder="To (BS)" style="max-width:160px;">');
			$wrap.append($start).append($sep).append($end);
			this.$input.after($wrap);

			this.$bs_range_from = $start;
			this.$bs_range_to = $end;

			function emitFromBsInputs() {
				var f = bsToAd(($start.val() || "").trim());
				var t = bsToAd(($end.val() || "").trim());
				if (f && t) {
					control.set_value([f, t]);
				}
			}

			function attachBsRange() {
				$start.nepaliDatePicker({
					ndpYear: true,
					ndpMonth: true,
					ndpYearCount: 100,
					dateFormat: "YYYY-MM-DD",
					onChange: function () {
						setTimeout(emitFromBsInputs, 0);
					},
				});
				$end.nepaliDatePicker({
					ndpYear: true,
					ndpMonth: true,
					ndpYearCount: 100,
					dateFormat: "YYYY-MM-DD",
					onChange: function () {
						setTimeout(emitFromBsInputs, 0);
					},
				});
			}

			attachBsRange();

			function readRange() {
				var arr = control.value;
				if (typeof arr === "string" && arr) {
					try {
						arr = JSON.parse(arr);
					} catch (e) {
						arr = null;
					}
				}
				return Array.isArray(arr) && arr.length === 2 ? arr : null;
			}

			var $toggle = buildToggle("BS", function (mode) {
				if (mode === "AD") {
					destroyBsPicker($start);
					destroyBsPicker($end);
					destroyAdPicker(control);
					$wrap.hide();
					control.$input.css("display", "");
					setMode(control, "AD");

					var arr = readRange();
					control.$input.val(arr ? arr[0] + " to " + arr[1] : "");

					// Frappe's ControlDateRange has its own range picker;
					// re-trigger init on the now-visible original input.
					if (typeof control.make_picker === "function") {
						control.make_picker();
					} else if (typeof control.set_datepicker === "function") {
						if (typeof control.set_date_options === "function") control.set_date_options();
						control.set_datepicker();
					}
				} else {
					destroyAdPicker(control);
					control.$input.css("display", "none");
					$wrap.show();
					setMode(control, "BS");

					var arr2 = readRange();
					if (arr2 && ISO_DATE.test(arr2[0]) && ISO_DATE.test(arr2[1])) {
						$start.val(adToBs(arr2[0]) || arr2[0]);
						$end.val(adToBs(arr2[1]) || arr2[1]);
					} else {
						$start.val("");
						$end.val("");
					}
					attachBsRange();
				}
			});
			$wrap.after($toggle);
			this.$ankaek_toggle = $toggle;
		};

		ControlDateRange.prototype.parse = function (value) {
			if (Array.isArray(value) && value.length === 2) {
				if (getMode(this) === "BS") {
					var f = ISO_DATE.test(value[0]) ? bsToAd(value[0]) || value[0] : value[0];
					var t = ISO_DATE.test(value[1]) ? bsToAd(value[1]) || value[1] : value[1];
					return [f, t];
				}
				return value;
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
			if (Array.isArray(arr) && arr.length === 2 && ISO_DATE.test(arr[0]) && ISO_DATE.test(arr[1])) {
				if (getMode(this) === "BS") {
					var bsFrom = adToBs(arr[0]);
					var bsTo = adToBs(arr[1]);
					if (bsFrom && bsTo) {
						if (this.$bs_range_from && this.$bs_range_from.length) this.$bs_range_from.val(bsFrom);
						if (this.$bs_range_to && this.$bs_range_to.length) this.$bs_range_to.val(bsTo);
						return bsFrom + " to " + bsTo;
					}
				} else {
					return arr[0] + " to " + arr[1];
				}
			}
			return origDrFormatForInput.apply(this, [value]);
		};
	}

	// ---- Read-only / list / report formatters --------------------------------
	//
	// List/report formatters always render BS — the per-field toggle only
	// affects active form inputs. A column-wide toggle for list views would
	// be a separate UX and is out of scope here.

	if (frappe.form && frappe.form.formatters) {
		var fmt = frappe.form.formatters;

		if (typeof fmt.Date === "function") {
			var origDateFmt = fmt.Date;
			fmt.Date = function (value) {
				if (value && typeof value === "string" && ISO_DATE.test(value)) {
					var bs = adToBs(value);
					if (bs) return bs;
				}
				return origDateFmt.apply(this, arguments);
			};
		}

		if (typeof fmt.Datetime === "function") {
			var origDtFmt = fmt.Datetime;
			fmt.Datetime = function (value) {
				if (value && typeof value === "string") {
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
})();
