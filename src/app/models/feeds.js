/*
 *		app/models/feeds.js - Feed data model
 */

/* FeedReader - A RSS Feed Aggregator for Palm WebOS
 * Copyright (C) 2009, 2010 Timo Tegtmeier
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

var feeds = Class.create ({
	list: [],			// contains the individual feeds
	loaded: false,		// indicates if list is successfully loaded

	db: {},				// takes the depot object
	connStatus: {},		// takes the connection state service
	cookie: {},			// takes the database info cookie
	spooler: {},		// action spooler
	converter: {},		// codepage converter
	dateConverter: {},	// date converter
	migrator: {},		// migrator class

	fullUpdateInProgress: false,	// true if a full update is in progress
	updateInProgress: false,		// true if any kind of update is in progress
	interactiveUpdate: false,		// true if the update is interactive
	changingFeed: false,			// true if a feed is changed
	properties: {
		migratingFrom: 1			// db version loaded
	},

	/** @private
	 *
	 * Initializing.
	 */	
	initialize: function() {
		this.spooler = new spooler();
		this.converter = new codepageConverter();
		this.dateConverter = new dateConverter();
		this.migrator = new migrator();
		
		this.cookie = new Mojo.Model.Cookie("comtegi-stuffAppFeedReaderProps");
		var data = this.cookie.get();
		this.properties.migratingFrom = data ? data.version : 1;
		
		this.openDBSuccessHandler = this.openDBSuccess.bind(this);
		this.openDBFailedHandler  = this.openDBFailed.bind(this);
		
		this.loadFeedListSuccessHandler = this.loadFeedListSuccess.bind(this);
		this.loadFeedListFailedHandler  = this.loadFeedListFailed.bind(this);
		
		this.saveFeedListSuccessHandler = this.saveFeedListSuccess.bind(this);
		this.saveFeedListFailedHandler  = this.saveFeedListFailed.bind(this);
		
		this.doSaveHandler = this.doSave.bind(this);
	},
	
	/**
	 * Load the feed list from a Depot.
	 */
	load: function() {
		this.db = new Mojo.Depot({
			name: "FeedListDB",
			version: 1,
			estimatedSize: 500000,
			replace: false
		}, this.openDBSuccessHandler, this.openDBFailedHandler);
	},
	
	/** @private
	 * 
	 * Called when opening the depot succeeds.
	 */
	openDBSuccess: function() {
        this.db.get("feedList",
					this.loadFeedListSuccessHandler,
					this.loadFeedListFailedHandler);
	},
	
	/** @private
	 *
	 * Called when opening the depot fails.
	 */
	openDBFailed: function(transaction, result) {
		Mojo.Log.warn("FEEDS> Can't open feed database: ", result.message);
	},

	/** @private
	 * 
	 * Called when the feed list object could be found in the depot.
	 * 
	 * @param {Object} data
	 */
	loadFeedListSuccess: function(data) {
        Mojo.Log.info("FEEDS> Database size: " , Object.values(data).size());
	    
        if (Object.toJSON(data) == "{}" || data === null) { 
			this.list = [ {
				type: 			"allItems",
				url: 			[],
				title: 			"",
				enabled: 		true,
				numUnRead: 		0,
				numNew: 		0,
				viewMode: 		0,
				sortMode:		0,
				allowHTML:		1,
				updated: 		true,
				spinning: 		false,
				preventDelete: 	true,
				stories: 		[] } ];
        } else {
            this.list = this.migrator.migrate(data, this.properties.migratingFrom);
		}
			
		this.cookie.put({ version: FeedReader.versionInt });
		this.loaded = true;
		Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-loaded" });
		if(FeedReader.prefs.updateOnStart) {
			this.enqueueUpdate(-1);
		}
	},
	
	/** @private
	 *
	 * Called when the feed list cannot be retrieved.
	 */
	loadFeedListFailed: function() {
		Mojo.Log.warn("FEEDS> unable to retrieve feedlist");
		Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-loaded" });
	},

	/**
	 * Save the feed list to a depot.
	 */
	enqueueSave: function() {
		this.spooler.addAction(this.doSaveHandler, "feedmodel.save", true);
	},
	
	/** @private
	 * Save the feed list.
	 */
	doSave: function() {
		this.db.add("feedList", this.list,
					this.saveFeedListSuccessHandler,
					this.saveFeedListFailedHandler);
	},
	
	/** @private
	 *
	 * Called when saving the feed list succeeds.
	 */
	saveFeedListSuccess: function() {
		Mojo.Log.info("FEEDS> feed list saved");
		this.spooler.nextAction();
	},
	
	/** @private
	 *
	 * Called when saving the feed list fails.
	 */
	saveFeedListFailed: function(transaction, result) {
		Mojo.Log.error("FEEDS> feed list could not be saved: ", result.message);
		this.spooler.nextAction();
	},
	
	/**
	 * Add a new feed.
	 * 
	 * @param {String} 	title
	 * @param {String} 	url
	 * @param {Boolean} enabled
	 * @param {Int} 	viewMode
	 * @param {Boolean} showPicture
	 * @param {Boolean} showMedia
	 * @param {Int}		sortMode
	 * @param {Boolean} allowHTML
	 */
	addFeed: function(title, url, enabled, viewMode, showPicture,
					  showMedia, sortMode, allowHTML) {			
		for(var i; i < this.list.length; i++) {
			if (this.list[i].url == url) {
				this.editFeed(i, title, url, enabled, viewmode, showPicture, showMedia);
				return;
			} 
		}
		
		if (title === "") {
			title = "RSS Feed";
		}
		
		this.list.push({
			title:			title,
			url:			url,
			type:			"rss",
			uid:			Math.uuid(15),
			numUnRead:		0,
			numNew:			0,
			enabled:		enabled,
			viewMode:		viewMode,
			showPicture:	showPicture,
			showMedia:		showMedia,
			sortMode: 		sortMode,
			allowHTML: 		allowHTML,
			preventDelete:	false,
			updated:		true,
			spinning:		false,
			stories:		[]
		});
		Mojo.Controller.getAppController().sendToNotificationChain({ type: "feedlist-newfeed" });
		this.changingFeed = true;
		this.enqueueUpdate(this.list.length - 1);
	},
	
	/**
	 * Update the properties of a feed.
	 * 
	 * @param {Int} 	index
	 * @param {String} 	title
	 * @param {String} 	url
	 * @param {Boolean} enabled
	 * @param {Int} 	viewMode
	 * @param {Boolean} showPicture
	 * @param {Boolean} showMedia
	 * @param {Int}		sortMode
	 * @param {Boolean} allowHTML
	 */
	editFeed: function(index, title, url, enabled, viewMode, showPicture,
					   showMedia, sortMode, allowHTML) {
		if((index >= 0) && (index < this.list.length)) {
			this.changingFeed = true;
			this.list[index].title = title;
			this.list[index].url = url;
			this.list[index].enabled = enabled;
			this.list[index].viewMode = viewMode;
			this.list[index].sortMode = sortMode;
			this.list[index].showPicture = showPicture;
			this.list[index].showMedia = showMedia;
			this.list[index].allowHTML = allowHTML;
			Mojo.Controller.getAppController().sendToNotificationChain({
				type: "feedlist-editedfeed",
				feedIndex: index
			});
			this.enqueueUpdate(index);
		}
	},
	
	/** @private
	 * 
	 * Send a notification about a feeds update state. 
	 * 
	 * @param {int} index			feed index
	 * @param {Boolean} updating	update state
	 */
	notifyOfFeedUpdate: function(index, updating) {
		this.list[index].spinning = updating;
		Mojo.Controller.getAppController().sendToNotificationChain({
			type: 		"feed-update",
			inProgress: updating,
			feedIndex:	index
		});		
	},
	
	/**
	 * Updates a feed.
	 * 
	 * @param {int} index		index of the feed to update.
	 */
	enqueueUpdate: function(index) {
		if ((index >= 0) && (index < this.list.length) && (this.list[index].type != "allItems")) {
			if(!this.list[index].enabled) {
				this.list[index].updated = true;
				this.list[index].spinning = false;
				return;
			}
			
			this.updateInProgress = true;
			this.spooler.beginUpdate();
			this.spooler.addAction(this.doUpdateFeed.bind(this, index), "feedmodel.updateFeed");
		} else {
			var l = this.list.length;
			if(l < 2) {
				return;
			}
			
			Mojo.Log.info("FEEDS> Full update requested");
			this.fullUpdateInProgress = true;
			this.updateInProgress = true;
			
			this.spooler.beginUpdate();
			for(var i = 0; i < l; i++) {
				if((this.list[i].type == "allItems") || !this.list[i].enabled) {
					this.list[i].updated = true;
					this.list[i].spinning = false;
				}
				
				if(this.list[i].type != "allItems") {
					this.list[i].updated = false;
					this.spooler.addAction(this.doUpdateFeed.bind(this, i), "feedmodel.updateFeed");
				}
			}
		}
		
		this.enqueueAllItemsUpdate();
		this.enqueueSave();
		this.spooler.endUpdate();		
	},
	
	/** @private
	 *
	 * Called by the spooler to update a feed.
	 */
	doUpdateFeed: function(index) {
		this.connStatus = new Mojo.Service.Request('palm://com.palm.connectionmanager', {
			method: 'getstatus',
			parameters: {},
			onSuccess: this.getConnStatusSuccess.bind(this, index),
			onFailure: this.getConnStatusFailed.bind(this, index)
		});		
	},

	/** @private
	 * 
	 * Called when the connection status could be retrieved.
	 *
	 * @param {int} index		Feed Index to be updated
	 * @param {Object} result	Information about the connection status
	 */	
	getConnStatusSuccess: function(index, result) {
		if(result.isInternetConnectionAvailable) {
			this.updateInProgress = true;
			this.list[index].updated  = false;
			this.notifyOfFeedUpdate(index, true);
			var request = new Ajax.Request(this.list[index].url, {
	    	        method: "get",
					evalJS: "false",
	        	    evalJSON: "false",
	            	onSuccess: this.updateFeedSuccess.bind(this, index),
	            	onFailure: this.updateFeedFailed.bind(this, index)});
		} else {
			Mojo.Log.info("FEEDS> No internet connection available");
			this.spooler.nextAction();
		}
	},
	
	/** @private
	 * 
	 * Called when the connection status could not be retrieved.
	 *
	 * @param {int} index		Feed Index to be updated
	 * @param {Object} result	Information about the connection status
	 */	
	getConnStatusFailed: function(index, result) {
		Mojo.Log.warn("FEEDS> Unable to determine connection status");
		this.spooler.nextAction();
	},

	/** @private
	 * 
	 * Reformat a story's summary.
	 * 
	 * @param {String} summary		string containing the summary to reformat
	 * @return {String}				reformatted summary
	 */
	reformatSummary: function(summary) {
		summary = FeedReader.stripCDATA(summary);
		
		// Remove potentially dangerous tags.
		summary = summary.replace(/<script[^>]*>(.*?)<\/script>/ig, "");
		summary = summary.replace(/(<script([^>]*)\/>)/ig, "");
		summary = summary.replace(/<iframe[^>]*>(.*?)<\/iframe>/ig, "");
		summary = summary.replace(/(<iframe([^>]+)\/>)/ig, "");
		
        summary = summary.replace(/(\{([^\}]+)\})/ig, "");
        summary = summary.replace(/digg_url .../, "");
		
		// Parse some BBCodes.
		summary = summary.replace(/\[i\](.*)\[\/i\]/ig, '<span class="italic">$1</span>');
		summary = summary.replace(/\[b\](.*)\[\/b\]/ig, '<span class="bold">$1</span>');
		summary = summary.replace(/\[u\](.*)\[\/u\]/ig, '<span class="underline">$1</span>');
        summary = unescape(summary);
		return summary;	
	},
	
	/** @private
	 * 
	 * Determine the type of the given feed.
	 * 
	 * @param {int} index			feed index
	 * @param {Object} transport	Ajax transport
	 * @return {Boolean}			true if type is supported
	 */
	determineFeedType: function(index, transport) {
		var feedType = transport.responseXML.getElementsByTagName("rss");
		var errorMsg = {};
		
		if(transport.responseText.length === 0) {
			if (this.changingFeed) {
				errorMsg = new Template($L("The Feed '#{title}' does not return data."));
				FeedReader.showError(errorMsg, { title: this.list[index].url });
			}
			Mojo.Log.info("FEEDS> Empty responseText in", this.list[index].url);
			this.list[index].type = "unknown";
			return false;			
		}

		if (feedType.length > 0) {
			this.list[index].type = "rss";				// RSS 2 
		} else {    
			feedType = transport.responseXML.getElementsByTagName("RDF");
			if (feedType.length > 0) {
				this.list[index].type = "RDF";			// RSS 1
			} else {
				feedType = transport.responseXML.getElementsByTagName("feed");
				if (feedType.length > 0) {
					this.list[index].type = "atom";		// ATOM
				} else {
					if (this.changingFeed) {
						errorMsg = new Template($L("The format of Feed '#{title}' is unsupported."));
						FeedReader.showError(errorMsg, {title: this.list[index].url});
					}
					Mojo.Log.info("FEEDS> Unsupported feed format in", this.list[index].url);
					this.list[index].type = "unknown";
					return false;
				}
			}
		}
		return true;
	},
	
	/** @private
	 *
	 * Parse RDF Feed data.
	 *
	 * @param {Object} transport
	 * @returns {Array} story container
	 */
	parseAtom: function(index, transport) {
		var container = [];
		var enclosures = {};
		var url = "", enc = 0, type = "", title = "";
		var el = 0;
		
		var atomItems = transport.responseXML.getElementsByTagName("entry");
		var l = atomItems.length;
		for (var i = 0; i < l; i++) {
			try {
				story = {
					index:		0,
					title:		"",
					summary:	"",
					url:		[],
					picture:	"",
					audio:		"",
					video:		"",
					intDate:	0,
					uid:		"",
					isRead:		false,
					isNew:		true
				};
				
				if(atomItems[i].getElementsByTagName("title") &&
				   atomItems[i].getElementsByTagName("title").item(0)) {
					story.title = unescape(atomItems[i].getElementsByTagName("title").item(0).textContent);
				}
				if (atomItems[i].getElementsByTagName("summary") &&
					atomItems[i].getElementsByTagName("summary").item(0)) {
					story.summary = this.reformatSummary(atomItems[i].getElementsByTagName("summary").item(0).textContent);
				}
				
				// Analyse the enclosures.
				enclosures = atomItems[i].getElementsByTagName("link");
				if(enclosures && (enclosures.length > 0)) {
					el = enclosures.length;
					for(enc = 0; enc < el; enc++) {
						rel = enclosures.item(enc).getAttribute("rel");
						url = enclosures.item(enc).getAttribute("href");
						type = enclosures.item(enc).getAttribute("type");

						if(!type) {
							type = "";
						}
						if(url && (url.length > 0)) {
							if(url.match(/.*\.htm(l){0,1}/i)){
								title = enclosures.item(enc).getAttribute("title");
								if((title === null) || (title.length === 0)) {
									title = "Weblink";
								}
								story.url.push({
									title:	title,
									href:	url
								});
							} else if(rel && rel.match(/enclosure/i)) {
								if(url.match(/.*\.jpg/i) ||
								   url.match(/.*\.jpeg/i) ||
								   url.match(/.*\.gif/i) ||
								   url.match(/.*\.png/i)) {
									story.picture = url;
								} else if(url.match(/.*\.mp3/i) ||
										  (url.match(/.*\.mp4/i) && type.match(/audio\/.*/i)) ||
										  url.match(/.*\.wav/i) ||
										  url.match(/.*\.aac/i)) {
									story.audio = url;
								} else if(url.match(/.*\.mpg/i) ||
										  url.match(/.*\.mpeg/i) ||
										  (url.match(/.*\.mp4/i) && type.match(/video\/.*/i)) ||
										   url.match(/.*\.avi/i)) {
									story.video = url;
								}
							}
						}
					}
				}
				
				// Set the publishing date.
				if (atomItems[i].getElementsByTagName("updated") &&
					atomItems[i].getElementsByTagName("updated").item(0)) {
					story.intDate = this.dateConverter.dateToInt(atomItems[i].getElementsByTagName("updated").item(0).textContent);
				}
				
				// Set the unique id.
				if (atomItems[i].getElementsByTagName("id") &&
					atomItems[i].getElementsByTagName("id").item(0)) {
					story.uid = atomItems[i].getElementsByTagName("id").item(0).textContent;
				} else {
					story.uid = story.url;
				}
				
				container.push(story);
			} catch(e) {
				Mojo.Log.logException(e);
			}
		}
		return container;
	},
	
	/** @private
	 *
	 * Parse RSS Feed data.
	 *
	 * @param {Object} transport
	 * @returns {Array} story container
	 */
	parseRSS: function(index, transport) {
		var container = [];
		var enclosures = {};
		var url = "", type = "", enc = 0;
		var el = 0;
		
		var rssItems = transport.responseXML.getElementsByTagName("item");
		var l = rssItems.length;
		for (var i = 0; i < l; i++) {
			try {
				story = {
					index: 		0,
					title: 		"",
					summary:	"",
					url:		[],
					picture:	"",
					audio:		"",
					video:		"",
					intDate:	0,
					uid:		"",
					isRead:		false,
					isNew:		true
				};
				
				if(rssItems[i].getElementsByTagName("title") &&
				   rssItems[i].getElementsByTagName("title").item(0)) {
					story.title = unescape(rssItems[i].getElementsByTagName("title").item(0).textContent);
				}
				if(rssItems[i].getElementsByTagName("description") &&
				   rssItems[i].getElementsByTagName("description").item(0)) {
					story.summary = this.reformatSummary(rssItems[i].getElementsByTagName("description").item(0).textContent);
				}
				if(rssItems[i].getElementsByTagName("link") &&
				   rssItems[i].getElementsByTagName("link").item(0)) {
					story.url.push({
						title:	"Weblink",
						href:	rssItems[i].getElementsByTagName("link").item(0).textContent
					});
				}
				
				// Analyse the enclosures.
				enclosures = rssItems[i].getElementsByTagName("enclosure");
				if(enclosures && (enclosures.length > 0)) {					
					el = enclosures.length;
					for(enc = 0; enc < el; enc++) {
						url = enclosures.item(enc).getAttribute("url");
						type = enclosures.item(enc).getAttribute("type");
						if(!type) {
							type = "";
						}
						if(url && (url.length > 0)) {
							if(url.match(/.*\.jpg/i) ||
							   url.match(/.*\.jpeg/i) ||
							   url.match(/.*\.gif/i) ||
							   url.match(/.*\.png/i)) {
								story.picture = url;
							} else if(url.match(/.*\.mp3/i) ||
									  (url.match(/.*\.mp4/i) && type.match(/audio\/.*/i)) ||
									  url.match(/.*\.wav/i) ||
									  url.match(/.*\.aac/i)) {
								story.audio = url;
							} else if(url.match(/.*\.mpg/i) ||
									  url.match(/.*\.mpeg/i) ||
									  (url.match(/.*\.mp4/i) && type.match(/video\/.*/i)) ||
									  url.match(/.*\.avi/i) ||
									  url.match(/.*\.m4v/i)) {
								story.video = url;
							}
						}
					}
				}
				
				// Set the publishing date.
				if(rssItems[i].getElementsByTagName("pubDate") &&
				   rssItems[i].getElementsByTagName("pubDate").item(0)) {
				   story.intDate = this.dateConverter.dateToInt(rssItems[i].getElementsByTagName("pubDate").item(0).textContent);
				} else if (rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date") &&
						   rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0)) {
					story.intDate = this.dateConverter.dateToInt(rssItems[i].getElementsByTagNameNS("http://purl.org/dc/elements/1.1/", "date").item(0).textContent);
				}
				
				// Set the unique id.
				if(rssItems[i].getElementsByTagName("guid") &&
				   rssItems[i].getElementsByTagName("guid").item(0)) {
					story.uid = rssItems[i].getElementsByTagName("guid").item(0).textContent;
				} else {
					story.uid = story.title;
				}
				
				container.push(story);
			} catch(e) {
				Mojo.Log.logException(e);
			}
		}
		return container;
	},
	
	/** @private
	 *
	 * Parse RDF Feed data.
	 *
	 * @param {Object} transport
	 * @returns {Array} story container
	 */
	parseRDF: function(index, transport) {
		// Currently we do the same as for RSS.
		return this.parseRSS(index, transport);
	},
	
	/** @private
	 *
	 * Sort function to sort stories by date.
	 *
	 * @param {Object}		Feed a
	 * @param {Object}		Feed b
	 */
	dateSort: function(a, b) {
		return b.intDate - a.intDate;
	},
	
	/** @private
	 * 
	 * Called when an Ajax request succeeds.
	 * 
	 * @param {int} index
	 * @param {Object} transport
	 */
	updateFeedSuccess: function(index, transport) {
		try {
			if((transport.responseXML === null) && (transport.responseText !== null)) {
				Mojo.Log.info("FEEDS> Manually converting feed info to xml");
				transport.responseXML = new DOMParser().parseFromString(transport.responseText, "text/xml");
				Mojo.Log.info(transport.responseText);
			}
			
			if(this.determineFeedType(index, transport)) {
				var contentType = transport.getHeader("Content-Type");
				var feed = this.list[index];
				var stories = feed.stories;
				var newStories = [];
				
				switch(feed.type) {
					case "RDF":
						newStories = this.parseRDF(index, transport);
						break;
						
					case "rss":
						newStories = this.parseRSS(index, transport);
						break;
						
					case "atom":
						newStories = this.parseAtom(index, transport);
						break;
				}
				
				var nl = newStories.length;
				var ol = stories.length;
				
				feed.numUnRead = newStories.length;
				feed.numNew = 0;
				
				for (var i = 0; i < nl; i++) {
					newStories[i].title = this.converter.convert(contentType, newStories[i].title);
					newStories[i].summary = this.converter.convert(contentType, newStories[i].summary);
					
					for (var j = 0; j < ol; j++) {						
						if(newStories[i].uid == stories[j].uid) {
							newStories[i].isRead = stories[j].isRead;
							newStories[i].isNew = stories[j].isNew;
							break;
						}            
					}
					
					if(newStories[i].isNew) {
						feed.numNew++;
					}
					if(newStories[i].isRead) {
						feed.numUnRead--;
					}
				}
				newStories.sort(this.dateSort);
				feed.stories = newStories;
			} 
		} catch(e) {
			Mojo.Log.logException(e);
		}
		this.finishUpdate(index);	
	},
	
	/** @private
	 * 
	 * Called when an Ajax request fails.
	 * 
	 * @param {Object} index
	 * @param {Object} transport
	 */
	updateFeedFailed: function(index, transport) {
		try {
			// TODO: handle redirections.
			var error = "";
			switch(transport.status) {
				case 400:
					error = $L("Bad Request");
					break;			
				case 401:
					error = $L("Unauthorized");
					break;
				case 403:
					error = $L("Forbidden");
					break;
				case 404:
					error = $L("Not Found");
					break;
				case 405:
					error = $L("Method Not Allowed");
					break;
				case 406:
					error = $L("Not Acceptable");
					break;
				default:
					if (transport.status >= 500) {
						error = $L("Server error");
					} else {
						error = $L("Unexpected error");
					}
					break;
			}
	
			Mojo.Log.warn("FEEDS> Feed", index, "is defect; disabling feed; error:", error);
			if (this.changingFeed) {
				this.list[index].enabled = false;
				this.list[index].type = "unknown";
				var errorMsg = new Template($L("The Feed '#{title}' could not be retrieved. The server responded: #{err}. The Feed was automatically disabled."));
				FeedReader.showError(errorMsg, {title: this.list[index].url, err: error});
			}
		} catch(e) {
			Mojo.Log.logException(e);
		}
		this.finishUpdate(index);
	},
	
	/** @private
	 *
	 * Finishes feed updates.
	 */
	finishUpdate: function(index) {
		this.list[index].updated = true;
		
		if(this.fullUpdateInProgress) {
			var updateComplete = true;
			for(var i = 0; (i < this.list.length) && updateComplete; i++) {
				updateComplete = this.list[i].updated;
			}
			
			if(updateComplete) {
				Mojo.Log.info("FEEDS> Full Update completed; isActive =", FeedReader.isActive, "; notifications =", FeedReader.prefs.notificationEnabled);
				this.fullUpdateInProgress = false;
				
				// Post a banner notification if applicable.
				if((!FeedReader.isActive) && (!this.interactiveUpdate) && (FeedReader.prefs.notificationEnabled)) {
					var n = 0;
					for(i = 0; i < this.list.length; i++) {
						if(this.list[i].type != "allItems") {
							n += this.list[i].numNew;
						}
					}
					Mojo.Log.info("FEEDS> About to post notification for new items; count =", n);
					FeedReader.postNotification(n);
				}
				
				this.interactiveUpdate = false;
			}
		} else {
			this.interactiveUpdate = false;
		}
		this.updateInProgress = this.fullUpdateInProgress;
		this.changingFeed = false;
		this.notifyOfFeedUpdate(index, false);
		
		this.spooler.nextAction();
	},

	/**
	 * Enqueue updating the all items feed.
	 *
	 * @param {Boolean}	disableNotification		If set, omit the notification
	 */
	enqueueAllItemsUpdate: function(disableNotification) {
		this.spooler.addAction(this.updateAllItemsFeed.bind(this, disableNotification),
							   "feeds-updateAllItemsFeed");
	},

	/** @private
	 * Update the all items feed.
	 *
	 * @param {Boolean}	disableNotification		If set, omit the notification
	 */
	updateAllItemsFeed: function(disableNotification) {	
		var allItemsIndex = -1;
		var numUnRead = 0, numNew = 0;
		var l = this.list.length;
		var list = this.list;
		
		for(var i = 0; i < l; i++) {
			if(list[i].type != "allItems") {
				numUnRead += list[i].numUnRead;
				numNew += list[i].numNew;
			} else {
				allItemsIndex = i;
			}
		}
		
		if(allItemsIndex >= 0) {
			list[allItemsIndex].numNew = numNew;
			list[allItemsIndex].numUnRead = numUnRead;
			if(!disableNotification) {
				this.notifyOfFeedUpdate(allItemsIndex, false);
			}
		} else {
			Mojo.Log.error("FEEDS> Something went wrong: no allItems feed found!");
		}
		
		this.spooler.nextAction();
	},
	
	/**
	 * Mark all stories of the given feed as being read.
	 * 
	 * @param {int}	index		Index of the feed
	 */
	markAllRead: function(index) {
		if((index >= 0) && (index < this.list.length)) {
			var i, j;
			if(this.list[index].type == "allItems") {
				for(i = 0; i < this.list.length; i++) {
					if(i == index) {
						continue;
					}
					this.list[i].numUnRead = 0;
					this.list[i].numNew = 0;
					for(j = 0; j < this.list[i].stories.length; j++) {
						this.list[i].stories[j].isRead = true;
						this.list[i].stories[j].isNew = false;						
					}
					this.notifyOfFeedUpdate(i, false);
				}
			} else {
				this.list[index].numUnRead = 0;
				this.list[index].numNew = 0;
				for(i = 0; i < this.list[index].stories.length; i++) {
					this.list[index].stories[i].isRead = true;
					this.list[index].stories[i].isNew = false;
				}
				this.notifyOfFeedUpdate(index, false);
			}
			this.spooler.beginUpdate();
			this.enqueueAllItemsUpdate();
			this.enqueueSave();
			this.spooler.endUpdate();
		}
	},
	
	/**
	 * Mark a given story as being read.
	 *
	 * @param {int} index		Index of the feed
	 * @param {int} story		Index of the story
	 */
	markStoryRead: function(index, story) {
		if((index >= 0) && (index < this.list.length)) {
			if((story >= 0) && (story < this.list[index].stories.length)) {
				if(!this.list[index].stories[story].isRead) {
					this.list[index].stories[story].isRead = true;
					this.list[index].numUnRead--;
				}
				if(this.list[index].stories[story].isNew) {
					this.list[index].stories[story].isNew = false;
					this.list[index].numNew--;
				}
				
				this.spooler.beginUpdate();
				this.enqueueAllItemsUpdate();
				this.enqueueSave();
				this.spooler.endUpdate();
			}
		}
	},
	
	/**
	 * Mark all stories of the given feed as being unread.
	 *  
	 * @param {int} index		Index of the feed
	 */
	markAllUnRead: function(index) {
		if((index >= 0) && (index < this.list.length)) {
			var i, j;
			if(this.list[index].type == "allItems") {
				for(i = 0; i < this.list.length; i++) {
					if(i == index) {
						continue;
					}
					this.list[i].numUnRead = this.list[i].stories.length;
					for(j = 0; j < this.list[i].stories.length; j++) {
						this.list[i].stories[j].isRead = false;
					}
					this.notifyOfFeedUpdate(i, false);
				}
			} else {
				this.list[index].numUnRead = this.list[index].stories.length;
				for(i = 0; i < this.list[index].stories.length; i++) {
					this.list[index].stories[i].isRead = false;
				}
				this.notifyOfFeedUpdate(index, false);
			}
			
			this.spooler.beginUpdate();
			this.enqueueAllItemsUpdate();
			this.enqueueSave();
			this.spooler.endUpdate();
		}
	},

	/**
	 * Mark a feed as being seen (not new).
	 *
	 * @param {int} index		Index of the feed to process
	 */
	markSeen: function(index) {
		if((index >= 0) && (index < this.list.length)) {
			if(this.list[index].type == "allItems") {
				for(var j = 0; j < this.list.length; j++) {
					if(j == index) {
						continue;
					}
					
					for(var k = 0; k < this.list[j].stories.length; k++) {
						this.list[j].stories[k].isNew = false;
					}
					this.list[j].numNew = 0;
				}
			} else {
				for(var i = 0; i < this.list[index].stories.length; i++) {
					this.list[index].stories[i].isNew = false;
				}
				this.list[index].numNew = 0;
				this.notifyOfFeedUpdate(index, false);
			}
			
			this.spooler.beginUpdate();
			this.enqueueAllItemsUpdate();
			this.enqueueSave();
			this.spooler.endUpdate();
		}
	},
	
	/**
	 * Delete a given feed.
	 *
	 * @param {int} index		Index of the feed to delete
	 */
	deleteFeed: function(index) {
		if((index >= 0) && (index < this.list.length)) {
			Mojo.Log.info("FEEDS> Deleting feed", index);
			this.list.splice(index, 1);
			
			this.spooler.beginUpdate();
			this.enqueueAllItemsUpdate();
			this.enqueueSave();
			this.spooler.endUpdate();
		}
	},
	
	/**
	 * Move a feed in the list.
	 *
	 * @param {int} fromIndex	Feed to be moved
	 * @param {int} toIndex		Index to move it to
	 */
	moveFeed: function(fromIndex, toIndex) {
		if(fromIndex == toIndex) {
			return;
		}
		
		if((fromIndex >= 0) && (fromIndex < this.list.length) &&
		   (toIndex >= 0) && (toIndex < this.list.length)) {
			var elem = this.list.slice(fromIndex);
			this.list.splice(fromIndex, 1);
			var behind = this.list.slice(toIndex);
			this.list.splice(toIndex, this.list.length - toIndex);
			this.list.push(elem[0]);
			for(var i = 0; i < behind.length; i++) {
				this.list.push(behind[i]);
			}
			
			this.enqueueSave();
		}
	},
	
	/**
	 * Return the feed's title.
	 *
	 * @param {Object} feed		a feed object
	 * @return {String}			the feed's title
	 */
	getFeedTitle: function(feed) {
		if(feed.type == "allItems") {
			return $L("All items");
		} else {
			return feed.title;
		}
	},
	
	/**
	 * Return the feed's url.
	 *
	 * @param {Object} feed		a feed object
	 * @return {String}			the feed's url
	 */
	getFeedURL: function(feed) {
		if(feed.type == "allItems") {
			return $L("Aggregation of all feeds");
		} else {
			return feed.url;
		}		
	},
	
	/**
	 * Return a feeds header icon class.
	 *
	 * @param {Object} feed		a feed object
	 * @return {String}			the header icon class
	 */
	getFeedHeaderIcon: function(feed) {
		switch(feed.type) {
			case "allItems":
				return "allitems";
			
			case "RDF":
			case "rss":
				return "rss";
				
			case "atom":
				return "atom";
			
			default:
				return "rss";
		}
	},
	
	/**
	 * Determine if the story captions should be shown.
	 * 
	 * @param {Object}		The feed to inspect
	 * @param {Boolean}		True if called from fullStoryView
	 */
	showCaption: function(feed, isDetailView) {
		var viewMode = parseInt(feed.viewMode, 10);
		var mode = (isDetailView ? (viewMode >> 24) : (viewMode >> 16)) & 0xFF;
		return (mode < 2);
	},
	
	/**
	 * Determine if the story summarys should be shown.
	 * 
	 * @param {Object}		The feed to inspect
	 * @param {Boolean}		True if called from fullStoryView
	 */
	showSummary: function(feed, isDetailView) {
		var viewMode = parseInt(feed.viewMode, 10);
		var mode = (isDetailView ? (viewMode >> 24) : (viewMode >> 16)) & 0xFF;
		return (mode == 2) || (mode === 0);
	},
	
	/** @private
	 *
	 * Decide whether a story should be taken into a story list.
	 *
	 * @param {Int}			SortMode of the feed
	 * @param {Object}		story object
	 */
	takeStory: function(sortMode, story) {
		switch(sortMode) {
			case 0:		return true;
			case 1:		return !story.isRead;
			case 2:		return story.isNew;
		}
		return false;
	},
	
	/**
	 * Build a story list for the given feed.
	 *
	 */
	buildStoryList: function(feedIndex) {
		var feed = this.list[feedIndex];
		var sortByDate = ((feed.sortMode >> 8) & 0xFF) == 1;
		var sortMode = (feed.sortMode & 0xFF);
		
		var result = [];
		var stories = [];
		var takeStory = false;
		var i = 0, j = 0, storyCount = 0;
		
		if(this.list[feedIndex].type != "allItems") {
			storyCount = feed.stories.length;
			stories = feed.stories;
			for(i = 0; i < storyCount; i++) {
				if(this.takeStory(sortMode, stories[i])) {
					result.push({
						intDate:		stories[i].intDate,
						feedIndex:		feedIndex,
						storyIndex:		i
					});
				}
			}
		} else {
			var feedCount = this.list.length;
			for(j = 0; j < feedCount; j++) {
				if(j == feedIndex) {
					continue;
				}
				feed = this.list[j];
				storyCount = feed.stories.length;
				stories = feed.stories;
				for(i = 0; i < storyCount; i++) {
					if(this.takeStory(sortMode, stories[i])) {
						result.push({
							intDate:		stories[i].intDate,
							feedIndex:		j,
							storyIndex:		i
						});
					}
				}				
			}
		}
		
		if(sortByDate) {
			result.sort(this.dateSort);
		}
		
		return result;
	},
	
	getStory: function(listItem) {
		return this.list[listItem.feedIndex].stories[listItem.storyIndex];
	}
});
