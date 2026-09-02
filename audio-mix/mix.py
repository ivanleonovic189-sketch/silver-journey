"""Final mix: python3 mix.py <instrumental file> [vocal_offset_seconds]"""
import sys, subprocess, numpy as np, soundfile as sf, pyloudnorm as pyln, imageio_ffmpeg
from scipy import signal
from pedalboard import Pedalboard, Compressor, Limiter
from vocal_chain import db, lin, hpf, lpf, eq, env_follow, fx_returns

SR=48000; FF=imageio_ffmpeg.get_ffmpeg_exe()
def load(path, name):
    subprocess.run([FF,'-hide_banner','-loglevel','error','-y','-i',path,'-ar',str(SR),'-ac','2','-c:a','pcm_f32le',name],check=True)
    x,sr=sf.read(name); return x.T  # (2,N)

def bpm_estimate(x, sr):
    m=x.mean(0); f,t,S=signal.stft(m,sr,nperseg=2048,noverlap=1536); S=np.abs(S)
    flux=np.maximum(np.diff(np.log1p(S*100),axis=1),0).sum(0); flux-=flux.mean()
    hop=(2048-1536)/sr; ac=np.correlate(flux,flux,'full')[len(flux)-1:]
    lags=np.arange(len(ac))*hop; sel=(lags>60/200)&(lags<60/60)
    pk,_=signal.find_peaks(ac[sel],distance=int(0.02/hop))
    cand=sorted([(ac[sel][p],60/lags[sel][p]) for p in pk],reverse=True)
    for sc,b in cand:
        if 80<=b<=140: return b
    return cand[0][1]

def lufs(x, sr):
    m=pyln.Meter(sr); return m.integrated_loudness(x.T if x.ndim>1 else x)

def short_term(x, sr, win=3.0, hop=0.5):
    m=x.mean(0) if x.ndim>1 else x; w=int(win*sr); h=int(hop*sr); out=[]
    for i in range(0,len(m)-w,h): out.append(db(np.sqrt((m[i:i+w]**2).mean())))
    return np.array(out)

def duck_eq(inst, voc, sr, f0=2800, Q=0.8, depth_db=-1.8):
    """dynamic EQ on the beat: dip presence band only while the vocal is speaking"""
    from vocal_chain import peaking
    e=env_follow(np.abs(voc),sr,10,250); g=np.clip((db(e)+40)/15,0,1)  # 0 when vocal silent, 1 when loud
    g=signal.sosfiltfilt(signal.butter(1,8,'low',fs=sr,output='sos'),g); g=np.clip(g,0,1)
    b,a=peaking(f0,depth_db,Q,sr); out=np.empty_like(inst)
    for c in range(2):
        d=signal.lfilter(b,a,inst[c]); out[c]=inst[c]*(1-g)+d*g
    return out

def restore(inst, sr):
    out=np.empty_like(inst)
    for c in range(2):
        x=hpf(inst[c],25,1,sr)
        band=lpf(hpf(x,2200,2,sr),5000,2,sr)
        u=signal.resample_poly(band,2,1); h=(np.abs(u)*u*3.0+np.tanh(u*4)/4); h=signal.resample_poly(h,1,2)[:len(x)]
        h=hpf(h,4500,4,sr)*lin(-14)                     # synthesized air 4.5k+
        out[c]=eq(x,[('peak',3200,1.0,1.0)],sr)+h
    return out

def main():
    inst=load(sys.argv[1],'inst'+(sys.argv[3] if len(sys.argv)>3 else '')+'.wav'); inst=restore(inst,SR); off=float(sys.argv[2]) if len(sys.argv)>2 else 0.0
    voc,sr=sf.read('vocal_dry.wav'); assert sr==SR
    if off>0: voc=np.concatenate([np.zeros(int(off*sr)),voc])
    elif off<0: voc=voc[int(-off*sr):]
    N=max(inst.shape[1],len(voc)); inst=np.pad(inst,((0,0),(0,N-inst.shape[1]))); voc=np.pad(voc,(0,N-len(voc)))
    bpm=bpm_estimate(inst,sr); Li=lufs(inst,sr); Lv=lufs(voc,sr)
    print(f"instrumental: LUFS={Li:.1f} peak={db(np.abs(inst).max()):.1f} dBTP~ bpm≈{bpm:.1f}")
    # level: vocal sits ~+1 LU above the beat (measured on vocal-active parts)
    act=np.abs(env_follow(np.abs(voc),sr,5,200))>lin(-35)
    vi=db(np.sqrt((voc[act]**2).mean())); ii=db(np.sqrt((inst.mean(0)[act]**2).mean()))
    gain=(ii+1.0)-vi; gain=np.clip(gain,-20,20); print(f"vocal rms on active={vi:.1f}, beat rms there={ii:.1f} -> vocal gain {gain:+.1f} dB")
    voc=voc*lin(gain)
    # make room in the beat
    inst=duck_eq(inst,voc,sr)
    # vocal + fx (reverb, slap, bpm-synced ping-pong delay)
    vfx=fx_returns(voc,sr,bpm=bpm,rev_db=-14,slap_db=-20,dly_db=-24)
    mix=inst+vfx
    # master bus: glue comp + gentle tilt + limiter
    board=Pedalboard([Compressor(threshold_db=db(np.percentile(np.abs(mix),99.9))-4,ratio=1.8,attack_ms=30,release_ms=250)])
    mix=board(mix.astype(np.float32),sr).astype(np.float64)
    for c in range(2): mix[c]=eq(mix[c],[('high',12000,0.8),('low',60,0.5)],sr)
    # normalize to target loudness then true-peak limit
    target=-9.5
    cur=lufs(mix,sr); mix=mix*lin(target-cur)
    lim=Pedalboard([Limiter(threshold_db=-1.0,release_ms=80)])
    up=signal.resample_poly(mix,4,1,axis=1); up=lim(up.astype(np.float32),sr*4).astype(np.float64)
    mix=signal.resample_poly(up,1,4,axis=1)[:,:N]
    mix=np.clip(mix,-0.999,0.999)*lin(-0.2)
    print(f"master: LUFS={lufs(mix,sr):.1f} peak={db(np.abs(mix).max()):.2f} dBFS")
    suf=sys.argv[3] if len(sys.argv)>3 else ''
    sf.write(f'final_mix{suf}.wav',mix.T.astype(np.float32),sr,subtype='PCM_24')
    subprocess.run([FF,'-hide_banner','-loglevel','error','-y','-i',f'final_mix{suf}.wav','-c:a','aac','-b:a','320k',f'final_mix{suf}.m4a'],check=True)
    subprocess.run([FF,'-hide_banner','-loglevel','error','-y','-i',f'final_mix{suf}.wav','-c:a','libmp3lame','-b:a','320k',f'final_mix{suf}.mp3'],check=True)
    print("written final_mix.wav / .m4a / .mp3")
if __name__=='__main__': main()
