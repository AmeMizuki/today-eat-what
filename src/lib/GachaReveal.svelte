<script>
  import { onMount, tick } from 'svelte';
  import { ArrowRight, Sparkles, Star, UtensilsCrossed } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button/index.js';

  let { restaurant, oncomplete, children } = $props();
  let phase = $state('waiting');
  let reducedMotion = $state(false);
  let imageFailed = $state(false);
  let completed = false;
  let destroyed = false;
  const timers = new Set();
  const captions = {
    charge: ['匯聚今天的好運', '讓金色光芒，帶來午餐的靈感。'],
    arrive: ['專屬餐卡，降臨', '這一次，只為你選出一間。'],
    flip: ['揭曉你的命定午餐', '好好吃飯，就是今天的小幸運。'],
    reveal: ['今天，就吃這一家', '你的午餐靈感，已經送達。'],
  };
  const caption = $derived(captions[phase]);
  // Fixed positions keep the 48-particle effect reproducible without a frame loop.
  const particles = Array.from({ length: 48 }, (_, index) => {
    const angle = index * 2.399963;
    const radius = 150 + (index % 7) * 22;
    return {
      x: `${Math.cos(angle) * radius}px`,
      y: `${Math.sin(angle) * radius}px`,
      delay: `${index < 24 ? (index % 8) * 130 : 4000 + (index % 6) * 90}ms`,
      size: `${index % 4 === 0 ? 8 : 5}px`,
    };
  });

  function clearTimers() {
    for (const timer of timers) window.clearTimeout(timer);
    timers.clear();
  }

  async function complete() {
    if (completed || destroyed || phase === 'waiting') return;
    completed = true;
    clearTimers();
    phase = 'settled';
    await tick();
    if (!destroyed) oncomplete?.();
  }

  function start() {
    if (phase !== 'waiting' || destroyed) return;
    phase = 'charge';
    if (reducedMotion) {
      schedule(complete, 150);
      return;
    }
    schedule(() => { phase = 'arrive'; }, 1800);
    schedule(() => { phase = 'flip'; }, 3600);
    schedule(() => { phase = 'reveal'; }, 5000);
    schedule(complete, 7200);
  }

  function schedule(callback, delay) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!completed && !destroyed) callback();
    }, delay);
    timers.add(timer);
  }

  onMount(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = preference.matches;
    const changePreference = (event) => {
      reducedMotion = event.matches;
      if (event.matches && phase !== 'waiting') complete();
    };
    preference.addEventListener('change', changePreference);

    return () => {
      destroyed = true;
      clearTimers();
      preference.removeEventListener('change', changePreference);
    };
  });
</script>

