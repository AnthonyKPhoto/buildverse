"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Search, Package, Star } from "lucide-react";
import { useState } from "react";

interface Vendor {
  name: string;
  domain: string;
  url: string;
  specialty: string[];
  description: string;
  shipping: string;
  highlights: string[];
  rating: number;
  tags: string[];
}

const VENDORS: Vendor[] = [
  {
    name: "ECS Tuning",
    domain: "ecstuning.com",
    url: "https://www.ecstuning.com",
    specialty: ["European"],
    description: "One of the largest European car parts retailers. Excellent for Audi, BMW, VW, Porsche, and Mercedes parts.",
    shipping: "Free over $49",
    highlights: ["Huge OEM+ selection", "Excellent fitment guarantee", "Lifetime warranty on select parts"],
    rating: 4.7,
    tags: ["Audi", "BMW", "VW", "Porsche", "Mercedes"],
  },
  {
    name: "FCP Euro",
    domain: "fcpeuro.com",
    url: "https://www.fcpeuro.com",
    specialty: ["European"],
    description: "Lifetime replacement guarantee on everything. Premier source for European OEM and OEM+ parts.",
    shipping: "Free over $49",
    highlights: ["Lifetime replacement guarantee", "OEM and OEM+ focus", "Excellent returns policy"],
    rating: 4.9,
    tags: ["Audi", "BMW", "Volvo", "Mercedes", "Saab"],
  },
  {
    name: "034Motorsport",
    domain: "034motorsport.com",
    url: "https://www.034motorsport.com",
    specialty: ["Performance", "European"],
    description: "Premium Audi/VW performance parts manufacturer. Known for their solid motor mounts, engine mounts, and suspension components.",
    shipping: "Calculated",
    highlights: ["In-house engineering", "Audi/VW specialists", "High-quality materials"],
    rating: 4.8,
    tags: ["Audi", "VW", "Performance"],
  },
  {
    name: "Integrated Engineering",
    domain: "integratedengineering.com",
    url: "https://www.integratedengineering.com",
    specialty: ["Performance", "Engine"],
    description: "Specializes in VW/Audi engine upgrades including turbo inlet pipes, intercoolers, and tune accessories.",
    shipping: "Free over $99",
    highlights: ["TFSI/TSI specialists", "Intake and airflow upgrades", "IE tune compatible parts"],
    rating: 4.7,
    tags: ["Audi", "VW", "Engine", "Turbo"],
  },
  {
    name: "APR",
    domain: "goapr.com",
    url: "https://www.goapr.com",
    specialty: ["Performance", "Tuning"],
    description: "Industry-leading ECU tune developer for VW/Audi. Also manufactures intakes, intercoolers, exhaust, and suspension.",
    shipping: "Free (dealer network)",
    highlights: ["Industry-leading ECU tunes", "Full stage kits", "Dealer network nationwide"],
    rating: 4.9,
    tags: ["Audi", "VW", "Tuning", "ECU"],
  },
  {
    name: "Unitronic",
    domain: "unitronic.ca",
    url: "https://www.unitronic.ca",
    specialty: ["Tuning", "Performance"],
    description: "Canadian ECU and DSG tune specialists for VW/Audi. Offers tune stacking and hardware support packages.",
    shipping: "Calculated",
    highlights: ["ECU + DSG tune packages", "Excellent tune quality", "Strong community support"],
    rating: 4.8,
    tags: ["Audi", "VW", "Tuning", "DSG"],
  },
  {
    name: "CTS Turbo",
    domain: "ctsturbo.com",
    url: "https://www.ctsturbo.com",
    specialty: ["Turbo", "Performance", "European"],
    description: "Specializes in turbo upgrade kits, intakes, intercoolers, and supporting mods for VW/Audi platforms.",
    shipping: "Free over $150",
    highlights: ["IS38 hybrid turbos", "MQB intake specialists", "Intercooler upgrades"],
    rating: 4.6,
    tags: ["Audi", "VW", "GTI", "Golf R", "Turbo"],
  },
  {
    name: "UROTuning",
    domain: "urotuning.com",
    url: "https://www.urotuning.com",
    specialty: ["European"],
    description: "Wide selection of European performance and OEM parts with competitive pricing and fast shipping.",
    shipping: "Free over $75",
    highlights: ["Competitive pricing", "Fast shipping", "Wide selection"],
    rating: 4.5,
    tags: ["Audi", "BMW", "VW", "Porsche"],
  },
  {
    name: "BMP Tuning",
    domain: "bmptuning.com",
    url: "https://www.bmptuning.com",
    specialty: ["European", "Performance"],
    description: "BMW and MINI specialists with a focus on performance upgrades, intakes, exhausts, and suspension.",
    shipping: "Free over $99",
    highlights: ["BMW specialists", "MINI performance", "Competitive pricing"],
    rating: 4.4,
    tags: ["BMW", "MINI", "Performance"],
  },
  {
    name: "Tire Rack",
    domain: "tirerack.com",
    url: "https://www.tirerack.com",
    specialty: ["Wheels", "Tires"],
    description: "America's largest tire and wheel retailer. Excellent fitment guides, reviews, and free flat repair.",
    shipping: "Free to dealer",
    highlights: ["Huge selection", "Expert reviews", "Fitment guarantee"],
    rating: 4.8,
    tags: ["Tires", "Wheels", "All Makes"],
  },
  {
    name: "RockAuto",
    domain: "rockauto.com",
    url: "https://www.rockauto.com",
    specialty: ["OEM", "Budget"],
    description: "Wholesale parts retailer with incredible pricing on OEM and aftermarket parts for virtually any vehicle.",
    shipping: "Calculated",
    highlights: ["Lowest prices", "Huge OEM catalog", "All makes and models"],
    rating: 4.3,
    tags: ["All Makes", "OEM", "Budget"],
  },
  {
    name: "BC Racing",
    domain: "bcracing.com",
    url: "https://www.bc-racing.com",
    specialty: ["Suspension", "Coilovers"],
    description: "Industry leader in adjustable coilover systems. Wide vehicle fitment and excellent value.",
    shipping: "Via distributors",
    highlights: ["Best value coilovers", "Huge vehicle fitment", "Fully adjustable"],
    rating: 4.6,
    tags: ["Coilovers", "Suspension", "All Makes"],
  },
];

