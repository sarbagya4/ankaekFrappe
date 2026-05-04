(function () {
	"use strict";

	var TARGET = "Frappe HR";
	var REPLACEMENT = "ankaEK HR";
	var SKIP_TAGS = { SCRIPT: true, STYLE: true, TEXTAREA: true, INPUT: true };

	function replaceInNode(node) {
		if (node.nodeType === Node.TEXT_NODE) {
			if (node.textContent.indexOf(TARGET) !== -1) {
				node.textContent = node.textContent.replace(/Frappe HR/g, REPLACEMENT);
			}
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return;
		if (SKIP_TAGS[node.tagName]) return;
		for (var i = 0; i < node.childNodes.length; i++) {
			replaceInNode(node.childNodes[i]);
		}
	}

	function scan(root) {
		replaceInNode(root || document.body);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () { scan(); });
	} else {
		scan();
	}

	var observer = new MutationObserver(function (mutations) {
		for (var i = 0; i < mutations.length; i++) {
			var added = mutations[i].addedNodes;
			for (var j = 0; j < added.length; j++) {
				scan(added[j]);
			}
		}
	});

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});
})();
