import numpy as np, soundfile as sf, sys
from scipy import signal
from pedalboard import Pedalboard, Compressor, NoiseGate, Reverb, Delay, Limiter

def db(x): return 20*np.log10(np.abs(x)+1e-12)
def lin(d): return 10**(np.asarray(d)/20)

# ---------- RBJ biquads ----------
def peaking(f0, g, Q, sr):
    A=10**(g/40); w=2*np.pi*f0/sr; al=np.sin(w)/(2*Q); c=np.cos(w)
    b=np.array([1+al*A,-2*c,1-al*A]); a=np.array([1+al/A,-2*c,1-al/A]); return b/a[0], a/a[0]
def shelf(f0, g, sr, kind, S=0.7):
    A=10**(g/40); w=2*np.pi*f0/sr; c=np.cos(w); al=np.sin(w)/2*np.sqrt((A+1/A)*(1/S-1)+2); sa=2*np.sqrt(A)*al
    if kind=='high':
        b=[A*((A+1)+(A-1)*c+sa),-2*A*((A-1)+(A+1)*c),A*((A+1)+(A-1)*c-sa)]; a=[(A+1)-(A-1)*c+sa,2*((A-1)-(A+1)*c),(A+1)-(A-1)*c-sa]
    else:
        b=[A*((A+1)-(A-1)*c+sa),2*A*((A-1)-(A+1)*c),A*((A+1)-(A-1)*c-sa)]; a=[(A+1)+(A-1)*c+sa,-2*((A-1)+(A+1)*c),(A+1)+(A-1)*c-sa]
    b=np.array(b); a=np.array(a); return b/a[0], a/a[0]
def eq(x, bands, sr):
    for kind,*p in bands:
        if kind=='peak': ba=peaking(p[0],p[1],p[2],sr)
        else: ba=shelf(p[0],p[1],sr,kind)
        x=signal.lfilter(ba[0],ba[1],x)
    return x

# ---------- envelope follower (block-decimated, sample-interpolated) ----------
def env_follow(a, sr, att_ms, rel_ms, blk=16):
    n=len(a)//blk*blk; m=a[:n].reshape(-1,blk).max(axis=1)
    bsr=sr/blk; aa=np.exp(-1/(bsr*max(att_ms,0.05)/1000)); ar=np.exp(-1/(bsr*rel_ms/1000))
    e=np.empty_like(m); s=0.0
    for i,v in enumerate(m):
        s = aa*s+(1-aa)*v if v>s else ar*s+(1-ar)*v
        e[i]=s
    t=np.arange(len(a)); return np.interp(t, np.arange(len(m))*blk+blk/2, e)

def hpf(x, f, order, sr): return signal.sosfilt(signal.butter(order,f,'high',fs=sr,output='sos'), x)
def lpf(x, f, order, sr): return signal.sosfilt(signal.butter(order,f,'low',fs=sr,output='sos'), x)

# ---------- plosive tamer: dynamic HPF only where LF bursts dominate ----------
def deplosive(x, sr):
    lf=lpf(x,160,2,sr); e_lf=env_follow(np.abs(lf),sr,1,80); e_all=env_follow(np.abs(x),sr,1,80)
    rel=db(e_lf)-db(e_all)
    blend=np.clip((rel+8)/6,0,1)*(db(e_lf)>-38)
    blend=signal.sosfiltfilt(signal.butter(1,30,'low',fs=sr,output='sos'),blend); blend=np.clip(blend,0,1)
    alt=hpf(x,220,4,sr)
    return x*(1-blend)+alt*blend, blend

# ---------- vocal rider: slow gain to even out sections ----------
def rider(x, sr, target_db=-20, max_db=4.0, hop=0.02, win=0.5):
    h=int(hop*sr); n=len(x)//h*h; fr=x[:n].reshape(-1,h); r=db(np.sqrt((fr**2).mean(axis=1)))
    k=int(win/hop); ker=np.ones(k)/k; rs=np.convolve(r,ker,'same')
    g=np.clip(target_db-rs,-max_db,max_db); g[rs<-45]=np.nan
    idx=np.arange(len(g)); good=~np.isnan(g); g=np.interp(idx,idx[good],g[good]) if good.any() else np.zeros_like(g)
    g=signal.sosfiltfilt(signal.butter(1,0.8,'low',fs=1/hop,output='sos'),g)
    gs=np.interp(np.arange(len(x)),idx*h+h/2,g); return x*lin(gs), g

# ---------- split-band de-esser ----------
def deesser(x, sr, f_lo=5200, f_hi=9500, ratio=3.0, att=0.3, rel=45, max_gr=6.0, pct=96):
    hi=hpf(x,f_lo,4,sr); lo=x-hi
    sc=signal.sosfilt(signal.butter(2,[f_lo,f_hi],'band',fs=sr,output='sos'),x)
    e=db(env_follow(np.abs(sc),sr,att,rel))
    thr=np.percentile(e[e>-60],pct)
    gr=-np.maximum(e-thr,0)*(1-1/ratio); gr=np.maximum(gr,-max_gr)
    return lo+hi*lin(gr), gr, thr

def saturate(x, drive_db=5, mix=0.3):
    d=lin(drive_db); u=signal.resample_poly(x,2,1); y=np.tanh(u*d)/d; y=signal.resample_poly(y,1,2)[:len(x)]
    return x*(1-mix)+y*mix

def pb(x, board, sr):
    y=board(x.astype(np.float32)[None,:], sr); return y[0].astype(np.float64)

