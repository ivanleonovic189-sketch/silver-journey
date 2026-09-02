import sys, numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy import signal
x, sr = sf.read(sys.argv[1])
if x.ndim > 1: x = x.mean(axis=1)
print(f"sr={sr} dur={len(x)/sr:.2f}s peak={20*np.log10(np.abs(x).max()+1e-12):.2f} dBFS rms={20*np.log10(np.sqrt((x**2).mean())+1e-12):.2f} dBFS")
m = pyln.Meter(sr); print(f"LUFS integrated={m.integrated_loudness(x):.2f}")
# noise floor: quietest 5% of 50ms frames
fl = int(0.05*sr); fr = x[:len(x)//fl*fl].reshape(-1, fl); r = 20*np.log10(np.sqrt((fr**2).mean(axis=1))+1e-12)
print(f"frame RMS: p5={np.percentile(r,5):.1f} p50={np.percentile(r,50):.1f} p95={np.percentile(r,95):.1f} dBFS")
# spectrum by band
f, P = signal.welch(x, sr, nperseg=8192)
bands = [(20,80),(80,150),(150,300),(300,600),(600,1200),(1200,2500),(2500,5000),(5000,8000),(8000,12000),(12000,20000)]
tot = P.sum()
for lo,hi in bands:
    sel=(f>=lo)&(f<hi); print(f"{lo:>5}-{hi:<5} Hz: {10*np.log10(P[sel].sum()/tot+1e-12):6.1f} dB rel")
# DC offset, silence at start/end
print(f"DC={x.mean():.5f}; first non-silent: {np.argmax(np.abs(x)>0.01)/sr:.2f}s last: {(len(x)-np.argmax(np.abs(x[::-1])>0.01))/sr:.2f}s")
# sibilance energy ratio 5-9k vs 1-4k on loud frames
loud = fr[r>np.percentile(r,70)]
S = np.abs(np.fft.rfft(loud*np.hanning(fl), axis=1)).mean(axis=0); ff = np.fft.rfftfreq(fl, 1/sr)
print(f"sib ratio (5-9k / 1-4k) = {10*np.log10(S[(ff>5000)&(ff<9000)].sum()/S[(ff>1000)&(ff<4000)].sum()):.1f} dB")
# clipping check
print(f"samples >= 0.99: {(np.abs(x)>=0.99).sum()}")
