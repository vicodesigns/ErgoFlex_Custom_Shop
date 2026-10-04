"""Build an original synthetic clip and LED banks using the actual host/board code.
No hardware, external footage, screen capture, network, or credentials.
"""
from pathlib import Path
import argparse, importlib.util, json, hashlib, math, struct, subprocess, tempfile, wave
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--reference-root',type=Path,default=Path('/home/ergo/ErgoFlex_Desk_Stack/Polish-Features'))
args=parser.parse_args(); ref=args.reference_root
host=ref/'tools/game_mode_proto/ambient.py'
spec=importlib.util.spec_from_file_location('ambient',host); ambient=importlib.util.module_from_spec(spec);spec.loader.exec_module(ambient)
OUT=ROOT/'assets/led/game';OUT.mkdir(parents=True,exist_ok=True)
duration=12; fps=60; n=duration*fps; width,height=640,360
geom=ambient.load_geometry(); counts=[s['n'] for s in geom]
assert counts==[14,14,15,14,14,11,11,13]

def picture(t):
    """Original neon flight through three color districts; smooth exposure, no strobe."""
    y,x=np.mgrid[0:height,0:width].astype(np.float32);x/=width;y/=height
    phase=t/duration*2*math.pi
    palettes=np.array([[.07,.72,1.0],[.70,.12,1.0],[1.0,.43,.08]],np.float32)
    blend=(math.sin(phase)+1)/2
    left=palettes[0]*(1-blend)+palettes[1]*blend
    right=palettes[2]*(1-blend)+palettes[0]*blend
    glow=np.exp(-((x-.5-.22*math.sin(phase))**2+(y-.4)**2)*7)
    col=left[None,None,:]*(1-x[:,:,None])+right[None,None,:]*x[:,:,None]
    scene=(col*(.11+.60*glow[:,:,None])*255).clip(0,255).astype(np.uint8)
    im=Image.fromarray(scene);d=ImageDraw.Draw(im)
    horizon=160
    for j in range(14):
        u=(j/14+t*.12)%1; yy=horizon+int(u*u*(height-horizon))
        d.line([(0,yy),(width,yy)],fill=(27,85,101),width=1)
    for j in range(-5,6):d.line([(width/2+j*12,horizon),(width/2+j*140,height)],fill=(33,102,130),width=1)
    for j in range(9):
        xx=int((j*91-t*38)%800)-80; top=62+int(23*math.sin(j+phase))
        d.rounded_rectangle([xx,top,xx+42,horizon],radius=4,fill=(8,15,30),outline=tuple(int(v*180) for v in (left if j%2 else right)),width=2)
    shipx=int(width/2+55*math.sin(phase));shipy=236
    d.polygon([(shipx-28,shipy+12),(shipx,shipy-22),(shipx+28,shipy+12),(shipx,shipy+5)],fill=(209,237,242),outline=(27,218,255))
    d.ellipse([shipx-4,shipy+12,shipx+4,shipy+23],fill=(255,158,60))
    d.text((22,18),'ERGOFLEX / NEON FLIGHT',fill=(211,238,244))
    d.text((22,34),'Original synthetic lighting showcase',fill=(146,185,200))
    return np.asarray(im)

def metrics(t):
    beat=(t%.5)<.045; bass=math.exp(-(t%.5)/.14)
    high=(math.sin(t*math.pi*2*2)+1)*.22
    energy=.20+.40*bass
    bands=[int(v*255) for v in [bass,.8*bass,.15,.1,.12,high,.7*high,high]]
    audio=bytearray(19);audio[:8]=bytes(bands);audio[9]=int(energy*255);audio[10]=2 if beat else 0
    pan=math.sin(t*math.pi/3)*.2
    return audio, int((energy+pan*.3)*255),int((energy-pan*.3)*255)

def crc(data):
    c=0xffff
    for byte in data:
        c^=byte<<8
        for _ in range(8):c=((c<<1)^0x1021)&0xffff if c&0x8000 else (c<<1)&0xffff
    return c

