// 大手セレクトショップ（BEAMS・UNITED ARROWS）やZOZOTOWNの売り場分けに合わせた階層。
export const accessoryFloors = {
  shoes: ['靴・レッグウェア'],
  accessories: ['ピアス','首元アクセサリー','ブレスレット','指輪','ネイル','ハーネス','耳・尻尾','頭・髪飾り','顔まわり小物','口元小物'],
  goods: ['眼鏡・ゴーグル','マスク','手袋','帽子','バッグ']
} as const;
export type AccessoryFloor = keyof typeof accessoryFloors;
export const isAccessoryFloor = (s: string): s is AccessoryFloor => s in accessoryFloors;
// 未分類のカテゴリはファッション雑貨に入れる。
export const floorOfCategory = (category: string): AccessoryFloor =>
  (Object.keys(accessoryFloors) as AccessoryFloor[]).find(f => (accessoryFloors[f] as readonly string[]).includes(category)) ?? 'goods';
