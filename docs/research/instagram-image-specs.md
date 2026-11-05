# Instagram image specs and recompression

Research for [#2](https://github.com/christiankammerer/picturesque/issues/2), part of the map [#1](https://github.com/christiankammerer/picturesque/issues/1). Researched 2026-11-05. Terms (Post, Collage, Carousel, Slide, Seamless Carousel, Aspect Ratio) are used as defined in `GLOSSARY.md`.

**Trust levels used below**

- **Primary**: Meta/Instagram's own pages (Help Centre, developer docs, Instagram blog, Instagram Engineering blog). "Seen" is the date this research read it.
- **Primary via press**: a statement by Instagram staff (usually Adam Mosseri on Threads/Instagram) that I could only reach through press coverage.
- **Folklore**: community or blog consensus with no first-party backing. Treat it as a hypothesis to test, not a spec.

Caveat: help.instagram.com renders with JavaScript and could not be fetched directly. Help Centre text below comes from search-engine extracts of those pages, seen 2026-11-05. The developer docs were fetched directly.

---

## TL;DR

| Topic | Answer | Trust |
|---|---|---|
| Feed width, in-app upload | Stored at up to **1080 px** wide. Wider images are scaled down, images narrower than 320 px are scaled up. | Primary (Help Centre) |
| Feed width, API publishing | Accepts up to **1440 px** wide (scaled down above that), min 320. JPEG only, 8 MB max. | Primary (Graph API) |
| Feed aspect-ratio range | **1.91:1 to 3:4** (newer Help Centre text, matches the May 2025 3:4 launch). Older text and the Graph API still say 1.91:1 to 4:5. Anything outside the range is cropped. | Primary, but the sources conflict |
| 9:16 in the feed | **Not a feed photo ratio.** A 9:16 image posted to the feed is cropped to the tallest allowed ratio (3:4 or 4:5). 9:16 (1080x1920) is the Stories/Reels format. | Primary (implied by the ratio range), plus ads specs |
| Max Slides per Carousel | **20** (since Aug 2024; previously 10). | Primary (Graph API) and press |
| Mixed Aspect Ratios in one Carousel | **No.** In the app, the chosen orientation applies to every item. Via the API, every image is cropped to the first image's ratio. | Primary |
| Format | Upload JPEG (the only format the API accepts). The app accepts whatever the phone gallery holds, but everything is re-encoded. | Primary (API), Folklore (app internals) |
| Colour space | **sRGB.** The API converts other colour spaces to sRGB. The iOS app has supported Display P3 since 2017, but you can't count on P3 reaching every viewer. | Primary |
| Profile grid | **3:4 portrait tiles, centre-cropped** (since Jan 2025). The thumbnail crop can be adjusted after posting. | Primary via press |

**Recommended export defaults for Picturesque**: sRGB JPEG with an embedded sRGB ICC profile, **1080 px wide**, quality around 90 to 95, metadata stripped, well under 8 MB. Heights: 1080 (1:1), 1350 (4:5), 1440 (3:4), 1920 (9:16, Stories only). See the [Recommendation](#recommendation-for-export-settings) section.

---

## 1. Pixel dimensions and Aspect Ratios

### In-app uploads (Help Centre)

"Image resolution of photos you share on Instagram", https://help.instagram.com/1631821640426723 (seen 2026-11-05 via search extracts):

- "When you share a photo on Instagram, regardless of whether you're using Instagram for iPhone or Android, we make sure to upload it at the best quality resolution possible (up to a width of 1080 pixels)."
- Photos narrower than 320 px are enlarged to 320 px wide. Photos wider than 1080 px are sized down to 1080 px.
- Current extract: photos keep their original resolution when the aspect ratio is **between 1.91:1 and 3:4**, i.e. 1080 px wide and 566 to 1440 px tall.
- An older extract of the same page, and a related Help Centre snippet, give the range as **1.91:1 to 4:5** (566 to 1350 px tall). The 3:4 version is the newer one. It matches the 3:4 rollout below.
- "If the aspect ratio of your photo isn't supported, it will be cropped to fit a supported ratio."

### 3:4 support (May 2025)

- Adam Mosseri announced on Threads, around 2025-05-29, that feed photos (single and Carousel) now support **3:4**, the native ratio of most phone cameras, on iOS and Android. Width stays at 1080, so a 3:4 Post is **1080x1440**. *Primary via press*: [PetaPixel, 2025-05-29](https://petapixel.com/2025/05/29/instagram-finally-adds-support-for-34-aspect-ratio-photos), [exchange4media, 2025-05-31](https://www.exchange4media.com/digital-news/instagram-introduces-34-aspect-ratio-for-photo-uploads-143973.html).
- So the "1440" in the ticket's question means two things: **1440 px tall** for a 3:4 Post at the standard 1080 width, and the **1440 px max width** that applies only to API publishing (next section).

### API publishing (Graph API, fetched 2026-11-05)

[IG User Media reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media), image specifications:

- Format: JPEG. File size: 8 MB maximum.
- Aspect ratio: "Must be within a 4:5 to 1.91:1 range". The API doc hasn't been updated for 3:4.
- Minimum width 320 (scaled up), **maximum width 1440** (scaled down).
- Colour space: "sRGB. Images using other color spaces will have their color spaces converted to sRGB."

[Content Publishing guide](https://developers.facebook.com/docs/instagram-platform/content-publishing) (fetched 2026-11-05): "JPEG is the only image format supported. Extended JPEG formats such as MPO and JPS are not supported."

Is 1440 wide worth exporting for app users? **Folklore says no.** Many guides report that in-app uploads still end up at 1080 wide, which agrees with the Help Centre. No first-party source says a 1440-wide in-app upload is stored or shown at more than 1080. Picturesque doesn't post through the API (out of scope in #1), so 1080 is the relevant limit.

### 9:16

- Nothing first-party lists 9:16 as a feed photo ratio. The feed range tops out at 3:4 (or 4:5), so a 9:16 image in a feed Post or Carousel gets cropped.
- 9:16 at **1080x1920** is the Stories/Reels canvas. Meta's carousel ad specs list "1:1 or 4:5 (Feed), 9:16 (Stories)" with a 1% ratio tolerance (Meta Business Help Centre, https://www.facebook.com/business/help/1114358518575630, seen 2026-11-05 via search extract). The 1080x1920 number for organic Stories is **folklore**: every source agrees on it, but I found no Help Centre page stating it.
- **Consequence for the map:** a "9:16 Carousel" can't be posted as a feed Carousel without cropping. 9:16 output only fits Stories (one image per Story frame, no swipeable Carousel). Meanwhile **3:4 is now a native feed ratio** and isn't in the glossary.

## 2. Carousels

- **Max 20 items.** Graph API: "Carousels can have up to 20 total images, videos, or a mix of the two." Content Publishing guide: "Carousels are limited to 20 images, videos, or a mix of the two." (both fetched 2026-11-05). The in-app limit went from 10 to 20 on 2024-08-08. *Press*: [PetaPixel, 2024-08-09](https://petapixel.com/2024/08/09/instagram-users-can-now-share-20-photos-videos-in-a-post-carousel-photodump). I didn't find the original Instagram announcement page.
- **No mixed Aspect Ratios.**
  - API: "Carousel images are all cropped based on the first image in the carousel, with the default being a 1:1 aspect ratio." ([Content Publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing), fetched 2026-11-05)
  - App: the Help Centre article on sharing multiple photos says the orientation you pick (square, portrait or landscape) applies to every photo and video in the Post, and you can't choose a different one per item. You can only reposition each item inside the shared frame. (help.instagram.com, seen 2026-11-05 via search extract)
  - This matches the glossary rule that all Slides share the Post's Aspect Ratio.
- History: multi-photo Posts launched square-only, and portrait/landscape came later ([Instagram blog, "Share up to 10 photos and videos in one post"](https://about.instagram.com/blog/announcements/new-share-up-to-10-photos-and-videos-in-one-post), 2017).

## 3. Colour space

- **sRGB is the safe target.** The Graph API converts everything to sRGB (see above).
- Instagram has displayed and captured Display P3 on iOS since January 2017. The backend serves a wide-gamut rendition to clients whose User-Agent says they support it. *Primary*: Mike Krieger, ["Bringing wide color to Instagram"](https://instagram-engineering.com/bringing-wide-color-to-instagram-5a5481802d7d), Instagram Engineering, 2017-01-09. I read search extracts, not the full article. Whether this still holds in 2026, and whether Android or the web keep P3, is **unverified**.
- Practical upshot: P3 might survive for some iPhone viewers, but most surfaces are sRGB, and an untagged P3 file looks dull or shifted. Picturesque is offline and colour-adjustment is out of scope, so it should convert to sRGB and embed the profile.

## 4. Format, quality and recompression

**Primary facts**

- Instagram stores and serves its own re-encoded copies. It resizes to 1080 wide (Help Centre) and converts to sRGB (Graph API). No first-party source publishes the encoder, quality level or file-size targets.
- The API takes JPEG only, up to 8 MB.
- The app has an **"Upload at highest quality"** setting (Settings and privacy, then Data usage and media quality). Instagram uploads at reduced quality when the toggle is off and the connection is poor. The setting is widely documented, but I didn't fetch its Help Centre page, so the exact menu path is unverified.

**Folklore (no first-party backing; treat as hypotheses)**

- Export at **exactly 1080 px wide** so Instagram doesn't resample. You control the downscale filter and any output sharpening, and Instagram's own resize is said to soften images. This agrees with the Help Centre, but whether it improves quality is folklore.
- Instagram re-encodes every upload, even one that is already 1080 wide and small. So uploading at quality 100 doesn't carry through. Quality around 85 to 95 is enough, and anything higher just adds upload size.
- Instagram reportedly serves JPEG, WebP or newer formats depending on the client. PNG or WebP uploads gain nothing, because they're converted anyway, and PNG transparency is lost.
- Smooth gradients, fine noise and fine text get hit hardest. Adding a little grain or dither and avoiding hairline details helps.
- Chroma subsampling (4:4:4 vs 4:2:0) on upload makes little difference after re-encoding. Saturated red or blue edges, like thin coloured text, smear either way.
- Some guides claim a "safe" file-size ceiling (figures like 1 to 1.6 MB) under which Instagram compresses less. I found no source for these numbers.

## 5. Profile grid preview

- Since **January 2025** the profile grid uses **3:4 portrait tiles**. Every Post's first image is **centre-cropped** to 3:4, whatever its ratio. Mosseri's reason was that most uploads are vertical. *Primary via press* (Mosseri's announcement, reported e.g. by Engadget on 2025-01-18. Testing was first mentioned in Aug 2024).
- Users can adjust the grid thumbnail crop after posting (*press*, early 2025). The default is centre.
- The grid tile is a crop, not a separate upload size. So, for a 1080-wide export:
  - **3:4 (1080x1440)**: shown whole, no crop.
  - **4:5 (1080x1350)**: about 34 px trimmed from each side (about 1013x1350 visible).
  - **1:1 (1080x1080)**: about 135 px trimmed from each side (810x1080 visible). Text near the side edges of a square Post gets cut off.
  - **9:16**: already cropped to 3:4 (or 4:5) in the feed, then shown as 3:4 in the grid.
- For a **Seamless Carousel**, the grid shows only the centre of Slide 1. Content that crosses the Slide 1/2 seam is likely off-tile.
- The "1013x1350" grid figure some guides quote is folklore. It's just the visible 3:4 portion of a 4:5 Post, not a spec.

## Recommendation for export settings

1. **Encoding**: baseline or progressive JPEG, quality **92** (user-adjustable from about 85 to 95), sRGB with an embedded ICC profile, EXIF/GPS stripped, file size well under 8 MB.
2. **Width**: always **1080 px**. Picturesque resizes with a high-quality filter (e.g. Lanczos) and optionally adds light output sharpening, so Instagram never has to resample. Don't offer 1440-wide export for in-app posting. At most, make it an advanced option labelled "for API/scheduler tools".
3. **Sizes per Aspect Ratio**: 1:1 = 1080x1080. 4:5 = 1080x1350. **3:4 = 1080x1440** (recommended addition). 9:16 = 1080x1920, but it's Stories-only, not a feed Carousel ratio.
4. **Carousels**: at most 20 Slides, all with one Aspect Ratio (already in the glossary). The editor should warn above 20.
5. **Grid-safe overlay**: the editor should show the 3:4 centre-crop region on the first image of every Post (and on Slide 1 of a Seamless Carousel).
6. **Map follow-ups** (for #1, not decided here): (a) add 3:4 as a supported Aspect Ratio; (b) decide what 9:16 means, either "Stories export only" or drop it for Carousels.

## Sources

- Instagram Help Centre, "Image resolution of photos you share on Instagram", https://help.instagram.com/1631821640426723 (seen 2026-11-05 via search extracts)
- Instagram Help Centre, sharing multiple photos/videos in one post (Posting help section, https://help.instagram.com/488619974671134) (seen 2026-11-05 via search extracts)
- Meta for Developers, IG User Media reference, https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media (fetched 2026-11-05)
- Meta for Developers, Content Publishing, https://developers.facebook.com/docs/instagram-platform/content-publishing (fetched 2026-11-05)
- Meta Business Help Centre, Design specifications for carousel ads, https://www.facebook.com/business/help/1114358518575630 (seen 2026-11-05 via search extract)
- Instagram blog, "Introducing landscape and portrait formats", 2015-08-27, https://about.instagram.com/blog/announcements/introducing-landscape-and-portrait-formats-on-instagram
- Instagram blog, "Share up to 10 photos and videos in one post", 2017, https://about.instagram.com/blog/announcements/new-share-up-to-10-photos-and-videos-in-one-post
- Instagram Engineering, "Bringing wide color to Instagram", 2017-01-09, https://instagram-engineering.com/bringing-wide-color-to-instagram-5a5481802d7d
- PetaPixel, 20-item carousels, 2024-08-09, https://petapixel.com/2024/08/09/instagram-users-can-now-share-20-photos-videos-in-a-post-carousel-photodump
- PetaPixel, 3:4 support, 2025-05-29, https://petapixel.com/2025/05/29/instagram-finally-adds-support-for-34-aspect-ratio-photos
- exchange4media, 3:4 support, 2025-05-31, https://www.exchange4media.com/digital-news/instagram-introduces-34-aspect-ratio-for-photo-uploads-143973.html
- Kapwing, profile grid 3:4 overview, https://www.kapwing.com/resources/instagrams-new-grid-layout-size-and-dimensions-2025/ (secondary, used only for grid-change dating)
