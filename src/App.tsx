import React, { useState, useEffect } from 'react';
import { Flow, MODELS_BY_PROVIDER, CUSTOM_MODEL_ID, Provider, DEFAULT_PROVIDER, getProviderInfo, isFlowAvailable, isGeminiWebAvailable, isChatGPTAvailable } from './flow-sdk';
import { SegmentedToggle, ZoomModal, Dropdown } from './components/Primitives';
import { ApiKeyModal } from './components/ApiKeyModal';
import { InputState, GeneratedResult, AspectRatio, MediaItem, ProductType, Niche } from './types';

const NUM_OPTIONS = 2;

// Loại sản phẩm phôi — LUÔN là ugly sweater (dùng chung cho mọi ngách).
const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: 'sweater', label: 'Ugly sweater (áo len dệt)' },
  { value: 'sweatshirt', label: 'Sweatshirt' },
  { value: 'hoodie', label: 'Hoodie' },
];
const PRODUCT_TYPE_PROMPT: Record<ProductType, string> = {
  sweater: 'an UGLY-SWEATER-STYLE crewneck KNIT SWEATER (a festive knitted jumper) — lean fully into the knitted ugly-sweater texture',
  sweatshirt: 'a crewneck SWEATSHIRT — print a knit-look ugly-sweater graphic onto it',
  hoodie: 'a HOODIE — print a knit-look ugly-sweater graphic onto it',
};

// Cấu hình theo NGÁCH — sản phẩm LUÔN là ugly sweater, chỉ khác CHỦ ĐỀ (theme).
type NicheCfg = {
  label: string;
  upload1: { title: string; desc: string };
  notesPlaceholder: string;
  // Mảnh prompt theo theme (đều dựng trên cùng 1 khung ugly sweater bên dưới):
  themeName: string;  // tên theme cho dòng mở đầu (in hoa)
  themeShort: string; // tên ngắn để chèn vào câu
  keyword: string;    // từ khoá research (đã kèm dấu ngoặc kép)
  subject: string;    // mô tả IMAGE 1 là gì + cách thể hiện
  motifs: string;     // motif dệt kim đặc trưng để fuse vào áo
  feature: string;    // STRICT RULE: bắt buộc thể hiện chủ thể
};
const NICHES: Record<Niche, NicheCfg> = {
  anime: {
    label: 'Anime',
    upload1: { title: 'Ảnh anime/nhân vật', desc: 'Nhân vật/series anime để in lên áo' },
    notesPlaceholder: 'VD: nền áo đỏ Giáng Sinh, thêm bông tuyết, tên nhân vật…',
    themeName: 'ANIME',
    themeShort: 'anime',
    keyword: '"ugly sweater anime"',
    subject: "ANIME THEME & SUBJECT SOURCE: the anime character, series or theme the new design must be built around. This IS the hero of the artwork — faithfully feature this character and its iconic motifs, items and symbols, redrawn in the ugly-sweater knit art style (see DESIGN STYLE), and keep the character clearly recognizable. Take the design's color accents from this subject's real colors (hair, outfit, signature colors).",
    motifs: 'the anime subject from IMAGE 1 (the character rendered as if knitted into the sweater, framed by themed knit motifs)',
    feature: 'the anime character and motifs from IMAGE 1 MUST be clearly present and recognizable, rendered in the ugly-sweater knit style.',
  },
  racing: {
    label: 'Racing (F1 / MotoGP)',
    upload1: { title: 'Ảnh xe/đội đua', desc: 'Xe đua, máy đua, livery hoặc logo đội…' },
    notesPlaceholder: 'VD: nền áo đỏ Giáng Sinh, thêm cờ caro, số xe, tên đội…',
    themeName: 'RACING / MOTORSPORT',
    themeShort: 'racing',
    keyword: '"ugly sweater racing" (also "ugly sweater f1", "ugly sweater motogp")',
    subject: "RACING THEME & SUBJECT SOURCE: the racing car, motorsport machine, team or livery the new design must be built around (e.g. an F1 or MotoGP car/bike). This IS the hero of the artwork — feature the vehicle and its racing iconography (the car/bike silhouette, team logos and branding, livery colors, racing number) redrawn in the ugly-sweater knit art style, and keep it recognizable. Take the design's color accents from the car/team's real livery and sponsor colors.",
    motifs: 'the racing subject from IMAGE 1 (the car/machine rendered as if knitted into the sweater, framed by motorsport knit motifs such as checkered flags, tyres, trophies, helmets, speed stripes and the team logos)',
    feature: 'the racing car/machine and motorsport motifs from IMAGE 1 MUST be clearly present and recognizable, rendered in the ugly-sweater knit style.',
  },
};
const NICHE_ITEMS: { value: Niche; label: string }[] = [
  { value: 'anime', label: NICHES.anime.label },
  { value: 'racing', label: NICHES.racing.label },
];

