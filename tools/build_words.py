#!/usr/bin/env python3
"""Genera words/{lang}.json: todas las formas de Hunspell (LibreOffice) + las comunes según wordfreq.

Uso: tools/.venv/bin/python tools/build_words.py es en fr
"""
import json
import sys
import unicodedata
import urllib.request
from pathlib import Path

import wordfreq
from spylls.hunspell import Dictionary
from spylls.hunspell.algo.capitalization import Type

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / 'tools' / 'sources'
LIBRE = 'https://raw.githubusercontent.com/LibreOffice/dictionaries/master/'
# idioma: (alfabeto, diccionario sin extensión, tienen que entrar, tienen que quedar afuera)
LANGS = {
    'es': ('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'es/es_ES', ['CASAS', 'COMI', 'DAMELO', 'ÑANDU'], ['NUGENT', 'KWH', 'PARTY']),
    'en': ('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'en/en_US', ['CATS', 'RUNNING', 'QUIZZES'], ['NUGENT', 'KWH', 'GPS']),
    'fr': ('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'fr_FR/dictionaries/fr', ['CHEVAUX', 'MANGEAIENT', 'ETE'], ['NUGENT', 'KWH', 'PARTY']),
}
MIN_LEN, MAX_LEN = 3, 12
N_COMMON = 20_000
TOP_FREQ = 300_000  # palabras de wordfreq que se recorren para ordenar las comunes


def normalize(word, lang):
    word = word.lower()
    if lang == 'es':
        word = word.replace('ñ', '\0')
    word = ''.join(c for c in unicodedata.normalize('NFD', word) if not unicodedata.combining(c))
    return word.replace('\0', 'ñ').upper()


def dictionary(path):
    base = SOURCES / Path(path).name
    for ext in ('.dic', '.aff'):
        local = base.with_suffix(ext)
        if not local.exists():
            SOURCES.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(LIBRE + path + ext, local)
    return Dictionary.from_files(str(base))


def apply_sfx(word, s):
    if s.cond_regexp.search(word) and word.endswith(s.strip):
        return word[:len(word) - len(s.strip)] + s.add


def apply_pfx(word, p):
    if p.cond_regexp.search(word) and word.startswith(p.strip):
        return p.add + word[len(p.strip):]


def expand(d):
    """Todas las formas del diccionario: raíz, +sufijo, +sufijo encadenado, +prefijo y prefijo×sufijo."""
    aff = d.aff
    skip = {f for f in (aff.FORBIDDENWORD, aff.ONLYINCOMPOUND) if f}
    needs_affix = lambda flags: aff.NEEDAFFIX and aff.NEEDAFFIX in flags
    for w in d.dic.words:
        if w.captype != Type.NO or w.flags & skip:  # con mayúscula = nombre propio
            continue
        if not needs_affix(w.flags):
            yield w.stem
        suffixed = []
        for flag in w.flags:
            for s in aff.SFX.get(flag, []):
                form = apply_sfx(w.stem, s)
                if form is None:
                    continue
                if not needs_affix(s.flags):
                    yield form
                suffixed.append((form, s))
                for flag2 in s.flags:  # sufijo encadenado: enclíticos del español (DAME -> DAMELO)
                    for s2 in aff.SFX.get(flag2, []):
                        if form2 := apply_sfx(form, s2):
                            yield form2
        for flag in w.flags:
            for p in aff.PFX.get(flag, []):
                if form := apply_pfx(w.stem, p):
                    yield form
                if p.crossproduct:
                    for form, s in suffixed:
                        if s.crossproduct and (form2 := apply_pfx(form, p)):
                            yield form2


def build(lang):
    alphabet, dic, must_in, must_out = LANGS[lang]
    ok = lambda w: MIN_LEN <= len(w) <= MAX_LEN and all(c in alphabet for c in w)

    blocklist = (ROOT / 'tools' / 'blocklist' / f'{lang}.txt').read_text(encoding='utf-8')
    blocked = {normalize(l.strip(), lang) for l in blocklist.splitlines() if l.strip()}

    valid = {n for form in expand(dictionary(dic)) if ok(n := normalize(form, lang)) and n not in blocked}

    common = {}  # dict: conserva el orden de frecuencia
    for w in wordfreq.top_n_list(lang, TOP_FREQ):
        n = normalize(w, lang)
        if n in valid:
            common.setdefault(n)
            if len(common) == N_COMMON:
                break

    data = {'alphabet': alphabet, 'valid': sorted(valid), 'common': sorted(common)}
    blob = json.dumps(data, ensure_ascii=False, separators=(',', ':'))

    assert all(ok(w) for w in valid), 'palabra con largo o letras inválidas'
    assert set(common) <= valid, 'common no está incluida en valid'
    assert not valid & blocked, 'palabra bloqueada'
    assert len(common) >= 10_000, f'muy pocas comunes: {len(common)}'
    assert len(blob.encode()) < 8_000_000, f'JSON demasiado grande: {len(blob.encode())} bytes'
    assert all(w in valid for w in must_in), [w for w in must_in if w not in valid]
    assert not any(w in valid for w in must_out), [w for w in must_out if w in valid]

    out = ROOT / 'words' / f'{lang}.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(blob, encoding='utf-8')
    print(f'{lang}: {len(valid)} válidas, {len(common)} comunes -> {out.relative_to(ROOT)}')


if __name__ == '__main__':
    langs = sys.argv[1:]
    assert langs and all(l in LANGS for l in langs), f'uso: build_words.py {" ".join(LANGS)}'
    for lang in langs:
        build(lang)