def gr_stats(pre, post, sr, fl=0.05):
    h=int(fl*sr); n=min(len(pre),len(post))//h*h
    a=db(np.sqrt((pre[:n].reshape(-1,h)**2).mean(1))); b=db(np.sqrt((post[:n].reshape(-1,h)**2).mean(1)))
    d=(b-a)[a>-40]; return f"GR median={np.median(d):.1f} dB, p95={np.percentile(d,5):.1f} dB"

def process_vocal(st, sr, log=print):
    x=st.mean(axis=1) if st.ndim>1 else st.copy()
    x=x-x.mean()
    # 1. HPF 85 Hz (male voice), 24 dB/oct
    x=hpf(x,85,4,sr)
    # 2. plosives
    x,bl=deplosive(x,sr); log(f"plosive tamer active {100*(bl>0.3).mean():.2f}% of time")
    # 3. gentle expander for pauses
    x=pb(x,Pedalboard([NoiseGate(threshold_db=-46,ratio=3.0,attack_ms=1,release_ms=250)]),sr)
    # 4. subtractive EQ: mud / box / nasal
    x=eq(x,[('peak',330,-3.5,1.1),('peak',520,-2.5,1.6),('peak',900,-1.0,2.0)],sr)
    # 5. rider
    x,g=rider(x,sr,target_db=-20); log(f"rider gain range {g.min():+.1f}..{g.max():+.1f} dB")
    # 6. de-ess #1 (pre-comp)
    x,gr,thr=deesser(x,sr); log(f"de-ess1 thr={thr:.1f} dB, max GR={gr.min():.1f} dB, active {100*(gr<-1).mean():.1f}%")
    # 7. comp stage 1 fast (1176 style)
    pk=np.percentile(np.abs(x[np.abs(x)>lin(-40)]),99.5); log(f"pre-comp peak p99.5={db(pk):.1f} dBFS")
    pre=x; x=pb(x,Pedalboard([Compressor(threshold_db=db(pk)-10,ratio=4,attack_ms=2,release_ms=70)]),sr); log("comp1 "+gr_stats(pre,x,sr))
    x=x*lin(3.0)  # makeup
    # 8. comp stage 2 slow (opto style)
    pk=np.percentile(np.abs(x[np.abs(x)>lin(-40)]),99.5)
    pre=x; x=pb(x,Pedalboard([Compressor(threshold_db=db(pk)-8,ratio=2.5,attack_ms=15,release_ms=350)]),sr); log("comp2 "+gr_stats(pre,x,sr))
    # 9. additive EQ: body / presence / air
    x=eq(x,[('low',140,1.0),('peak',3000,3.0,0.9),('peak',5500,1.5,1.5),('high',10500,4.0)],sr)
    # 10. de-ess #2 (after air boost)
    x,gr,thr=deesser(x,sr,ratio=2.5,max_gr=4,pct=97); log(f"de-ess2 max GR={gr.min():.1f} dB, active {100*(gr<-1).mean():.1f}%")
    # 11. saturation
    x=saturate(x,5,0.3)
    # 12. peak limit dry stem to -3 dBFS
    x=x/np.abs(x).max()*lin(-1.0)
    x=pb(x,Pedalboard([Limiter(threshold_db=-1.5,release_ms=120)]),sr)
    x=hpf(x,20,1,sr); x=x/np.abs(x).max()*lin(-3.0)
    return x

def fx_returns(dry, sr, bpm=None, rev_db=-13, slap_db=-19, dly_db=None):
    # reverb send: pre-delay, band-limited
    pre=int(0.035*sr); send=np.concatenate([np.zeros(pre),dry[:-pre]]); send=hpf(send,400,2,sr); send=lpf(send,7500,2,sr)
    rv=Pedalboard([Reverb(room_size=0.55,damping=0.55,wet_level=1.0,dry_level=0.0,width=1.0)])
    r=rv(np.stack([send,send]).astype(np.float32),sr).astype(np.float64)
    r=r/ (np.abs(r).max()+1e-9)*np.abs(dry).max()*lin(rev_db)
    # slap delay, mono-ish, filtered
    sl=int(0.105*sr); s=np.concatenate([np.zeros(sl),dry[:-sl]]); s=hpf(s,500,2,sr); s=lpf(s,5000,2,sr)*lin(slap_db)
    out=np.stack([dry,dry])+r+np.stack([s*0.9,s*1.0])
    if bpm and dly_db is not None:
        beat=60/bpm; dl=int(beat*0.75*sr); dr=int(beat*0.5*sr)
        f=lpf(hpf(dry,600,2,sr),4500,2,sr)
        L=np.zeros_like(dry); R=np.zeros_like(dry); fb=0.32
        # feedback ping-pong
        buf=np.concatenate([f,np.zeros(dl*6)]); acc=np.zeros_like(buf); g=1.0
        for k in range(1,7):
            off=dl if k%2 else dr; sh=int(off*((k+1)//2))+int(dr*(k//2)) if False else 0
        # simple: 5 taps each side
        for k in range(1,6):
            gk=fb**(k-1)
            tl=np.concatenate([np.zeros(dl*k),f[:-dl*k]])*gk; tr=np.concatenate([np.zeros(dl*k+dr),f[:-(dl*k+dr)]])*gk
            L+=tl; R+=tr
        out+=np.stack([L,R])*lin(dly_db)
    return out

if __name__=='__main__':
    st,sr=sf.read(sys.argv[1]); dry=process_vocal(st,sr)
    sf.write('vocal_dry.wav',dry.astype(np.float32),sr)
    wet=fx_returns(dry,sr); wet=wet/np.abs(wet).max()*lin(-1.0)
    sf.write('vocal_preview.wav',wet.T.astype(np.float32),sr)
    print("dry:", f"peak={db(np.abs(dry).max()):.1f} rms={db(np.sqrt((dry**2).mean())):.1f}")
