Dungeon of Fate — Card presentation assets (V2.23.2)

assets/ui/card-frame.webp — complete Full Card transparent overlay, 1024×1536 (2:3).
assets/ui/card-frame-small.webp — dedicated Archive Mini Card overlay, 1024×1536 (2:3).
assets/ui/card_interior_texture.png — fill behind transparent upper area/fallback art.
assets/cards/ — category-grouped WebP artwork, mapped in Card metadata.
assets/icons/ — PWA icons.

Full Card: crest at 5%; title at 14%; artwork x 7.5%, y 19%, width 85%, height 46%.
Lower dynamic HTML starts at 68%. Crop with object-fit: cover, centered by default.
Archive Mini Cards use their own simple geometry/DOM; do not shrink gameplay DOM.

The prior card_outer_frame.png, card_artwork_frame_9slice.png and card_crest.png
remain reference assets, but are no longer runtime or precache dependencies.
The complete frame now supplies the border/panel; no stretchable slicing is needed.
No card_reference_transparent.png exists in current HEAD.

Healing Flask's uploaded filename is healimg-flask.webp (intentional path spelling).
Frame exports contain minor colored exterior edge fringes; inspect on real devices.
