<script>
  import { onMount, tick } from 'svelte'
  import { ArrowRight, BookOpen, CalendarDays, Check, CheckCheck, ChevronRight, CircleHelp, Dices, Heart, MapPin, Plus, RotateCcw, ShieldCheck, Sparkles, Star, UtensilsCrossed, X } from '@lucide/svelte'
  import { Button } from '$lib/components/ui/button/index.js'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import Collection from './lib/Collection.svelte'
  import GachaReveal from './lib/GachaReveal.svelte'
  import { currentWeek, deleteCategory, loadState, localDate, saveState, startOfWeek, recordDailyDraw, storageStatus, requestPersistence } from './lib/storage.js'
  import { seeds } from './lib/seeds.js'
  const base = import.meta.env.BASE_URL

  let view = $state('draw')
  let state = $state(null)
  let now = $state(new Date())
  let loading = $state(true)
  let busy = $state(false)
  let error = $state('')
  let notice = $state('')
  let drawing = $state(false)
  let result = $state(null)
  let resultOpen = $state(false)
  let helpOpen = $state(false)
  let drawRun = $state(0)
  let resultDate = $state('')
  let persistent = $state(undefined)
  let storageBusy = $state(false)
  let storageNotice = $state('')
  const todayDraw = $derived(state?.dailyDraw?.date === today ? state.dailyDraw : null)
  const week = $derived(state ? currentWeek(state, now) : null)
  const restaurants = $derived(state?.restaurants ?? [])
  const today = $derived(localDate(now))
  const todayPick = $derived(week?.selections[today])
  const selectedCount = $derived(Object.keys(week?.selections ?? {}).length)
  const days = $derived.by(() => {
    const monday = new Date(`${startOfWeek(now)}T12:00:00`)
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      return { key: localDate(date), label: ['一', '二', '三', '四', '五', '六', '日'][index], date, pick: week?.selections[localDate(date)] }
    })
  })
  const weekLabel = $derived(`${days[0].date.getMonth() + 1}.${String(days[0].date.getDate()).padStart(2, '0')} – ${days[6].date.getMonth() + 1}.${String(days[6].date.getDate()).padStart(2, '0')}`)

  async function initialize() {
    loading = true
    error = ''
    try { state = await loadState(seeds) }
    catch (e) { error = e instanceof Error ? e.message : '無法讀取資料，請確認瀏覽器允許 IndexedDB 後重試。' }
    finally { loading = false }
  }
  onMount(() => {
    void initialize()
    void storageStatus().then(value => persistent = value)
    const timer = setInterval(() => {
      now = new Date()
      if (state && !busy && state.weekStart !== startOfWeek(now)) {
        void persist(currentWeek(state, now)).catch(() => {})
      }
    }, 30_000)
    return () => clearInterval(timer)
  })
  async function persist(next) {
    busy = true
    error = ''
    try {
      state = await saveState(next)
    } catch (e) {
      error = e instanceof Error ? e.message : '儲存失敗，請確認瀏覽器儲存空間後重試。'
      throw e
    } finally { busy = false }
  }
  async function addRestaurant(restaurant) {
    if (!state || busy) throw new Error('資料處理中，請稍後再試。')
    await persist({ ...currentWeek(state, new Date()), restaurants: [...restaurants, restaurant] })
    notice = `已將「${restaurant.name}」加入卡池。`
  }
  async function updateRestaurant(restaurant) {
    if (!state || busy) throw new Error('資料處理中，請稍後再試。')
    if (!restaurants.some(item => item.id === restaurant.id)) throw new Error('這家店已不存在，請重新整理。')
    if (!Number.isInteger(restaurant.rating ?? 0) || (restaurant.rating ?? 0) < 0 || restaurant.rating > 5) throw new Error('評分請選擇 0 至 5 顆星。')
    await persist({ ...currentWeek(state, new Date()), restaurants: restaurants.map(item => item.id === restaurant.id ? restaurant : item) })
    notice = `已更新「${restaurant.name}」，歷史菜單與已抽出的卡片不變。`
  }
  async function removeRestaurant(ids) {
    if (!state || busy) throw new Error('資料處理中，請稍後再試。')
    await persist({ ...currentWeek(state, new Date()), restaurants: restaurants.filter(item => !ids.includes(item.id)) })
    notice = '已移出卡池，已確認的本週紀錄仍會保留。'
  }
  async function addCategory(value) {
    if (!state || busy) throw new Error('資料處理中，請稍後再試。')
    const name = value.trim()
    if (!name || name.length > 30) throw new Error('分類名稱請填寫 1 至 30 字。')
    if (state.categories.some(item => item.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('已經有這個分類，請從選單中選擇。')
    }
    await persist({ ...currentWeek(state, new Date()), categories: [...state.categories, name] })
    notice = `已新增「${name}」分類。`
  }
  async function removeCategory(name) {
    if (!state || busy) throw new Error('資料處理中，請稍後再試。')
    await persist(deleteCategory(currentWeek(state, new Date()), name))
    notice = `已刪除「${name}」分類，店家保留為自選店家，本週紀錄不受影響。`
  }
  function showToday() {
    if (!todayDraw || busy || drawing) return
    result = { ...todayDraw.restaurant }
    resultDate = todayDraw.date
    drawRun += 1
    drawing = true
    resultOpen = true
  }
  async function draw() {
    if (drawing || busy || loading || !state) return
    now = new Date()
    if (state.dailyDraw?.date === localDate(now)) { showToday(); return }
    if (!restaurants.length) return
    busy = true
    error = ''
    notice = ''
    try {
      state = await recordDailyDraw(seeds)
      result = { ...state.dailyDraw.restaurant }
      resultDate = state.dailyDraw.date
      drawRun += 1
      drawing = true
      resultOpen = true
    } catch (e) {
      error = e instanceof Error ? e.message : '抽卡結果尚未儲存，請重試。'
    } finally { busy = false }
  }
  async function enablePersistence() {
    storageBusy = true
    try {
      persistent = await requestPersistence()
      storageNotice = persistent === true ? '已啟用持久儲存。' : '瀏覽器未核准持久儲存；現有資料仍保留於 IndexedDB。'
    } finally { storageBusy = false }
  }
  async function finishReveal() {
    if (!drawing || !resultOpen) return
    drawing = false
    await tick()
    document.getElementById('confirm-lunch')?.focus()
  }
  function changeResultOpen(open) {
    resultOpen = open
    if (!open) drawing = false
  }
  async function confirmLunch() {
    if (!state || !result || busy) return
    now = new Date()
    if (resultDate !== localDate(now)) {
      error = '這張卡片不是今天抽出的，請關閉後抽取今天的午餐。'
      return
    }
    const next = currentWeek(state, now)
    try {
      await persist({ ...next, selections: { ...next.selections, [localDate(now)]: { ...result } } })
      resultOpen = false
      notice = `今天就吃「${result.name}」！已記入本週菜單。`
    } catch { /* Keep the result open so saving can be retried. */ }
  }
  function navigate(next) { view = next; notice = ''; window.scrollTo({ top: 0, behavior: 'instant' }) }
</script>

<svelte:head><title>{view === 'collection' ? '店家圖鑑' : view === 'week' ? '本週菜單' : '今天吃什麼？'} | 午餐事務所</title></svelte:head>

<div class="app-shell">
  <header class="site-header">
    <a class="brand" href={base} onclick={(e) => { e.preventDefault(); navigate('draw') }} aria-label="午餐事務所首頁">
      <span class="brand-mark"><UtensilsCrossed size={23} strokeWidth={1.8} /></span>
      <span class="brand-name">午餐事務所<small>LUNCH GACHA CLUB</small></span>
    </a>
    <nav aria-label="主要選單">
      <button class:active={view === 'draw'} onclick={() => navigate('draw')}><Sparkles size={17} />今日召喚</button>
      <button class:active={view === 'collection'} onclick={() => navigate('collection')}><BookOpen size={17} />店家圖鑑</button>
      <button class:active={view === 'week'} onclick={() => navigate('week')}><CalendarDays size={17} />本週菜單</button>
    </nav>
    <button class="help-button" onclick={() => helpOpen = true} aria-label="開啟遊戲說明"><CircleHelp size={20} /></button>
  </header>

  <main>
    {#if error}<div class="message error" role="alert"><span>{error}</span>{#if !state}<Button variant="outline" size="sm" onclick={initialize} disabled={loading}>重新讀取</Button>{/if}</div>{/if}
    {#if notice}<div class="message success" role="status"><CheckCheck size={18} /><span>{notice}</span><button onclick={() => notice = ''} aria-label="關閉通知"><X size={16} /></button></div>{/if}
    {#if view === 'draw'}
      <section class="gacha-section" aria-labelledby="gacha-title">
        <div class="intro-row"><span class="intro-note"><span class="little-line"></span>為每天的小選擇，留一點驚喜。</span><span class="date-note">{now.getMonth() + 1} 月 {now.getDate()} 日 · 星期{['日', '一', '二', '三', '四', '五', '六'][now.getDay()]}</span></div>
        <div class="gacha-stage">
          <div class="hero-copy">
            <span class="welcome-label"><span class="status-dot"></span>今日午餐卡池開放中</span>
            <h1 id="gacha-title">今天的午餐，<br />交給<span class="highlight">命運</span>吧。</h1>
            <p>選擇困難，就讓好運幫你選。<br />收藏喜歡的店家，抽出今天的美味相遇。</p>
            <div class="hero-footnote"><span class="mini-spark"><Sparkles size={17} /></span>不用課金，每一餐都是好運氣。</div>
          </div>
          <div class="card-scene" aria-hidden="true">
            <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
            <Sparkles class="scene-spark spark-one" size={29} strokeWidth={1.3} /><Star class="scene-spark spark-two" size={19} strokeWidth={1.2} />
            <span class="scene-cross cross-one">+</span><span class="scene-cross cross-two">+</span>
            <div class="food-card card-left"><img src={`${base}images/salad.jpg`} alt="" /><div class="food-card-text"><span>FRESH & HAPPY</span><strong>小森輕食</strong><small>把日常吃得清爽一點</small></div></div>
            <div class="food-card card-right"><img src={`${base}images/rice.jpg`} alt="" /><div class="food-card-text"><span>A TASTE OF HOME</span><strong>好日子食堂</strong><small>一口熟悉的幸福</small></div></div>
            <div class="food-card card-center"><div class="card-topline"><span>LUNCH ENCOUNTER</span><Sparkles size={13} /></div><img src={`${base}images/ramen.jpg`} alt="" /><div class="food-card-text"><div class="card-stars"><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /></div><strong>命中注定的這一餐</strong><small>YOUR NEXT FAVORITE LUNCH</small></div></div>
            <div class="lucky-seal"><Sparkles size={17} /><span>今日好運<br />準備上桌</span></div>
            <span class="scene-caption">美味的相遇，從一張卡開始。</span>
          </div>
        </div>
        <div class="draw-bar">
          <div class="pool-summary"><div class="avatar-stack"><img src={`${base}images/ramen.jpg`} alt="" /><img src={`${base}images/rice.jpg`} alt="" /><img src={`${base}images/salad.jpg`} alt="" /></div><div><strong>{loading ? '正在準備卡池…' : `卡池裡有 ${restaurants.length} 家美味`}</strong><span>每家機率相同，每次只抽一張</span></div><button class="pool-link" onclick={() => navigate('collection')} aria-label="管理抽卡店家"><ChevronRight size={19} /></button></div>
          <div class="draw-action"><span class="free-label">每天一次 · 免費召喚</span><Button class="draw-button" onclick={draw} disabled={loading || !state || drawing || busy || (!todayDraw && restaurants.length === 0)}><Dices size={23} />{drawing ? '好運降臨中…' : todayDraw ? '查看今日卡片' : '召喚我的午餐'}<ArrowRight size={20} /></Button></div>
        </div>
        {#if !loading && restaurants.length === 0}<div class="empty-pool">卡池還空著。<button onclick={() => navigate('collection')}>先新增一家喜歡的店 <ArrowRight size={14} /></button></div>{/if}
        <div class="game-details"><span><ShieldCheck size={14} />只存在你的裝置，安心收藏</span><span><CalendarDays size={14} />每天一張，明天再抽</span><span><Check size={14} />確認後才記入菜單</span></div>
      </section>
      <section class="weekly-section" aria-labelledby="weekly-title">
        <div class="section-heading"><div><h2 id="weekly-title">這週的美味足跡<span class="small-tag">{weekLabel}</span></h2><p>好好吃飯，也是認真生活的一部分。</p></div><button class="text-link" onclick={() => navigate('week')}>查看本週菜單<ArrowRight size={16} /></button></div>
        <div class="week-grid">
          {#each days as day}<div class="day-tile" class:is-today={day.key === today} class:has-pick={!!day.pick}><div class="day-top"><span>週{day.label}</span><span>{day.key === today ? '今天' : `${day.date.getMonth() + 1}/${day.date.getDate()}`}</span></div>{#if day.pick}<img src={day.pick.image} referrerpolicy="no-referrer" alt="" /><strong>{day.pick.name}</strong>{:else}<span class="day-placeholder">{day.key === today ? '好運待揭曉' : day.key < today ? '尚未記錄' : '期待下一餐'}</span><span class="day-dash">{day.key === today ? 'TODAY’S LUNCH' : '・'}</span>{/if}</div>{/each}
        </div>
        <div class="week-caption"><CalendarDays size={14} /><span>每週一開啟新篇章，店家收藏不會消失。</span><span class="count-note">已收藏 {selectedCount} 餐日常</span></div>
      </section>
      <section class="collection-banner"><div class="banner-icon"><BookOpen size={24} strokeWidth={1.5} /></div><div><h3>你的口袋名單，就是專屬卡池。</h3><p>上傳店家照片，讓喜歡的美味都有機會被抽中。</p></div><Button variant="outline" class="collection-cta" onclick={() => navigate('collection')}><Plus size={16} />管理我的店家</Button></section>
    {:else if view === 'collection'}
      {#if state}<Collection {restaurants} categories={state.categories} {busy} onadd={addRestaurant} onupdate={updateRestaurant} onremove={removeRestaurant} oncategoryadd={addCategory} oncategoryremove={removeCategory} />{:else if loading}<div class="loading-surface">正在讀取店家圖鑑…</div>{/if}
    {:else}
      <section class="week-page">
        <div class="page-heading"><div><h1>本週菜單</h1><p>把每天的小確幸，收進這一週。</p></div><span class="week-range"><CalendarDays size={17} />{weekLabel}</span></div>
        <div class="weekly-summary"><span>本週已確認 <strong>{selectedCount}</strong> 餐</span><span>週一重置紀錄，店家圖鑑持續保留於此瀏覽器</span></div>
        <div class="week-list">
          {#each days as day}
            <article class="week-entry" class:today-entry={day.key === today}>
              <div class="entry-date"><strong>週{day.label}</strong><span>{day.date.getMonth() + 1} / {day.date.getDate()}</span></div>
              {#if day.pick}
                <img src={day.pick.image} referrerpolicy="no-referrer" alt={day.pick.name} />
                <div class="entry-content"><span>{day.pick.category || '自選店家'}</span><h2>{day.pick.name}</h2>{#if day.pick.address}<p class="restaurant-address"><MapPin size={15} aria-hidden="true" /><span>{day.pick.address}</span></p>{/if}</div>
                <span class="confirmed-label"><Check size={14} />已確認</span>
              {:else}
                <div class="entry-content unchosen"><UtensilsCrossed size={22} /><span>{day.key === today ? '今天想和哪一份美味相遇？' : day.key < today ? '這天沒有留下紀錄' : '美味，值得期待'}</span></div>
                {#if day.key === today}<Button variant="outline" onclick={() => navigate('draw')}>去抽午餐<ArrowRight size={15} /></Button>{/if}
              {/if}
              {#if day.key === today}<span class="entry-today">今天</span>{/if}
            </article>
          {/each}
        </div>
        <p class="week-explanation">每天只能抽一張卡，關閉或重新整理不會重抽；按下「今天就吃這家」才會記入菜單。</p>
      </section>
    {/if}
    <section class="message data-storage" aria-label="資料保存">
      <ShieldCheck size={20} aria-hidden="true" />
      <div><strong>資料保存</strong><p>{persistent === undefined ? '正在檢查儲存狀態…' : persistent === true ? '已啟用瀏覽器持久儲存，可降低自動清除的風險。' : persistent === false ? '資料已存於 IndexedDB；尚未啟用瀏覽器持久儲存。' : '此瀏覽器不支援持久儲存申請，資料仍使用 IndexedDB 保存。'} 清除網站資料、無痕模式或更換裝置仍可能失去資料；圖片網址也取決於來源網站。</p><p role="status">{storageNotice}</p></div>
      {#if persistent === false}<Button variant="outline" onclick={enablePersistence} disabled={storageBusy}>{storageBusy ? '申請中…' : '申請持久儲存'}</Button>{/if}
    </section>
  </main>
  <footer class="site-footer"><span class="footer-brand"><UtensilsCrossed size={14} />午餐事務所</span><span>少一點糾結，多一點好好吃飯。</span><span class="made-with">MADE FOR YOUR LUNCH BREAK <Heart size={12} /></span></footer>
</div>

<Dialog.Root open={resultOpen} onOpenChange={changeResultOpen}>
  <Dialog.Content class="result-dialog summoning" showCloseButton={!drawing}>
    <Dialog.Header class="sr-only">
      <Dialog.Title>午餐奇遇</Dialog.Title>
      <Dialog.Description>你的今日午餐卡。</Dialog.Description>
    </Dialog.Header>
    {#if result}
      {#key drawRun}
        <GachaReveal restaurant={result} oncomplete={finishReveal}>
          {#if resultDate !== today}<p class="replace-note">這是先前日期抽出的卡片，無法記入今天。</p>{/if}
          {#if error}<p class="result-error" role="alert">{error}</p>{/if}
          <div class="result-actions">
            <Button variant="outline" onclick={() => changeResultOpen(false)} disabled={busy}>稍後決定</Button>
            <Button id="confirm-lunch" onclick={confirmLunch} disabled={busy || resultDate !== today || todayPick?.id === result.id}><Check size={19} />{busy ? '儲存中…' : todayPick?.id === result.id ? '已記入今天的菜單' : '今天就吃這家'}</Button>
          </div>
          <p class="result-note">今日抽卡次數已使用，可隨時回來查看這張卡片，明天再抽。</p>
        </GachaReveal>
      {/key}
    {/if}
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={helpOpen}><Dialog.Content class="help-dialog"><Dialog.Header><Dialog.Title>午餐，交給一點好運。</Dialog.Title><Dialog.Description>每天一張，為午餐留一點驚喜。</Dialog.Description></Dialog.Header><ol class="help-steps"><li><BookOpen size={21} /><div><strong>建立專屬卡池</strong><p>新增或編輯店名、照片、分類、地址與五星評分，也能勾選店家批次刪除。</p></div></li><li><Dices size={21} /><div><strong>每天只能抽一次</strong><p>所有店家機率相同。抽卡結果會先保存，關閉或重新整理仍是同一張；每天依裝置當地日期開放新抽卡。</p></div></li><li><CalendarDays size={21} /><div><strong>確認今天的美味</strong><p>確認才會記錄，沒有確認的日期不會記入菜單。週一重置本週紀錄，不刪除店家。</p></div></li></ol><p class="privacy-note"><ShieldCheck size={17} />資料以 JSON 存於此瀏覽器的 IndexedDB，不會上傳伺服器。持久儲存無法防止手動清除，也不跨裝置同步。</p></Dialog.Content></Dialog.Root>

<style>
  .data-storage { flex-wrap: wrap; align-items: flex-start; border-top: 1px solid var(--line); }
  .data-storage > div { flex: 1 1 240px; min-width: 0; }
</style>
