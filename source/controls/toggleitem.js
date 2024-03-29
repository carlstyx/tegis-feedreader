/*
 *		source/controls/toggleitem.js
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
	name:		"ToggleItem",
    classes:    "toggle-item",

	components:	[{
		name:		"caption",
        classes:    "caption float-left"
	}, {
		name: 		"button",
		kind: 		onyx.ToggleButton,
		classes:	"float-right",
		onChange:	"doChange"
	}, {
		kind:		"FloatBreaker"
	}],

	published: {
		caption:	"",
		value:		false,
		trueLabel:	$L("Yes"),
		falseLabel:	$L("No"),
		disabled:	false
	},

	events: {
		onChange:	""
	},

	getValue: function() {
		return this.$.button.getValue();
	},

	setValue: function(state) {
		this.$.button.setValue(state);
	},

	captionChanged: function() {
		this.$.caption.setContent(this.caption);
	},

	trueLabelChanged: function() {
		this.$.button.setOnContent(this.trueLabel);
	},

	falseLabelChanged: function() {
		this.$.button.setOffContent(this.falseLabel);
	},

	disabledChanged: function() {
		this.$.button.setDisabled(this.disabled);
	},

	create: function() {
		this.inherited(arguments);

		this.setValue(this.value);
		this.captionChanged();
		this.trueLabelChanged();
		this.falseLabelChanged();
		this.disabledChanged();
	}
});
