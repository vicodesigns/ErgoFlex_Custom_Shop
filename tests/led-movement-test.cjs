const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
    const {sampleMovementInto,LedMotion,wheelDirection}=await import('../led-movement.mjs');
    const {createLedFrame}=await import('../led-strip-map.mjs');
    const suite=JSON.parse(fs.readFileSync(__dirname+'/fixtures/led-movement-reference-v1.json','utf8'));
    const frame=createLedFrame();
    for(const reference of suite.frames){sampleMovementInto(frame,reference);assert.deepEqual(frame.map(row=>Array.from({length:row.length/4},(_,i)=>[...row.slice(i*4,i*4+4)])),reference.rgbw);}
    assert.equal(suite.frames.length,56);
    const directions=[[-0, -1,0,1],[0,1,0,2],[1,0,0,3],[-1,0,0,4],[0,0,-1,5],[0,0,1,6],[1,-1,0,7],[-1,-1,0,8],[1,1,0,9],[-1,1,0,10]];
    directions.forEach(([x,z,yaw,ix])=>assert.equal(wheelDirection(x,z,yaw),ix));
    for(const ix of [5,6]){
        const args={fx:36,ix,sx:180,elapsedMs:1000,colors:[[255,0,0,0],[255,0,0,0],[255,70,0,0]]};
        const reversed=createLedFrame(),opposite=createLedFrame();
        sampleMovementInto(reversed,{...args,reverseRotation:true});
        sampleMovementInto(opposite,{...args,ix:11-ix});
        assert.deepEqual(reversed,opposite,'Rotation preview reverses comet travel without changing the physical direction ID');
        sampleMovementInto(frame,args);assert.notDeepEqual(reversed,frame);
    }
    const start={lift:43.5,tilt:-5,x:0,z:0,yaw:0},motion=new LedMotion();
    motion.observe(start,0);motion.observe({...start,lift:44},20);assert.equal(motion.owner.name,'Lift up');
    motion.observe({...start,lift:44.1,tilt:-4},40);assert.equal(motion.owner.name,'Tilt retract');
    motion.observe({...start,lift:44.2,tilt:-3},60);assert.equal(motion.owner.name,'Tilt retract','Continuous axes do not compete every tick');
    motion.observe({...start,lift:44.3,tilt:-3,x:.02},80);assert.equal(motion.owner.fx,36);assert.equal(motion.owner.ix,3);
    motion.observe({...start,lift:44.3,tilt:-3,x:.02},100);assert.equal(motion.owner,null,'Release restores ambient/base immediately');
    motion.reset(start);motion.observe({...start,lift:44},100);motion.observe({...start,lift:44},120,{liftReached:true});
    assert.equal(motion.completionUntil,5120);assert.equal(motion.sample(frame,200),true);assert.equal(frame[0][1],254);
    motion.observe({...start,lift:44,x:.01},300);assert.equal(motion.completionUntil,0,'New owner cancels completion without stale timers');
    motion.observe({...start,lift:44,x:.02},5200);assert.equal(motion.owner.fx,36,'Old completion expiry cannot clear wheels');
    motion.cancel(start);motion.observe(start,6000);assert.equal(motion.owner,null,'Held limit/stationary desk has no cue');
    motion.observe({...start,yaw:.02},6020);assert.equal(motion.owner.reverseRotation,true);assert.equal(motion.owner.ix,6);
    const {LedSounds}=await import('../led-sounds.mjs');
    class AudioMock{constructor(src){this.src=src;this.currentTime=0;this.paused=true;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
    global.Audio=AudioMock;const sound=new LedSounds();sound.update('movement_wheels');assert.equal(sound.loop,null,'Default silent');
    sound.setEnabled(true);await Promise.resolve();sound.update('movement_wheels');assert.equal(sound.loop.loop,true);assert.equal(sound.loop.paused,false);
    sound.update('movement_lift_up');assert.match(sound.loop.src,/movement_lift_up/);sound.update(null,true);assert.equal(sound.loop.paused,true);assert.match(sound.cue.src,/target_reached/);
    sound.stop();assert.equal(sound.cue.paused,true);sound.dispose();assert.equal(sound.enabled,false);
    const {validateGameManifest,sampleGameBank}=await import('../led-game-frames.mjs');
    const manifest=JSON.parse(fs.readFileSync(__dirname+'/../assets/led/game/manifest.json','utf8'));
    validateGameManifest(manifest,suite.counts);assert.throws(()=>validateGameManifest({...manifest,frames:1000000},suite.counts));
    const stride=suite.counts.reduce((a,b)=>a+b,0)*4;
    for(const name of Object.values(manifest.banks))assert.equal(fs.statSync(__dirname+'/../assets/led/game/'+name).size,manifest.frames*stride);
    const bank=fs.readFileSync(__dirname+'/../assets/led/game/'+manifest.banks['normal:colours']);
    sampleGameBank(frame,bank,manifest,2);assert.deepEqual(frame.flatMap(row=>[...row]),[...bank.subarray(120*stride,121*stride)]);
    sampleGameBank(frame,bank,manifest,999);assert.deepEqual(frame.flatMap(row=>[...row]),[...bank.subarray((manifest.frames-1)*stride)]);
    const music=fs.readFileSync(__dirname+'/../assets/led/game/'+manifest.banks['normal:music']);assert.notDeepEqual(music,bank,'Actual compiled audio fusion changes RGBW');
    console.log('56 movement reference frames, ten wheel directions, motion ownership/release/completion, muted sounds and all eight compiled Game Mode banks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
