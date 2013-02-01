/*
 *		source/controls/listviewskeleton.js
 */

/* FeedReader - A RSS Feed Aggregator for Palm WebOS
 * Copyright (C) 2009-2012 Timo Tegtmeier
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
	name:				"ListViewSkeleton",
	kind:				"DraggableView",
    classes:            "back-color",

	items:				[],
	filter:				"",

	selectedIndex:		-1,
	deletedItem:		null,

	refreshInProgress:	false,
	selectionClass:		"list-item-selected",

	//
	// List handling
	//

	itemClicked: function(sender, event) {
		// If the tapped item is already selected, nothing has to be done.
		// This is indicated by returning false. As a result, this method
		// needs to be overridden in a derived kind, as the handler must
		// not return a value to the caller.
		if(event.index == this.selectedIndex && !enyo.Panels.isScreenNarrow()) {
			return false;
		}

		this.selectedIndex = event.index;
		return true;
	},

	itemDeleted: function(sender, index) {
		var delSelected = this.selectedIndex === index;
		if(delSelected) {
			this.selectedIndex = -1;
		}

		this.deletedItem = this.items[index];
		this.items.splice(index, 1);
		this.$.list.setCount(this.items.length);
		this.$.list.refresh(); // Provide quick visual response.

		return delSelected;
	},

	//
	// Helper functions
	//

	getSelectedId: function() {
		return (this.selectedIndex >= 0 ? this.items[this.selectedIndex].id : -1);
	},

	restoreSelectedId: function(selectedId) {
		// Search for the formerly selected item
		if (selectedId < 0)
			return;

		for (var i = 0; i < this.items.length; i++) {
			if (this.items[i] && (this.items[i].id == selectedId)) {
				this.$.list.select(i);
				break;
			}
		}
	},

	dropEvent: function() {
		return true;
	},

	//
	// Database interaction
	//

	setItems: function(items) {
		try {
			// Remember selected id and clear it afterwards.
			var selectedId = this.getSelectedId();
			this.selectedIndex = -1;
			this.$.list.getSelection().clear();

			// Store the new items array
			this.items = items;
            this.$.list.setCount(items.length);

			// Restore the previous selection
			this.restoreSelectedId(selectedId);

			// Refresh the list.
			this.$.list.refresh();
		} catch(e) {
			this.error("LV EXCEPTION>", e);
		} finally {
			this.refreshInProgress = false;
			this.refreshFinished();
		}
	},

	/** @protected
	 * Called right before the list itself is refreshed.
	 */
	refreshFinished: function() {},

	/** @protected
	 * Called to determine if a refresh can be done.
	 */
	canRefresh: function() {
		return true;
	},

	/** @protected
	 * Called to determine the row index of a list event.
	 * @param event		event object
	 * @return {*}		false, if index does not exist, otherwise the index
	 */
	indexFromEvent: function(event) {
		var index = event.index;
		if((index < 0) || (index >= this.items.length) || (!this.items[index])) {
			return false;
		}
		return index;
	},

	//
	// Public functions
	//

	refresh: function() {
		if(this.refreshInProgress) {
			this.log("LV> refreshInProgress = true, ignoring request");
		} else if(!this.canRefresh()){
			this.log("LV> Cannot refresh, calling clear() instead");
			this.clear();
		} else {
			this.log("LV> requesting refresh");
			this.refreshInProgress = true;
			this.acquireData(this.filter, this.setItems);
		}
	},

	clear: function() {
		this.items = [];
		this.filter = "";
		this.selectedIndex = -1;
		this.$.list.getSelection().clear();
		this.$.list.setCount(0);
		this.$.list.refresh();
	},

	//
	// Initialization
	//

	create: function() {
		this.inherited(arguments);
		this.setItems = enyo.bind(this, this.setItems);
	}
});
