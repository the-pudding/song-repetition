## Compression animation
- maybe start by continuing with the example of the "Cheap Thrills" chorus, slowly and with explanatory text, then give the full song example.
- figure out how to scale to different viewport sizes (currently uses fixed width of 1350px, which won't fly for mobile)
    - try slow scrolling thing. Example: map in this article: https://pudding.cool/2017/03/labels/index.html
- try scaling ditto radius with size
- arrow stuff...
    - nicer trajectories
    - should they go from dest to src (as they do now), or the opposite? Going the other way would direct the eye to the final part of the transition (the erasing of the dest text)
- (maybe) special case dittos that start on a newline so they don't look so funny
- integrate hand-holding prose. (Could mayyybe get away with putting it before the animation?)
- underlining animation should probably accelerate. (But doing so across lines is probably tricky.)
- explain dittos (maybe replace 'ditto' text in final banner with an actual dot)
- need something moving from bottom to top (or just a play button instead of scrollmagic)
- NTH: start with single col layout with large font size (and enough room on right for prose sidebar), then zoom out when necessary
- NTH: other songs (selectable via dropdown or something)

## Histogram
- Do a scrollytelling transition between first and second version of histogram (without and with outliers)

## Most repetitive songs
- headings
- search
- animated transitions when adding/removing rows, or switching between decades
- NTH: show something like an excerpt of a song's lyrics when hovering/selecting it
    - mini gif version of compression, inline
- Should the bars be colormapped? Problematic because either:
    - the bars will be mostly hard to distinguish, because they all fall in the same relatively small region of the overall distribution and therefore all get pretty similar colors, or...
    - I use a version of the colormap rescaled to the domain of the top songs. Which could be confusing. i.e. the same shade of green corresponds to a different amount of repetition depending on which chart you're looking at.

## Repetition through the ages
- ylabel
- try a subtle scatterplot underlay effect
- add a legend after adding orange line? or maybe just a label pointing to the new line.
- maybe do major/minor grid lines for y axis? (and x?)

## Artists beeswarm
- color artists by genre?
- artist faces
- label axes (maybe in a way that's consistent with whatever's done in discog)

## Discographies
- nicer artist-picker
    - one reader suggested arranging from most-to-least repetitive?
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

## Multi-chart todos
- Some kind of search widget shared across topsongs/artists/discog graphics?
- "I wanted a visual signal of repetitiveness across the article. Maybe consistent coloring of repetitiveness (red is higher than X (e.g., “Tequila by the Champs would be here.”, “0 is Bohemian Rhapsody which would be here”)"
- stop hard-coding dimensions of graphics. Should probably set size as fn of the size of the containing div (which should probably be set with % units)
- review easing (which is right now a random mix of linear and the default cubic)
- resizing shenanigans

## Data
- Consider doing more normalization before compressing. As a way of removing non-meaningful variations in how lyrics are transcribed that could lead to different compression ratios.
    - lowercase everything
    - strip newlines
    - strip punctuation
    - asciify
- Consider loosening criteria for artist/discog charts, include featured artists.
    
## Prose
- Be consistent with example songs. Replace Cheap Thrills example with Bad Romance, or vice versa.
- Link to Around The World lyrics. Probably not possible to find a non-scummy/ad-bloated lyrics site. Maybe just host text file in assets, or pointer to file in github repo.
- Refactor into hbs file per section
- speculating on the 'why' of the trends
    - worth mentioning possible experimental biases? Might be too technical/uninteresting.
    - my claim about golden age of hip hop is pretty wild speculation. I don't know if this period actually coincided with extraordinary success in the hot 100.
- shorten/simplify prose before discog section. Brief comments on default artist discog and pointers to interesting examples.
- conclusion
    - story sort of starts with Q of whether music is getting more repetitive
    - which is basically answered after the trend-over-time graphic
    - the stuff after that is just gravy. Like, "oh, and here's some other neat stuff for exploring the data at a more granular level"
    - So not clear how the piece should end. Just reiterating the conclusion that "yeah, it does seem like music is getting more repetitive after all" seems kind of lame.
    - Maybe just move the repetition-over-time graphic to the end?

## Misc thoughts
- Would be nice to connect graphics somehow since they're so naturally hierarchical. Like, when exploring the artist comparison chart, it'd be great if you could select one of those artists and jump to the discography widget for that artist. And then even jump from a particular song in that discography to the corresponding compression graphic.
- Would be nice to define some common design element to use for 'small print' stuff, like explaining logarithmic scale in topsongs, rolling average in overtime, etc.
- If the intro is going to use the Beyonce vs. Queen meme, it seems appropriate to use 'Girls'/Bohemian Rhapsody at some point as examples.
