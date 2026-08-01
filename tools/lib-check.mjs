/*
 * Copyright (c) 2025, 2026 Yahweasel
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

import * as legacy from "legacy-encoding";

export function specials(str, re) {
    return (str.match(re) || []).join(",");
}

export function check(string, config) {
    let encoding = string.enc;
    if (!encoding)
        encoding = config.encoding;
    if (encoding instanceof Array)
        encoding = encoding[0];

    const stringLen = string.end - string.start;

    const en = string.en2 || string.en;
    if (en.trim() === "ERROR")
        return null;
    const enc = legacy.encode(
        en.replace(/’/g, "'"), encoding
    );

    // Check the specials
    //const origSpecials = specials(string.string, /[\x1b%]./g);
    //const enSpecials = specials(en, /[\x1b%]./g);
    const origSpecials = specials(string.string, /%./g);
    const enSpecials = specials(en, /%./g);
    if (origSpecials !== enSpecials)
        return "SPECIALS";

    // Check encodability
    const thruEnc = legacy.decode(legacy.encode(en, encoding), encoding);
    if (thruEnc !== en)
        return "UNENCODEABLE";

    // Check if it even fits
    if (enc.length > stringLen)
        return "LENGTH";

    // Check if it's untranslated
    if (/\p{Lo}/u.test(en))
        return "UNTRANSLATED";

    return null;
}
