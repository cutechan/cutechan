"use strict";System.register([],function(e,t){function n(){try{var e=JSON.parse(localStorage.ident);e.name&&l.val(e.name),e.email&&c.val(e.email)}catch(t){}}function a(){var e=i.request("postForm");e&&e.renderIdentity(),v()}var i,r,o,c,l,m,s,u,v;return{setters:[],execute:function(){i=require("../main"),r=i.$,o=i.$script,c=i.$email,l=i.$name,m=i._,s=i.common,u=i.config,v=m.debounce(function(){try{var e=l.val(),t=c.val();if(t===u.LOGIN_KEYWORD&&(c.val(""),o(u.MEDIA_URL+"js/login.js?v="+i.clientHash),t=!1),e||t){var n={};e&&(n.name=e),t&&(n.email=t),localStorage.ident=JSON.stringify(n)}else localStorage.removeItem("ident")}catch(a){}},1e3),i.defer(function(){n(),l.on("input",a),c.on("input",a)})}}});
//# sourceMappingURL=../maps/posts/identity.js.map
