# 午餐事務所

午餐單抽小遊戲。使用 **Svelte 5、JavaScript、Vite、Tailwind CSS、shadcn-svelte**。

## 執行

```sh
npm install
npm run dev
```

```sh
npm run check   # Svelte 元件檢查
npm run build  # 靜態網站輸出至 dist/
npm run preview
```

需 Node.js 22.12 以上，以及支援 IndexedDB 的現代瀏覽器。

## 使用方式

- 收藏餐廳照片與名稱，可選填分類和地址。
- 自行新增、刪除分類，管理自己的口袋名單。
- 抽一張午餐卡，點擊卡片揭曉，不滿意可以重抽。
- 確認後記入本週菜單，同一天以最後一次選擇為準。
- 每週一重置用餐紀錄，保留餐廳與分類收藏。

初始餐廳為虛構體驗資料，可自行刪除。

## 資料儲存

資料以 JSON 儲存在此瀏覽器的 IndexedDB，不會上傳伺服器，也不跨裝置同步。清除網站資料會失去收藏與紀錄。
