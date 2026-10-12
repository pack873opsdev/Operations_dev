# Website images

These are the original images extracted without alteration from the website's embedded image data.

- `pack873-logo.png`: Pack 873 logo.
- `page-background.jpg`: page background artwork.
- `hero-*.png`: six rotating hero banners.
- `event-*.jpg`: four event pictures.
- `gallery-*.jpg`: four gallery pictures.

The live `index.html` references these files using relative paths. Keep this folder with the page when deploying to Cloudflare Pages. `manifest.json` records each file's size and SHA-256 hash for checking original image integrity.

The historical baseline HTML is preserved as originally committed, with its embedded images.
