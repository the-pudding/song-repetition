from __future__ import division
from collections import namedtuple
import json
import os
import sys

# Smallest match size we'll consider significant
# TODO: experiment with bigger values
MINMATCH = 4

OUTDIR = '../src/assets/lz/'
JSDIR = '../src/js/'

SAVE_INDEX = 0
FIX_MISSING = 0

songdat = [
  {"slug": "allyouneedislove", "title": "All You Need is Love", "artist": "The Beatles", "reduction": 0, "hidden": False}, 
  {"slug": "barbiegirl", "title": "Barbie Girl", "artist": "Aqua", "reduction": 0, "hidden": False}, 
  {"slug": "billsbillsbills", "title": "Bills, Bills, Bills", "artist": "Destiny's Child", "reduction": 0, "hidden": False}, 
  {"slug": "blackbeatles", "title": "Black Beatles", "artist": "Rae Sremmurd", "reduction": 0, "hidden": False}, 
  {"slug": "bomt", "title": "Baby One More Time", "artist": "Britney Spears", "reduction": 0, "hidden": False}, 
  {"slug": "cgyoomh", "title": "Can't Get You Out Of My Head", "artist": "Kylie Minogue", "reduction": 0, "hidden": False}, 
  {"slug": "cheapthrills_chorus", "title": "cheapthrills_chorus", "artist": "", "reduction": 0, "hidden": True}, 
  {"slug": "cheapthrills", "title": "Cheap Thrills", "artist": "Sia", "reduction": 0, "hidden": False}, 
  {"slug": "essay_intro", "title": "essay_intro", "artist": "", "reduction": 0, "hidden": True}, 
  {"slug": "geniusoflove", "title": "Genius of Love", "artist": "Tom-Tom Club", "reduction": 0, "hidden": False}, 
  {"slug": "ifeellove", "title": "I Feel Love", "artist": "Donna Summer", "reduction": 0, "hidden": False}, 
  {"slug": "praiseyou", "title": "Praise You", "artist": "Fatboy Slim", "reduction": 0, "hidden": False}, 
  {"slug": "sabotage", "title": "Sabotage", "artist": "Beastie Boys", "reduction": 0, "hidden": False}, 
  {"slug": "thrillscheap", "title": "thrillscheap", "artist": "", "reduction": 0, "hidden": True}, 
  {"slug": "whereismymind", "title": "Where is My Mind", "artist": "Pixies", "reduction": 0, "hidden": False}, 
  {"slug": "wouldntitbenice", "title": "Wouldn't it be Nice", "artist": "The Beach Boys", "reduction": 0, "hidden": False},
  {"slug": "buddyholly", "title": "Buddy Holly", "artist": "Weezer", "reduction": 0, "hidden": False},
]

def dict_to_js(d, fname, varname="DATA", pprint=1):
    s = json.dumps(d, indent=(2 if pprint else None))
    _json_str_to_js(s, fname, varname)
    
def _json_str_to_js(json_str, fname, varname):
    if not fname.endswith('.js'):
        fname += '.js'
    path = os.path.join(JSDIR, fname)
    with open(path, 'w') as f:
        f.write('var {} = '.format(varname))
        f.write(json_str)
        f.write(';\nexport default {};'.format(varname))

class CompressionParser(object):
    def __init__(self, raw_file, infgen_file):
        self.raw = raw_file.read()
        self.lines = self.raw.split('\n')
        # Also sets self.reduction
        self.compressed_parts = self.parse_infgen(infgen_file)
        self.words = list(self.get_words())

    def debug_words(self):
        res = []
        offset = 0
        for i, word in enumerate(self.words):
            thing = dict(word=word, windex=i, gindex=offset, length=len(word))
            res.append(thing)
            offset += len(word)
        return res

    def get_words(self):
        # We must have a word juncture at the beginning/end of each
        # line, and also at the beginning/end of a ditto src/dest
        # An index in this set means:
        # - a word begins with this index (except the last index), inclusive
        # - a word ends with this index (except 0), exclusive
        junctures = set([0, len(self.raw)])
        offset = 0
        for i, line in enumerate(self.lines):
            offset += len(line)+1 # +1 for the newline
            junctures.add(offset)
        for ditto in self.dittos:
            for r in [ditto.dest, ditto.src]:
                junctures.add(r.start)
                junctures.add(r.end+1) # Range uses inclusive end indices
        junctures = list(junctures)
        junctures.sort()
        i = junctures[0]
        for j in junctures[1:]:
            yield self.raw[i:j]
            i = j

    @property
    def dittos(self):
        return [part for part in self.compressed_parts if isinstance(part, Ditto)]

    def parse_infgen(self, f):
        parts = []
        offset = 0
        # Compression savings, counted in characters
        reduction = 0
        for line in f:
            if line.startswith('match'):
                p = Ditto.from_line(line, offset)
                if p.trivial():
                    offset += p.length
                    continue
                else:
                    savings = p.length - 3
                    assert savings > 0
                    reduction += savings
            elif line.startswith('literal'):
                p = Literal.from_line(line, offset)
                assert p.txt == self.raw[p.i:p.i+p.length]
            else:
                continue
            parts.append(p)
            offset += p.length
        self.reduction = reduction / len(self.raw)
        return parts

    def save(self, slug):
        lines = self.get_lines()
        dittos = self.ditto_dicts()
        fname = slug+'.json'
        with open(os.path.join(OUTDIR, fname), 'w') as f:
            obj = {'lines': lines, 'dittos': dittos}
            json.dump(obj, f, indent=2)

    def get_lines(self):
        lines = []
        line = []
        for word in self.words:
            line.append(word)
            if word.endswith('\n'):
                lines.append(line)
                line = []
        if line:
            lines.append(line)
        return lines

    def ditto_dicts(self):
        dittos = []
        for ditto in self.dittos:
            dittos.append(ditto.serialize(self))
        return dittos

    def char_index_to_word_index(self, i, end=False, local=True):
        """return a word index local to whichever line that word is on"""
        offset = 0
        windex = 0
        for word in self.words:
            if abs(offset - i) < 10:
                #print "hi line 114"
                pass
            if not end and offset == i:
                return windex
            offset += len(word)
            if end and (offset-1) == i:
                return windex
            if word.endswith('\n') and local:
                windex = 0
            else:
                windex += 1 
        assert False, "Invalid word char index: {}".format(i)

    def xy(self, i):
        """Look up x/y coords for the given flattened index
        """
        offset = 0
        for y, line in enumerate(self.lines):
            offset += len(line)+1
            if i < offset:
                return (i-(offset-(len(line)+1)), y)
        assert False, "Couldn't find index {}".format(i)

