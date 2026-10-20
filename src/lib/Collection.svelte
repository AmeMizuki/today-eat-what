<script>
  import { onDestroy, tick } from 'svelte';
  import { Plus, Search, Trash2, ImagePlus, Utensils, X, ArrowUpRight, MapPin, ClipboardPaste, Link } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { defaultCategories } from './storage.js';
  import { imageToWebp, imageUrlPreview } from './image-upload.js';

  let { restaurants = [], categories = [], busy = false, onadd, onremove, oncategoryadd, oncategoryremove } = $props();
  let query = $state('');
  let dialogOpen = $state(false);
  let name = $state('');
  let category = $state('');
  let address = $state('');
  let addressError = $state('');
  let categoryOpen = $state(false);
  let categoryName = $state('');
  let categoryError = $state('');
  let categorySaving = $state(false);
  let categoryInput = $state(null);
  let image = $state('');
  let imageName = $state('');
  let fileLoading = $state(false);
  let imageMode = $state('file');
  let imageUrl = $state('');
  let imageSize = $state(0);
  let urlInput = $state(null);
  let imageAbort;
  let saving = $state(false);
  let nameError = $state('');
  let fileError = $state('');
  let saveError = $state('');
  let confirmingId = $state(null);
  let removingId = $state(null);
  let removeError = $state('');
  let announcement = $state('');
  let fileInput = $state(null);
  let nameInput = $state(null);
  let searchInput = $state(null);
  let cancelRemoveButton = $state(null);
  let fileVersion = 0;
  let confirmingCategory = $state(null);
  let removingCategory = $state(null);
  let categoryRemoveError = $state('');
  let categorySummary = $state(null);
  let categoryCancelButton = $state(null);
  const customCategories = $derived(categories.filter((name) =>
    !defaultCategories.some((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase())));

  $effect(() => {
    if (category && !categories.includes(category)) category = '';
  });

  async function askCategoryRemove(name) {
    confirmingCategory = name;
    categoryRemoveError = '';
    await tick();
    categoryCancelButton?.focus();
  }

  async function cancelCategoryRemove(name) {
    confirmingCategory = null;
    categoryRemoveError = '';
    await tick();
    document.getElementById(`remove-category-${encodeURIComponent(name)}`)?.focus();
  }

  async function removeCategory(name) {
    if (busy || removingCategory) return;
    removingCategory = name;
    categoryRemoveError = '';
    try {
      await oncategoryremove(name);
      confirmingCategory = null;
      announcement = `已刪除分類「${name}」，店家及歷史菜單均已保留。`;
      await tick();
      categorySummary?.focus();
    } catch {
      categoryRemoveError = '分類尚未刪除成功，店家與分類均已保留，請再試一次。';
    } finally {
      removingCategory = null;
    }
  }

  const filtered = $derived(restaurants.filter((restaurant) => {
    const term = query.trim().toLocaleLowerCase();
    return !term || `${restaurant.name} ${restaurant.category || ''} ${restaurant.address || ''}`.toLocaleLowerCase().includes(term);
  }));

  function resetForm() {
    clearImage();
    imageMode = 'file';
    imageUrl = '';
    name = '';
    category = '';
    address = '';
    addressError = '';
    categoryOpen = false;
    categoryName = '';
    categoryError = '';
    nameError = '';
  }

  function changeOpen(nextOpen) {
    if (saving || categorySaving) return;
    resetForm();
    dialogOpen = nextOpen;
  }

  async function openCategory() {
    categoryOpen = true;
    categoryError = '';
    await tick();
    categoryInput?.focus();
  }

  async function addCategory() {
    if (busy || saving || categorySaving) return;
    const next = categoryName.trim();
    categoryError = '';
    if (!next || next.length > 30) {
      categoryError = '請填寫 1 至 30 字的分類名稱。';
      categoryInput?.focus();
      return;
    }
    if (categories.some((item) => item.toLocaleLowerCase() === next.toLocaleLowerCase())) {
      categoryError = '這個分類已經存在，請直接從清單選擇。';
      categoryInput?.focus();
      return;
    }
    categorySaving = true;
    try {
      await oncategoryadd(next);
      category = next;
      categoryName = '';
      categoryOpen = false;
      announcement = `已儲存分類「${next}」。`;
    } catch {
      categoryError = '分類尚未儲存成功，店家資料已保留，請再試一次。';
    } finally {
      categorySaving = false;
    }
  }

  function clearImage() {
    fileVersion += 1;
    imageAbort?.abort();
    imageAbort = undefined;
    image = '';
    imageName = '';
    imageSize = 0;
    fileError = '';
    saveError = '';
    fileLoading = false;
    if (fileInput) fileInput.value = '';
  }

  function switchImageMode(mode) {
    if (mode === imageMode) return;
    clearImage();
    imageMode = mode;
    imageUrl = '';
  }

  function beginImage(mode) {
    clearImage();
    imageMode = mode;
    if (mode === 'file') imageUrl = '';
    fileLoading = true;
    return fileVersion;
  }

  async function receiveLocalImage(fileOrPromise, label) {
    const version = beginImage('file');
    try {
      const file = await fileOrPromise;
      if (version !== fileVersion || !dialogOpen) return;
      const prepared = await imageToWebp(file);
      if (version !== fileVersion || !dialogOpen) return;
      image = prepared.data;
      imageSize = prepared.size;
      imageName = `${(label || file.name || '貼上的圖片').replace(/\.[^.]+$/, '')}.webp`;
      announcement = '圖片已壓縮為 WebP，可加入圖鑑。';
    } catch (error) {
      if (version === fileVersion && dialogOpen) {
        fileError = error instanceof Error ? error.message : '圖片處理失敗，請重新選擇。';
      }
    } finally {
      if (version === fileVersion) fileLoading = false;
    }
  }

  function chooseImage(event) {
    const file = event.currentTarget.files?.[0];
    if (file) void receiveLocalImage(file);
  }

  function pasteImage(event) {
    if (!dialogOpen || saving || busy || categorySaving) return;
    const item = Array.from(event.clipboardData?.items || [])
      .find(item => item.kind === 'file' && item.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (!file) return;
    event.preventDefault();
    void receiveLocalImage(file, '貼上的圖片');
  }

  async function readClipboardImage() {
    if (!navigator.clipboard?.read) {
      throw new Error('瀏覽器不支援直接讀取剪貼簿，請在此視窗按 Ctrl+V 或 ⌘V 貼上圖片。');
    }
    let items;
    try { items = await navigator.clipboard.read(); }
    catch { throw new Error('無法讀取剪貼簿，請允許存取，或按 Ctrl+V／⌘V 貼上圖片。'); }
    for (const item of items) {
      const type = item.types.includes('image/png') ? 'image/png' : item.types.find(type => type.startsWith('image/'));
      if (type) return item.getType(type);
    }
    throw new Error('剪貼簿裡沒有圖片，請先複製圖片再貼上；圖片網址請填入「圖片網址」。');
  }

  function pasteFromClipboard() {
    if (saving || busy || categorySaving) return;
    void receiveLocalImage(readClipboardImage(), '貼上的圖片');
  }

  async function useImageUrl() {
    const version = beginImage('url');
    imageAbort = new AbortController();
    try {
      const url = await imageUrlPreview(imageUrl, imageAbort.signal);
      if (version !== fileVersion || !dialogOpen) return;
      image = url;
      imageName = '網址圖片（保留原始連結）';
      announcement = '圖片網址已確認，可加入圖鑑。';
    } catch (error) {
      if (version === fileVersion && dialogOpen) {
        fileError = error instanceof Error ? error.message : '圖片網址無法載入，請重新確認。';
      }
    } finally {
      if (version === fileVersion) {
        fileLoading = false;
        imageAbort = undefined;
      }
    }
  }

  onDestroy(() => {
    fileVersion += 1;
    imageAbort?.abort();
  });

  async function submit(event) {
    event.preventDefault();
    if (busy || saving || categorySaving || fileLoading || !dialogOpen) return;
    nameError = '';
    saveError = '';
    addressError = '';
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 40) {
      nameError = '請填寫 1 至 40 字的店家名稱。';
      nameInput?.focus();
      return;
    }
    const trimmedAddress = address.trim();
    if (trimmedAddress.length > 200) {
      addressError = '地址請填寫 200 字以內。';
      document.getElementById('restaurant-address')?.focus();
      return;
    }
    if (imageMode === 'url' && (!image || image !== imageUrl.trim())) {
      await useImageUrl();
      if (!dialogOpen || imageMode !== 'url' || !image || image !== imageUrl.trim()) return;
      if (busy || saving || categorySaving || fileLoading) return;
    }
    if (!image) {
      fileError = fileError || '請選擇或貼上圖片，或填入圖片網址。';
      if (imageMode === 'url') urlInput?.focus();
      else fileInput?.focus();
      return;
    }
    saving = true;
    try {
      await onadd({
        id: crypto.randomUUID(),
        name: trimmedName,
        image,
        ...(category ? { category } : {}),
        ...(trimmedAddress ? { address: trimmedAddress } : {}),
      });
      announcement = `已新增「${trimmedName}」。`;
      dialogOpen = false;
      resetForm();
    } catch {
      saveError = '店家尚未儲存成功。資料已保留，請再試一次。';
    } finally {
      saving = false;
    }
  }

  async function askRemove(id) {
    confirmingId = id;
    removeError = '';
    await tick();
    cancelRemoveButton?.focus();
  }

  async function cancelRemove(id) {
    confirmingId = null;
    removeError = '';
    await tick();
    document.getElementById(`remove-restaurant-${id}`)?.focus();
  }

  async function removeRestaurant(restaurant) {
    if (busy || removingId) return;
    removingId = restaurant.id;
    removeError = '';
    try {
      await onremove(restaurant.id);
      confirmingId = null;
      announcement = `已移除「${restaurant.name}」。`;
      searchInput?.focus();
    } catch {
      removeError = '移除失敗，店家仍在圖鑑中。請再試一次。';
    } finally {
      removingId = null;
    }
  }
</script>

<svelte:window onpaste={pasteImage} />

<section id="collection" aria-labelledby="collection-heading" class="collection">
  <div class="section-header">
    <div>
      <div class="heading-row">
        <h2 id="collection-heading">店家圖鑑</h2>
        <span class="collection-count">{restaurants.length} 間店家</span>
      </div>
      <p class="section-description">把喜歡的口袋名單收藏起來，讓下一頓午餐多一點期待。</p>
    </div>
    <Dialog.Root open={dialogOpen} onOpenChange={changeOpen}>
      <Dialog.Trigger>
        {#snippet child({ props })}
          <Button {...props} class="collection-add" disabled={busy || !!removingId}>
            <Plus size={17} aria-hidden="true" /> 新增店家
          </Button>
        {/snippet}
      </Dialog.Trigger>
      <Dialog.Content class="collection-dialog motion-reduce:animate-none" showCloseButton={false}>
        <Dialog.Header>
          <Dialog.Title>收藏一間好店</Dialog.Title>
          <Dialog.Description>放上美味的照片，將喜歡的店家加入午餐抽選。</Dialog.Description>
        </Dialog.Header>
        <form onsubmit={submit} class="restaurant-form" aria-busy={saving || categorySaving}>
          <fieldset disabled={saving || busy || categorySaving}>
            <div class="form-field">
              <label for="restaurant-name">店家名稱 <span aria-hidden="true">*</span></label>
              <Input id="restaurant-name" name="restaurant-name" bind:ref={nameInput} bind:value={name} required maxlength={40} placeholder="例如：巷口的日式食堂" autocomplete="off" aria-invalid={!!nameError} aria-describedby={nameError ? 'restaurant-name-error' : undefined} />
              {#if nameError}<p class="field-error" id="restaurant-name-error">{nameError}</p>{/if}
            </div>
            <div class="form-field">
              <label for="restaurant-category">料理分類 <span class="optional">選填</span></label>
              <select id="restaurant-category" name="restaurant-category" bind:value={category}>
                <option value="">自選店家</option>
                {#each categories as item}<option value={item}>{item}</option>{/each}
              </select>
              <Button type="button" variant="outline" onclick={openCategory} aria-expanded={categoryOpen} aria-controls="new-category-fields"><Plus size={16} aria-hidden="true" />新增分類</Button>
              {#if categoryOpen}
                <div id="new-category-fields" class="category-fields">
                  <label for="new-category">新分類名稱</label>
                  <Input id="new-category" name="new-category" bind:ref={categoryInput} bind:value={categoryName} maxlength={30} placeholder="例如：深夜食堂" aria-invalid={!!categoryError} aria-describedby="new-category-error" onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCategory(); } }} />
                  <p class="field-hint">分類會立即儲存，取消新增店家也會保留。</p>
                  <Button type="button" variant="outline" onclick={addCategory}>儲存分類</Button>
                </div>
              {/if}
              <p id="new-category-error" class="field-error" role="alert">{categoryError}</p>
              <p class="field-hint" role="status">{categorySaving ? '正在儲存分類…' : ''}</p>
            </div>
            <div class="form-field">
              <label for="restaurant-address">店家地址 <span class="optional">選填</span></label>
              <Input id="restaurant-address" name="restaurant-address" bind:value={address} maxlength={200} autocomplete="street-address" placeholder="方便下次找到這間好店" aria-invalid={!!addressError} aria-describedby={addressError ? 'restaurant-address-error' : undefined} />
              {#if addressError}<p id="restaurant-address-error" class="field-error" role="alert">{addressError}</p>{/if}
            </div>
            <div class="form-field">
              <label for={imageMode === 'url' ? 'restaurant-image-url' : 'restaurant-image'}>店家或餐點圖片 <span aria-hidden="true">*</span></label>
              <div class="image-methods" role="group" aria-label="圖片來源">
                <Button type="button" variant={imageMode === 'file' ? 'secondary' : 'outline'} aria-pressed={imageMode === 'file'} onclick={() => switchImageMode('file')}><ImagePlus size={16} aria-hidden="true" />上傳圖片</Button>
                <Button type="button" variant={imageMode === 'url' ? 'secondary' : 'outline'} aria-pressed={imageMode === 'url'} onclick={() => switchImageMode('url')}><Link size={16} aria-hidden="true" />圖片網址</Button>
                <Button type="button" variant="outline" onclick={pasteFromClipboard}><ClipboardPaste size={16} aria-hidden="true" />從剪貼簿貼上</Button>
              </div>
              <div class="image-upload" class:has-image={!!image}>
                {#if image}
                  <img class="image-preview" src={image} referrerpolicy="no-referrer" alt={`「${name.trim() || '新增店家'}」的圖片預覽`} />
                  <p class="image-filename">{imageName}{imageSize ? ` · ${Math.max(1, Math.round(imageSize / 1024))} KB` : ''}</p>
                {:else if imageMode === 'file'}
                  <div class="upload-prompt">
                    <ImagePlus size={28} strokeWidth={1.5} aria-hidden="true" />
                    <p>{fileLoading ? '正在壓縮圖片…' : '讓美味先被看見'}</p>
                    <span>選擇檔案，或直接按 Ctrl+V／⌘V 貼上圖片</span>
                  </div>
                {/if}
                {#if imageMode === 'file'}
                  <input id="restaurant-image" name="restaurant-image" type="file" bind:this={fileInput} accept="image/jpeg,image/png,image/webp,image/gif" onchange={chooseImage} aria-required="true" aria-invalid={!!fileError} aria-describedby={`restaurant-image-hint${fileError ? ' restaurant-image-error' : ''}`} />
                {:else}
                  <Input id="restaurant-image-url" name="restaurant-image-url" type="url" inputmode="url" bind:ref={urlInput} bind:value={imageUrl} oninput={clearImage} placeholder="https://example.com/photo.jpg" autocomplete="off" aria-required="true" aria-invalid={!!fileError} aria-describedby={`restaurant-image-hint${fileError ? ' restaurant-image-error' : ''}`} onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (!fileLoading) useImageUrl(); } }} />
                  <Button type="button" variant="outline" onclick={useImageUrl} disabled={fileLoading}>使用網址</Button>
                {/if}
              </div>
              <p class="field-hint" id="restaurant-image-hint">{imageMode === 'url' ? '請使用可公開載入的圖片直連網址；保留原連結，不轉檔。' : 'JPG、PNG、WebP 或 GIF，上限 4 MB。自動壓縮為 WebP，GIF 會轉為靜態圖片。'}</p>
              <p class="field-hint" role="status">{fileLoading ? (imageMode === 'url' ? '正在確認圖片網址…' : '正在轉換並壓縮為 WebP…') : ''}</p>
              {#if fileError}<p class="field-error" id="restaurant-image-error" role="alert">{fileError}</p>{/if}
            </div>
          </fieldset>
          <p class="field-error form-error" role="alert">{saveError}</p>
          <div class="form-actions">
            <Button type="button" variant="outline" onclick={() => changeOpen(false)} disabled={saving || categorySaving}>取消</Button>
            <Button type="submit" class="collection-add" disabled={busy || saving || categorySaving || fileLoading}>
              <Plus size={16} aria-hidden="true" />{categorySaving ? '正在儲存分類…' : saving ? '正在儲存…' : fileLoading ? '正在讀取圖片…' : '加入圖鑑'}
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  </div>

  <details class="category-management">
    <summary bind:this={categorySummary}>管理自訂分類（{customCategories.length}）</summary>
    <p class="field-hint">預設分類會保留。刪除自訂分類不會移除店家，也不影響歷史菜單。</p>
    {#if customCategories.length}
      <ul class="category-list">
        {#each customCategories as item (item)}
          <li aria-busy={removingCategory === item}>
            <div class="category-row">
              <span>{item}</span>
              <Button id={`remove-category-${encodeURIComponent(item)}`} type="button" variant="outline" size="sm" aria-label={`刪除自訂分類「${item}」`} disabled={busy || !!removingCategory} onclick={() => askCategoryRemove(item)}>
                <Trash2 size={16} aria-hidden="true" />刪除
              </Button>
            </div>
            {#if confirmingCategory === item}
              <div class="remove-confirmation">
                <p>確定刪除「{item}」？{restaurants.filter((restaurant) => restaurant.category === item).length} 間店家將改為「自選店家」，店家、地址與歷史菜單都會保留。</p>
                <div class="confirmation-actions">
                  <Button type="button" variant="outline" size="sm" bind:ref={categoryCancelButton} disabled={!!removingCategory} onclick={() => cancelCategoryRemove(item)}>取消</Button>
                  <Button type="button" variant="destructive" size="sm" disabled={busy || !!removingCategory} onclick={() => removeCategory(item)}>{removingCategory === item ? '正在刪除…' : '確定刪除'}</Button>
                </div>
                {#if categoryRemoveError}<p class="field-error" role="alert">{categoryRemoveError}</p>{/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="field-hint">尚無自訂分類。可在「新增店家」中新增分類。</p>
    {/if}
  </details>

  <div class="collection-toolbar">
    <div class="search-field">
      <Search size={17} aria-hidden="true" />
      <label class="sr-only" for="collection-search">搜尋店家名稱、料理分類或地址</label>
      <Input id="collection-search" name="collection-search" type="search" bind:ref={searchInput} bind:value={query} placeholder="搜尋店家、分類、地址…" class="collection-search" />
    </div>
    <span class="result-count" role="status">{query.trim() ? `找到 ${filtered.length} 間店家` : '每一間，都是午餐的好選擇。'}</span>
  </div>

  <p class="sr-only" role="status">{announcement}</p>
  {#if filtered.length}
    <div class="restaurant-grid">
      {#each filtered as restaurant (restaurant.id)}
        <article class="restaurant-card" aria-labelledby={`restaurant-${restaurant.id}`}>
          <div class="card-image-wrap">
            <img class="card-image" src={restaurant.image} referrerpolicy="no-referrer" alt={`${restaurant.name}的店家或餐點照片`} loading="lazy" />
            <span class="card-category">{restaurant.category || '自選店家'}</span>
          </div>
          <div class="card-body">
            <div class="card-title-row">
              <h3 id={`restaurant-${restaurant.id}`}>{restaurant.name}</h3>
              <Button id={`remove-restaurant-${restaurant.id}`} type="button" variant="ghost" size="icon" class="remove-button" aria-label={`移除「${restaurant.name}」`} disabled={busy || !!removingId} onclick={() => askRemove(restaurant.id)}>
                <Trash2 size={16} strokeWidth={1.6} aria-hidden="true" />
              </Button>
            </div>
            {#if restaurant.address}
              <p class="card-address"><MapPin size={16} aria-hidden="true" /><span>{restaurant.address}</span></p>
            {/if}
            {#if confirmingId === restaurant.id}
              <div class="remove-confirmation">
                <p>確定將這間店移出圖鑑？</p>
                <div class="confirmation-actions">
                  <Button type="button" variant="outline" size="sm" bind:ref={cancelRemoveButton} disabled={!!removingId} onclick={() => cancelRemove(restaurant.id)}>取消</Button>
                  <Button type="button" variant="destructive" size="sm" disabled={busy || !!removingId} onclick={() => removeRestaurant(restaurant)}>{removingId === restaurant.id ? '正在移除…' : '確定移除'}</Button>
                </div>
                {#if removeError}<p class="field-error" role="alert">{removeError}</p>{/if}
              </div>
            {:else}
              <p class="card-caption"><span class="little-dot"></span>午餐候選名單 <ArrowUpRight size={14} aria-hidden="true" /></p>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      <div class="empty-icon"><Utensils size={28} strokeWidth={1.4} aria-hidden="true" /></div>
      <h3>{restaurants.length ? '還沒找到這間店' : '你的美味圖鑑，從這裡開始'}</h3>
      <p>{restaurants.length ? '試試其他店名或料理分類，找回你的口袋名單。' : '點選「新增店家」，收藏第一間想吃的店。'}</p>
      {#if restaurants.length}
        <Button variant="outline" onclick={() => { query = ''; searchInput?.focus(); }}><X size={15} aria-hidden="true" />清除搜尋</Button>
      {:else}
        <Button class="collection-add" disabled={busy} onclick={() => changeOpen(true)}><Plus size={16} aria-hidden="true" />新增第一間店家</Button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .collection { color: var(--ink, #302c28); scroll-margin-top: 100px; padding: 45px 0; font-size: 16px; line-height: 1.6; }
  .section-header { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-bottom: 29px; }
  .heading-row { display: flex; align-items: center; gap: 13px; flex-wrap: wrap; }
  h2 { font-size: 28px; font-weight: 700; letter-spacing: -.035em; margin: 0; }
  .collection-count { border: 1px solid var(--line, #e9e3da); border-radius: 99px; padding: 4px 10px; color: #766b60; font-size: 12px; background: #fff; }
  .section-description { color: var(--muted, #797169); font-size: 14px; line-height: 1.8; margin: 9px 0 0; }
  .category-management { border: 1px solid var(--line, #e9e3da); border-radius: 12px; padding: 14px 17px; margin-bottom: 24px; background: #ffffff70; }
  .category-management summary { cursor: pointer; font-weight: 600; padding-block: 5px; }
  .category-management summary:focus-visible { outline: 2px solid #934022; outline-offset: 3px; }
  .category-management > p { margin-top: 10px; }
  .category-list { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 12px; }
  .category-list li { min-width: 0; border-top: 1px solid var(--line, #e9e3da); padding-top: 12px; }
  .category-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .category-row span { min-width: 0; overflow-wrap: anywhere; }
  .category-row :global(button) { flex-shrink: 0; }
  :global(.collection-add) { background: var(--accent, #bd492e); color: white; border-radius: 9px; min-height: 44px; gap: 7px; padding-inline: 17px; font-size: 14px; box-shadow: 0 3px 7px #963a2110; }
  .collection-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 24px; }
  .search-field { position: relative; width: min(100%, 330px); }
  .search-field > :global(svg) { position: absolute; left: 13px; top: 50%; translate: 0 -50%; color: var(--muted, #827a72); pointer-events: none; }
  :global(.collection-search) { background: #fff; padding-left: 39px; border: 1px solid #b6ada4; border-radius: 9px; min-height: 44px; font-size: 16px; }
  .result-count { color: var(--muted, #797169); font-size: 14px; }
  .restaurant-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 23px; }
  .restaurant-card { background: white; border-radius: 13px; overflow: hidden; border: 1px solid var(--line, #e9e3da); min-width: 0; }
  .card-image-wrap { position: relative; aspect-ratio: 1.55; background: #eee8df; }
  .card-image { width: 100%; height: 100%; object-fit: cover; outline: 1px solid #00000010; outline-offset: -1px; }
  .card-category { position: absolute; left: 13px; top: 13px; max-width: calc(100% - 26px); overflow-wrap: anywhere; font-size: 12px; color: #564c40; background: #fffffff0; padding: 5px 9px; border-radius: 5px; }
  .card-body { padding: 13px 17px 17px; }
  .card-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  h3 { font-size: 20px; font-weight: 650; line-height: 1.5; margin: 0; overflow-wrap: anywhere; }
  :global(.remove-button) { color: #857b70; width: 36px; height: 36px; flex-shrink: 0; border-radius: 7px; }
  .card-caption { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted, #797169); margin: 5px 0 0; }
  .card-caption :global(svg) { margin-left: auto; }
  .card-address { display: flex; align-items: flex-start; gap: 7px; font-size: 14px; line-height: 1.6; color: var(--muted, #797169); margin: 9px 0; }
  .card-address :global(svg) { flex-shrink: 0; margin-top: 3px; }
  .card-address span { min-width: 0; overflow-wrap: anywhere; }
  .little-dot { width: 5px; height: 5px; border-radius: 50%; background: #87997d; }
  .remove-confirmation { border-top: 1px solid var(--line, #e9e3da); padding-top: 10px; margin-top: 9px; }
  .remove-confirmation > p { font-size: 14px; line-height: 1.7; margin: 0 0 9px; }
  .confirmation-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .empty-state { text-align: center; padding: 64px 20px; border: 1px dashed #d4c9bc; background: #ffffff70; border-radius: 16px; }
  .empty-icon { display: grid; place-items: center; background: #eee8df; color: #8e7f6e; width: 62px; height: 62px; border-radius: 20px; margin: 0 auto 20px; }
  .empty-state p { color: var(--muted, #797169); font-size: 14px; line-height: 1.8; margin: 10px 0 22px; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
  :global(.collection-dialog) { width: min(480px, calc(100% - 32px)); max-height: calc(100dvh - 40px); overflow-y: auto; overscroll-behavior: contain; border-radius: 18px; background: var(--paper, #fbf9f5); color: var(--ink, #302c28); padding: 27px; }
  .restaurant-form { margin-top: 7px; font-size: 16px; line-height: 1.6; }
  fieldset { border: 0; padding: 0; margin: 0; min-width: 0; display: grid; gap: 19px; }
  .form-field { display: grid; gap: 8px; min-width: 0; }
  .form-field > label, .category-fields > label { font-size: 16px; font-weight: 600; }
  .form-field > label > span:not(.optional) { color: var(--accent, #bd492e); }
  .optional { color: var(--muted, #797169); font-size: 14px; font-weight: 400; margin-left: 5px; }
  .form-field :global(input:not([type="file"])), select { width: 100%; min-width: 0; border: 1px solid #a99f94; background: white; border-radius: 8px; min-height: 42px; font-size: 16px; padding: 9px 11px; color: var(--ink, #302c28); }
  .category-fields { display: grid; gap: 8px; border: 1px solid var(--line, #e9e3da); padding: 12px; border-radius: 10px; min-width: 0; }
  .restaurant-form :global(button), .collection :global(button) { font-size: 14px; min-height: 40px; }
  .image-upload { background: #f3eee6; border: 1px dashed #a99f94; border-radius: 10px; padding: 17px; min-width: 0; }
  .image-methods { display: flex; flex-wrap: wrap; gap: 8px; }
  .image-methods :global(button) { flex: 1 1 auto; }
  .image-upload :global(input[type="url"]) { margin-top: 4px; }
  .image-upload > :global(button) { width: 100%; margin-top: 10px; }
  .upload-prompt { text-align: center; padding: 4px 0 15px; color: #857561; }
  .upload-prompt > :global(svg) { margin: 0 auto 9px; }
  .upload-prompt p { font-size: 16px; color: var(--ink, #302c28); margin: 0 0 5px; }
  .upload-prompt span { font-size: 14px; }
  input[type="file"] { display: block; width: 100%; min-width: 0; font-size: 16px; color: #6e6458; }
  input[type="file"]::file-selector-button { border: 1px solid #a99f94; background: white; color: var(--ink, #302c28); border-radius: 6px; min-height: 36px; padding: 7px 11px; margin-right: 10px; cursor: pointer; }
  .image-preview { display: block; width: 100%; max-height: 180px; object-fit: cover; border-radius: 7px; outline: 1px solid #00000015; outline-offset: -1px; }
  .image-filename { margin: 9px 0 13px; font-size: 14px; overflow-wrap: anywhere; color: #6e6458; }
  .field-hint { color: #776b5f; font-size: 14px; line-height: 1.6; margin: 0; }
  .field-hint:empty, .form-error:empty { display: none; }
  .field-error { color: #ab3528; font-size: 14px; line-height: 1.6; margin: 0; }
  .form-error { margin-top: 16px; }
  .form-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; margin-top: 23px; }
  select:focus-visible, input:focus-visible, :global(.collection button:focus-visible), :global(.collection-dialog button:focus-visible) { outline: 2px solid #934022; outline-offset: 3px; }
  @media (hover: hover) { :global(.collection-add:hover) { background: #a73d25; } :global(.remove-button:hover) { background: #f8eae4; color: #a73d25; } }
  @media (prefers-reduced-motion: no-preference) {
    .restaurant-card { transition: transform 180ms ease-out, box-shadow 180ms ease-out; }
    :global(.collection-add) { transition: transform 150ms ease-out, background-color 150ms ease-out; }
    :global(.collection-add:not(:disabled):active) { transform: scale(.96); }
    @media (hover: hover) {
      .restaurant-card:hover { transform: translateY(-4px); box-shadow: 0 10px 24px #302c2810; }
      :global(.collection-add:not(:disabled):hover) { transform: translateY(-2px); }
    }
  }
  @media (max-width: 900px) { .restaurant-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; } }
  @media (max-width: 560px) {
    .collection { padding: 28px 0; }
    .section-header { align-items: flex-start; flex-wrap: wrap; gap: 17px; margin-bottom: 24px; }
    h2 { font-size: 25px; }
    .collection-toolbar { align-items: flex-start; flex-direction: column; gap: 10px; }
    .search-field { width: 100%; }
    :global(.collection-search) { font-size: 16px; }
    .restaurant-grid { grid-template-columns: minmax(0, 1fr); gap: 20px; }
    .card-image-wrap { aspect-ratio: 1.65; }
    .empty-state { padding: 42px 17px; }
    :global(.collection-dialog) { padding: 23px 19px; }
  }
</style>
