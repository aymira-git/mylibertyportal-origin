export default function StudentFamilyFields({ formData, field }) {
  return (
    <>
      <hr className="border-slate-100" />

      {/* Section 3: Parents / Guardians */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-[#1a3a8f] flex items-center gap-1.5">
          <span>👨‍👩‍👦</span> Parents / Guardians Information
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Father Box */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <p className="text-[11px] font-bold text-slate-700 uppercase">
              Father's Information (Data Ayah)
            </p>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                Name (Nama Ayah)
              </label>
              <input
                type="text"
                placeholder="Father's Name"
                value={formData.fatherName || ""}
                onChange={(e) => field("fatherName", e.target.value)}
                className="w-full p-2 border rounded-lg bg-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                Occupation (Pekerjaan Ayah)
              </label>
              <input
                type="text"
                placeholder="Occupation"
                value={formData.fatherJob || ""}
                onChange={(e) => field("fatherJob", e.target.value)}
                className="w-full p-2 border rounded-lg bg-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                WhatsApp Phone (No HP Ayah)
              </label>
              <input
                type="tel"
                placeholder="08..."
                value={formData.fatherPhone || ""}
                onChange={(e) => field("fatherPhone", e.target.value)}
                className="w-full p-2 border rounded-lg bg-white text-xs"
              />
            </div>
          </div>

          {/* Mother Box */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <p className="text-[11px] font-bold text-slate-700 uppercase">
              Mother's Information (Data Ibu)
            </p>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                Name (Nama Ibu)
              </label>
              <input
                type="text"
                placeholder="Mother's Name"
                value={formData.motherName || ""}
                onChange={(e) => field("motherName", e.target.value)}
                className="w-full p-2 border rounded-lg bg-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                Occupation (Pekerjaan Ibu)
              </label>
              <input
                type="text"
                placeholder="Occupation"
                value={formData.motherJob || ""}
                onChange={(e) => field("motherJob", e.target.value)}
                className="w-full p-2 border rounded-lg bg-white text-xs"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">
                WhatsApp Phone (No HP Ibu)
              </label>
              <input
                type="tel"
                placeholder="08..."
                value={formData.motherPhone || ""}
                onChange={(e) => field("motherPhone", e.target.value)}
                className="w-full p-2 border rounded-lg bg-white text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <hr className="border-slate-100" />

      {/* Section 4: Administrative & Notes */}
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-[#1a3a8f] flex items-center gap-1.5">
          <span>📝</span> Administrative & Evaluation
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Information Source (Dari Mana Tahu MyLiberty)
            </label>
            <input
              type="text"
              placeholder="e.g. Instagram, Teman, Brosur"
              value={formData.referralSource || ""}
              onChange={(e) => field("referralSource", e.target.value)}
              className="w-full p-2.5 border rounded-xl"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Notes / Evaluation
            </label>
            <textarea
              rows={3}
              placeholder="Internal notes, special considerations, or student progress..."
              value={formData.notes || ""}
              onChange={(e) => field("notes", e.target.value)}
              className="w-full p-2.5 border rounded-xl"
            />
          </div>
        </div>
      </div>
    </>
  );
}
