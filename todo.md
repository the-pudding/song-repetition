("*" bullet = high priority. "-" = nice-to-have.)

## Compression animation
- arrow stuff...
    - nicer trajectories
    - give dest highlight a bit of a headstart before the arrow arrives
- special case dittos that start on a newline so they don't look so funny
- underlining animation should probably accelerate. (But doing so across lines is probably tricky.)
- helper class for json cache
- in setLastDitto, if add an increasing delay to ravels after the first one, so that if a bunch of them come in at once, they sort of get drawn in order

### compression-tutorial.js
- seems like scrollmagic kind of goes haywire on refresh and cycles through a bunch of stages in quick succession for inscrutable reasons. Maybe need to just put the whole thing behind some kind of delay or onLoad callback?
    - I think part of the problem might be dynamically adding the compression-tutorial slide/stage elements dynamically. They take up a lot of space, so whenever they get added, the page shifts around a lot.
- when scrolling up to the defrag scenes, we should just draw the final result of the defrag without any delays/animations. 
- some of the slide wrappers have enough padding between them that you can scroll to a point between them such that neither is visible (violating the rule that there always needs to be something moving up when the user scrolls). Maybe insert some dummy '...' elements between them or something?
- have a lot of room to play with. Could try increasing font size.

### compression.js
- maybe just have this as a standalone page somewhere and link to it in the body? The scrollytelling version already does a pretty good job of explaining the algo. It's not clear most readers will want to run through more (full song) examples after. And it takes up a lot of space.
* better controls
    - switch between play/pause as appropriate
    - try a slider for speed controls
- ability to control minimum match size. This'd be a nice thing to include in a standalone version.

## Histogram
- annotations for the outliers

## Most repetitive songs
- animated transitions when adding/removing rows, or switching between decades
    - object constancy
- show something like an excerpt of a song's lyrics when hovering/selecting it
    - mini gif version of compression, inline
- deal better with overly long track labels (truncate rather than wrapping to next line? as it is, the extra height on an overflowed row sort of messes up the look of the table)
- what about having youtube links to the songs, where possible?

## Repetition through the ages
* ylabel
- bottom padding on last card a little too small
- is there a better place for footnote-y technical details, like the rolling average thing?

## Artists beeswarm
- artist faces
- try to get closer to an equal number of artists per decade

## Discographies
- nicer artist-picker
    - one reader suggested arranging from most-to-least repetitive?
    - maybe just an *additional* artist-picker mechanism? Like, underneath the the chart, have some tabbed lists, organized along a few themes. (decade, highly-repetitive, highly-non-repetitive, high-variance, maybe genre)
- consider looking at a particular artist's discography (e.g. the Tswift example from Ipython notebook) and talking through some observations, before unleashing the selection of all artists in the dataset.
- histogram backdrop
    - smoothing
    - maybe scale up max height according to number of songs (would help contextualize a discography like TSwift's)
- profile. Seems a bit laggy at times.
- highlight a few examples of artists with interesting discographies (maybe as an alternative to blathering through a specific example)
- may want to limit number of songs per artist (Tswift's discog is v crowded right now)
    - or maybe even grow height if an artist has a lot of songs?
- a lot of now-obscure artists from 60s/70s (Brenda Lee? Herman's Hermits? The Hollies?) taking up space in the dropdown. May want to restrict data for this chart to the last 4 decades, or be more selective for earlier decades.
- x-axis should probably transition smoothly on artist change
- experiment w rendering of the median line. Maybe do it as a dashed line that exactly matches the height of the corresponding part of the histogram, and label with an annotation/legend
    - and maybe do something similar with 5%/10%, 90%/95%
- icon instead of text for randomize button

## Beeswarms
- I wonder if forces could help in fitting text into the bubbles? It could presumably help with a ittle like "Whererever Would I Be", which gets split to "Wherever / Would / I Be". In that case, rather than vertically centering the text, you'd want to shift it down, so that the widest chunk of text is closer to the widest part of the circle.
    - also, if we take it as a given that sometimes some text is going to spill out of the bubbles, it would probably be good to also repel texts from one another
- could maybe fit text into bubbles a bit more naturally if they were fat ellipses rather than circles
- when restarting the force sim, add a tiny bit of y jitter to the initial positions to break symmetry
- add a strong collision force to top and bottom limits of the graph

## Code stuff
* Review the many, many TODOs and XXXs in code.

## Data
- Consider doing more normalization before compressing. As a way of removing non-meaningful variations in how lyrics are transcribed that could lead to different compression ratios.
    - lowercase everything
    - strip newlines
    - strip punctuation
    - asciify
- Consider loosening criteria for artist/discog charts, include featured artists.
- I would love to increase the minimum match length, because I think 3 captures too many incidentally repeated substrings that aren't really instances of the kind of repetition I'm interested in. But that's possibly a lot of work. Probably.
    
## Prose
* Link to Around The World lyrics. Probably not possible to find a non-scummy/ad-bloated lyrics site. Maybe just host text file in assets, or pointer to file in github repo.
- Refactor into hbs file per section
* speculating on the 'why' of the trends
    - worth mentioning possible experimental biases? Might be too technical/uninteresting.
    - my claim about golden age of hip hop is pretty wild speculation. I don't know if this period actually coincided with extraordinary success in the hot 100.
- shorten/simplify prose before discog section. Brief comments on default artist discog and pointers to interesting examples.
- conclusion
    - story sort of starts with Q of whether music is getting more repetitive
    - which is basically answered after the trend-over-time graphic
    - the stuff after that is just gravy. Like, "oh, and here's some other neat stuff for exploring the data at a more granular level"
    - So not clear how the piece should end. Just reiterating the conclusion that "yeah, it does seem like music is getting more repetitive after all" seems kind of lame.
    - Maybe just move the repetition-over-time graphic to the end?
    
## Mobile
- tweak distance between scrollytelling cards (to give graphics a little more room to breathe)
- look across the board at aspect ratios. Seems to be a common source of mobile wonkiness right now.
- center overtime graphic vertically
- histogram subtitle fit

## Misc
- Would be nice to connect graphics somehow since they're so naturally hierarchical. Like, when exploring the artist comparison chart, it'd be great if you could select one of those artists and jump to the discography widget for that artist. And then even jump from a particular song in that discography to the corresponding compression graphic.
- Would be nice to define some common design element to use for 'small print' stuff, like explaining logarithmic scale in topsongs, rolling average in overtime, etc.
- resize hooks are probably a generally good idea. (And they'd help a lot with debugging, given how often I open and close the developer console. Or just fiddle with css - I don't know if those changes fire a resize event.)
