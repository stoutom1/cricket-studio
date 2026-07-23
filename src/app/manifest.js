export default function manifest() {
  return {
    name: "Cric4All",
    short_name: "Cric4All",

    description:
      "Cricket scoring, live scores, league management and player statistics.",

    start_url: "/",
    scope: "/",

    display: "standalone",

    background_color: "#111827",
    theme_color: "#111827",

    orientation: "portrait-primary",

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
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}