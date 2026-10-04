# The Mama Budget mark

Three options drawn in the house colours only (cream, ink, gele green, gold), none of them her face. She is the character; this is the product.

- `c-m-meter.svg`: a heavy M whose last stem is the gele meter, gold cap. Installed as the extension icon.
- `a-ring-meter.svg`: the store page badge without her: gold ring, meter to the left. Best at 48 and above.
- `b-envelope.svg`: the weekly envelope tied with a gele band and a gold knot. Best story, weakest at 16.

To install another one, from the repo root:

```
for n in 16 32 48 96 128; do inkscape design/icon/a-ring-meter.svg -w $n -h $n -o apps/extension/public/icon/$n.png; done
```

Then build and reload the extension. WXT picks up `public/icon/*.png` by name.
