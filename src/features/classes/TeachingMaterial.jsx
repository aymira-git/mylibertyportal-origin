import { useState, useEffect, useCallback } from "react";
import { auth } from "../../firebase";
import { useToast, useConfirm } from "../shared";
import { fetchMaterialsFor, addMaterial, deleteMaterial } from "./materialsRepository";
import {
  FolderOpen,
  Plus,
  Trash2,
  ExternalLink,
  FileText,
  Video,
  Link2,
  Loader2
} from "lucide-react";

export default function TeachingMaterial() {
  const toast = useToast();
  const confirm = useConfirm();
  const [materials, setMaterials] = useState([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const uid = auth.currentUser?.uid;

  const fetchMaterials = useCallback(async () => {
    try {
      const items = await fetchMaterialsFor(uid);
      setMaterials(items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const items = await fetchMaterialsFor(uid);
        if (active) setMaterials(items);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [uid]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    try {
      await addMaterial({ title: title.trim(), url: url.trim(), createdBy: uid });
      setTitle("");
      setUrl("");
      await fetchMaterials();
      toast("Teaching material added successfully!", "success");
    } catch (err) {
      toast("Error: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirm("Are you sure you want to remove this teaching material?"))) return;
    try {
      await deleteMaterial(id);
      await fetchMaterials();
      toast("Material removed", "info");
    } catch (err) {
      toast("Error: " + err.message, "error");
    }
  };

  const getIconForUrl = (targetUrl) => {
    const lower = (targetUrl || "").toLowerCase();
    if (lower.includes("youtube") || lower.includes("youtu.be") || lower.includes("vimeo")) {
      return <Video className="w-4 h-4 text-rose-500" />;
    }
    if (lower.includes("drive.google") || lower.includes("docs.google") || lower.includes(".pdf")) {
      return <FileText className="w-4 h-4 text-blue-500" />;
    }
    return <Link2 className="w-4 h-4 text-indigo-500" />;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-5xl mx-auto">
      {/* ── Left: Add New Material Form ── */}
      <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#1a3a8f]">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">Add Curriculum Resource</h3>
            <p className="text-[11px] text-slate-500 font-medium">Link worksheets, slides, or videos</p>
          </div>
        </div>

        <form onSubmit={handleAdd} className="space-y-3.5">
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Resource Title
            </label>
            <input
              type="text"
              placeholder="e.g. Cambridge B1 Unit 4 Vocabulary Guide"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Resource Web URL
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-[44px] bg-[#1a3a8f] hover:bg-[#122b6e] text-white py-2.5 px-4 rounded-xl font-bold text-xs transition duration-150 shadow-md shadow-indigo-950/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Save to Repository</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* ── Right: List of Materials ── */}
      <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#1a3a8f]">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Active Lesson Materials</h3>
              <p className="text-[11px] text-slate-500 font-medium">Quick reference repository for your classes</p>
            </div>
          </div>
          <span className="bg-indigo-50 text-[#1a3a8f] px-2.5 py-1 rounded-full font-extrabold text-[11px]">
            {materials.length} Items
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#1a3a8f]" />
            <span>Loading library materials...</span>
          </div>
        ) : materials.length === 0 ? (
          <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
            No teaching materials attached to your profile yet. Add your first resource using the form.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {materials.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 p-3.5 bg-slate-50/80 hover:bg-indigo-50/40 border border-slate-200/80 hover:border-indigo-200 rounded-2xl transition group shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0">
                    {getIconForUrl(m.url)}
                  </div>
                  <div className="min-w-0">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-extrabold text-slate-800 hover:text-[#1a3a8f] flex items-center gap-1.5 truncate group-hover:underline"
                    >
                      <span className="truncate">{m.title}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                    </a>
                    <p className="text-[10px] text-slate-400 truncate max-w-xs">{m.url}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition shrink-0"
                  title="Remove material"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
