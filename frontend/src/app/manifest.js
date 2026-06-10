// PWA web app manifest (served at /manifest.webmanifest). Serving it is
// harmless when the PWA feature is off — installability is actually driven by
// the service worker, which is only registered when features.pwa is enabled.
export default function manifest() {
    return {
        name: "Store POS & Shop",
        short_name: "Store POS",
        description: "Point-of-sale terminal and online store.",
        start_url: "/pos",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#0f172a",
        theme_color: "#0f766e",
        icons: [
            {
                src: "/icons/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icons/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icons/maskable-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
