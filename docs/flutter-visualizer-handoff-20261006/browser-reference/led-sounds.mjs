export class LedSounds {
    constructor(base = './assets/led/audio/') {this.base=base;this.enabled=false;this.volume=.3;this.owner=null;this.loop=null;this.cue=null;this.generation=0;this.error='';}
    setEnabled(value) {
        this.enabled=!!value;this.stop();this.error='';
        // This method is called directly from the opt-in click. Prime the same
        // media element during that gesture; subsequent motion reuses it.
        if(this.enabled){this.loop=new Audio(this.base+'movement_start.mp3');this.loop.volume=0;
            const token=this.generation;this.loop.play().then(()=>{if(token===this.generation){this.loop.pause();this.loop.currentTime=0;this.loop.volume=this.volume;}}).catch(()=>{if(token===this.generation&&this.enabled)this.error='Sound could not start. Tap Movement sounds again.';});}
    }
    setVolume(value) {this.volume=Math.max(0,Math.min(1,Number(value)||0));if(this.loop)this.loop.volume=this.volume;if(this.cue)this.cue.volume=this.volume;}
    update(name, completed=false) {
        if(!this.enabled)return;
        if(name!==this.owner){this.generation++;if(this.loop){this.loop.pause();this.loop.currentTime=0;}
            this.owner=name;
            if(name){this.loop ||= new Audio();this.loop.src=this.base+name+'.mp3';this.loop.loop=true;this.loop.volume=this.volume;
                const token=this.generation;this.loop.play().catch(()=>{if(token===this.generation)this.error='Movement sound unavailable.';});}
        }
        if(completed){if(this.cue){this.cue.pause();this.cue.currentTime=0;}this.cue=new Audio(this.base+'target_reached.mp3');this.cue.volume=this.volume;this.cue.play().catch(()=>{});}
    }
    stop() {this.generation++;for(const media of [this.loop,this.cue])if(media){media.pause();media.currentTime=0;}this.owner=null;}
    dispose(){this.stop();this.loop=this.cue=null;this.enabled=false;}
}