/** Ghép prompt UGLY SWEATER theo CHỦ ĐỀ ngách (anime / racing). Khung prompt chung, chỉ khác theme. */
function buildPrompt(notes: string, variant: number, productType: ProductType, niche: Niche): string {
  const c = NICHES[niche];
  const base = `You are a professional print-on-demand "UGLY SWEATER" apparel mockup generator specialized in ${c.themeName} ugly-sweater designs — the festive, kitschy novelty-knit "ugly Christmas sweater" look fused with ${c.themeShort}.

You are given two reference images, in this EXACT order:
- IMAGE 1 — ${c.subject}
- IMAGE 2 — BLANK PRODUCT: a plain blank garment (e.g. a sweater, sweatshirt or hoodie). This is the canvas you print the design onto.

PRESERVE THE PRODUCT'S SHAPE & SCENE — CRITICAL: Keep the EXACT SAME garment type, shape, silhouette, cut, collar, cuffs, sleeves, fabric and material, folds and wrinkles, AND the EXACT SAME background/scene, lighting, shadows, people, pose and camera angle as IMAGE 2. Do NOT swap the garment for a different type, do NOT reshape, resize or replace the product, and do NOT change the background or the people. BUT the product's plain surface is ONLY a blank CANVAS — you SHOULD cover it with the printed ugly-sweater design INCLUDING LARGE AREAS OF COLOR and all-over knit patterning, so it reads as a real festive ${c.themeShort} ugly sweater, NOT a plain garment with one small logo. The print must wrap the fabric's folds, curvature and lighting like a real garment.

DESIGN STYLE — ${c.themeName} UGLY SWEATER. The blank product in IMAGE 2 is ${PRODUCT_TYPE_PROMPT[productType]}. Build the design in the classic "ugly Christmas sweater" aesthetic: chunky knit / cross-stitch / fair-isle texture, horizontal patterned bands and borders, snowflakes, geometric and pixelated knit motifs and festive icons — intentionally fun, busy and kitschy — and fuse in ${c.motifs}.

RESEARCH & TREND-MATCH (VERY IMPORTANT): design as if you had just researched the search keyword ${c.keyword} and studied the TOP-RANKING results across Google's "All", "Images", "Short videos" and "Shopping" tabs, plus the best-selling listings on POD marketplaces (Etsy, Amazon, Redbubble, TeePublic). Take CONCEPT, layout, motif and composition inspiration from those hottest, top-of-search, best-selling ugly-sweater ${c.themeShort} designs, and synthesize them into a fresh, polished, market-ready design — do NOT copy any single existing one.

TASK: Create a brand-new ugly-sweater-style ${c.themeShort} graphic themed on the subject of IMAGE 1, in the knit/festive style above, and print it realistically onto the blank product in IMAGE 2 — as if truly knitted/printed on it, following the fabric folds, curvature and lighting so the result looks like a real product photo.

STRICT RULES:
- FEATURE THE SUBJECT: ${c.feature}
- ALL-OVER UGLY-SWEATER LOOK: cover the garment with the festive knit design plus patterned bands/borders; choose a tasteful festive base color (e.g. red, green, navy, black or cream) that suits IMAGE 1's palette. Do NOT leave a plain garment with just a small print.
- PRINT ONLY: only add the design; never change the garment, its shape, or the background of IMAGE 2 (see "PRESERVE THE PRODUCT'S SHAPE & SCENE" above).
- The final image shows ONLY the product from IMAGE 2. Do NOT show IMAGE 1's original photo anywhere in the output.
- Output ONE single high-resolution, photorealistic product mockup image.`;
  const variantHint = `\n\nThis is creative VARIATION #${variant + 1} of ${NUM_OPTIONS}. Make it visibly DIFFERENT from the other variations — vary the layout, the knit motifs and borders, the festive base color and the overall composition — but keep the same ${c.themeShort} subject from IMAGE 1 clearly recognizable and strictly obey every rule above.`;
  const extra = notes.trim()
    ? `\n\nADDITIONAL INSTRUCTIONS FROM USER (must also follow): "${notes.trim()}"`
    : '';
  return base + variantHint + extra;
}

