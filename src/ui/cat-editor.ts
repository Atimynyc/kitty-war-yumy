import { baseCatParts, baseCatSVG } from '../game/base-cat-art.ts';
import { baseCatMotion } from '../game/base-cat-motion.ts';
import { CAT_OPTIONS, CAT_COLORS, COAT_PALETTES, PLAYER_CAT, breedPreset, breedLabel, copyCat, coatPalette, catSignature, randomCat } from '../game/cat-appearance.ts';
import type { CatAppearance, CatFeature, CatBreed } from '../game/cat-appearance.ts';
import { svgURL } from '../art.ts';

const tabs=[['breed','品种'],['coat','毛色'],['shape','脸与身型'],['face','五官'],['parts','耳尾与爪']] as const;
type Tab=typeof tabs[number][0];
const coatRegions=[['body','身体'],['head','头部'],['markings','花纹'],['belly','肚皮'],['muzzle','口鼻'],['ears','耳内'],['tail','尾巴'],['paws','爪子']] as const;
export function catEditorMarkup() {
  return `<section id="cat-editor" class="menu-screen cat-editor" hidden aria-labelledby="cat-editor-title">
    <div class="cat-heading"><div><span class="eyebrow">A LITTLE CAT, ALL YOURS</span><h1 id="cat-editor-title" tabindex="-1">我的猫咪</h1></div><button id="cat-back" class="menu-secondary">← 首页</button></div>
    <div class="cat-workbench">
      <div class="cat-preview-panel"><div class="cat-preview-top"><span>小窝里的主角</span><button id="cat-motion" aria-pressed="true">动态预览</button></div>
        <div id="cat-preview" class="cat-preview" role="img" aria-label="自定义猫咪的大图预览"></div>
        <div class="cat-preview-caption"><div><strong id="cat-breed-label"></strong><span>陪你守护每一粒冻干</span></div><button id="cat-size" aria-pressed="false">看战场大小</button></div>
        <div class="cat-tools"><button id="cat-random">随机搭配</button><button id="cat-undo" disabled>撤销</button><button id="cat-reset">恢复默认</button></div>
      </div>
      <div class="cat-customization"><nav class="cat-tabs" aria-label="外观分类">${tabs.map(([id,label])=>`<button data-cat-tab="${id}" aria-pressed="${id==='breed'}" aria-controls="cat-options">${label}</button>`).join('')}</nav><div id="cat-options" class="cat-options" tabindex="0" aria-label="猫咪外观选项"></div></div>
    </div>
    <div class="cat-actions"><p id="cat-status" role="status">只改变外观，不影响战斗属性。</p><button id="cat-save" class="primary-button" disabled>已保存</button><span class="cat-storage-note">保存在本机 · 应用于基地旁的我方猫咪</span></div>
    <dialog id="cat-discard" aria-labelledby="cat-discard-title"><h2 id="cat-discard-title">还有没保存的搭配</h2><p>返回会放弃编辑中的修改，已经应用的外观会保留。</p><div class="cat-dialog-actions"><button id="cat-stay" class="primary-button">继续编辑</button><button id="cat-leave" class="menu-secondary">放弃修改并返回</button></div></dialog>
  </section>`;
}

