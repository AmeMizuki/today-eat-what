# 午餐事務所

午餐單抽小遊戲。使用 **Svelte 5、JavaScript、Vite、Tailwind CSS、shadcn-svelte**。

![home](https://github.com/AmeMizuki/today-eat-what/releases/download/preview/preview-home.png)

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

- 可上傳餐廳圖片、貼上剪貼簿圖片或使用圖片網址，並填寫名稱、分類與地址。
- 可編輯餐廳資訊、設定最多五顆星的評分，勾選店家後編輯或批次刪除。
- 自行新增、刪除分類，管理自己的口袋名單。
- 每天只能抽一張午餐卡，點擊卡片揭曉；關閉或重新整理仍可查看同一張。
- 確認後記入本週菜單，未確認不會留下用餐紀錄。
- 每週一重置用餐紀錄，保留餐廳與分類收藏。

初始餐廳為虛構體驗資料，可自行刪除。

## 流暢動畫效果
參考著名手遊如《蔚藍檔案》、《公主連結》、《偶像大師灰姑娘》等...。

![animation](https://github.com/AmeMizuki/today-eat-what/releases/download/preview/preview-animation.webp)

## 完全自訂
- 可以自訂餐廳名稱
- 填寫餐廳地址
- 自訂餐廳圖示
- 自訂分類

![menu](https://github.com/AmeMizuki/today-eat-what/releases/download/preview/preview-menu.png)

## 本週菜單
每週重製菜單，記錄每天挑選的餐廳。

![week](https://github.com/AmeMizuki/today-eat-what/releases/download/preview/preview-week.png)


> [!IMPORTANT]
> 資料以 JSON 儲存在此瀏覽器的 IndexedDB，不會上傳伺服器，也不跨裝置同步。頁面可檢查並申請瀏覽器持久儲存，降低自動清除的風險，但無法保證永久保存；清除網站資料、使用無痕模式或更換裝置仍可能失去資料。圖片網址會從原網站載入，是否能顯示取決於來源網站。
