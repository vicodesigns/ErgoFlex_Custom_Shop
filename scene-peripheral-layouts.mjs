import { SCENE_PRODUCT_REFERENCE } from './scene-product-reference.mjs';
import { cleanDeskObjects, seedSceneDeskSize } from './scene-desk-data.mjs';

const clone=value=>JSON.parse(JSON.stringify(value));
const profiles={
    office:'office',home:'office',coworking:'office',library:'library',study:'library',
    music:'music',gaming:'gaming',creative:'creative',gallery:'artist',workshop:'architect',
    lounge:'compact',bedroom:'compact',kitchen:'compact',gym:'compact',scifi:'creative',
    security:'office',police:'office',government:'office',hospital:'occ',laboratory:'office',mobileit:'office',
    kindergarten:'compact',elementary:'compact',middleschool:'compact',highschool:'office',college:'occ',university:'library',occmedialab:'occ'
};
export function scenePeripheralRecipe(sceneId,station='main') {
    if(sceneId==='occmedialab'){
        if(/sound|audio/.test(station))return 'music';
        if(/animation|digital-art/.test(station))return 'creative';
        if(/film-edit|colour/.test(station))return 'office';
        return 'occ';
    }
    if(/paint|easel/.test(station))return 'artist';
    if(/draft|architect|drawing/.test(station))return 'architect';
    if(/illustrat|design|diagnostic|analysis/.test(station))return 'creative';
    if(/read|study|research/.test(station)&&!['laboratory','mobileit'].includes(sceneId))return 'library';
    if(station!=='main'&&/visitor|intake|service|student|coach|review|checkout/.test(station))return 'compact';
    return profiles[sceneId]||'compact';
}
export function peripheralReference(recipe,size) {
    const ref=clone(SCENE_PRODUCT_REFERENCE[recipe]?.[size]||SCENE_PRODUCT_REFERENCE.compact[size]);
    // Leave the narrow music/digital stations room for their instruments and
    // drawing tools. The fitted single-screen clusters come from the owner's
    // Artist and Office examples; the 60-inch versions retain their two screens.
    if(size==='48x30'&&['creative','music'].includes(recipe)){
        const donor=SCENE_PRODUCT_REFERENCE[recipe==='creative'?'artist':'office'][size];
        ref.config.accessories=ref.config.accessories.filter(id=>!['portrait-monitor','monitor-arm-2'].includes(id));
        if(!ref.config.accessories.includes('monitor-arm'))ref.config.accessories.push('monitor-arm');
        delete ref.objects['accessory-portrait-monitor'];delete ref.objects['accessory-monitor-arm-2'];
        ref.objects['accessory-monitor-arm']=clone(donor.objects['accessory-monitor-arm']);
        const display=recipe==='creative'?'flat-monitor':'wide-monitor';
        ref.objects['accessory-'+display]=clone(donor.objects['accessory-'+display]);
    }
    return ref;
}
export function seedScenePeripherals(state,sceneId,station='main') {
    state.artwork||={v:1,surfaces:{}};
    if(state.peripheralSetup==='product-reference-v1')return state;
    const recipe=scenePeripheralRecipe(sceneId,station),ref=peripheralReference(recipe,state.size);
    state.accessories=ref.config.accessories;
    state.accessoryFinishes=ref.config.accessoryFinishes||{};
    state.peripheralRecipe=recipe;state.peripheralSetup='product-reference-v1';
    // Existing library additions and activity materials retain their identities.
    // Purchased peripheral IDs get the owner's measured Product placements.
    state.objects={...state.objects,...cleanDeskObjects(ref.objects)};
    return state;
}
export function seedSceneSizeWithPeripherals(source,size) {
    const draft=seedSceneDeskSize(source,size);
    if(!draft)return null;
    // Both CAD widths share the same charging insert. Its phone keeps that
    // measured contact point when a new width is first seeded.
    if(draft.objects['default-library-iphone'])draft.objects['default-library-iphone'].transform.p.x=source.objects['default-library-iphone'].transform.p.x;
    if(source.peripheralSetup==='product-reference-v1'){
        const ref=peripheralReference(source.peripheralRecipe,size);
        const previous=peripheralReference(source.peripheralRecipe,source.size);
        const selectedSource=new Set(source.accessories||[]),originalSource=new Set(previous.config.accessories);
        const removed=new Set([...originalSource].filter(id=>!selectedSource.has(id)));
        draft.accessories=[...new Set([...ref.config.accessories.filter(id=>!removed.has(id)),...[...selectedSource].filter(id=>!originalSource.has(id))])];
        // A monitor-free station must not acquire a different screen/arm ID
        // when its other width is seeded. Explicit later additions are retained.
        if(source.shelfStation==='shelf-first-v1')draft.accessories=draft.accessories.filter(id=>!(/monitor|^obsbot-tiny-2$/.test(id))||selectedSource.has(id));
        draft.accessoryFinishes={...ref.config.accessoryFinishes};
        for(const [id,finish] of Object.entries(source.accessoryFinishes||{}))if(finish!==previous.config.accessoryFinishes?.[id])draft.accessoryFinishes[id]=finish;
        const selected=new Set(draft.accessories.map(id=>'accessory-'+id));
        for(const id of Object.keys(draft.objects))if(id.startsWith('accessory-')&&!selected.has(id))delete draft.objects[id];
        const objects=cleanDeskObjects(ref.objects);
        for(const [id,obj] of Object.entries(objects))if(selected.has(id))draft.objects[id]={...obj,...(source.objects[id]?.removed?{removed:true}:{})};
    }
    return draft;
}
export function isLegacyScenePeripheral(obj) {
    const id=obj.userData.propId||'',name=obj.name||'';
    return /keyboard|mouse|monitor|display|screen|keyboard.*tray/i.test(id+' '+name);
}
