import { useState } from "react";
import { X, Building2, MapPin, Compass, AlertCircle } from "lucide-react";
import { SCHOOL_TIERS } from "../../../schemas/schoolOutreachSchema";
import { addSchool } from "./schoolOutreachRepository";
import { useToast } from "../../shared";

export default function AddSchoolModal({ currentUser, onClose, onSchoolAdded }) {
  const toast = useToast();

  const [name, setName] = useState("");
  const [municipality, setMunicipality] = useState("Kota Gorontalo");
  const [district, setDistrict] = useState("Kota Tengah");
  const [address, setAddress] = useState("");
  const [tier, setTier] = useState("SMA");
  const [lat, setLat] = useState("0.5500");
  const [lng, setLng] = useState("123.0600");
  const [status, setStatus] = useState("pending");

  const [saving, setSaving] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser.");
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setDetectingGps(false);
        toast("Current GPS coordinates applied!", "success");
      },
      (err) => {
        console.error("GPS error:", err);
        setErrorMsg("Could not detect location. Please input coordinates manually.");
        setDetectingGps(false);
      },
      { timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("School name is required.");
      return;
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setErrorMsg("Latitude and longitude must be valid numbers.");
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");

      await addSchool(
        {
          name: name.trim(),
          municipality: municipality.trim(),
          district: district.trim(),
          address: address.trim(),
          tier,
          lat: parsedLat,
          lng: parsedLng,
          status,
          active: true,
        },
        currentUser?.uid || "marketing-user"
      );

      toast(`${name} added to target schools!`, "success");
      if (onSchoolAdded) onSchoolAdded();
      onClose();
    } catch (err) {
      console.error("Error adding school:", err);
      setErrorMsg(err.message || "Failed to add school.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#1a3a8f] to-[#2a4db3] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <h3 className="font-extrabold text-base">Add New Target School</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">School Name *</label>
            <input
              type="text"
              placeholder="e.g. SMAN 5 Gorontalo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Municipality</label>
              <input
                type="text"
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">District (Kecamatan)</label>
              <input
                type="text"
                placeholder="e.g. Kota Tengah"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tier / Level</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              >
                {SCHOOL_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
              >
                <option value="pending">⚪ Pending</option>
                <option value="scheduled">🟡 Scheduled</option>
                <option value="visited">🟢 Visited</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              placeholder="e.g. Jl. Rusli Datau No. 12"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1a3a8f]/30"
            />
          </div>

          {/* Coordinates & GPS */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#1a3a8f]" />
                <span>Map Coordinates</span>
              </span>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={detectingGps}
                className="text-[11px] font-bold text-[#1a3a8f] hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{detectingGps ? "Detecting GPS..." : "Use Current GPS"}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#1a3a8f] hover:bg-[#122b6e] text-white text-xs font-extrabold rounded-xl shadow-xs transition disabled:opacity-60"
            >
              {saving ? "Adding..." : "Add School"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
