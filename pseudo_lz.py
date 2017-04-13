import sys
import os
import json
import itertools

OUTDIR = ''

def flatten(lol):
    return list(itertools.chain.from_iterable(lol))

def preprocess(line):
    # TODO: lowercase whole line (or none of it)
    assert line.endswith('\n')
    line = line[:-1]
    if not line:
        return []
    line = line.replace('-', ' ')
    words = line.split()
    words = [(word.lower() if word not in ['I', "I'm"] else word) for word in words]
    return words
    
def dict_to_js(d, fname, varname="DATA", pprint=1):
    s = json.dumps(d, indent=(2 if pprint else None))
    _json_str_to_js(s, fname, varname)
    
def _json_str_to_js(json_str, fname, varname):
    if not fname.endswith('.js'):
        fname += '.js'
    path = os.path.join(OUTDIR, fname)
    with open(path, 'w') as f:
        f.write('var {} = '.format(varname))
        f.write(json_str)
        f.write(';\nexport default {};'.format(varname))

def iter_indices(lines):
    x = 0
    y = 0
    line = lines[y]
    while 1:
        if x >= len(line):
            x = 0
            y += 1
            if y >= len(lines):
                break
            line = lines[y]
            continue
        yield x, y
        x += 1

def find_dittos(lines):
    #words = flatten(lines)
    coords_to_words = {}
    for y, line in enumerate(lines):
        for x, word in enumerate(line):
            coords_to_words[(x,y)] = word

    indices = iter_indices(lines)
    while 1:
        try:
           x, y = indices.next()
        except StopIteration:
            break
        word = lines[y][x]
        lessthan = lambda x1,y1,x2,y2: y1 < y2 or (y1==y2 and x1 < x2)
        # TODO: set a minimum length in terms of characters (i.e. don't
        # include short single-word matches like "I", or "it")
        match_indices = [xy for xy, w in coords_to_words.iteritems() 
                if w==word and lessthan(xy[0],xy[1],x,y)
                ]
        if not match_indices:
            continue
        matches = [Match(lines, (x,y), xy2) for xy2 in match_indices]
        best = max(matches, key=lambda m: m.score(lines))
        yield best
        # Skip the appropriate number of next words
        [indices.next() for _ in range(best.length-1)]

class Match(object):
    def __init__(self, lines, xy2, xy1):
        x1, y1 = xy1
        x2, y2 = xy2
        length = 0
        offset = 0
        w1 = lines[y1][x1]
        w2 = lines[y2][x2]
        # Last 'good' x/y tuples for src/dest
        last1 = None
        last2 = None
        while w1 == w2:
            last1 = (x1, y1)
            last2 = (x2, y2)
            length += 1
            if x1 == len(lines[y1])-1:
                x1 = 0
                y1 += 1
            else:
                x1 += 1
            if x2 == len(lines[y2])-1:
                x2 = 0
                y2 += 1
            else:
                x2 += 1
            try:
                w1 = lines[y1][x1]
                w2 = lines[y2][x2]
            except IndexError:
                break

        self.length = length
        # Make sure ranges are not overlapping. If they are, truncate the source.
        x2, y2 = last1
        if y2 > xy2[1] or (y2 == xy2[1] and x2 >= xy2[0]):
            if xy2[0] == 0:
                y2 = xy2[1]-1
                x2 = len(lines[y2])-1
            else:
                y2 = xy2[1]
                x2 = xy2[0]-1
        self.src = dict(x1=xy1[0], y1=xy1[1], 
                x2=x2, y2=y2
                )
        self.dest = dict(x1=xy2[0], y1=xy2[1], x2=last2[0], y2=last2[1])

    def distance(self, lines):
        # XXX: hack for now
        x1, y1 = self.src['x1'], self.src['y1']
        x2, y2 = self.dest['x1'], self.dest['y1']
        if y1 == y2:
            return x2 - x1
        else:
            return (y2-y1)*10

    def score(self, lines):
        # Score by length but use proximity as tiebreaker
        return self.length*10**5 - self.distance(lines)

    def serialize(self):
        return dict(
                src=self.src, dest=self.dest,
                length=self.length
                )

def to_char_indices(ditto, lines):
    for key in ['src', 'dest']:
        r = ditto[key]
        for xk,yk in [ ('x1','y1'), ('x2','y2') ]:
            x = r[xk]
            y = r[yk]
            # Keep a backup of the word index, cause it's useful in some contexts
            r[xk+'word'] = x 
            line = lines[y]
            newx = sum(len(word)+1 for word in line[:x])
            newx = max(0, newx)
            # If this is an endpoint, add the length of the xth word (but not the space)
            if xk == 'x2':
                newx += len(line[x])
            r[xk] = newx
    return ditto

def main(f):
    lines = [preprocess(line) for line in f]
    dict_to_js(lines, 'lines.js')
    dittos = list(find_dittos(lines))
    dittos = [to_char_indices(d.serialize(), lines) for d in dittos]
    dict_to_js(dittos, 'dittos.js')


if __name__ == '__main__':
    try:
        fname = sys.argv[1]
    except IndexError:
        fname = 'badmini.txt'
    with open(fname) as f:
        main(f)
