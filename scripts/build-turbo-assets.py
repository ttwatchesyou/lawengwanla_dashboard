import numpy as np
import soundfile as sf
from scipy import signal
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Extract licensed turbo textures; requires numpy, scipy, soundfile.')
parser.add_argument('--dyno',required=True,help='editboy23 Freesound 496171 recording/preview')
parser.add_argument('--hks',required=True,help='nick7100 Peugeot 406 HKS recording')
parser.add_argument('--output',default=str(Path(__file__).resolve().parents[1]/'public/audio/turbo-v3'))
args=parser.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
def extract(file,start,end,low,high,loop=False):
 x,sr=sf.read(file);x=x.mean(axis=1) if x.ndim==2 else x
 x=x[round(start*sr):round(end*sr)]
 x=signal.sosfiltfilt(signal.butter(4,[low,high],btype='bandpass',fs=sr,output='sos'),x)
 x=signal.resample_poly(x,147,160) if sr==48000 else x
 sr=44100
 if loop:
  n=round(.08*sr);phase=np.linspace(0,np.pi/2,n)
  x=np.concatenate([x[n:-n],x[-n:]*np.cos(phase)+x[:n]*np.sin(phase)])
 else:
  # Keep the recorded valve transient and its real decay, with click-free edges.
  n=round(.008*sr);x[:n]*=np.linspace(0,1,n);x[-n:]*=np.linspace(1,0,n)
 x*=min(.16/max(np.sqrt(np.mean(x*x)),1e-9),.88/max(abs(x)))
 return sr,x
for name,args in {
 'spool-low':(args.dyno,14.6,16.2,1400,11000,True),
 'spool-high':(args.dyno,23.3,24.9,1700,12000,True),
 'engine':(args.hks,12.4,14.2,65,1500,True),
 'blowoff':(args.hks,9.73,10.93,1300,11500,False),
}.items():
 sr,x=extract(*args);sf.write(out/(name+'.wav'),x,sr,subtype='PCM_16')
 print(name,len(x)/sr,'rms',float(np.sqrt(np.mean(x*x))),'peak',float(max(abs(x))))
