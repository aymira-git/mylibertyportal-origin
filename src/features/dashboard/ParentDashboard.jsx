import { useState, useEffect, useMemo } from "react";
import { auth } from "../../firebase";
import {
  getAuthenticatedParentBundle,
  getChildAttendanceAndClasses,
  buildPaymentSummary,
} from "../students/parentPortalRepository";
import LevelBadge from "../shared/LevelBadge";
import Badge from "../shared/Badge";
import { useToast } from "../shared";
import { buildFrontDeskWhatsAppUrl } from "../../constants/contact";
import { getUrlAction, clearUrlAction } from "../../utils/urlAction";
import {
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  BookOpen,
  MessageSquare,
  ShieldCheck,
  Loader2,
} from "lucide-react";

export default function ParentDashboard({ user = null }) {
  const toast = useToast();
  const currentUid = user?.uid || auth.currentUser?.uid;

  useEffect(() => {
    const action = getUrlAction();
    if (action) {
      toast(`Action shortcut "${action}" is not supported in Parent Portal.`, "info");
      clearUrlAction();
    }
  }, [toast]);

  const [parentProfile, setParentProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [prevChildId, setPrevChildId] = useState(null);
  const [childDetails, setChildDetails] = useState({ classes: [], attendance: [] });
  const [loadingInitial, setLoadingInitial] = useState(Boolean(currentUid));
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState("");
  const [detailsError, setDetailsError] = useState("");
  const selectedChild = useMemo(() => {
    return children.find((c) => c.id === selectedChildId) || null;
  }, [children, selectedChildId]);

  // Reset child details and set loadingDetails immediately when child changes
  if (selectedChildId !== prevChildId) {
    setPrevChildId(selectedChildId);
    setChildDetails({ classes: [], attendance: [] });
    setLoadingDetails(Boolean(selectedChildId));
    setDetailsError("");
  }

  // 1. Load Parent Profile and Linked Children
  useEffect(() => {
    let active = true;
    if (!currentUid) return;

    getAuthenticatedParentBundle(currentUid)
      .then((bundle) => {
        if (!active) return;
        if (bundle.parent?.status && bundle.parent.status !== "active") {
          setError("This parent account is inactive. Please contact the front desk.");
          setLoadingInitial(false);
          return;
        }
        setParentProfile(bundle.parent);
        setChildren(bundle.children || []);
        if (bundle.children && bundle.children.length > 0) {
          setSelectedChildId(bundle.children[0].id);
        }
        setLoadingInitial(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed loading parent portal data:", err);
        setError("Unable to load parent portal. Please refresh or contact front desk.");
        setLoadingInitial(false);
      });

    return () => {
      active = false;
    };
  }, [currentUid]);

  // 2. Load Selected Child's Classes and Attendance
  useEffect(() => {
    let active = true;
    if (!selectedChildId) return;

    getChildAttendanceAndClasses(
      selectedChildId,
      selectedChild?.branchId || selectedChild?.branch
    )
      .then((data) => {
        if (!active) return;
        setChildDetails(data);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed loading child classes/attendance:", err);
        setDetailsError("Unable to load classes or attendance. Please refresh or contact the front desk.");
      })
      .finally(() => {
        if (active) {
          setLoadingDetails(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedChildId, selectedChild]);

  // Attendance Statistics
  const stats = useMemo(() => {
    const list = childDetails.attendance || [];
    const total = list.length;
    const present = list.filter((a) => a.status === "PRESENT").length;
    const late = list.filter((a) => a.status === "LATE").length;
    const excused = list.filter((a) => a.status === "EXCUSED").length;
    const absent = list.filter((a) => a.status === "ABSENT").length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
    return { total, present, late, excused, absent, rate };
  }, [childDetails.attendance]);

  const paymentSummary = useMemo(() => {
    return buildPaymentSummary(selectedChild);
  }, [selectedChild]);

  const handleWhatsAppContact = () => {
    const childName = selectedChild?.displayName || selectedChild?.name || "anak saya";
    const childId = selectedChild?.studentId || selectedChild?.nis || "-";
    const text = `Halo Front Desk My Liberty, saya orang tua dari ${childName} (NIS: ${childId}). Saya ingin menanyakan terkait program belajar dan informasi kehadiran.`;
    const branchKey =
      selectedChild?.branchId ||
      selectedChild?.branch ||
      parentProfile?.branchId ||
      parentProfile?.branch;
    const url = buildFrontDeskWhatsAppUrl(branchKey, text);
    window.open(url, "_blank");
  };

  const handleGeneralWhatsAppContact = () => {
    const text = `Halo Front Desk My Liberty, saya orang tua / wali siswa. Saya ingin menanyakan informasi akun dan penautan profil anak di portal orang tua.`;
    const branchKey = parentProfile?.branchId || parentProfile?.branch;
    const url = buildFrontDeskWhatsAppUrl(branchKey, text);
    window.open(url, "_blank");
  };

  if (loadingInitial) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a3a8f]" />
        <p className="text-sm font-medium">Memuat Portal Orang Tua...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto p-6 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-center space-y-3">
        <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
        <h3 className="font-bold text-base">Terjadi Kendala</h3>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  if (!children || children.length === 0) {
    return (
      <div className="max-w-lg mx-auto p-8 bg-white rounded-3xl border border-slate-200 shadow-xs text-center space-y-4">
        <div className="w-14 h-14 bg-indigo-50 text-[#1a3a8f] rounded-2xl flex items-center justify-center mx-auto">
          <Users className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-800">Selamat Datang di Portal Orang Tua</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Akun orang tua Anda telah aktif, namun belum ada profil siswa yang tertaut.
            Silakan hubungi Front Desk My Liberty agar staf kami dapat menautkan akun ananda.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGeneralWhatsAppContact}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Hubungi Front Desk WhatsApp</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 max-w-5xl mx-auto pb-10">
      {detailsError && (
        <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-xs">
          {detailsError}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-[#1a3a8f] via-[#162f74] to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-400/20 text-indigo-200 border border-indigo-400/30">
                Portal Orang Tua / Wali
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-300 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" /> Terverifikasi
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              {parentProfile?.displayName || "Orang Tua / Wali"}
            </h1>
            <p className="text-xs text-indigo-200/90">
              Pantau kehadiran kelas, jadwal belajar, dan perkembangan ananda di My Liberty.
            </p>
          </div>

          <button
            type="button"
            onClick={handleWhatsAppContact}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Tanya Front Desk</span>
          </button>
        </div>

        {/* Multi-child Switcher Pills */}
        {children.length > 1 && (
          <div className="relative z-10 mt-6 pt-5 border-t border-indigo-800/40">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-2">
              Pilih Siswa / Ananda:
            </p>
            <div className="flex flex-wrap gap-2">
              {children.map((child) => {
                const isSelected = child.id === selectedChildId;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => setSelectedChildId(child.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? "bg-white text-[#1a3a8f] shadow-md scale-102"
                        : "bg-indigo-900/60 text-indigo-200 hover:bg-indigo-800/80 border border-indigo-700/50"
                    }`}
                  >
                    <span>{child.displayName || child.name || "Siswa"}</span>
                    {child.currentLevel && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                          isSelected ? "bg-indigo-50 text-indigo-700 font-bold" : "bg-indigo-950/60 text-indigo-300"
                        }`}
                      >
                        {child.currentLevel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Child Detail Card */}
      {selectedChild && (
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
          {/* Child Identity Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#1a3a8f] border border-indigo-100 flex items-center justify-center font-black text-lg shrink-0">
                {(selectedChild.displayName || "S")[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-slate-800">
                    {selectedChild.displayName || selectedChild.name}
                  </h2>
                  <LevelBadge level={selectedChild.currentLevel || "warrior"} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span>ID: {selectedChild.studentId || selectedChild.nis || selectedChild.id}</span>
                  {selectedChild.program && <span>• {selectedChild.program}</span>}
                  {selectedChild.branch && <span>• Cabang {selectedChild.branch}</span>}
                </p>
              </div>
            </div>

            {paymentSummary && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Status Pembayaran:</span>
                <Badge
                  tone={
                    paymentSummary.status === "paid"
                      ? "emerald"
                      : paymentSummary.status === "pending"
                      ? "amber"
                      : "slate"
                  }
                >
                  {paymentSummary.status === "paid"
                    ? "Lunas"
                    : paymentSummary.status === "pending"
                    ? "Menunggu"
                    : "Belum Ada"}
                </Badge>
              </div>
            )}
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Total Sesi Hadir
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-800">{stats.present}</span>
                <span className="text-xs text-slate-400">/ {stats.total} sesi</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Tingkat Kehadiran
              </p>
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`text-2xl font-black ${
                    stats.rate >= 80 ? "text-emerald-600" : stats.rate >= 60 ? "text-amber-600" : "text-red-600"
                  }`}
                >
                  {stats.rate}%
                </span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Izin / Terlambat
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-600">{stats.late + stats.excused}</span>
                <span className="text-xs text-slate-400">kali</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Kelas Terdaftar
              </p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-[#1a3a8f]">{childDetails.classes.length}</span>
                <span className="text-xs text-slate-400">kelas aktif</span>
              </div>
            </div>
          </div>

          {/* Enrolled Classes Subsection */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 tracking-wider">
              <BookOpen className="w-3.5 h-3.5 text-[#1a3a8f]" />
              <span>Kelas &amp; Jadwal Belajar Aktif</span>
            </h3>

            {loadingDetails ? (
              <div className="p-4 flex items-center justify-center text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Memuat kelas...
              </div>
            ) : detailsError ? (
              <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-xs">
                Classes could not be loaded.
              </div>
            ) : childDetails.classes.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 text-center">
                Belum terdaftar di kelas aktif saat ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {childDetails.classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="p-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-2xl border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">
                        {cls.className || "Kelas Bahasa Inggris"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                        {cls.level || cls.program || "Course"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      {cls.scheduleDays && (
                        <p className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Hari: {Array.isArray(cls.scheduleDays) ? cls.scheduleDays.join(", ") : cls.scheduleDays}</span>
                        </p>
                      )}
                      {cls.scheduleTime && (
                        <p className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Pukul: {cls.scheduleTime} WITA</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance History Subsection */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-[#1a3a8f]" />
              <span>Riwayat Kehadiran (30 Sesi Terakhir)</span>
            </h3>

            {loadingDetails ? (
              <div className="p-4 flex items-center justify-center text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Memuat data kehadiran...
              </div>
            ) : detailsError ? (
              <div role="alert" className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-xs">
                Attendance could not be loaded.
              </div>
            ) : childDetails.attendance.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500 text-center">
                Belum ada riwayat kehadiran tercatat untuk siswa ini.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Tanggal</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Metode</th>
                      <th className="py-3 px-4">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {childDetails.attendance.map((att, idx) => (
                      <tr key={att.id || idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {att.attendanceDate || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              att.status === "PRESENT"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : att.status === "LATE"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : att.status === "EXCUSED"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                          >
                            {att.status === "PRESENT" && <CheckCircle2 className="w-3 h-3" />}
                            {att.status === "LATE" && <Clock className="w-3 h-3" />}
                            {att.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {att.method === "SCAN" ? "QR Scanner" : att.method || "Manual"}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {att.notes || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