export default function VendorsPage() {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("All");

  const allTags = ["All", ...Array.from(new Set(VENDORS.flatMap((v) => v.tags))).sort()];

  const filtered = VENDORS.filter((v) => {
    const matchSearch = !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase()) ||
      v.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchTag = activeTag === "All" || v.tags.includes(activeTag);
    return matchSearch && matchTag;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Vendor Directory</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Trusted sources for performance parts, OEM replacements, and upgrades
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors…"
            className="pl-8 w-52"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                activeTag === tag
                  ? "bg-theme text-white border-theme"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Vendor grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((vendor) => (
          <Card key={vendor.domain} className="hover:border-theme/30 transition-all duration-200 flex flex-col">
            <CardContent className="p-5 flex flex-col flex-1">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-base">{vendor.name}</h3>
                  <p className="text-xs text-muted-foreground">{vendor.domain}</p>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{vendor.rating}</span>
                </div>
              </div>

              {/* Specialty badges */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {vendor.specialty.map((s) => (
                  <Badge key={s} className="text-xs bg-theme/10 text-theme border-theme/20">{s}</Badge>
                ))}
                {vendor.tags.slice(0, 3).map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground flex-1 mb-3 leading-relaxed">{vendor.description}</p>

              {/* Highlights */}
              <ul className="space-y-1 mb-4">
                {vendor.highlights.map((h) => (
                  <li key={h} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-theme flex-shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Package className="w-3 h-3" />
                  {vendor.shipping}
                </div>
                <a href={vendor.url} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                    Visit Store
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No vendors match your search</p>
        </div>
      )}
    </div>
  );
}
