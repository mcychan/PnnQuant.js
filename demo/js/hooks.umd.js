!function(n,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports,require("preact")):"function"==typeof define&&define.amd?define(["exports","preact"],t):t(n.preactHooks={},n.preact)}(this,function(n,t){var u,o,r,i,c=0,f=[],e=[],a=t.options.__b,v=t.options.__r,l=t.options.diffed,d=t.options.__c,p=t.options.unmount;function m(n,u){t.options.__h&&t.options.__h(o,n,c||u),c=0;var r=o.__H||(o.__H={__:[],__h:[]});return n>=r.__.length&&r.__.push({__V:e}),r.__[n]}function y(n){return c=1,s(b,n)}function s(n,t,r){var i=m(u++,2);return i.t=n,i.__c||(i.__=[r?r(t):b(void 0,t),function(n){var t=i.t(i.__[0],n);i.__[0]!==t&&(i.__=[t,i.__[1]],i.__c.setState({}))}],i.__c=o),i.__}function _(n,r){var i=m(u++,4);!t.options.__s&&T(i.__H,r)&&(i.__=n,i.u=r,o.__h.push(i))}function h(n,t){var o=m(u++,7);return T(o.__H,t)?(o.__V=n(),o.u=t,o.__h=n,o.__V):o.__}function q(){for(var n;n=f.shift();)if(n.__P)try{n.__H.__h.forEach(A),n.__H.__h.forEach(F),n.__H.__h=[]}catch(u){n.__H.__h=[],t.options.__e(u,n.__v)}}t.options.__b=function(n){o=null,a&&a(n)},t.options.__r=function(n){v&&v(n),u=0;var t=(o=n.__c).__H;t&&(r===o?(t.__h=[],o.__h=[],t.__.forEach(function(n){n.__V=e,n.u=void 0})):(t.__h.forEach(A),t.__h.forEach(F),t.__h=[])),r=o},t.options.diffed=function(n){l&&l(n);var u=n.__c;u&&u.__H&&(u.__H.__h.length&&(1!==f.push(u)&&i===t.options.requestAnimationFrame||((i=t.options.requestAnimationFrame)||function(n){var t,u=function(){clearTimeout(o),x&&cancelAnimationFrame(t),setTimeout(n)},o=setTimeout(u,100);x&&(t=requestAnimationFrame(u))})(q)),u.__H.__.forEach(function(n){n.u&&(n.__H=n.u),n.__V!==e&&(n.__=n.__V),n.u=void 0,n.__V=e})),r=o=null},t.options.__c=function(n,u){u.some(function(n){try{n.__h.forEach(A),n.__h=n.__h.filter(function(n){return!n.__||F(n)})}catch(o){u.some(function(n){n.__h&&(n.__h=[])}),u=[],t.options.__e(o,n.__v)}}),d&&d(n,u)},t.options.unmount=function(n){p&&p(n);var u,o=n.__c;o&&o.__H&&(o.__H.__.forEach(function(n){try{A(n)}catch(n){u=n}}),u&&t.options.__e(u,o.__v))};var x="function"==typeof requestAnimationFrame;function A(n){var t=o,u=n.__c;"function"==typeof u&&(n.__c=void 0,u()),o=t}function F(n){var t=o;n.__c=n.__(),o=t}function T(n,t){return!n||n.length!==t.length||t.some(function(t,u){return t!==n[u]})}function b(n,t){return"function"==typeof t?t(n):t}n.useState=y,n.useReducer=s,n.useEffect=function(n,r){var i=m(u++,3);!t.options.__s&&T(i.__H,r)&&(i.__=n,i.u=r,o.__H.__h.push(i))},n.useLayoutEffect=_,n.useRef=function(n){return c=5,h(function(){return{current:n}},[])},n.useImperativeHandle=function(n,t,u){c=6,_(function(){return"function"==typeof n?(n(t()),function(){return n(null)}):n?(n.current=t(),function(){return n.current=null}):void 0},null==u?u:u.concat(n))},n.useMemo=h,n.useCallback=function(n,t){return c=8,h(function(){return n},t)},n.useContext=function(n){var t=o.context[n.__c],r=m(u++,9);return r.c=n,t?(null==r.__&&(r.__=!0,t.sub(o)),t.props.value):n.__},n.useDebugValue=function(n,u){t.options.useDebugValue&&t.options.useDebugValue(u?u(n):n)},n.useErrorBoundary=function(n){var t=m(u++,10),r=y();return t.__=n,o.componentDidCatch||(o.componentDidCatch=function(n){t.__&&t.__(n),r[1](n)}),[r[0],function(){r[1](void 0)}]}});