<div class="summon" class:reduced-motion={reducedMotion} data-phase={phase}>
  {#if phase === 'settled'}
    <section class="settled-result" aria-label="今日午餐結果">
      <div class="result-art">
        {#if restaurant.image && !imageFailed}
          <img src={restaurant.image} referrerpolicy="no-referrer" alt="餐廳照片" onerror={() => { imageFailed = true; }} />
        {:else}
          <div class="result-photo-fallback"><UtensilsCrossed size={64} strokeWidth={1.2} /><span>尚無餐廳照片</span></div>
        {/if}
        <span class="art-seal"><Sparkles size={16} /> 今日之選</span>
      </div>
      <div class="result-copy">
        <h2>今天，就吃這一家</h2>
        <p class="result-category">{restaurant.category || '自選店家'}</p>
        <h3>{restaurant.name}</h3>
        {#if restaurant.address}<p class="result-address">{restaurant.address}</p>{/if}
        <div class="result-divider" aria-hidden="true"><Star size={14} /></div>
        {@render children?.()}
      </div>
    </section>
  {:else}
  {#if phase !== 'waiting'}
    <p class="sr-status" role="status" aria-live="polite" aria-atomic="true">正在揭曉已選好的午餐。你可以隨時略過動畫，直接查看結果。</p>
  {/if}
  <div class="cinematic">
    <div class="ambient"></div>
    {#if phase !== 'waiting'}
    <header class="summon-heading">
      <h2>{caption[0]}</h2>
    </header>
    {/if}

    <div class="stage">
      {#if phase !== 'waiting'}
      <div class="rays"></div>
      <div class="charging-ring ring-outer"></div>
      <div class="charging-ring ring-inner"></div>
      <div class="bloom"></div>
      <div class="reveal-halo"></div>
      <div class="particles">
        {#each particles as particle, index}
          <span
            class:inward={index < 24}
            class:outward={index >= 24}
            class:glitter={index % 3 === 0}
            style={`--x:${particle.x};--y:${particle.y};--delay:${particle.delay};--size:${particle.size}`}
          ></span>
        {/each}
      </div>
      {/if}

      <div class="card-flight">
        <div class="card-turn">
          {#if phase === 'waiting'}
          <button class="card-face card-back waiting-card" aria-label="揭曉午餐卡片" onclick={start}>
            <span class="back-frame" aria-hidden="true"></span>
            <span class="back-ornament ornament-top" aria-hidden="true"><Sparkles size={22} /></span>
            <span class="crest" aria-hidden="true"><UtensilsCrossed size={54} strokeWidth={1.2} /></span>
            <span class="back-title" aria-hidden="true">午餐奇遇</span>
            <span class="back-subtitle" aria-hidden="true">一餐一會 · 美味將至</span>
            <span class="back-ornament ornament-bottom" aria-hidden="true"><Sparkles size={22} /></span>
          </button>
          {:else}
          <div class="card-face card-back" aria-hidden="true">
            <div class="back-frame"></div>
            <div class="back-ornament ornament-top"><Sparkles size={22} /></div>
            <div class="crest"><UtensilsCrossed size={54} strokeWidth={1.2} /></div>
            <p class="back-title">午餐奇遇</p>
            <p class="back-subtitle">一餐一會 · 美味將至</p>
            <div class="back-ornament ornament-bottom"><Sparkles size={22} /></div>
            <div class="foil"></div>
          </div>
          <div class="card-face card-front" aria-hidden="true">
            <div class="restaurant-photo">
              <div class="photo-fallback"><UtensilsCrossed size={58} strokeWidth={1.2} /><span>美味，值得期待</span></div>
              {#if restaurant.image && !imageFailed}
                <img src={restaurant.image} referrerpolicy="no-referrer" alt="" loading="eager" onerror={() => { imageFailed = true; }} />
              {/if}
              <span class="chosen-label"><Sparkles size={14} /> 今日之選</span>
            </div>
            <div class="restaurant-details">
              <p class="restaurant-category">{restaurant.category || '美味料理'}</p>
              <h3>{restaurant.name}</h3>
              <span class="front-ornament"><Star size={12} /> 好好享用這一餐 <Star size={12} /></span>
            </div>
            <div class="front-foil"></div>
          </div>
          {/if}
        </div>
      </div>
    </div>

    {#if phase !== 'waiting'}<p class="sequence-caption">{caption[1]}</p>{/if}
  </div>

  {#if phase !== 'waiting'}
  <div class="skip-control">
    <Button variant="ghost" onclick={complete}>略過動畫 <ArrowRight size={17} aria-hidden="true" /></Button>
  </div>
  {/if}
  {/if}
</div>

<style>
  .summon {
    position: relative;
    isolation: isolate;
    width: 100%;
    height: 100%;
    min-height: 360px;
    overflow: hidden;
    border-radius: inherit;
    background: #16110e;
    color: #fff1d1;
    font-family: inherit;
  }
  .cinematic { position: absolute; inset: 0; overflow: hidden; }
  .ambient {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 50% 48%, #59401e80 0%, #30221455 35%, transparent 70%), linear-gradient(145deg, #211713, #100d0b);
  }
  .summon-heading { position: absolute; z-index: 3; top: 7%; left: 20px; right: 20px; text-align: center; }
  .summon-heading h2 { margin: 0; font-size: clamp(22px, 4.5vw, 30px); font-weight: 500; letter-spacing: .08em; }
  .stage { position: absolute; inset: 126px 0 118px; display: grid; place-items: center; perspective: 1200px; }
  .charging-ring, .reveal-halo, .bloom, .rays { position: absolute; pointer-events: none; }
  .charging-ring { width: min(340px, 82vw); aspect-ratio: 1; border: 1px solid #e5bd64; border-radius: 50%; opacity: 0; box-shadow: 0 0 22px #dba64440, inset 0 0 20px #dba64420; animation: charge-ring 3.6s ease-out both; }
  .ring-inner { width: min(292px, 72vw); border-style: dashed; border-color: #b99154; animation-delay: 100ms; }
  .rays { width: min(650px, 150vw); aspect-ratio: 1; background: repeating-conic-gradient(from 8deg, transparent 0deg 17deg, #e7bc5a33 18deg 21deg, transparent 22deg 36deg); mask-image: radial-gradient(circle, transparent 13%, black 36%, transparent 68%); opacity: 0; animation: rays 5.8s 1400ms ease-out both; }
  .bloom { width: min(600px, 140vw); aspect-ratio: 1; background: radial-gradient(circle, #ffe5a3b0 0%, #d5993860 30%, transparent 66%); opacity: 0; animation: bloom 3.6s 3600ms ease-out both; }
  .reveal-halo { width: min(310px, 78vw); aspect-ratio: 1; border: 2px solid #f6d68f; border-radius: 50%; opacity: 0; box-shadow: 0 0 28px #f8cf6c66; animation: halo 3.2s 4000ms ease-out both; }
  .particles { position: absolute; inset: 50% auto auto 50%; }
  .particles span { position: absolute; width: var(--size); height: var(--size); background: #ffe9ac; border-radius: 50%; box-shadow: 0 0 12px #f9d276, 0 0 22px #e7b34d70; opacity: 0; }
  .particles .glitter::before, .particles .glitter::after { content: ''; position: absolute; left: 50%; top: 50%; width: calc(var(--size) * 3); height: 2px; transform: translate(-50%, -50%); background: #fff6d6; border-radius: 50%; }
  .particles .glitter::after { width: 2px; height: calc(var(--size) * 3); }
  .inward { animation: gather 2100ms var(--delay) cubic-bezier(.4, 0, .7, 1) both; }
  .outward { animation: burst 2650ms var(--delay) cubic-bezier(.16, 1, .3, 1) both; }
  .card-flight { position: relative; z-index: 2; width: min(280px, 68vw, calc((100svh - 270px) * .68)); max-height: 100%; aspect-ratio: .68; transform-style: preserve-3d; opacity: 0; animation: arrival 1800ms 1800ms cubic-bezier(.16, 1, .3, 1) both; }
  .card-turn { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; animation: card-flip 1400ms 3600ms cubic-bezier(.45, 0, .2, 1) both; }
  .card-face { position: absolute; inset: 0; overflow: hidden; border: 2px solid #e8c275; border-radius: 17px; backface-visibility: hidden; -webkit-backface-visibility: hidden; box-shadow: 0 22px 65px #0009, 0 0 24px #e4b96125; }
  .card-back { display: flex; align-items: center; justify-content: center; flex-direction: column; background: repeating-linear-gradient(45deg, transparent 0 9px, #e7c57406 10px 11px), radial-gradient(ellipse, #513822, #261a13 70%); }
  .back-frame { position: absolute; inset: 11px; border: 1px solid #c69b53; border-radius: 9px; }
  .back-frame::before, .back-frame::after { content: ''; position: absolute; inset: 9px; border: 1px solid #b68c473d; border-radius: 45% 45% 9px 9px; }
  .back-frame::after { transform: rotate(180deg); }
  .crest { display: grid; place-items: center; width: 112px; height: 112px; border: 1px solid #dfbb74; outline: 1px solid #bd945650; outline-offset: 8px; border-radius: 50%; color: #f4d490; background: radial-gradient(circle, #c58b2e25, transparent); }
  .back-title { margin: 30px 0 8px; font-size: 26px; letter-spacing: .24em; text-indent: .24em; color: #ffe4ac; }
  .back-subtitle { margin: 0; font-size: 14px; letter-spacing: .1em; color: #d7bb8a; }
  .back-ornament { position: absolute; color: #e7c579; font-size: 24px; }
  .ornament-top { top: 24px; }
  .ornament-bottom { bottom: 24px; }
  .foil, .front-foil { position: absolute; inset: -50%; pointer-events: none; background: linear-gradient(115deg, transparent 38%, #fff0ba08 43%, #fff1bf4a 49%, #fff5d30d 54%, transparent 60%); opacity: 0; }
  .foil { animation: foil 1600ms 2200ms ease-out both; }
  .front-foil { animation: foil 1700ms 5000ms ease-out both; }
  .card-front { transform: rotateY(180deg); background: #fbf5e8; color: #352818; }
  .restaurant-photo { position: relative; height: 60%; overflow: hidden; background: #453322; }
  .restaurant-photo::after { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 55%, #1d130f77); }
  .restaurant-photo img { position: relative; width: 100%; height: 100%; object-fit: cover; }
  .photo-fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: #f4d290; background: radial-gradient(circle at 50% 40%, #735231, #302319); }
  .photo-fallback span { font-size: 14px; }
  .chosen-label { position: absolute; top: 13px; left: 12px; z-index: 1; display: flex; align-items: center; gap: 5px; padding: 6px 10px; border: 1px solid #e7c57d99; border-radius: 99px; background: #241b12df; color: #ffe3a2; font-size: 12px; }
  .restaurant-details { position: relative; display: flex; height: 40%; padding: 13px 15px; flex-direction: column; justify-content: center; text-align: center; background: linear-gradient(140deg, #fffbef, #ead6ab40); }
  .restaurant-category { margin: 0 0 7px; color: #7a541e; font-size: 14px; }
  .restaurant-details h3 { margin: 0; color: #30281e; font-size: clamp(20px, 4.7vw, 26px); font-weight: 700; line-height: 1.35; overflow-wrap: anywhere; display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .front-ornament { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 12px; color: #80612c; font-size: 12px; }
  .sequence-caption { position: absolute; bottom: 79px; left: 16px; right: 16px; margin: 0; color: #e1cba5; font-size: 16px; line-height: 1.6; text-align: center; }
  .skip-control { position: absolute; z-index: 5; bottom: 20px; left: 50%; transform: translateX(-50%); }
  .skip-control :global(button) { min-height: 44px; padding: 8px 20px; border: 1px solid #c5a67666; border-radius: 99px; background: #211912; color: #f5e5c6; font-size: 14px; gap: 12px; transition: background-color 150ms ease, border-color 150ms ease; }
  .skip-control :global(button:hover) { background: #3a2b1c; border-color: #e4c487; color: #fff3d7; }
  .skip-control :global(button:focus-visible) { outline: 2px solid #f6d68f; outline-offset: 4px; }
  .sr-status { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }

  @keyframes charge-ring { 0% { opacity: 0; transform: scale(.6) rotate(-30deg); } 35% { opacity: .8; } 70% { opacity: .65; } 100% { opacity: 0; transform: scale(1.12) rotate(30deg); } }
  @keyframes gather { 0% { opacity: 0; transform: translate(var(--x), var(--y)) scale(.4); } 20% { opacity: .9; } 80% { opacity: .8; } 100% { opacity: 0; transform: translate(0, 0) scale(.2); } }
  @keyframes burst { 0% { opacity: 0; transform: translate(0, 0) scale(.3) rotate(0deg); } 12% { opacity: 1; } 65% { opacity: .8; } 100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(.5) rotate(140deg); } }
  @keyframes arrival { 0% { opacity: 0; transform: translateY(360px) translateZ(-220px) rotateX(48deg) rotateZ(-16deg) scale(.65); } 25% { opacity: 1; } 76% { transform: translateY(-13px) translateZ(0) rotateX(-5deg) rotateZ(3deg) scale(1.02); } 100% { opacity: 1; transform: translateY(0) translateZ(0) rotateX(0) rotateZ(0) scale(1); } }
  @keyframes card-flip { 0% { transform: rotateY(0); } 40% { transform: rotateY(75deg) scale(1.04); } 100% { transform: rotateY(180deg) scale(1); } }
  @keyframes halo { 0% { opacity: 0; transform: scale(.55); } 20% { opacity: .8; } 100% { opacity: 0; transform: scale(1.9); } }
  @keyframes bloom { 0% { opacity: 0; transform: scale(.7); } 45% { opacity: .85; } 100% { opacity: .25; transform: scale(1.15); } }
  @keyframes rays { 0% { opacity: 0; transform: rotate(-12deg) scale(.7); } 45% { opacity: .8; } 100% { opacity: .2; transform: rotate(12deg) scale(1.05); } }
  @keyframes foil { 0% { opacity: 0; transform: translateX(-65%); } 25%, 65% { opacity: .85; } 100% { opacity: 0; transform: translateX(65%); } }
  @keyframes gentle-fade { from { opacity: 0; } to { opacity: 1; } }

  .reduced-motion .charging-ring, .reduced-motion .particles, .reduced-motion .rays, .reduced-motion .reveal-halo, .reduced-motion .bloom, .reduced-motion .foil, .reduced-motion .front-foil { display: none; }
  .reduced-motion .card-flight { animation: gentle-fade 150ms ease-out both; transform: none; }
  .reduced-motion .card-turn { animation: none; transform: none; }
  .reduced-motion .card-back:not(.waiting-card) { display: none; }
  .reduced-motion .card-front { transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .charging-ring, .particles, .rays, .reveal-halo, .bloom, .foil, .front-foil { display: none; }
    .card-flight { animation: gentle-fade 150ms ease-out both; transform: none; }
    .card-turn { animation: none; transform: none; }
    .card-back:not(.waiting-card) { display: none; }
    .card-front { transform: none; }
  }
  @media (max-height: 620px) {
    .summon-heading { top: 20px; }
    .summon-heading h2 { font-size: 22px; }
    .stage { top: 96px; bottom: 107px; }
    .sequence-caption { bottom: 72px; font-size: 14px; }
    .crest { width: 76px; height: 76px; }
    .back-title { margin-top: 20px; font-size: 22px; }
    .back-subtitle { font-size: 14px; }
    .ornament-top { top: 14px; }
    .ornament-bottom { bottom: 14px; }
    .front-ornament { display: none; }
    .restaurant-details { padding: 8px 12px; }
    .restaurant-category { margin-bottom: 4px; }
  }
  .summon[data-phase='waiting'] .card-flight { animation: none; opacity: 1; transform: none; }
  .summon[data-phase='waiting'] .card-turn { animation: none; transform: none; }
  .summon[data-phase='waiting'] .stage { inset: 32px 0; }
  .waiting-card { width: 100%; padding: 0; font: inherit; cursor: pointer; }
  .waiting-card:focus-visible { outline: 3px solid #ffe5a3; outline-offset: 7px; }

  .settled-result {
    position: relative;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr);
    align-items: center;
    gap: clamp(24px, 4vw, 44px);
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 56px 40px 40px;
    background: radial-gradient(ellipse at 23% 46%, #9a6d302b, transparent 58%), linear-gradient(145deg, #251a13, #110e0c);
    animation: gentle-fade 180ms ease-out;
    scrollbar-color: #a78248 #211912;
  }
  .result-art { position: relative; min-width: 0; height: 410px; border: 1px solid #e0bc77; border-radius: 18px; padding: 7px; background: #5f43251c; box-shadow: 0 0 0 5px #d8ad6020, 0 24px 65px #0007, 0 0 80px #ce9b3420; }
  .result-art::before { content: ''; position: absolute; inset: 13px; z-index: 1; pointer-events: none; border: 1px solid #e9c78777; border-radius: 8px; }
  .result-art img { width: 100%; height: 100%; object-fit: cover; border-radius: 11px; }
  .result-photo-fallback { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; height: 100%; border-radius: 11px; background: radial-gradient(circle, #624828, #251b13); color: #e6c484; }
  .art-seal { position: absolute; bottom: 24px; left: 24px; display: flex; align-items: center; gap: 7px; padding: 8px 12px; border: 1px solid #d3ad68; border-radius: 99px; background: #20170ee8; color: #ffe6ac; font-size: 13px; }
  .result-copy { min-width: 0; padding-block: 8px; overflow-wrap: anywhere; }
  .result-copy h2 { margin: 0 0 30px; color: #f6dfaf; font-size: clamp(20px, 3vw, 27px); font-weight: 500; letter-spacing: .04em; line-height: 1.45; }
  .result-category { margin: 0 0 10px; color: #dab878; font-size: 14px; line-height: 1.6; }
  .result-copy h3 { margin: 0; color: #fff1d4; font-size: clamp(27px, 4vw, 38px); font-weight: 650; line-height: 1.4; text-wrap: pretty; }
  .result-address { margin: 16px 0 0; color: #d1c0a6; font-size: 15px; line-height: 1.8; white-space: pre-wrap; }
  .result-divider { display: flex; align-items: center; gap: 12px; margin: 25px 0; color: #ccaa69; }
  .result-divider::before, .result-divider::after { content: ''; height: 1px; flex: 1; background: #ad89463d; }
  @media (max-width: 640px) {
    .settled-result { display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 25px; padding: 48px 24px 28px; }
    .result-art { height: 200px; min-height: 200px; flex-shrink: 0; }
    .result-copy { padding: 0; }
    .result-copy h2 { margin-bottom: 22px; font-size: 22px; }
    .result-copy h3 { font-size: 29px; }
  }
</style>
