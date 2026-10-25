"""Build an original K24-inspired engine model, not an extracted K24 recording.
Reference (listening/spectral analysis only): https://youtu.be/vdBzOoUfoN0
Four-cylinder four-stroke pulse train + intake/exhaust resonances; no reference
waveform is copied. Requires numpy and soundfile. Deterministic, 44.1 kHz PCM.
"""
from pathlib import Path
import numpy as np
import soundfile as sf

sr = 44100
length = sr * 2
t = np.arange(length) / sr
phase = 100 * t + .002 * np.sin(2*np.pi*3*t) + .001*np.sin(2*np.pi*7*t)
cycle = phase % 1
cylinders = np.array([1, .985, 1.025, .995])[np.floor(phase).astype(int) % 4]
pulse = (np.exp(-cycle/.13) - .34*np.exp(-cycle/.48)) * cylinders
pulse -= pulse.mean()
f = np.fft.rfftfreq(length, 1/sr)
p = np.fft.rfft(pulse)
rng = np.random.default_rng(2404)
noise = np.fft.rfft(rng.normal(size=length))
out = Path(__file__).resolve().parents[1] / 'public/audio/k24-hks-v1'
out.mkdir(parents=True, exist_ok=True)
for mode, bite in [('low', .35), ('high', 1.)]:
    # Broad exhaust body around 100/220 Hz, with the loaded intake rasp above.
    body = np.exp(-.5*(np.log(np.maximum(f, 1)/110)/.5)**2)
    mid = np.exp(-.5*(np.log(np.maximum(f, 1)/440)/.65)**2)
    rasp = np.exp(-.5*(np.log(np.maximum(f, 1)/1350)/.55)**2)
    response = (.8*body + (.27+.3*bite)*mid + (.06+.2*bite)*rasp)
    response *= (1-np.exp(-(f/48)**4)) * np.exp(-(f/4800)**4)
    y = np.fft.irfft(p*response, n=length)
    grit = np.fft.irfft(noise*np.exp(-.5*(np.log(np.maximum(f,1)/1700)/.6)**2), n=length)
    grit /= max(np.std(grit), 1e-9)
    y = np.tanh(y*3.4) + (.012+.018*bite)*grit*(.3+.7*np.exp(-cycle/.22))
    y -= y.mean()
    y *= min(.18/max(np.sqrt(np.mean(y*y)), 1e-9), .82/max(abs(y)))
    # Smooth the seam without changing pulse spacing.
    n=round(.04*sr);angle=np.linspace(0,np.pi/2,n)
    y=np.concatenate([y[n:-n],y[-n:]*np.cos(angle)+y[:n]*np.sin(angle)])
    sf.write(out/f'engine-{mode}.wav', y, sr, subtype='PCM_16')
    print(mode, 'seconds',len(y)/sr,'RMS',float(np.sqrt(np.mean(y*y))), 'peak',float(max(abs(y))))
