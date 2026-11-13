"use client";

export function NonceScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){
          var isStorageLike=function(value){
            return !!value && typeof value.getItem==="function" && typeof value.setItem==="function" && typeof value.removeItem==="function";
          };
          var s=function(e){
            var msg=(e.message||e.reason?.message||"").toLowerCase();
            if(msg.includes("storage")||msg.includes("access")||msg.includes("zap")||msg.includes("clock")||msg.includes("extension")||msg.includes("cactus")){
              if(e.stopImmediatePropagation)e.stopImmediatePropagation();
              if(e.preventDefault)e.preventDefault();
              return true;
            }
          };
          window.addEventListener("error",s,true);
          window.addEventListener("unhandledrejection",s,true);

          var f=function(a){if(!a || typeof a!=="string")return false;var s=a.toLowerCase();return s.includes("zustand")||s.includes("deprecated")||s.includes("extension")||s.includes("storage")||s.includes("access")||s.includes("zap")||s.includes("clock")||s.includes("cactus");};
          var ow=console.warn;console.warn=function(){if(f(arguments[0]))return;ow.apply(console,arguments)};
          var oe=console.error;console.error=function(){if(f(arguments[0]))return;oe.apply(console,arguments)};
          var ol=console.log;console.log=function(){if(f(arguments[0]))return;ol.apply(console,arguments)};
        })();`
      }}
    />
  );
}