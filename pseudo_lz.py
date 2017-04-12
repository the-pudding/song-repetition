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
    words = [word.lower() for word in words if word not in ['I', "I'm"]]
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
        match_indices = [xy for xy, w in coords_to_words.iteritems() 
                if w==word and lessthan(xy[0],xy[1],x,y)
                ]
        if not match_indices:
            continue
        matches = [Match(lines, (x,y), xy2) for xy2 in match_indices]
        best = max(matches, key=lambda m: m.score(lines))
        yield best.serialize()
        # Skip the appropriate number of next words
        [indices.next() for _ in range(best.length-1)]
    return

    x = 0
    y = 0
    # Find all earlier matches of words[i]
    # Choose the one that stretches the longest, breaking ties by proximity
    while y < len(lines):
        line = lines[y]
        x = 0
        while x < len(line):
            word = line[x]
            match_indices = [xy for xy, w in coords_to_words.iteritems() if w==word]
            if not match_indices:
                x += 1
                continue
        
        matches = [Match(lines, (x,y), xy2) for xy2 in match_indices]
        best = max(matches, key=lambda m: m.score(lines))
        yield best.serialize()
        # TODO: increase x and/or y appropriately



        word = words[j]
        match_indices = [i for i,w in enumerate(words[:j]) if w==word]
        if not match_indices:
            j += 1
            continue

        matches = [Match(words, j, i) for i in match_indices]
        best = max(matches, key=lambda m: m.score())
        yield best.serialize()
        j += best.length

class Match(object):
    def __init__(self, lines, xy2, xy1):
        x1, y1 = xy1
        x2, y2 = xy2
        length = 0
        offset = 0
        w1 = lines[y1][x1]
        w2 = lines[y2][x2]
        while w1 == w2:
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
        self.src = xy1
        self.dest = xy2

    def distance(self, lines):
        # XXX: hack for now
        x1, y1 = self.src
        x2, y2 = self.dest
        if y1 == y2:
            return x2 - x1
        else:
            return (y2-y1)*10

    def score(self, lines):
        # Score by length but use proximity as tiebreaker
        return self.length*10**5 - self.distance(lines)

    def serialize(self):
        return dict(
                src={"x":self.src[0], "y":self.src[1]}, 
                dest={"x":self.dest[0], "y":self.dest[1]}, 
                length=self.length
                )


def main(f):
    lines = [preprocess(line) for line in f]
    dict_to_js(lines, 'lines.js')
    dittos = list(find_dittos(lines))
    dict_to_js(dittos, 'dittos.js')


if __name__ == '__main__':
    try:
        fname = sys.argv[1]
    except IndexError:
        fname = 'badmini.txt'
    with open(fname) as f:
        main(f)
