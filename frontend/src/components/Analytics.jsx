import Script from "next/script";

// Injects the admin-configured web-analytics tags into the storefront.
//
// Rendered from the root layout and gated by the "Web analytics" feature flag
// plus the presence of each ID, so nothing loads until an admin opts in. The
// three networks are independent — configure only the ones you use.
//
//   gtmId        → Google Tag Manager  (GTM-XXXXXXX)
//   ga4Id        → Google Analytics 4  (G-XXXXXXXXXX)
//   metaPixelId  → Meta / Facebook Pixel
export default function Analytics({ enabled, gtmId, ga4Id, metaPixelId }) {
    if (!enabled) return null;

    const hasGtm = Boolean(gtmId);
    const hasGa4 = Boolean(ga4Id);
    const hasPixel = Boolean(metaPixelId);
    if (!hasGtm && !hasGa4 && !hasPixel) return null;

    return (
        <>
            {hasGtm && (
                <>
                    <Script id="gtm-init" strategy="afterInteractive">
                        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
                    </Script>
                    <noscript>
                        <iframe
                            src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
                            height="0"
                            width="0"
                            style={{ display: "none", visibility: "hidden" }}
                            title="gtm"
                        />
                    </noscript>
                </>
            )}

            {hasGa4 && (
                <>
                    <Script
                        src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
                        strategy="afterInteractive"
                    />
                    <Script id="ga4-init" strategy="afterInteractive">
                        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4Id}');`}
                    </Script>
                </>
            )}

            {hasPixel && (
                <>
                    <Script id="meta-pixel" strategy="afterInteractive">
                        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${metaPixelId}');
fbq('track', 'PageView');`}
                    </Script>
                    <noscript>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            height="1"
                            width="1"
                            style={{ display: "none" }}
                            alt=""
                            src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
                        />
                    </noscript>
                </>
            )}
        </>
    );
}
