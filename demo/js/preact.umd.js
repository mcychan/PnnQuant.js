!function(n,l){"object"==typeof exports&&"undefined"!=typeof module?l(exports):"function"==typeof define&&define.amd?define(["exports"],l):l(n.preact={})}(this,function(n){var l,u,t,i,o,f,r,e={},c=[],s=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;function a(n,l){for(var u in l)n[u]=l[u];return n}function h(n){var l=n.parentNode;l&&l.removeChild(n)}function v(n,u,t){var i,o,f,r={};for(f in u)"key"==f?i=u[f]:"ref"==f?o=u[f]:r[f]=u[f];if(arguments.length>2&&(r.children=arguments.length>3?l.call(arguments,2):t),"function"==typeof n&&null!=n.defaultProps)for(f in n.defaultProps)void 0===r[f]&&(r[f]=n.defaultProps[f]);return y(n,r,i,o,null)}function y(n,l,i,o,f){var r={type:n,props:l,key:i,ref:o,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,__h:null,constructor:void 0,__v:null==f?++t:f};return null==f&&null!=u.vnode&&u.vnode(r),r}function p(n){return n.children}function d(n,l){this.props=n,this.context=l}function _(n,l){if(null==l)return n.__?_(n.__,n.__.__k.indexOf(n)+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return"function"==typeof n.type?_(n):null}function b(n){var l,u;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e){n.__e=n.__c.base=u.__e;break}return b(n)}}function k(n){(!n.__d&&(n.__d=!0)&&o.push(n)&&!g.__r++||f!==u.debounceRendering)&&((f=u.debounceRendering)||setTimeout)(g)}function g(){for(var n;g.__r=o.length;)n=o.sort(function(n,l){return n.__v.__b-l.__v.__b}),o=[],n.some(function(n){var l,u,t,i,o,f;n.__d&&(o=(i=(l=n).__v).__e,(f=l.__P)&&(u=[],(t=a({},i)).__v=i.__v+1,I(f,i,t,l.__n,void 0!==f.ownerSVGElement,null!=i.__h?[o]:null,u,null==o?_(i):o,i.__h),T(u,i),i.__e!=o&&b(i)))})}function m(n,l,u,t,i,o,f,r,s,a){var h,v,d,b,k,g,m,A=t&&t.__k||c,C=A.length;for(u.__k=[],h=0;h<l.length;h++)if(null!=(b=u.__k[h]=null==(b=l[h])||"boolean"==typeof b?null:"string"==typeof b||"number"==typeof b||"bigint"==typeof b?y(null,b,null,null,b):Array.isArray(b)?y(p,{children:b},null,null,null):b.__b>0?y(b.type,b.props,b.key,null,b.__v):b)){if(b.__=u,b.__b=u.__b+1,null===(d=A[h])||d&&b.key==d.key&&b.type===d.type)A[h]=void 0;else for(v=0;v<C;v++){if((d=A[v])&&b.key==d.key&&b.type===d.type){A[v]=void 0;break}d=null}I(n,b,d=d||e,i,o,f,r,s,a),k=b.__e,(v=b.ref)&&d.ref!=v&&(m||(m=[]),d.ref&&m.push(d.ref,null,b),m.push(v,b.__c||k,b)),null!=k?(null==g&&(g=k),"function"==typeof b.type&&b.__k===d.__k?b.__d=s=w(b,s,n):s=x(n,b,d,A,k,s),"function"==typeof u.type&&(u.__d=s)):s&&d.__e==s&&s.parentNode!=n&&(s=_(d))}for(u.__e=g,h=C;h--;)null!=A[h]&&("function"==typeof u.type&&null!=A[h].__e&&A[h].__e==u.__d&&(u.__d=_(t,h+1)),M(A[h],A[h]));if(m)for(h=0;h<m.length;h++)L(m[h],m[++h],m[++h])}function w(n,l,u){for(var t,i=n.__k,o=0;i&&o<i.length;o++)(t=i[o])&&(t.__=n,l="function"==typeof t.type?w(t,l,u):x(u,t,t,i,t.__e,l));return l}function x(n,l,u,t,i,o){var f,r,e;if(void 0!==l.__d)f=l.__d,l.__d=void 0;else if(null==u||i!=o||null==i.parentNode)n:if(null==o||o.parentNode!==n)n.appendChild(i),f=null;else{for(r=o,e=0;(r=r.nextSibling)&&e<t.length;e+=2)if(r==i)break n;n.insertBefore(i,o),f=o}return void 0!==f?f:i.nextSibling}function A(n,l,u,t,i){var o;for(o in u)"children"===o||"key"===o||o in l||$(n,o,null,u[o],t);for(o in l)i&&"function"!=typeof l[o]||"children"===o||"key"===o||"value"===o||"checked"===o||u[o]===l[o]||$(n,o,l[o],u[o],t)}function C(n,l,u){"-"===l[0]?n.setProperty(l,u):n[l]=null==u?"":"number"!=typeof u||s.test(l)?u:u+"px"}function $(n,l,u,t,i){var o;n:if("style"===l)if("string"==typeof u)n.style.cssText=u;else{if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||C(n.style,l,"");if(u)for(l in u)t&&u[l]===t[l]||C(n.style,l,u[l])}else if("o"===l[0]&&"n"===l[1])o=l!==(l=l.replace(/Capture$/,"")),l=l.toLowerCase()in n?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+o]=u,u?t||n.addEventListener(l,o?H:j,o):n.removeEventListener(l,o?H:j,o);else if("dangerouslySetInnerHTML"!==l){if(i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("href"!==l&&"list"!==l&&"form"!==l&&"tabIndex"!==l&&"download"!==l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null!=u&&(!1!==u||"a"===l[0]&&"r"===l[1])?n.setAttribute(l,u):n.removeAttribute(l))}}function j(n){this.l[n.type+!1](u.event?u.event(n):n)}function H(n){this.l[n.type+!0](u.event?u.event(n):n)}function I(n,l,t,i,o,f,r,e,c){var s,h,v,y,_,b,k,g,w,x,A,C,$,j=l.type;if(void 0!==l.constructor)return null;null!=t.__h&&(c=t.__h,e=l.__e=t.__e,l.__h=null,f=[e]),(s=u.__b)&&s(l);try{n:if("function"==typeof j){if(g=l.props,w=(s=j.contextType)&&i[s.__c],x=s?w?w.props.value:s.__:i,t.__c?k=(h=l.__c=t.__c).__=h.__E:("prototype"in j&&j.prototype.render?l.__c=h=new j(g,x):(l.__c=h=new d(g,x),h.constructor=j,h.render=N),w&&w.sub(h),h.props=g,h.state||(h.state={}),h.context=x,h.__n=i,v=h.__d=!0,h.__h=[]),null==h.__s&&(h.__s=h.state),null!=j.getDerivedStateFromProps&&(h.__s==h.state&&(h.__s=a({},h.__s)),a(h.__s,j.getDerivedStateFromProps(g,h.__s))),y=h.props,_=h.state,v)null==j.getDerivedStateFromProps&&null!=h.componentWillMount&&h.componentWillMount(),null!=h.componentDidMount&&h.__h.push(h.componentDidMount);else{if(null==j.getDerivedStateFromProps&&g!==y&&null!=h.componentWillReceiveProps&&h.componentWillReceiveProps(g,x),!h.__e&&null!=h.shouldComponentUpdate&&!1===h.shouldComponentUpdate(g,h.__s,x)||l.__v===t.__v){h.props=g,h.state=h.__s,l.__v!==t.__v&&(h.__d=!1),h.__v=l,l.__e=t.__e,l.__k=t.__k,l.__k.forEach(function(n){n&&(n.__=l)}),h.__h.length&&r.push(h);break n}null!=h.componentWillUpdate&&h.componentWillUpdate(g,h.__s,x),null!=h.componentDidUpdate&&h.__h.push(function(){h.componentDidUpdate(y,_,b)})}if(h.context=x,h.props=g,h.__v=l,h.__P=n,A=u.__r,C=0,"prototype"in j&&j.prototype.render)h.state=h.__s,h.__d=!1,A&&A(l),s=h.render(h.props,h.state,h.context);else do{h.__d=!1,A&&A(l),s=h.render(h.props,h.state,h.context),h.state=h.__s}while(h.__d&&++C<25);h.state=h.__s,null!=h.getChildContext&&(i=a(a({},i),h.getChildContext())),v||null==h.getSnapshotBeforeUpdate||(b=h.getSnapshotBeforeUpdate(y,_)),$=null!=s&&s.type===p&&null==s.key?s.props.children:s,m(n,Array.isArray($)?$:[$],l,t,i,o,f,r,e,c),h.base=l.__e,l.__h=null,h.__h.length&&r.push(h),k&&(h.__E=h.__=null),h.__e=!1}else null==f&&l.__v===t.__v?(l.__k=t.__k,l.__e=t.__e):l.__e=z(t.__e,l,t,i,o,f,r,c);(s=u.diffed)&&s(l)}catch(n){l.__v=null,(c||null!=f)&&(l.__e=e,l.__h=!!c,f[f.indexOf(e)]=null),u.__e(n,l,t)}}function T(n,l){u.__c&&u.__c(l,n),n.some(function(l){try{n=l.__h,l.__h=[],n.some(function(n){n.call(l)})}catch(n){u.__e(n,l.__v)}})}function z(n,u,t,i,o,f,r,c){var s,a,v,y=t.props,p=u.props,d=u.type,b=0;if("svg"===d&&(o=!0),null!=f)for(;b<f.length;b++)if((s=f[b])&&"setAttribute"in s==!!d&&(d?s.localName===d:3===s.nodeType)){n=s,f[b]=null;break}if(null==n){if(null===d)return document.createTextNode(p);n=o?document.createElementNS("http://www.w3.org/2000/svg",d):document.createElement(d,p.is&&p),f=null,c=!1}if(null===d)y===p||c&&n.data===p||(n.data=p);else{if(f=f&&l.call(n.childNodes),a=(y=t.props||e).dangerouslySetInnerHTML,v=p.dangerouslySetInnerHTML,!c){if(null!=f)for(y={},b=0;b<n.attributes.length;b++)y[n.attributes[b].name]=n.attributes[b].value;(v||a)&&(v&&(a&&v.__html==a.__html||v.__html===n.innerHTML)||(n.innerHTML=v&&v.__html||""))}if(A(n,p,y,o,c),v)u.__k=[];else if(b=u.props.children,m(n,Array.isArray(b)?b:[b],u,t,i,o&&"foreignObject"!==d,f,r,f?f[0]:t.__k&&_(t,0),c),null!=f)for(b=f.length;b--;)null!=f[b]&&h(f[b]);c||("value"in p&&void 0!==(b=p.value)&&(b!==n.value||"progress"===d&&!b||"option"===d&&b!==y.value)&&$(n,"value",b,y.value,!1),"checked"in p&&void 0!==(b=p.checked)&&b!==n.checked&&$(n,"checked",b,y.checked,!1))}return n}function L(n,l,t){try{"function"==typeof n?n(l):n.current=l}catch(n){u.__e(n,t)}}function M(n,l,t){var i,o;if(u.unmount&&u.unmount(n),(i=n.ref)&&(i.current&&i.current!==n.__e||L(i,null,l)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(n){u.__e(n,l)}i.base=i.__P=null}if(i=n.__k)for(o=0;o<i.length;o++)i[o]&&M(i[o],l,"function"!=typeof n.type);t||null==n.__e||h(n.__e),n.__e=n.__d=void 0}function N(n,l,u){return this.constructor(n,u)}function O(n,t,i){var o,f,r;u.__&&u.__(n,t),f=(o="function"==typeof i)?null:i&&i.__k||t.__k,r=[],I(t,n=(!o&&i||t).__k=v(p,null,[n]),f||e,e,void 0!==t.ownerSVGElement,!o&&i?[i]:f?null:t.firstChild?l.call(t.childNodes):null,r,!o&&i?i:f?f.__e:t.firstChild,o),T(r,n)}l=c.slice,u={__e:function(n,l,u,t){for(var i,o,f;l=l.__;)if((i=l.__c)&&!i.__)try{if((o=i.constructor)&&null!=o.getDerivedStateFromError&&(i.setState(o.getDerivedStateFromError(n)),f=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),f=i.__d),f)return i.__E=i}catch(l){n=l}throw n}},t=0,i=function(n){return null!=n&&void 0===n.constructor},d.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=a({},this.state),"function"==typeof n&&(n=n(a({},u),this.props)),n&&a(u,n),null!=n&&this.__v&&(l&&this.__h.push(l),k(this))},d.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),k(this))},d.prototype.render=p,o=[],g.__r=0,r=0,n.render=O,n.hydrate=function n(l,u){O(l,u,n)},n.createElement=v,n.h=v,n.Fragment=p,n.createRef=function(){return{current:null}},n.isValidElement=i,n.Component=d,n.cloneElement=function(n,u,t){var i,o,f,r=a({},n.props);for(f in u)"key"==f?i=u[f]:"ref"==f?o=u[f]:r[f]=u[f];return arguments.length>2&&(r.children=arguments.length>3?l.call(arguments,2):t),y(n.type,r,i||n.key,o||n.ref,null)},n.createContext=function(n,l){var u={__c:l="__cC"+r++,__:n,Consumer:function(n,l){return n.children(l)},Provider:function(n){var u,t;return this.getChildContext||(u=[],(t={})[l]=this,this.getChildContext=function(){return t},this.shouldComponentUpdate=function(n){this.props.value!==n.value&&u.some(k)},this.sub=function(n){u.push(n);var l=n.componentWillUnmount;n.componentWillUnmount=function(){u.splice(u.indexOf(n),1),l&&l.call(n)}}),n.children}};return u.Provider.__=u.Consumer.contextType=u},n.toChildArray=function n(l,u){return u=u||[],null==l||"boolean"==typeof l||(Array.isArray(l)?l.some(function(l){n(l,u)}):u.push(l)),u},n.options=u});
