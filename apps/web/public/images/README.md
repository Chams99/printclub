# printclub visual assets

The five WebP assets in this folder were generated for the printclub portfolio demo on 2026-09-19. They are original project assets with no third-party logos, text, or watermarks. The source PNGs were converted to WebP for a smaller storefront payload.

Use these assets as demo photography only. Before a commercial launch, replace them with commissioned or explicitly licensed photography and record the license, photographer, and permitted uses in this manifest.

## Generated size variants

Files ending in `-480w`, `-768w`, or `-1024w` are smaller copies of the originals, written by `bun run images:variants` (see `scripts/generate-image-variants.ts`). Pages pick between them with `srcset` via `responsiveImage()` in `src/lib/images.ts`. Regenerate them whenever an original changes, and register new photos in that file.
