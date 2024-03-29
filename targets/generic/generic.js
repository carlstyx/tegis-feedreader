/*
 *		source/utils/os/generic.js - OS dependent functions
 */

/* FeedReader - A RSS Feed Aggregator for Firefox OS
 * Copyright (C) 2009-2013 Timo Tegtmeier
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 3
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

enyo.kind({
    name:				"AppHelper",
    kind:   			enyo.Component,

	hasHTMLMail:		false,
	hasEmbeddedVideo:	false,
	canShareViaIM:		false,
	canExtendLifetime:	false,

	rendered:			false,

    openLink: function(url) {
        window.open(url);
    },

    openEMail: function(subject, text) {
		window.open("mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text));
    },

    openMessaging: function(text) {
    },

	openMainView: function() {
		if(!this.rendered)
			(new FeedReaderMainView()).renderInto(document.body);
		this.rendered = true;
	},

	afterScheduledUpdate: function() {
		this.openMainView();
	},

	notifyAboutNewItems: function(count) {
		alert("" + count + " new items arrived!");
	}
});

enyo.kind({
    name:   "Timer",
    kind:   enyo.Component,

    setTimer: function() {
    }
});

enyo.kind({
    name:   "ConnectionChecker",
    kind:   enyo.Component,

    checkConnection: function(onSuccess, onFail) {
        enyo.asyncMethod(this, onSuccess);
    }
});

enyo.kind({
    name:   "PowerManager",
    kind:   enyo.Component,

    enterActivity: function() {
    },

    leaveActivity: function() {
    }
});

enyo.kind({
	name:	"ApplicationEvents",
	kind:	enyo.Component,

	events:	{
		onWindowActivated:		"",
		onWindowDeactivated:	"",
		onUnload:				""
	},

	create: function() {
		this.inherited(arguments);
		var self = this;
		window.addEventListener("activate", function() { self.log("ACTIVATE"); self.doWindowActivated(); });
		window.addEventListener("deactivate", function() { self.log("DE-ACTIVATE"); self.doWindowDeactivated() });
		window.addEventListener("unload", function() { self.log("DIE"); self.doUnload(); });
		window.addEventListener("sizemodechange", function() { self.log("SIZE MODE", window.windowState); });
	}
});

function applyOSSpecific() {
	// Unknown host OS/browser
	enyo.log("OSSPECIFIC> Using generic handlers; platform unkown/unsupported or running in browser");
}