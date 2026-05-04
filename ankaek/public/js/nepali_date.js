/**
 * Global Bikram Sambat (BS) date override for Frappe Desk.
 *
 * Replaces the date picker on every `frappe.ui.form.ControlDate`,
 * `ControlDatetime`, and `ControlDateRange` with the nepalidate BS picker.
 *
 * Storage contract is unchanged: the model still stores ISO Gregorian
 * (`YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss`). Only the input + display layer is
 * BS. Conversion happens in `format_for_input` (AD->BS, for display) and
 * `parse` (BS->AD, when the user types or the picker fires onChange).
 *
 * Depends on `nepali.datepicker.js` (loaded via app_include_js before this
 * file), which exposes `NepaliFunctions` and `$.fn.nepaliDatePicker`.
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

	function attachBsPicker($input, control) {
		// Tear down flatpickr if Frappe attached one in the original make_input.
		if (control.datepicker && typeof control.datepicker.destroy === "function") {
			try {
				control.datepicker.destroy();
			} catch (e) {
				/* ignore */
			}
			control.datepicker = null;
		}

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
				control.set_value(e.ad);
			},
		});
	}

	// ---- ControlDate ----------------------------------------------------------

	var ControlDate = frappe.ui.form.ControlDate;
	if (ControlDate && ControlDate.prototype) {
		var origMakeInput = ControlDate.prototype.make_input;
		var origParse = ControlDate.prototype.parse;
		var origFormatForInput = ControlDate.prototype.format_for_input;

		ControlDate.prototype.make_input = function () {
			origMakeInput.apply(this, arguments);
			if (this.$input && this.$input.length) {
				attachBsPicker(this.$input, this);
			}
		};

		ControlDate.prototype.parse = function (value) {
			if (value && ISO_DATE.test(String(value).trim())) {
				var ad = bsToAd(String(value).trim());
				if (ad) return ad;
			}
			return origParse.apply(this, [value]);
		};

		ControlDate.prototype.format_for_input = function (value) {
			if (value && ISO_DATE.test(String(value).trim())) {
				var bs = adToBs(String(value).trim());
				if (bs) return bs;
			}
			return origFormatForInput.apply(this, [value]);
		};
	}

	// ---- ControlDatetime ------------------------------------------------------
	//
	// Datetime stores "YYYY-MM-DD HH:mm:ss". We split: BS picker handles the
	// date half, a sibling <input type="time"> handles the time. Both inputs
	// write a combined AD+time string to the model.

	var ControlDatetime = frappe.ui.form.ControlDatetime;
	if (ControlDatetime && ControlDatetime.prototype) {
		var origDtMakeInput = ControlDatetime.prototype.make_input;
		var origDtParse = ControlDatetime.prototype.parse;
		var origDtFormatForInput = ControlDatetime.prototype.format_for_input;

		ControlDatetime.prototype.make_input = function () {
			origDtMakeInput.apply(this, arguments);
			if (!this.$input || !this.$input.length) return;

			var control = this;
			if (this.datepicker && typeof this.datepicker.destroy === "function") {
				try {
					this.datepicker.destroy();
				} catch (e) {
					/* ignore */
				}
				this.datepicker = null;
			}

			this.$input.attr("autocomplete", "off");
			this.$input.attr("placeholder", "YYYY-MM-DD (BS)");

			// Sibling time input, lives next to the BS date input.
			var $time = jQuery(
				'<input type="time" step="1" class="form-control ankaek-bs-time-input" ' +
					'style="margin-top:4px;max-width:140px;">'
			);
			this.$input.after($time);
			this.$bs_time_input = $time;

			this.$input.nepaliDatePicker({
				ndpYear: true,
				ndpMonth: true,
				ndpYearCount: 100,
				dateFormat: "YYYY-MM-DD",
				onChange: function (e) {
					if (!e || !e.ad) return;
					var t = $time.val() || "00:00:00";
					if (t.length === 5) t += ":00";
					control.set_value(e.ad + " " + t);
				},
			});

			$time.on("change", function () {
				var t = $time.val() || "00:00:00";
				if (t.length === 5) t += ":00";
				var bsDate = control.$input.val();
				var ad = bsToAd(bsDate);
				if (!ad) return;
				control.set_value(ad + " " + t);
			});
		};

		ControlDatetime.prototype.parse = function (value) {
			if (!value) return origDtParse.apply(this, [value]);
			var parts = splitDatetime(value);
			if (ISO_DATE.test(parts[0])) {
				var ad = bsToAd(parts[0]);
				if (ad) return ad + " " + parts[1];
			}
			return origDtParse.apply(this, [value]);
		};

		ControlDatetime.prototype.format_for_input = function (value) {
			if (!value) return origDtFormatForInput.apply(this, [value]);
			var parts = splitDatetime(value);
			if (ISO_DATE.test(parts[0])) {
				var bs = adToBs(parts[0]);
				if (bs) {
					if (this.$bs_time_input && this.$bs_time_input.length) {
						this.$bs_time_input.val(parts[1]);
					}
					return bs + " " + parts[1];
				}
			}
			return origDtFormatForInput.apply(this, [value]);
		};
	}

	// ---- ControlDateRange -----------------------------------------------------
	//
	// DateRange uses flatpickr in range mode and stores a JSON array
	// `["YYYY-MM-DD", "YYYY-MM-DD"]`. We render two BS inputs side-by-side.

	var ControlDateRange = frappe.ui.form.ControlDateRange;
	if (ControlDateRange && ControlDateRange.prototype) {
		var origDrMakeInput = ControlDateRange.prototype.make_input;
		var origDrParse = ControlDateRange.prototype.parse;
		var origDrFormatForInput = ControlDateRange.prototype.format_for_input;

		ControlDateRange.prototype.make_input = function () {
			origDrMakeInput.apply(this, arguments);
			if (!this.$input || !this.$input.length) return;

			var control = this;
			if (this.datepicker && typeof this.datepicker.destroy === "function") {
				try {
					this.datepicker.destroy();
				} catch (e) {
					/* ignore */
				}
				this.datepicker = null;
			}

			this.$input.attr("autocomplete", "off");
			this.$input.attr("placeholder", "YYYY-MM-DD to YYYY-MM-DD (BS)");

			// We do NOT attach the picker to the existing single input directly,
			// because nepalidate is single-date. Instead, hide it and render a
			// pair of BS pickers that produce the JSON range.
			this.$input.css("display", "none");

			var $wrap = jQuery('<div class="ankaek-bs-range-wrap" style="display:flex;gap:6px;align-items:center;"></div>');
			var $start = jQuery('<input type="text" class="form-control ankaek-bs-range-from" placeholder="From (BS)" style="max-width:160px;">');
			var $sep = jQuery('<span style="opacity:0.6;">to</span>');
			var $end = jQuery('<input type="text" class="form-control ankaek-bs-range-to" placeholder="To (BS)" style="max-width:160px;">');
			$wrap.append($start).append($sep).append($end);
			this.$input.after($wrap);

			this.$bs_range_from = $start;
			this.$bs_range_to = $end;

			function emit() {
				var f = bsToAd(($start.val() || "").trim());
				var t = bsToAd(($end.val() || "").trim());
				if (f && t) {
					control.set_value([f, t]);
				}
			}

			$start.nepaliDatePicker({
				ndpYear: true,
				ndpMonth: true,
				ndpYearCount: 100,
				dateFormat: "YYYY-MM-DD",
				onChange: function () {
					setTimeout(emit, 0);
				},
			});
			$end.nepaliDatePicker({
				ndpYear: true,
				ndpMonth: true,
				ndpYearCount: 100,
				dateFormat: "YYYY-MM-DD",
				onChange: function () {
					setTimeout(emit, 0);
				},
			});
		};

		ControlDateRange.prototype.parse = function (value) {
			if (Array.isArray(value) && value.length === 2) {
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
			if (Array.isArray(arr) && arr.length === 2 && ISO_DATE.test(arr[0]) && ISO_DATE.test(arr[1])) {
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

	// ---- Read-only / list / report formatters --------------------------------
	//
	// Frappe renders dates in list views, reports, and read-only fields via
	// `frappe.form.formatters.Date` / `Datetime`. Wrap them so the displayed
	// value is BS while the underlying stored value remains AD.

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
