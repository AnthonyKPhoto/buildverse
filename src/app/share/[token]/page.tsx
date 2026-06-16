"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Car, Wrench, AlertCircle, CheckCircle2, Package, Clock, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Modification {
  id: string; name: string; category: string; status: string; priority: string;
  brand?: string; vendor?: string; price?: number | null; actualPrice?: number | null;
  imageUrl?: string; installDate?: string; notes?: string;
}

interface Vehicle {
  id: string; name?: string; year: number; make: string; model: string;
  trim?: string; engine?: string; transmission?: string; drivetrain?: string;
  color?: string; mileage?: number; platform?: string; photoUrl?: string;
  modifications: Modification[];
}

const STATUS_COLORS: Record<string, string> = {
  INSTALLED:   "bg-green-500/15 text-green-400 border-green-500/25",
  PLANNED:     "bg-slate-500/15 text-slate-400 border-slate-500/25",
  RESEARCHING: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  ORDERED:     "bg-amber-500/15 text-amber-400 border-amber-500/25",
  PURCHASED:   "bg-purple-500/15 text-purple-400 border-purple-500/25",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  INSTALLED:   <CheckCircle2 className="w-3 h-3" />,
  PLANNED:     <Clock className="w-3 h-3" />,
  ORDERED:     <ShoppingCart className="w-3 h-3" />,
  PURCHASED:   <Package className="w-3 h-3" />,
};

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setVehicle)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center text-slate-400">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !vehicle) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center text-center p-8">
        <AlertCircle className="w-12 h-12 text-slate-600 mb-4" />
        <h1 className="text-xl font-bold text-slate-200">Build not found</h1>
        <p className="text-slate-500 mt-2 text-sm">This link may have been revoked or never existed.</p>
        <p className="text-slate-600 mt-6 text-xs">Powered by BuildVerse</p>
      </div>
    );
  }

  const installed = vehicle.modifications.filter((m) => m.status === "INSTALLED");
  const planned   = vehicle.modifications.filter((m) => m.status !== "INSTALLED");
  const totalInstalled = installed.reduce((s, m) => s + ((m.actualPrice ?? m.price) ?? 0), 0);
  const totalPlanned   = planned.reduce((s, m) => s + (m.price ?? 0), 0);

  const byCategory = vehicle.modifications.reduce<Record<string, Modification[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  const completion = vehicle.modifications.length > 0
    ? Math.round((installed.length / vehicle.modifications.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-start gap-5">
          {vehicle.photoUrl ? (
            <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-white/10">
              <Image
                src={vehicle.photoUrl}
                alt={vehicle.make}
                width={96} height={96}
                className="object-cover w-full h-full"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <Car className="w-10 h-10 text-slate-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {vehicle.name && <p className="text-sm font-medium text-violet-400 mb-0.5">{vehicle.name}</p>}
            <h1 className="text-2xl font-bold">{vehicle.year} {vehicle.make} {vehicle.model}</h1>
            {vehicle.trim && <p className="text-slate-400 text-sm">{vehicle.trim}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              {vehicle.engine       && <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/10">{vehicle.engine}</span>}
              {vehicle.transmission && <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/10">{vehicle.transmission}</span>}
              {vehicle.drivetrain   && <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/10">{vehicle.drivetrain}</span>}
              {vehicle.color        && <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/10">{vehicle.color}</span>}
              {vehicle.mileage      && <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/10">{vehicle.mileage.toLocaleString()} mi</span>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Mods",   value: vehicle.modifications.length },
            { label: "Installed",    value: installed.length },
            { label: "Installed $",  value: formatCurrency(totalInstalled) },
            { label: "Build %",      value: `${completion}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/4 border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="text-xl font-bold text-violet-400">{value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {vehicle.modifications.length > 0 && (
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Build completion</span>
              <span>{completion}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/8 rounded-full">
              <div className="h-1.5 bg-violet-500 rounded-full transition-all" style={{ width: `${completion}%` }} />
            </div>
          </div>
        )}

        {/* Mods by category */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-violet-400" />
            <h2 className="text-base font-semibold">Modifications ({vehicle.modifications.length})</h2>
          </div>

          {Object.entries(byCategory).map(([category, mods]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">{category}</p>
              <div className="space-y-2">
                {mods.map((mod) => (
                  <div key={mod.id} className="flex items-start gap-3 px-4 py-3 bg-white/3 border border-white/8 rounded-xl">
                    {mod.imageUrl && (
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={mod.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{mod.name}</p>
                        <span className={`inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-full border font-medium ${STATUS_COLORS[mod.status] ?? STATUS_COLORS.PLANNED}`}>
                          {STATUS_ICON[mod.status]}
                          {mod.status.charAt(0) + mod.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        {mod.brand  && <span className="text-xs text-slate-500">{mod.brand}</span>}
                        {mod.vendor && <span className="text-xs text-slate-500">{mod.vendor}</span>}
                        {(mod.actualPrice ?? mod.price) != null && (
                          <span className="text-xs font-medium text-violet-400">{formatCurrency((mod.actualPrice ?? mod.price)!)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/8 text-center">
          <p className="text-xs text-slate-600">
            Shared with <span className="text-violet-500 font-medium">BuildVerse</span> — Vehicle Modification Manager
          </p>
          {totalPlanned > 0 && (
            <p className="text-xs text-slate-600 mt-1">{formatCurrency(totalPlanned)} in planned mods</p>
          )}
        </div>
      </div>
    </div>
  );
}
