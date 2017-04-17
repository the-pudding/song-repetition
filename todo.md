## Compression animation

- figure out how to scale to different viewport sizes (currently uses fixed width of 1350px, which won't fly for mobile)
- try scaling ditto radius with size
- arrow stuff...
    - pointy ends
    - nicer trajectories
- (maybe) special case dittos that start on a newline so they don't look so funny
- integrate hand-holding prose. (Could mayyybe get away with putting it before the animation?)
- explain dittos (maybe replace 'ditto' text in final banner with an actual dot)
- integrate into main flow
- NTH: start with single col layout with large font size (and enough room on right for prose sidebar), then zoom out when necessary
- NTH: other songs (selectable via dropdown or something)


## Most repetitive songs
- make bars more intuitively clear
    - large -> small?
    - tooltips
- or just do bars based on compression %, not showing original size info
- headings
- NTH: show something like an excerpt of a song's lyrics when hovering/selecting it

## Repetition through the ages
- try a subtle scatterplot underlay effect
- fix animation bugs
- add a legend after adding orange line? or maybe just a label pointing to the new line.

## Artists beeswarm
- color artists by genre?

## Discographies
- consider looking at a particular artist's discography (e.g. the Tswift example from Ipython notebook) and talking through some observations, before unleashing the selection of all artists in the dataset.
- histogram backdrop
    - is this comprehensible?
    - smoothing
    - colormap?
    - maybe scale up max height according to number of songs (would help contextualize a discography like TSwift's)
- force text into bubbles (truncating if necessary)
- profile. Seems a bit laggy at times.
- highlight a few examples of artists with interesting discographies (maybe as an alternative to blathering through a specific example)
- may want to limit number of songs per artist (Tswift's discog is v crowded right now)
- a lot of now-obscure artists from 60s/70s (Brenda Lee? Herman's Hermits? The Hollies?) taking up space in the dropdown. May want to restrict data for this chart to the last 4 decades, or be more selective for earlier decades.

## Data
- Consider doing more normalization before compressing. As a way of removing non-meaningful variations in how lyrics are transcribed that could lead to different compression ratios.
    - lowercase everything
    - strip newlines
    - strip punctuation

## Misc thoughts
- Would be nice to connect graphics somehow since they're so naturally hierarchical. Like, when exploring the artist comparison chart, it'd be great if you could select one of those artists and jump to the discography widget for that artist. And then even jump from a particular song in that discography to the corresponding compression graphic.
