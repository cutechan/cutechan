/*
 * OP and thread related logic
 */

var $ = require('jquery'),
	_ = require('underscore'),
	Backbone = require('backbone'),
	main = require('../main'),
	oneeSama = main.oneeSama,
	postCommon = require('./common'),
	state = require('../state');

var Section = module.exports = Backbone.View.extend({
	tagName: 'section',
	initialize: function() {
		// On the live page only
		if (!this.el.innerHTML)
			this.render();
		else
			this.renderOmit();

		this.listenTo(this.model, {
			'change:locked': this.renderLocked,
			remove: this.remove,
			bump: this.bumpThread
		});
		this.initCommon();
	},
	render: function() {
		let attrs = this.model.attributes;
		oneeSama.links = attrs.links;
		this.setElement(oneeSama.monomono(attrs).join('')).insertToTop();
		// Insert reply box into the new thread
		let $reply = $(oneeSama.replyBox());
		if (state.ownPosts.hasOwnProperty(attrs.num)
			|| !!main.request('postForm')
		)
			$reply.hide();
		this.$el.after($reply, '<hr>');
		return this;
	},
	insertToTop: function() {
		this.$el.insertAfter(main.$threads.children('aside').first());
	},
	renderLocked: function (model, locked) {
		this.$el.toggleClass('locked', !!locked);
	},
	remove: function() {
		this.$el.next('hr').addBack().remove();
		this.stopListening();
		return this;
	},
	/*
	 Remove the top reply on board pages, if over limit, when a new reply is
	 added
	 */
	shiftReplies: function(postForm) {
		if (state.page.get('thread'))
			return;
		let attrs = this.model.attributes,
			lim = state.hotConfig.get('ABBREVIATED_REPLIES'),
			replies = attrs.replies,
			changed;
		if (postForm)
			lim--;
		// Need a static length, because the original array get's modified
		const len = replies.slice().length;
		for (let i = len; i > lim; i--) {
			let post = state.posts.get(replies.shift());
			if (!post)
				continue;
			if (post.get('image'))
				attrs.image_omit++;
			attrs.omit++;
			changed = true;
			post.remove();
		}
		if (changed)
			this.renderOmit(attrs.omit, attrs.image_omit)
	},
	// Posts and images omited indicator
	renderOmit: function(omit, image_omit) {
		if (typeof omit === 'undefined') {
			const attrs = this.model.attributes;
			omit = attrs.omit;
			image_omit = attrs.image_omit;
		}
		if (omit === 0)
			return;
		if (!this.$omit) {
			this.$omit = $('<span class="omit"/>')
				.insertAfter(this.$el.children('blockquote'));
		}
		const page = state.page.attributes;
		var html = oneeSama.lang.abbrev_msg(omit,
			this.model.get('image_omit'),
			// [See All] link URL
			page.thread && page.href.split('?')[0]
		);
		this.$omit.html(html);
	},
	// Move thread to the top of the page
	bumpThread: function() {
		this.$el.detach();
		this.insertToTop();
	}
});

// Extend with common mixins
_.extend(Section.prototype, postCommon);