with tempfile.TemporaryDirectory(prefix='ef-game-') as tmp:
    tmp=Path(tmp); render=tmp/'render'
    subprocess.run(['g++','-std=c++17','-O2','-I'+str(ref/'Firmware/ergoled_firmware/src/ambient'),str(ROOT/'tools/led/ambient-render.cpp'),'-o',str(render)],check=True)
    # Original 120 BPM stereo music. Analyzer inputs below come from these same
    # scheduled bass/high envelopes; this is a synthetic fixture, not microphone analysis.
    rate=24000; tt=np.arange(duration*rate)/rate; beatpos=tt%.5
    bassenv=np.exp(-beatpos/.14); highenv=(np.sin(tt*math.pi*4)+1)*.22
    pad=np.sin(2*math.pi*220*tt)*.025+np.sin(2*math.pi*330*tt)*.02
    bass=np.sin(2*math.pi*55*tt)*bassenv*.18; high=np.sin(2*math.pi*1760*tt)*highenv*.025
    pan=np.sin(tt*math.pi/3)*.2; fade=np.minimum(1,np.minimum(tt/.15,(duration-tt)/.25))
    pcm=np.stack([(bass+pad+high)*(1+pan)*fade,(bass+pad+high)*(1-pan)*fade],axis=1)
    wav=tmp/'sound.wav'
    with wave.open(str(wav),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes((pcm*32767).astype('<i2').tobytes())
    raw=tmp/'picture.rgb'
    with raw.open('wb') as f:
        for i in range(n//2):f.write(picture(i/30).tobytes())
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{width}x{height}','-r','30','-i',str(raw),'-i',str(wav),'-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-c:a','aac','-b:a','80k','-movflags','+faststart','-shortest',str(OUT/'neon-flight.mp4')],check=True)
    banks={}
    for mode, bits in [('calm',0),('normal',1),('intense',2),('full',2)]:
        pipeline=ambient.Pipeline(geom=geom,mode=mode,fps=fps,hud_mask=False)
        colour_frames=[]
        for i in range(n):
            if i%2==0:pipeline.push_frame(picture(i/fps)[::3,::3],now=i/fps)
            colour_frames.append(pipeline.tick(1/fps))
        for music in [False,True]:
            packets=bytearray()
            for i,leds in enumerate(colour_frames):
                payload=bytearray([0xAD,0x10,i%256,(bits<<4)|(1 if music else 0),8,0])
                for row in leds:
                    keys=np.round(ambient.lin_to_srgb(ambient.to_keyframes(row,K=6))*255).clip(0,255).astype(np.uint8)
                    payload.append(6);payload.extend(keys.tobytes())
                if music:
                    audio,left,right=metrics(i/fps);payload.extend(audio);payload.extend([left,right])
                payload.extend(struct.pack('<H',crc(payload[1:])))
                packets.extend(struct.pack('<H',len(payload)));packets.extend(payload)
            result=subprocess.run([str(render)],input=bytes(packets),stdout=subprocess.PIPE,check=True).stdout
            assert len(result)==n*sum(counts)*4
            name=f'{mode}-{"music" if music else "colours"}.rgbw';(OUT/name).write_bytes(result)
            banks[f'{mode}:{"music" if music else "colours"}']=name
            print(name,len(result),flush=True)
    manifest={'version':1,'title':'Neon Flight','duration':duration,'fps':fps,'frames':n,'counts':counts,'video':'neon-flight.mp4','banks':banks,
              'stage':'compiled Ambient.hpp emit; brightness 255; configured 8000 mA ceiling; raw linear RGBW drive bytes',
              'provenance':'Original synthetic video/audio; actual ambient.py host pipeline and compiled board Ambient.hpp; synthetic scheduled audio metrics; not ESP32 capture',
              'sourceHashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [host,ref/'Firmware/ergoled_firmware/src/ambient/Ambient.hpp']},
              'stripMap':'desk02-config-2026-10-01-address-space-v1','endpointCalibration':'saved operator 2026-10-01T22:51:29; geometry and visibility need current hardware check'}
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (OUT/'README.md').write_text('# Neon Flight\n\nOriginal procedurally authored clip and synthesized music, generated for ErgoFlex.\nNo third-party footage or music. Rebuild with tools/led/build-game-demo.py.\n\n'+manifest['provenance']+'\n\n'+manifest['stage']+'\n')
