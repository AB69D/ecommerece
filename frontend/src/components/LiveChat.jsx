"use client";
import Script from "next/script";

export default function LiveChat({ liveChat }) {
    if (!liveChat?.enabled || !liveChat?.propertyId || liveChat?.provider === "none") return null;

    if (liveChat.provider === "tawkto") {
        const id = liveChat.propertyId;
        return (
            <Script
                id="tawkto-chat"
                strategy="lazyOnload"
                dangerouslySetInnerHTML={{
                    __html: `
var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/${id}/default';
s1.charset='UTF-8';
s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);
})();`,
                }}
            />
        );
    }

    if (liveChat.provider === "crisp") {
        const id = liveChat.propertyId;
        return (
            <Script
                id="crisp-chat"
                strategy="lazyOnload"
                dangerouslySetInnerHTML={{
                    __html: `
window.$crisp=[];window.CRISP_WEBSITE_ID="${id}";
(function(){
var d=document;var s=d.createElement("script");
s.src="https://client.crisp.chat/l.js";
s.async=1;d.getElementsByTagName("head")[0].appendChild(s);
})();`,
                }}
            />
        );
    }

    return null;
}
