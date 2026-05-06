interface CmsItem {
  id: string;
  title?: string;
  content?: string;
  image_url?: string;
  position: number;
}

async function fetchSection(type: string): Promise<CmsItem[]> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "";
  try {
    const res = await fetch(`${base}/cms/${type}`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function CmsSections() {
  const [ads, islamInfo, honorList, quotes] = await Promise.all([
    fetchSection("advertisements"),
    fetchSection("islam_info"),
    fetchSection("honor_list"),
    fetchSection("quotes"),
  ]);

  return (
    <>
      {/* Advertisements */}
      {ads.length > 0 && (
        <section className="py-10 bg-cream">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
              {ads.map(ad => (
                <div key={ad.id} className="shrink-0 w-72 bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm">
                  {ad.image_url && (
                    <div className="h-36 bg-emerald-primary/5 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ad.image_url} alt={ad.title ?? ""} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    {ad.title && <p className="font-semibold text-charcoal text-sm">{ad.title}</p>}
                    {ad.content && <p className="text-charcoal/60 text-xs mt-1 leading-relaxed">{ad.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Learn About Islam */}
      {islamInfo.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-bold text-charcoal text-center mb-10">Learn About Islam</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {islamInfo.map(item => (
                <div key={item.id} className="bg-cream rounded-2xl border border-black/5 overflow-hidden">
                  {item.image_url && (
                    <div className="h-44 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image_url} alt={item.title ?? ""} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    {item.title && <h3 className="font-semibold text-charcoal mb-2">{item.title}</h3>}
                    {item.content && <p className="text-charcoal/60 text-sm leading-relaxed">{item.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Honor List */}
      {honorList.length > 0 && (
        <section className="py-16 bg-cream">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-display text-3xl font-bold text-charcoal mb-2">Honour Roll</h2>
            <p className="text-charcoal/50 text-sm mb-10">Celebrating our outstanding students</p>
            <div className="space-y-3">
              {honorList.map((item, i) => (
                <div key={item.id} className="bg-white rounded-2xl border border-black/5 px-6 py-4 flex items-center gap-4">
                  <span className="w-8 h-8 rounded-full bg-gold/10 text-gold font-bold text-sm flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="text-left min-w-0">
                    {item.title && <p className="font-semibold text-charcoal">{item.title}</p>}
                    {item.content && <p className="text-charcoal/50 text-sm mt-0.5 leading-relaxed">{item.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Quotes */}
      {quotes.length > 0 && (
        <section className="py-16 bg-emerald-primary">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {quotes.map(q => (
                <div key={q.id} className="bg-white/10 rounded-2xl p-6 border border-white/10">
                  {q.content && (
                    <p className="text-white/90 text-lg leading-relaxed italic mb-3">
                      &ldquo;{q.content}&rdquo;
                    </p>
                  )}
                  {q.title && <p className="text-white/60 text-sm font-medium">— {q.title}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
