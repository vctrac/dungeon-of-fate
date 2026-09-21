Dungeon of Fate — modular card asset kit

card_reference_transparent.png — supplied design with near-black exterior/aperture made transparent.
card_outer_frame.png — fixed outer border + crest overlay.
card_artwork_frame_9slice.png — dynamic artwork-window border source; use CSS border-image/9-slice.
card_interior_texture.png — background texture for the dynamic card surface.
card_crest.png — optional independent crest/category overlay.

Recommended DOM stack:
interior texture -> clipped artwork container -> 9-slice artwork border -> text/die/action -> outer frame.

Resize the HTML artwork container between card states. Do not vertically scale the inner decorative
border as one bitmap; preserve its corners with border-image/9-slice.

Note: the uploaded source was RGB with black standing in for transparency. Transparency was therefore
derived from near-pure-black pixels. Inspect edges in-browser before treating these as final exports.
