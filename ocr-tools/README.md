# OCR translation

These tools are for translating scanned manuals or other OCR'd materials.

The pipeline is (1) scan to images (this is up to you), (2) OCR them, (3)
adjoin connected OCR'd segments into paragraphs, (4) translate, (5)
reconstitute a PDF from the scans.

Parts of this pipeline are based on the binary translation tools in `../tools`,
so you should familiarize yourself with them first.


## config.json

Before using any of these tools, you must set up config.json. See
config.json.example for an example of how to set it up.


## ocr.mjs

Run this to OCR images. Give images as arguments, e.g.
`./ocr-tools/ocr.mjs manual/*.png`. Writes to `strings.json`.

You should check that `strings.json` is basically correct, and remove any false
positives, before moving on.

`ocr.mjs` uses EasyOCR, via `eocr.py`. You must install it, e.g. with
`pip install -r requirements.txt`. This can be done in a Python virtual
environment (venv), if preferred.


## Combining

The OCR step uses EasyOCR's paragraphization, but it's imperfect. You need to
combine connected groups for the translation to work well. This is a manual
step.


## ../tools/trans.mjs

Use the normal binary translation `trans.mjs` for translation.


## reconstitute-pdf.mjs

Run this to make a PDF from the scans and translations in `strings.json`. Give
images as arguments, e.g. `./ocr-tools/reconstitute-pdf.mjs manual/*.png`.
Writes to `out.pdf`.
