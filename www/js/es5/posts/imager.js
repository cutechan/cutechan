"use strict";System.register([],function(e,t){function n(e,t){return Object.freeze(Object.defineProperties(e,{raw:{value:Object.freeze(t)}}))}var i,a,r,o,s,g,d,l,u,m,c,h,p;return{setters:[],execute:function(){i=n(["<"," ",">"],["<"," ",">"]),a=n(['<audio src="','"\n				width="300"\n				height="3em"\n				autoplay loop controls\n			>\n			</audio>'],['<audio src="','"\n				width="300"\n				height="3em"\n				autoplay loop controls\n			>\n			</audio>']),r=require("../main"),o=r.$threads,s=r._,g=r.Backbone,d=r.common,l=r.util,u=r.oneeSama,m=r.options,c=r.state,exports.Hidamari=g.View.extend({renderImage:function(e,t,n){var i=e===!0,a=this.model,r=this.el;t&&t.src||(t=a.get("image"));var o=r.query("figure");o&&o.remove(),t&&(r.query("blockquote").before(l.parseDOM(u.image(t,i))),n&&a.get("tallImage")&&(window.scrollTop=r.getBoundingClientRect().top+document.body.scrollTop-document.query("#banner").height),a.set({thumbnailRevealed:i,imageExpanded:!1,tallImage:!1}))},autoExpandImage:function(){var e=this.model.get("image");return!e||!p.get("expand")||[".webm",".pdf",".mp3"].indexOf(e.ext)>-1?this:(this.toggleImageExpansion(!0,e),this)},toggleImageExpansion:function(e,t,n){var i=m.get("inlinefit");t&&"none"!==i&&(e?this.fitImage(t,i):this.renderImage(null,t,n))},fitImage:function(e,t){if(".pdf"===e.ext)return window.open(u.imagePaths().src+e.src,"_blank");if(".mp3"===e.ext)return this.renderAudio(e);var n=void 0,i=void 0,a=n=e.dims[0],r=i=e.dims[1];if("full"===t)return this.expandImage(e,{width:a,height:r});var o="both"===t,s=o||"width"===t,g=o||"height"===t,d=a/r,l=void 0,m=void 0;if(s){var c=this.imageMaxWidth();n>c&&(n=c,i=n/d,l=!0)}if(g){var h=window.innerHeight-document.query("#banner").offsetHeight;i>h&&(i=h,n=i*d,m=!0)}n>50&&i>50&&(a=n,r=i),this.expandImage(e,a,r,m&&!l)},imageMaxWidth:function(){var e=this.el,t=this.model;return window.innerWidth-2*parseInt(e.closest("section").getBoundingClientRect().left)-l.outerWidth(t.get("op")?e:e.query(".background"))},expandImage:function(e,t,n,a){var r=".webm"===e.ext,o={src:u.imagePaths().src+e.src,width:t,height:n},s="expanded";a&&(s+=" noMargin"),o["class"]=s,r&&(o.autoplay=o.loop=o.controls=!0),this.el.query("figure").lastChild.innerHTML=d.parseHTML(i,r?"video":"img",o),this.model.set({imageExpanded:!0,tallImage:n>window.innerHeight})},renderAudio:function(e){this.el.query("figure").append(l.parseDOM(d.parseHTML(a,u.imagePaths().src+e.src))),this.model.set("imageExpanded",!0)}}),h=g.Model.extend({initialize:function(){var e=this;o.on("click","#expandImages",function(t){t.preventDefault(),e.toggle()})},toggle:function(){var e=!this.get("expand");this.set("expand",e).massToggle(e),o.find("#expandImages").text(r.lang.expander[+e])},massToggle:function(e){var t=m.get("inlinefit");if("none"!==t)for(var n=c.posts.models,i=0,a=n.length;a>i;i++){var r=n[i],o=r.get("image");o&&(e?r.dispatch("fitImage",o,t):r.dispatch("renderImage",null,o))}}}),p=exports.massExpander=new h,r.reply("massExpander:unset",function(){return p.unset()}),o.on("click","img, video",function(e){if("none"!=m.get("inlinefit")&&1===e.which){var t=l.getModel(e.target);t&&(e.preventDefault(),r.request("imager:clicked"),t.dispatch("toggleImageExpansion",!t.get("imageExpanded"),t.get("image"),!0))}}),o.on("click",".imageToggle",function(e){e.preventDefault();var t=l.getModel(e.target);t&&r.follow(function(){return t.dispatch("renderImage",!t.get("thumbnailRevealed"))})})}}});
//# sourceMappingURL=../maps/posts/imager.js.map
