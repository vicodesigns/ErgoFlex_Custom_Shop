#!/usr/bin/env python3
"""Poll Downloads and Manifest-Share for render requests."""
import argparse, hashlib, json, os, subprocess, sys, time
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SHARES=[Path(p) for p in os.environ.get('RENDER_REQUEST_DIRS','/home/ergo/Downloads:/home/ergo/Manifest-Share').split(os.pathsep) if p]
STATE=Path(os.environ.get('RENDER_REQUEST_STATE','/home/ergo/.local/state/ergoflex-render-request-bridge/seen.json'))
POLL=float(os.environ.get('RENDER_REQUEST_POLL_SECONDS','15'))
RETRY=float(os.environ.get('RENDER_REQUEST_RETRY_SECONDS','60'))
LOG=ROOT/'exports/render-queue/bridge.log'

def log(level,event,file,detail=''):
    line=f"{time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())} level={level} event={event} request={file} {detail}\n"
    print(line,end='',flush=True)
    try:
        LOG.parent.mkdir(parents=True,exist_ok=True)
        with LOG.open('a') as f: f.write(line)
    except OSError as e: print(f'bridge log write failed: {e}',file=sys.stderr,flush=True)

def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()

def save(state):
    STATE.parent.mkdir(parents=True,exist_ok=True)
    tmp=STATE.with_suffix('.tmp')
    tmp.write_text(json.dumps(state,indent=2)+'\n')
    os.replace(tmp,STATE)

def scan(state,baseline=False):
    files=sorted((p for folder in SHARES for p in folder.glob('Render-request-*.json')), key=lambda p: (p.name, str(p)))
    if baseline and not state.get('_initialized'):
        for p in files:
            try: state[str(p)]={'sha':digest(p),'status':'baseline','at':time.time()}
            except OSError as e: log('error','FAILED',p.name,f'reason=baseline-read:{e}')
        state['_initialized']=True; save(state)
        log('info','BASELINED',f'{len(files)} existing request file(s)','new files will be enqueued automatically')
        return state
    for p in files:
        try: sha=digest(p); st=p.stat()
        except OSError as e: log('error','FAILED',p.name,f'reason=read:{e}'); continue
        key=str(p); old=state.get(key,{})
        if old.get('sha')==sha and old.get('status') in ('accepted','rejected','baseline'): continue
        # Require the file to remain unchanged for one full poll interval before parsing it.
        if old.get('sha')!=sha or old.get('size')!=st.st_size or old.get('mtime_ns')!=st.st_mtime_ns:
            state[key]={'sha':sha,'size':st.st_size,'mtime_ns':st.st_mtime_ns,'status':'observed','at':time.time()}; save(state); continue
        if old.get('status')=='failed' and time.time()-old.get('attempt',0)<RETRY: continue
        proc=subprocess.run([str(ROOT/'tools/experience/render-request.sh'),str(p),str(ROOT)],capture_output=True,text=True)
        if proc.returncode==0:
            out=(proc.stdout+' '+proc.stderr).strip().replace('\n',' ')
            jid=next((x for x in reversed((proc.stdout+'\n'+proc.stderr).split()) if x.startswith('req-')), '')
            state[key]={'sha':sha,'size':st.st_size,'mtime_ns':st.st_mtime_ns,'status':'accepted','job':jid,'at':time.time()}; save(state)
            log('info','ACCEPTED',p.name,f'sha={sha} job={jid or "existing"}')
        else:
            reason=(proc.stderr or proc.stdout or f'exit={proc.returncode}').strip().replace('\n',' ')[:300]
            rejected=reason.startswith('rejected render request:') or reason.startswith('bad render request:') or reason.startswith('chapter ')
            state[key]={'sha':sha,'size':st.st_size,'mtime_ns':st.st_mtime_ns,'status':'rejected' if rejected else 'failed','attempt':time.time(),'at':time.time()}; save(state)
            log('warning' if rejected else 'error','REJECTED' if rejected else 'FAILED',p.name,f'sha={sha} exit={proc.returncode} reason={reason}')
    return state

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--watch',action='store_true'); ap.add_argument('--baseline-existing',action='store_true'); a=ap.parse_args()
    if not any(folder.is_dir() for folder in SHARES): log('error','FAILED','-','reason=request-folders-not-mounted'); return 2
    try: state=json.loads(STATE.read_text()) if STATE.exists() else {}
    except Exception as e: log('error','FAILED','-',f'reason=state-read:{e}'); return 2
    while True:
        state=scan(state,a.baseline_existing)
        if not a.watch: break
        time.sleep(POLL)
        try: state=json.loads(STATE.read_text()) if STATE.exists() else state
        except Exception as e: log('error','FAILED','-',f'reason=state-read:{e}')
    return 0

if __name__=='__main__': raise SystemExit(main())
