'use strict';System.register([],function(_export,_context){return {setters:[],execute:function(){let main=require('../main');let _=main._;let Backbone=main.Backbone;let state=main.state;exports.Post=Backbone.Model.extend({idAttribute:'num',initialize(){state.posts.add(this);},dispatch(command){for(var _len=arguments.length,args=Array(_len>1?_len-1:0),_key=1;_key<_len;_key++){args[_key-1]=arguments[_key];}this.trigger('dispatch',command,...args);},remove(){this.stopListening().dispatch('remove');state.posts.remove(this);},update(frag,links,dice){const updates={body:this.get('body')+frag};if(links)_.extend(this.get('links'),links);if(dice)updates.dice=(this.get('dice')||[]).concat(dice);this.set(updates);},setImage(image,silent){this.set('image',image);if(!silent)this.dispatch('renderImage',image);},setSpoiler(spoiler,info){let image=this.get('image');image.spoiler=spoiler;this.dispatch('renderImage',image);this.moderationInfo(info);},removeImage(info){this.moderationInfo(info)||this.unset('image').dispatch('renderImage');},deletePost(info){this.moderationInfo(info)||this.remove();},setBan(display,info){if(display)this.set('ban',true).dispatch('renderBan');this.moderationInfo(info);},addBacklink(num,op){let backlinks=this.get('backlinks')||{};backlinks[num]=op;this.set({backlinks}).dispatch('renderBacklinks',backlinks);},moderationInfo(info){if(!info)return false;const mod=this.get('mod')||[];mod.push(info);this.set('mod',mod).dispatch('renderModerationInfo',mod);return true;}});exports.Thread=exports.Post.extend({defaults:{replies:[],omit:0,image_omit:0},initialize(){if(this.get('omit'))this.getImageOmit();state.posts.add(this);},remove(){this.stopListening().dispatch('remove');state.posts.remove(this);const replies=this.get('replies');for(let i=0,lim=replies.length;i<lim;i++){let model=state.posts.get(replies[i]);if(model)model.remove();}},getImageOmit(){let image_omit=this.get('imgctr')-1;const replies=this.get('replies');for(let i=0,lim=replies.length;i<lim;i++){let model=state.posts.get(replies[i]);if(!model)continue;if(model.get('image'))image_omit--;}this.set('image_omit',image_omit);},toggleLocked(val,info){this.moderationInfo(info);this.set('locked',val).dispatch('renderLocked',val);}});}};});
//# sourceMappingURL=../maps/posts/models.js.map