export function installCatEditor(options: { get:()=>CatAppearance; save:(cat: CatAppearance)=>Promise<boolean>; close:()=>void; canSave:()=>boolean }) {
  const root=document.getElementById('cat-editor')!, controls=document.getElementById('cat-options')!, preview=document.getElementById('cat-preview')!;
  const $=<T extends HTMLElement=HTMLElement>(id: string)=>document.getElementById(id)! as T;
  const dialog=$<HTMLDialogElement>('cat-discard'), save=$<HTMLButtonElement>('cat-save');
  let draft=copyCat(PLAYER_CAT),baseline=catSignature(draft),history: CatAppearance[]=[];
  let tab: Tab='breed',region: keyof CatAppearance['coat']='body',busy=false,small=false,moving=true,active=false,frame=0;
  let nodes: Record<string,SVGGElement>={};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const dirty=()=>catSignature(draft)!==baseline;
  const status=(text: string)=>{$('cat-status').textContent=text;};
  function toolbar() {
    save.disabled=busy||!dirty()||!options.canSave(); save.textContent=busy?'正在保存…':dirty()?'保存并应用':'已保存';
    $<HTMLButtonElement>('cat-undo').disabled=busy||history.length===0;
    for(const id of ['cat-back','cat-random','cat-reset'])$<HTMLButtonElement>(id).disabled=busy;
    controls.querySelectorAll<HTMLInputElement|HTMLButtonElement|HTMLSelectElement>('button,input,select').forEach(el=>el.disabled=busy);
    controls.querySelectorAll<HTMLInputElement>('input[type="color"]').forEach(input=>{
      if(input.type==='color')return;
      input.classList.add('cat-color-fallback');input.maxLength=7;input.placeholder='#aab8bf';input.title='输入六位色号，例如 #aab8bf';
    });
    root.setAttribute('aria-busy',String(busy));
  }
  function renderPreview() {
    const parts=baseCatParts(draft),head=['leftEar','rightEar','head','eyes'];
    const markup=(name: string)=>{const p=parts.find(p=>p.name===name)!;return `<g data-preview-part="${p.name}">${p.svg.replace(/^<svg[^>]*>|<\/svg>$/g,'')}</g>`;};
    preview.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" aria-hidden="true">${parts.filter(p=>!head.includes(p.name)&&!['jar','hands'].includes(p.name)).map(p=>markup(p.name)).join('')}<g data-preview-part="headGroup">${head.map(markup).join('')}</g>${markup('jar')}${markup('hands')}</svg>`;
    nodes=Object.fromEntries(Array.from(preview.querySelectorAll<SVGGElement>('[data-preview-part]')).map(n=>[n.dataset.previewPart!,n]));
    $('cat-breed-label').textContent=breedLabel(draft);
    preview.dataset.size=small?'battle':'large';
    pose(performance.now());
  }
  function pose(now: number) {
    const m=baseCatMotion(now/1000,'player','calm',0,!moving||reduced.matches);
    const set=(key: string,value: string)=>nodes[key]?.setAttribute('transform',value);
    set('body',`translate(80 144) scale(${1+m.breath*.55} ${1+m.breath}) translate(-80 -144)`);
    set('headGroup',`translate(${m.headX} ${m.headY}) rotate(${m.headAngle} 80 92)`);
    set('tail',`rotate(${m.tailAngle} 38 132)`);
    set('leftEar',`rotate(${m.leftEarAngle} 46 49)`);set('rightEar',`rotate(${m.rightEarAngle} 114 49)`);
    set('eyes',`translate(0 67) scale(1 ${1-m.blink*.94}) translate(0 -67)`);
    set('scarf',`translate(0 ${m.headY*.35})`);set('hands',`translate(0 ${-m.pawLift})`);set('jar',`translate(0 ${-m.pawLift*.25})`);
  }
  function animate(now: number){if(!active)return;pose(now);frame=requestAnimationFrame(animate);}
  function field(key: CatFeature,label: string) {
    return `<fieldset><legend>${label}</legend><div class="cat-choices">${CAT_OPTIONS[key].map(([value,name])=>`<button data-cat-feature="${key}" data-cat-value="${value}" aria-pressed="${draft[key]===value}">${name}</button>`).join('')}</div></fieldset>`;
  }
  function colorField(key: 'eyes'|'noseColor'|'scarf',label: string) {
    return `<label class="cat-color-label">${label}<input type="color" data-cat-color="${key}" value="${draft[key]}" aria-label="${label}"/></label>`;
  }
  function renderControls() {
    root.querySelectorAll<HTMLButtonElement>('[data-cat-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.catTab===tab)));
    if(tab==='breed')controls.innerHTML=`<p class="cat-hint">先选一位小伙伴，再慢慢捏成你的模样。切换品种会套用整套外观，可以撤销。</p><div class="cat-breeds">${CAT_OPTIONS.breed.map(([id,name])=>`<button data-cat-feature="breed" data-cat-value="${id}" aria-pressed="${draft.breed===id}"><img src="${svgURL(baseCatSVG(breedPreset(id)))}" alt=""/><strong>${name}</strong><span>${id==='british-shorthair'?'圆脸小守卫':id==='domestic-shorthair'?'暖暖的熟悉感':id==='ragdoll'?'蓝眼毛绒伙伴':id==='siamese'?'灵巧的小精灵':id==='persian'?'一团蓬松云朵':'软乎乎的小耳朵'}</span></button>`).join('')}</div>`;
    if(tab==='coat')controls.innerHTML=`<fieldset><legend>整套配色</legend><div class="cat-palettes">${COAT_PALETTES.map((p,i)=>`<button data-cat-palette="${i}" aria-label="${p.name}整套配色"><i style="background:${p.body};border-color:${p.markings}"></i>${p.name}</button>`).join('')}</div></fieldset>${field('pattern','毛色花纹')}<fieldset><legend>分区调色</legend><div class="cat-region-row"><label for="cat-region">当前部位</label><select id="cat-region">${coatRegions.map(([id,name])=>`<option value="${id}" ${id===region?'selected':''}>${name}</option>`).join('')}</select><input type="color" data-cat-coat="true" value="${draft.coat[region]}" aria-label="当前部位自选颜色"/></div><div class="cat-swatches">${CAT_COLORS.map(color=>`<button data-cat-swatch="${color}" style="--swatch:${color}" aria-label="${coatRegions.find(([id])=>id===region)![1]}颜色 ${color}" aria-pressed="${draft.coat[region]===color}"><span aria-hidden="true">${draft.coat[region]===color?'✓':''}</span></button>`).join('')}</div></fieldset>${colorField('scarf','围巾颜色')}`;
    if(tab==='shape')controls.innerHTML=`<p class="cat-hint">从轮廓开始，圆润或灵巧都很可爱。</p>${field('face','脸型')}${field('body','身型')}`;
    if(tab==='face')controls.innerHTML=`${field('eyeShape','眼睛形状')}${colorField('eyes','眼睛颜色')}${field('mouth','嘴巴')}${field('nose','鼻子形状')}${colorField('noseColor','鼻子颜色')}`;
    if(tab==='parts')controls.innerHTML=`${field('ears','耳朵形状')}${field('tail','尾巴形状')}${field('paws','爪子形状')}<p class="cat-hint">想给小爪子穿白袜？到「毛色」里单独调整爪子颜色。</p>`;
    toolbar();
  }
  function change(next: CatAppearance,rerender=true) {
    if(busy||catSignature(next)===catSignature(draft))return;
    history.push(copyCat(draft));if(history.length>30)history.shift();draft=next;
    renderPreview();if(rerender)renderControls();else toolbar();
    status(!options.canSave()?'当前存档只读，可以试搭，暂时无法保存。':dirty()?'搭配已修改，保存后带进关卡。':'已恢复到保存的外观。');
  }
  function back() {
    if(busy)return;
    if(dirty()){dialog.showModal();$('cat-stay').focus();}else options.close();
  }
  $('cat-back').addEventListener('click',back);
  $('cat-stay').addEventListener('click',()=>{dialog.close();$('cat-back').focus();});
  $('cat-leave').addEventListener('click',()=>{dialog.close();options.close();});
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();$('cat-back').focus();});
  root.addEventListener('click',event=>{
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button||busy)return;
    if(button.dataset.catTab){tab=button.dataset.catTab as Tab;renderControls();controls.scrollTop=0;}
    const key=button.dataset.catFeature as CatFeature|undefined;
    if(key){const value=button.dataset.catValue!;change(key==='breed'?breedPreset(value as CatBreed):{...copyCat(draft),[key]:value});controls.querySelector<HTMLButtonElement>(`[data-cat-feature="${key}"][data-cat-value="${value}"]`)?.focus({preventScroll:true});}
    if(button.dataset.catPalette){const index=Number(button.dataset.catPalette);change(coatPalette(draft,index));controls.querySelector<HTMLButtonElement>(`[data-cat-palette="${index}"]`)?.focus({preventScroll:true});}
    if(button.dataset.catSwatch){const value=button.dataset.catSwatch;change({...copyCat(draft),coat:{...draft.coat,[region]:value}});controls.querySelector<HTMLButtonElement>(`[data-cat-swatch="${value}"]`)?.focus({preventScroll:true});}
  });
  controls.addEventListener('change',event=>{const input=event.target as HTMLSelectElement;if(input.id==='cat-region'){region=input.value as typeof region;renderControls();$('cat-region').focus({preventScroll:true});}});
  const onColor=(event: Event)=>{
    const input=event.target as HTMLInputElement;
    if(!input.dataset.catCoat&&!input.dataset.catColor)return;
    if(!/^#[0-9a-f]{6}$/i.test(input.value)){if(event.type==='change')status('请输入完整色号，例如 #aab8bf。');return;}
    const value=input.value.toLowerCase();
    if(input.dataset.catCoat)change({...copyCat(draft),coat:{...draft.coat,[region]:value}},false);
    else if(input.dataset.catColor)change({...copyCat(draft),[input.dataset.catColor]:value},false);
    controls.querySelectorAll<HTMLButtonElement>('[data-cat-swatch]').forEach(button=>{
      const selected=button.dataset.catSwatch===draft.coat[region];
      button.setAttribute('aria-pressed',String(selected));button.querySelector('span')!.textContent=selected?'✓':'';
    });
  };
  controls.addEventListener('input',onColor);
  controls.addEventListener('change',onColor);
  $('cat-random').addEventListener('click',()=>change(randomCat()));
  $('cat-reset').addEventListener('click',()=>change(copyCat(PLAYER_CAT)));
  $('cat-undo').addEventListener('click',()=>{const previous=history.pop();if(!previous||busy)return;draft=previous;renderPreview();renderControls();status(dirty()?'已撤销上一步，记得保存。':'已回到保存的外观。');});
  $('cat-size').addEventListener('click',()=>{small=!small;preview.dataset.size=small?'battle':'large';$('cat-size').setAttribute('aria-pressed',String(small));$('cat-size').textContent=small?'返回大图':'看战场大小';preview.setAttribute('aria-label',small?'约 64 像素的战场大小参考，实际随屏幕调整':'自定义猫咪的大图预览');});
  $('cat-motion').addEventListener('click',()=>{moving=!moving;$('cat-motion').setAttribute('aria-pressed',String(moving));});
  save.addEventListener('click',async()=>{
    if(busy||!dirty()||!options.canSave())return;
    busy=true;toolbar();status('正在给小伙伴换上新模样…');
    try {
      if(await options.save(copyCat(draft))){baseline=catSignature(draft);status('已保存到本机，下次开局和继续对局都会带上它。');}
      else status('已应用，但本机保存失败。请重试，关闭页面可能丢失。');
    } catch {status('外观未能保存，请重试。之前的存档仍然保留。');}
    finally{busy=false;toolbar();}
  });
  return {
    open(label: string){draft=copyCat(options.get());baseline=catSignature(draft);history=[];tab='breed';$('cat-back').textContent=`← ${label}`;renderPreview();renderControls();controls.scrollTop=0;status(options.canSave()?'只改变外观，不影响战斗属性。':'当前存档只读，可以试搭，暂时无法保存。');active=true;cancelAnimationFrame(frame);frame=requestAnimationFrame(animate);},
    stop(){active=false;cancelAnimationFrame(frame);},
    back,
    snapshot(){return {tab,draft:copyCat(draft),dirty:dirty(),busy};},
  };
}
