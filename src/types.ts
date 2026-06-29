export type AspectRatio = '1:1' | '4:5' | '3:4' | '9:16' | '16:9';

// Ngách thiết kế: 'racing' (áo đua) hoặc 'anime' (ugly sweater). Chọn ngách -> dùng đúng prompt.
export type Niche = 'racing' | 'anime';

// Loại sản phẩm phôi (ugly sweater) do người dùng chọn -> AI tham chiếu đúng concept.
export type ProductType = 'sweater' | 'sweatshirt' | 'hoodie';

export interface MediaItem {
  mediaId: string;
  base64: string;
  mimeType: string;
}

/** 2 ô upload bên trái + tuỳ chọn. */
export interface InputState {
  // Ngách thiết kế đang chọn -> quyết định prompt + loại sản phẩm + nhãn ô nhập.
  niche: Niche;
  // Ô 1: ảnh chủ thể (anime/nhân vật, hoặc xe... tuỳ ngách).
  sourceImage: MediaItem | null;
  // Ô 2: ảnh phôi trắng/trơn — canvas để AI in design lên.
  blankImage: MediaItem | null;
  // Loại sản phẩm phôi (người dùng chọn) -> AI tham chiếu đúng concept design.
  productType: ProductType;
  // Ghi chú thêm cho AI (tuỳ chọn): màu, chữ, vị trí in...
  notes: string;
  aspectRatio: AspectRatio;
}

export interface GeneratedResult {
  id: string;
  mediaId: string;
  base64: string;
  mimeType: string;
  prompt: string;
}