// Version hiển thị: dùng define lúc build; nếu chưa thay (vd. dev) thì fallback an toàn
// (typeof trên biến chưa khai báo KHÔNG ném lỗi -> tránh trắng trang).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';
const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';

/** 1 ô upload (có số thứ tự, tiêu đề, mô tả; xem trước + xoá ảnh). */
const UploadBox: React.FC<{
  index: number;
  title: string;
  desc: string;
  image: MediaItem | null;
  onPick: () => void;
  onRemove: () => void;
  onZoom: (src: string) => void;
}> = ({ index, title, desc, image, onPick, onRemove, onZoom }) => {
  const src = image ? `data:${image.mimeType};base64,${image.base64}` : '';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-1">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#969696] text-black text-[11px] font-semibold shrink-0">
          {index}
        </span>
        <div className="flex flex-col">
          <span className="text-[12px] font-semibold text-white leading-tight">{title}</span>
          <span className="text-[10px] text-white/40 leading-tight">{desc}</span>
        </div>
      </div>
      {image ? (
        <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-[4/3] bg-[#141414]">
          <img
            src={src}
            className="w-full h-full object-contain cursor-zoom-in"
            onClick={() => onZoom(src)}
          />
          <button
            onClick={onRemove}
            className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ) : (
        <button
          onClick={onPick}
          className="flex flex-col items-center justify-center gap-1 aspect-[4/3] rounded-xl border border-dashed border-[#595959] hover:border-[#969696] hover:bg-white/5 transition-colors text-white/40 hover:text-white/70"
        >
          <span className="material-symbols-outlined text-[26px]">add_photo_alternate</span>
          <span className="text-[10px] font-medium">Tải ảnh lên</span>
        </button>
      )}
    </div>
  );
};

