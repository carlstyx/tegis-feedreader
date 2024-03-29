/*
 *		commonjs/category.js - Category data model
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

function Category(proto) {
	enyo.mixin(this, Category.prototype);
	if(proto) {
		if(proto.id || proto.id === 0)
			this.id = proto.id;
		this.title = proto.title || this.title;
		this.catOrder = proto.catOrder || this.catOrder;
	}
}

Category.prototype = {
	title:		"",
	catOrder:	0
};