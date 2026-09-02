# Vocal mixing chain (OUTRO 1100)

Python-only vocal processing and mixdown, no DAW required.

```
pip install numpy scipy soundfile pedalboard pyloudnorm imageio-ffmpeg
python3 vocal_chain.py vocal.wav              # -> vocal_dry.wav, vocal_preview.wav
python3 mix.py instrumental.wav [offset_s]    # -> final_mix.wav/.m4a/.mp3
python3 analyze.py file.wav                   # levels, LUFS, spectrum, sibilance
```

Vocal chain: HPF 85 Hz, plosive tamer, expander, subtractive EQ (330/520/900 Hz),
vocal rider, split-band de-esser, fast + slow compressor, presence/air EQ,
second de-esser, tape-style saturation, limiter. Mix: level matching to the beat,
dynamic presence dip on the beat while the vocal is active, plate reverb, slap
and tempo-synced ping-pong delay, glue compressor, true-peak limiter to -1 dBTP.