class Range(object):
    # Start end end indices are both inclusive. Because of reasons.
    def __init__(self, start, length=None, end=None):
        self.start = start
        if length:
            self.length = length
            self.end = start+length-1
        elif end:
            self.end = end
            self.length = 1+(end-start)
        else:
            assert False, "Need one of length or end"

    def __str__(self):
        return 'Range(start={}, end={}, length={})'.format(
                self.start, self.end, self.length)

    def nwords(self, parser):
        w1 = parser.char_index_to_word_index(self.start, local=False)
        w2 = parser.char_index_to_word_index(self.end, end=True, local=False)
        return 1 + (w2-w1)

    def serialize(self, parser):
        x1, y1 = parser.xy(self.start)
        x2, y2 = parser.xy(self.end)
        x1word = parser.char_index_to_word_index(self.start) 
        # Lookups are done based on the index of the word's first
        # character. self.end is the index of the last character of
        # the last word, so correct for that
        if (x1, y1) == (6, 12):
            #import pdb; pdb.set_trace()
            pass
        x2word = parser.char_index_to_word_index(self.end, end=1)
        # I never thought I'd say this, but I miss javascript. Shorthand
        # object initializer syntax is da bomb.
        res = dict(x1=x1, y1=y1, x2=x2, y2=y2, x1word=x1word, x2word=x2word)
        # More debugging stuff
        res['nwords'] = self.nwords(parser)
        res['nchars'] = self.length
        return res

class Ditto(object):
    def __init__(self, length, distance, i):
        self.length = length
        self.distance = distance
        # Index into flattened song of this ditto's first character
        self.i = i
        self.dest = Range(i, length)
        self.src = Range(i-distance, end=min(i-1, (i-distance)+length-1)) 

    def serialize(self, parser):
        d = {}
        d['dest'] = self.dest.serialize(parser)
        d['src'] = self.src.serialize(parser)
        # debugging info
        d['src']['txt'] = parser.raw[self.src.start:self.src.end+1]
        # (broken now that it's not using global word indices)
        #wordversion = ''.join(parser.words[d['src']['x1word']:d['src']['x2word']+1])
        #assert d['src']['txt'] == wordversion
        return d

    def trivial(self):
        return self.length < MINMATCH

    @classmethod
    def from_line(kls, line, i):
        _, l, dist = line.split(' ')
        return kls(int(l), int(dist), i)

class Literal(object):
    def __init__(self, txt, length, i):
        self.length = length
        self.i = i
        self.txt = txt

    @classmethod
    def from_line(kls, line, i):
        prefix = 'literal '
        assert line.startswith(prefix)
        assert line.endswith('\n')
        line = line[len(prefix):-1]
        try:
            codes, txt = line.split("'", 1)
        except ValueError:
            codes = line
            txt = ''
        length = 0
        length += len(codes.split())
        length += len(txt)
        if codes:
            codes = [int(code) for code in codes.strip().split()]
            chrs = ''.join([chr(c) for c in codes])
            txt = chrs + txt
        return kls(txt, length, i)

if __name__ == '__main__':
    raw_fnames = sys.argv[1:]
    for raw in raw_fnames:
        slug = raw.split('.')[0]
        slugixs = [i for (i, dat) in enumerate(songdat) if dat['slug'] == slug]
        #assert len(slugixs) > 0, "Couldn't find song data for {}".format(slug)
        assert len(slugixs) < 2
        if len(slugixs) == 0:
            assert FIX_MISSING
            slugdat = dict(slug=slug, title=slug, artist='', hidden=False)
            songdat.append(slugdat)
        else:
            slugdat = songdat[slugixs[0]]
        inf = raw + '.gz.infgen'
        rawf = open(raw)
        inff = open(inf)
        parser = CompressionParser(rawf, inff)
        parser.save(slug)
        rawf.close()
        inff.close()
        slugdat['reduction'] = parser.reduction

    if SAVE_INDEX:
        ix = [dat for dat in songdat if not dat['hidden']] 
        dict_to_js(ix, 'lz-directory.js')
