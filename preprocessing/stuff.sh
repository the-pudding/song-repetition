#!/bin/bash

zopfli *.txt

for fname in `ls *.gz`
do
    ./infgen $fname > $fname.infgen
done

python compression_parse.py *.txt
