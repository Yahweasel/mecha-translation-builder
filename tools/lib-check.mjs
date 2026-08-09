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

export const specialsRe =
    /(\u001b.|[\u0000-\u0008\u000b\u000c\u000e-\u001f]|%.)/g;

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

    // Check if it's untranslated
    if (/\p{Lo}/u.test(en)) {
        return {
            warn: "UNTRANSLATED",
            msg: "I need a fully English string. Give me the English translation."
        };
    }

    // Check the specials
    const origSpecials = specials(string.string, specialsRe);
    const enSpecials = specials(en, specialsRe);
    if (origSpecials !== enSpecials) {
        return {
            warn: "SPECIALS",
            msg: `The special sequences in your translation are incorrect. The exact same sequence of special sequences must be in your translation, even if that makes the translation awkward.\n\nSpecial sequences in the original string: ${JSON.stringify(origSpecials)}.\nSpecial sequences in your string: ${JSON.stringify(enSpecials)}.\n\nProvide a correct translation with the special sequences intact.`
        };
    }

    // Check encodability
    const thruEnc = legacy.decode(legacy.encode(en, encoding), encoding);
    if (thruEnc !== en) {
        let i;
        let bad = null;
        for (i = 0; i < en.length; i++) {
            if (en[i] !== thruEnc[i]) {
                bad = en[i];
                break;
            }
        }
        return {
            warn: "UNENCODEABLE",
            msg: `The character ${JSON.stringify(bad)} is not encodeable in this system. Rephrase to avoid it.`
        };
    }

    // Check if it even fits
    if (enc.length > stringLen) {
        return {
            warn: "LENGTH",
            msg: "Too long. Shorten and/or abbreviate."
        };
    }

    return null;
}