/** 1 ô kết quả (1 trong 3 mẫu): loading / ảnh / lỗi / trống. */
const OptionCard: React.FC<{
  index: number;
  result: GeneratedResult | null;
  loading: boolean;
  error: string | null;
  onZoom: (src: string) => void;
  onDownload: (r: GeneratedResult) => void;
}> = ({ index, result, loading, error, onZoom, onDownload }) => {
  const src = result ? `data:${result.mimeType};base64,${result.base64}` : '';
  return (
    <div className="relative flex flex-col rounded-xl border border-white/10 bg-[#141414] overflow-hidden min-h-0">
      <div className="px-2.5 py-1.5 text-[10px] font-medium text-white/50 border-b border-white/10 flex items-center justify-between shrink-0">
        <span>Mẫu {index + 1}</span>
        {result && (
          <button
            onClick={() => onDownload(result)}
            className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            Tải
          </button>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-white/40 animate-shimmer">
            <span className="material-symbols-outlined text-[28px]">apparel</span>
            <span className="text-[10px]">Đang tạo…</span>
          </div>
        ) : result ? (
          <img
            src={src}
            className="max-w-full max-h-full object-contain rounded-md cursor-zoom-in"
            onClick={() => onZoom(src)}
          />
        ) : error ? (
          <div className="text-[10px] text-red-400/80 text-center px-2 leading-relaxed">{error}</div>
        ) : (
          <span className="material-symbols-outlined text-[28px] text-white/15">imagesmode</span>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [inputs, setInputs] = useState<InputState>({
    niche: 'anime',
    sourceImage: null,
    blankImage: null,
    productType: 'sweater',
    notes: '',
    aspectRatio: '1:1',
  });

  // 3 mẫu kết quả + lỗi từng mẫu + tập index đang tạo (chạy song song).
  const [results, setResults] = useState<(GeneratedResult | null)[]>(Array(NUM_OPTIONS).fill(null));
  const [slotErrors, setSlotErrors] = useState<(string | null)[]>(Array(NUM_OPTIONS).fill(null));
  const [loadingIndices, setLoadingIndices] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);

  // Đọc key đã lưu của một provider.
  const readKeyFor = (p: Provider): string => {
    try { return localStorage.getItem(getProviderInfo(p).storageKey) || ''; } catch { return ''; }
  };

  // Provider AI đang dùng (OpenRouter / Gemini) — chọn ở popup API key.
  const [provider, setProvider] = useState<Provider>(() => {
    try {
      const p = localStorage.getItem('AI_PROVIDER');
      if (p === 'googleflow') return isFlowAvailable() ? 'googleflow' : DEFAULT_PROVIDER;
      if (p === 'geminiweb') return isGeminiWebAvailable() ? 'geminiweb' : DEFAULT_PROVIDER;
      if (p === 'chatgpt') return isChatGPTAvailable() ? 'chatgpt' : DEFAULT_PROVIDER;
      return p === 'gemini' || p === 'openrouter' || p === 'openai' ? p : DEFAULT_PROVIDER;
    } catch { return DEFAULT_PROVIDER; }
  });

  // Model AI dùng để sinh ảnh (theo provider). 'Khác' -> nhập model ID thủ công.
  const [model, setModel] = useState<string>(MODELS_BY_PROVIDER[provider][0].id);
  const [customModel, setCustomModel] = useState('');
  // Model đọc động từ tài khoản Gemini (sau khi đăng nhập) -> đổ vào dropdown.
  const [geminiModels, setGeminiModels] = useState<{ value: string; label: string }[] | null>(null);

  // Đổi provider: đảm bảo model thuộc danh sách của provider mới.
  useEffect(() => {
    const list = MODELS_BY_PROVIDER[provider];
    setModel((cur) => (cur === CUSTOM_MODEL_ID || list.some((m) => m.id === cur) ? cur : list[0].id));
  }, [provider]);

  // Mỗi khi mở app: hiện popup nếu provider hiện tại chưa có key (env hoặc localStorage).
  useEffect(() => {
    const info = getProviderInfo(provider);
    if (info.noKey) return; // provider như Google Flow không cần key
    const envKey = (import.meta as any).env?.[info.envKey];
    if (!envKey && !readKeyFor(provider)) setApiKeyModalOpen(true);
  }, []);

  // Inject style nền tối + scrollbar + hiệu ứng shimmer (giống các app khác của studio).
  useEffect(() => {
    if (document.getElementById('dt-app-styles')) return;
    const style = document.createElement('style');
    style.id = 'dt-app-styles';
    style.textContent = `
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: #0e0e0e; font-family: 'Google Sans Text', sans-serif; overflow: hidden; }
      .dark-scrollbar::-webkit-scrollbar { width: 4px; }
      .dark-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .dark-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      @keyframes shimmer { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
      .animate-shimmer { animation: shimmer 1.5s infinite ease-in-out; }
    `;
    document.head.appendChild(style);
  }, []);

  const saveApiKey = (p: Provider, key: string) => {
    try {
      const info = getProviderInfo(p);
      if (!info.noKey && info.storageKey) localStorage.setItem(info.storageKey, key);
      localStorage.setItem('AI_PROVIDER', p);
    } catch {}
    setProvider(p);
    setApiKeyModalOpen(false);
    // Chọn provider automation -> mở ngay Chrome + vào web để đăng nhập (không đợi bấm Tạo).
    if (p === 'googleflow') (window as any).flowBridge?.open?.().catch(() => {});
    if (p === 'chatgpt') (window as any).chatgptBridge?.open?.().catch(() => {});
    if (p === 'geminiweb') {
      // open() trả về danh sách model đọc từ tài khoản -> đổ vào dropdown.
      (window as any).geminiBridge?.open?.()
        .then((models: string[]) => {
          if (Array.isArray(models) && models.length) {
            const items = models.map((m) => ({ value: m, label: m }));
            setGeminiModels(items);
            setModel(items[0].value);
          }
        })
        .catch(() => {});
    }
  };

  // Chọn ảnh cho 1 trong 3 ô.
  const pick = async (slot: keyof Pick<InputState, 'sourceImage' | 'blankImage'>) => {
    try {
      const m = await Flow.media.select({ filter: 'image' });
      setInputs((prev) => ({ ...prev, [slot]: { mediaId: m.mediaId, base64: m.base64, mimeType: m.mimeType } }));
    } catch {
      // người dùng huỷ chọn file -> bỏ qua
    }
  };

  const clearSlot = (slot: keyof Pick<InputState, 'sourceImage' | 'blankImage'>) =>
    setInputs((prev) => ({ ...prev, [slot]: null }));

  const loading = loadingIndices.size > 0;
  const canGenerate = !!(inputs.sourceImage && inputs.blankImage) && !loading;
  const hasOutput = loading || results.some(Boolean) || slotErrors.some(Boolean);

  const generate = () => {
    const src = inputs.sourceImage, blk = inputs.blankImage;
    if (!src || !blk) {
      setError('Cần đủ 2 ảnh: tư liệu (1) và phôi trắng (2).');
      return;
    }
    const effectiveModel = model === CUSTOM_MODEL_ID ? customModel.trim() : model;
    if (!effectiveModel) { setError('Hãy nhập Model ID khi chọn "Khác".'); return; }

    setError(null);
    setResults(Array(NUM_OPTIONS).fill(null));
    setSlotErrors(Array(NUM_OPTIONS).fill(null));
    setLoadingIndices(new Set(Array.from({ length: NUM_OPTIONS }, (_, i) => i)));

    // Thứ tự PHẢI là: tư liệu -> phôi trắng (prompt tham chiếu IMAGE 1/2).
    const refs = [src.mediaId, blk.mediaId];
    const notes = inputs.notes;
    const aspectRatio = inputs.aspectRatio;
    const productType = inputs.productType;
    const niche = inputs.niche;

    // Tạo 3 mẫu SONG SONG — mẫu nào xong hiện trước, lỗi 1 mẫu không chặn 2 mẫu kia.
    for (let i = 0; i < NUM_OPTIONS; i++) {
      const idx = i;
      const prompt = buildPrompt(notes, idx, productType, niche);
      Flow.generate.image({ prompt, model: effectiveModel, provider, referenceImageMediaIds: refs, aspectRatio })
        .then((out) => {
          setResults((prev) => {
            const next = [...prev];
            next[idx] = { id: out.mediaId, mediaId: out.mediaId, base64: out.base64, mimeType: out.mimeType, prompt };
            return next;
          });
        })
        .catch((e: any) => {
          setSlotErrors((prev) => {
            const next = [...prev];
            next[idx] = e?.message || 'Tạo ảnh thất bại.';
            return next;
          });
        })
        .finally(() => {
          setLoadingIndices((prev) => {
            const next = new Set(prev);
            next.delete(idx);
            return next;
          });
        });
    }
  };

  const download = (r: GeneratedResult) => {
    const ext = (r.mimeType.split('/')[1] || 'png').replace('jpeg', 'jpg');
    Flow.download({ base64: r.base64, mimeType: r.mimeType, filename: `design-${Date.now()}.${ext}` });
  };

  // Provider Gemini web: dùng model đọc động từ tài khoản (nếu đã có); còn lại dùng list tĩnh.
  const baseModels =
    provider === 'geminiweb' && geminiModels && geminiModels.length
      ? geminiModels
      : MODELS_BY_PROVIDER[provider].map((m) => ({ value: m.id, label: m.label }));
  const modelItems = [
    ...baseModels,
    { value: CUSTOM_MODEL_ID, label: 'Khác (nhập model ID)…' },
  ];

  return (
    <div className="flex h-screen w-screen bg-[#0e0e0e] text-white overflow-hidden">
      {/* ===== Panel trái: đầu vào ===== */}
      <aside className="w-[380px] shrink-0 h-full border-r border-white/10 flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-amber-400">apparel</span>
            <h1 className="text-[14px] font-semibold">Ugly Anime</h1>
          </div>
          <span className="text-[10px] text-white/30">v{APP_VERSION}{BUILD_DATE ? ` · ${BUILD_DATE}` : ''}</span>
        </header>

        <div className="flex-1 overflow-y-auto dark-scrollbar p-4 flex flex-col gap-4">
          <Dropdown
            label="Ngách thiết kế"
            value={inputs.niche}
            items={NICHE_ITEMS}
            onChange={(v) => setInputs((prev) => ({ ...prev, niche: v as Niche }))}
          />
          <UploadBox
            index={1}
            title={NICHES[inputs.niche].upload1.title}
            desc={NICHES[inputs.niche].upload1.desc}
            image={inputs.sourceImage}
            onPick={() => pick('sourceImage')}
            onRemove={() => clearSlot('sourceImage')}
            onZoom={setZoomImage}
          />
          <UploadBox
            index={2}
            title="Ảnh phôi trắng"
            desc="Áo sweater/phôi trơn để AI in lên"
            image={inputs.blankImage}
            onPick={() => pick('blankImage')}
            onRemove={() => clearSlot('blankImage')}
            onZoom={setZoomImage}
          />

          <div className="flex flex-col gap-1 w-full">
            <span className="text-[10px] text-white/40 ml-2 font-medium uppercase tracking-wider">Ghi chú thêm (tuỳ chọn)</span>
            <textarea
              value={inputs.notes}
              onChange={(e) => setInputs((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder={NICHES[inputs.niche].notesPlaceholder}
              style={{ height: '80px' }}
              className="border border-[#595959] hover:border-[#7a7a7a] focus:border-[#969696] rounded-xl w-full px-3 py-2.5 resize-none bg-transparent text-[11px] font-medium text-white placeholder-[rgba(218,220,224,0.3)] tracking-[0.1px] focus:outline-none transition-colors dark-scrollbar"
            />
          </div>

          <Dropdown
            label="Loại sản phẩm (phôi úp lên)"
            value={inputs.productType}
            items={PRODUCT_TYPES}
            onChange={(v) => setInputs((prev) => ({ ...prev, productType: v as ProductType }))}
          />

          <SegmentedToggle
            label="Tỉ lệ ảnh"
            value={inputs.aspectRatio}
            items={[
              { value: '1:1', label: '1:1' },
              { value: '4:5', label: '4:5' },
              { value: '3:4', label: '3:4' },
              { value: '9:16', label: '9:16' },
            ]}
            onChange={(v: AspectRatio) => setInputs((prev) => ({ ...prev, aspectRatio: v }))}
          />

          <Dropdown
            label="Model AI"
            value={model}
            items={modelItems}
            onChange={setModel}
          />
          {model === CUSTOM_MODEL_ID && (
            <input
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="VD: google/gemini-2.5-flash-image"
              className="border border-[#595959] focus:border-[#969696] rounded-xl w-full px-3 py-2.5 bg-transparent text-[11px] text-white placeholder-white/25 focus:outline-none transition-colors"
            />
          )}

          {error && (
            <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 leading-relaxed">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 flex flex-col gap-2">
          <button
            onClick={generate}
            disabled={!canGenerate}
            className="flex items-center justify-center gap-2 h-[42px] rounded-xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">{loading ? 'progress_activity' : 'auto_awesome'}</span>
            {loading ? `Đang tạo ${NUM_OPTIONS} mẫu…` : `Tạo ${NUM_OPTIONS} mẫu lên phôi`}
          </button>
          <button
            onClick={() => setApiKeyModalOpen(true)}
            className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
          >
            Provider: <span className="text-white/60">{getProviderInfo(provider).label}</span> · Đổi API Key
          </button>
        </div>
      </aside>

      {/* ===== Panel phải: 3 mẫu kết quả ===== */}
      <main className="flex-1 h-full flex flex-col min-w-0">
        {hasOutput ? (
          <>
            <div className="px-5 pt-4 pb-1 text-[11px] text-white/40">
              Chọn mẫu ưng ý → bấm <span className="text-amber-400">Tải</span> ở góc mỗi mẫu. Bấm vào ảnh để phóng to.
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3 p-4 pt-2 min-h-0">
              {Array.from({ length: NUM_OPTIONS }, (_, i) => (
                <OptionCard
                  key={i}
                  index={i}
                  result={results[i]}
                  loading={loadingIndices.has(i)}
                  error={slotErrors[i]}
                  onZoom={setZoomImage}
                  onDownload={download}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex flex-col items-center gap-3 text-white/25 max-w-[340px] text-center">
              <span className="material-symbols-outlined text-[44px]">imagesmode</span>
              <span className="text-[13px] leading-relaxed">
                Tải đủ 2 ảnh bên trái rồi bấm <span className="text-white/50">Tạo {NUM_OPTIONS} mẫu lên phôi</span>. AI sẽ tạo {NUM_OPTIONS} mẫu để Anh4 chọn.
              </span>
            </div>
          </div>
        )}
      </main>

      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        required={!getProviderInfo(provider).noKey && !readKeyFor(provider) && !(import.meta as any).env?.[getProviderInfo(provider).envKey]}
        provider={provider}
        getKeyFor={readKeyFor}
        onSave={saveApiKey}
        onClose={() => setApiKeyModalOpen(false)}
      />
      <ZoomModal isOpen={!!zoomImage} imageSrc={zoomImage || ''} onClose={() => setZoomImage(null)} />
    </div>
  );
}
