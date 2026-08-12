#!/usr/bin/env node
/*
 * Copyright (c) 2026 Yahweasel
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED “AS IS” AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

import * as fs from "fs/promises";

import fontkit from "@pdf-lib/fontkit";
import * as pdfLib from "pdf-lib";
import sharp from "sharp";

const config = JSON.parse(await fs.readFile("config.json", "utf8"));

const LINE_HEIGHT_FACTOR = 1.15;
const FONT_SCALE_FACTOR = Math.pow(0.5, 1/8);

function wrapLines(text, font, fontSize, maxWidth) {
    const inLines = text.split("\n");
    const words = inLines.map(x => x.trim().split(/\s+/));
    const lines = [];
    let line = "";

    for (const inLine of words) {
        for (const word of inLine) {
            const candidate = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
                line = candidate;
                continue;
            }

            // Split here
            lines.push(line);
            line = word;
        }
        if (line) {
            lines.push(line);
            line = "";
        }

        if (inLine.length === 1 && !inLine[0]) {
            // This was a blank line
            lines.push("");
        }
    }

    // Split any overly long lines
    for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (font.widthOfTextAtSize(line, fontSize) <= maxWidth)
            continue;

        let bk = line.length;
        for (
            ;
            bk > 4 && font.widthOfTextAtSize(line.slice(0, bk), fontSize) > maxWidth;
            bk--
        ) {}

        lines.splice(li, 1, line.slice(0, bk), line.slice(bk));
    }

    return lines;
}

function fitText(text, font, boxWidth, boxHeight) {
    const minFont = 6, maxFont = boxHeight;

    let best = { size: minFont, lines: wrapLines(text, font, minFont, boxWidth) };

    for (
        let size = maxFont;
        size >= minFont;
        size = Math.min(
            size - 1,
            Math.round(size * FONT_SCALE_FACTOR)
        )
    ) {
        const lines = wrapLines(text, font, size, boxWidth);
        const totalHeight = lines.length * size * LINE_HEIGHT_FACTOR;
        best = { size, lines };
        if (totalHeight <= boxHeight)
            break;
    }

    return best;
}

async function main() {
    const pageFiles = process.argv.slice(2);
    const strings = JSON.parse(await fs.readFile("strings.json", "utf8"));

    const pdf = await pdfLib.PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(await fs.readFile(config.font), { subset: true });

    // Group strings by page
    const byPage = Object.create(null);
    for (const string of strings) {
        const en = string.en2 || string.en || string.string;
        if (en === "ERROR") continue;
        const idx = pageFiles.indexOf(string.file);
        if (idx < 0) continue;
        byPage[idx] = byPage[idx] || [];
        byPage[idx].push(string);
    }

    // For each page
    for (let pi = 0; pi < pageFiles.length; pi++) {
        const pageFile = pageFiles[pi];
        console.log(`${pageFile}...`);

        let img = await fs.readFile(pageFile);
        let width, height;
        {
            const s = sharp(img);
            const m = await s.metadata();
            width = m.width;
            height = m.height;
            img = await s.toFormat("jpeg", {quality: 91}).toBuffer();
        }

        const embed = await pdf.embedJpg(img);
        const page = pdf.addPage([width, height]);
        page.drawImage(embed, { x: 0, y: 0, width, height });

        for (const string of byPage[pi] || []) {
            const en = string.en2 || string.en || string.string;
            if (en === "ERROR")
                continue;

            const x = string.bbox[0];
            const y = height - string.bbox[3];
            const w = string.bbox[2] - string.bbox[0];
            const h = string.bbox[3] - string.bbox[1];

            // Cover the original
            page.drawRectangle({
                x, y, width: w, height: h,
                color: pdfLib.rgb(1, 1, 1),
                opacity: 0.85
            });

            // Fit it
            const { size, lines } = fitText(en, font, w, h);
            let cursorY = y + h - size;
            for (const line of lines) {
                page.drawText(line, {
                    x, y: cursorY, size, font, color: pdfLib.rgb(0, 0, 0)
                });
                cursorY -= size * LINE_HEIGHT_FACTOR;
            }
        }
    }

    /*

      // 2) lay out the translated text, top-aligned within the box
      const { size, lines } = fitText(text, font, boxW, boxH);
      let cursorY = boxTop - BOX_PADDING - size; // baseline of first line
      for (const line of lines) {
        if (cursorY < boxBottom - BOX_PADDING) break; // safety: don't draw outside box
        page.drawText(line, {
          x: x + BOX_PADDING,
          y: cursorY,
          size,
          font,
          color: rgb(0, 0, 0),
        });
        cursorY -= size * LINE_HEIGHT_FACTOR;
      }
    }
  }

  fs.writeFileSync(OUT_PATH, await pdfDoc.save());
  console.log(`wrote ${OUT_PATH}`);
    */

    await fs.writeFile("out.pdf", await pdf.save());
}

await main();
