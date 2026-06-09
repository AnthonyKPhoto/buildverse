"use client";

import { Card, CardContent } from "@/components/ui/card";
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
  // ── Universal / Multi-Make ──────────────────────────────────────────────────
  {
    name: "Tire Rack",
    domain: "tirerack.com",
    url: "https://www.tirerack.com",
    specialty: ["Wheels", "Tires"],
    description: "America's largest tire and wheel retailer. Expert reviews, fitment guides, and free flat repair at thousands of locations.",
    shipping: "Free to installer",
    highlights: ["Huge wheel & tire selection", "Expert independent reviews", "Fitment guarantee"],
    rating: 4.8,
    tags: ["Tires", "Wheels", "Universal"],
  },
  {
    name: "RockAuto",
    domain: "rockauto.com",
    url: "https://www.rockauto.com",
    specialty: ["OEM", "Budget"],
    description: "Wholesale parts warehouse with rock-bottom pricing on OEM and aftermarket parts for virtually every vehicle ever made.",
    shipping: "Calculated",
    highlights: ["Lowest prices anywhere", "Massive OEM catalog", "Every make & model"],
    rating: 4.3,
    tags: ["Universal", "OEM", "Budget"],
  },
  {
    name: "Summit Racing",
    domain: "summitracing.com",
    url: "https://www.summitracing.com",
    specialty: ["Performance", "Racing"],
    description: "One of the largest performance parts retailers in the US. Covers everything from street builds to full race cars across all makes.",
    shipping: "Free over $109",
    highlights: ["Massive performance catalog", "Expert phone support", "Same-day shipping available"],
    rating: 4.7,
    tags: ["Universal", "Performance", "Racing"],
  },
  {
    name: "JEGS",
    domain: "jegs.com",
    url: "https://www.jegs.com",
    specialty: ["Performance", "Racing"],
    description: "High-performance auto parts retailer with a huge catalog spanning domestic and import makes. Competing directly with Summit Racing.",
    shipping: "Free over $99",
    highlights: ["Next-day shipping options", "Wide brand selection", "Price match guarantee"],
    rating: 4.6,
    tags: ["Universal", "Performance", "Racing"],
  },
  {
    name: "Mishimoto",
    domain: "mishimoto.com",
    url: "https://www.mishimoto.com",
    specialty: ["Cooling", "Performance"],
    description: "Leading manufacturer of performance cooling products — radiators, intercoolers, oil coolers, and silicone hoses for all platforms.",
    shipping: "Free over $75",
    highlights: ["Lifetime warranty", "Direct-fit applications", "Covers JDM, Euro & domestic"],
    rating: 4.7,
    tags: ["Universal", "Cooling", "Turbo", "Performance"],
  },
  {
    name: "Eibach",
    domain: "eibach.com",
    url: "https://www.eibach.com",
    specialty: ["Suspension", "Springs"],
    description: "World-class spring and suspension manufacturer trusted by OEMs and racers alike. Pro-Kit and sportline springs for daily drivers.",
    shipping: "Via dealers",
    highlights: ["OEM supplier quality", "Sport springs & coilovers", "Covers virtually all makes"],
    rating: 4.8,
    tags: ["Universal", "Suspension", "Springs"],
  },
  {
    name: "BC Racing",
    domain: "bc-racing.com",
    url: "https://www.bc-racing.com",
    specialty: ["Suspension", "Coilovers"],
    description: "Industry leader in adjustable coilover systems. Best value full-adjustable coilover with the widest vehicle fitment list available.",
    shipping: "Via distributors",
    highlights: ["Best value coilovers", "2000+ vehicle fitments", "Fully height & damper adjustable"],
    rating: 4.6,
    tags: ["Universal", "Coilovers", "Suspension"],
  },
  {
    name: "KW Suspensions",
    domain: "kwsuspensions.com",
    url: "https://www.kwsuspensions.com",
    specialty: ["Suspension", "Coilovers"],
    description: "German-engineered premium coilovers and suspension components trusted by OEM manufacturers and motorsport teams worldwide.",
    shipping: "Via dealers",
    highlights: ["Inox stainless construction", "OEM-level quality", "Variant 1/2/3 lineup"],
    rating: 4.9,
    tags: ["Universal", "Coilovers", "Suspension", "Premium"],
  },
  {
    name: "Bilstein",
    domain: "bilstein.com",
    url: "https://www.bilstein.com",
    specialty: ["Suspension", "Shocks"],
    description: "The gold standard in monotube shock absorbers. OEM supplier to Porsche, BMW, and Mercedes. B6/B8/B16 product lines for all budgets.",
    shipping: "Via dealers",
    highlights: ["Monotube technology", "OEM for German makes", "B6 through B16 lineup"],
    rating: 4.9,
    tags: ["Universal", "Shocks", "Suspension", "OEM"],
  },
  {
    name: "H&R Springs",
    domain: "hrsprings.com",
    url: "https://www.hrsprings.com",
    specialty: ["Suspension", "Springs"],
    description: "German spring manufacturer producing sport springs, coilovers, and sway bars for European and Japanese platforms.",
    shipping: "Via dealers",
    highlights: ["Sport lowering springs", "TÜV-approved", "Track & street options"],
    rating: 4.7,
    tags: ["Universal", "Springs", "Suspension"],
  },
  {
    name: "Brembo",
    domain: "brembo.com",
    url: "https://www.brembo.com",
    specialty: ["Brakes"],
    description: "The world's leading brake system manufacturer. OEM for Ferrari, Lamborghini, and dozens of performance vehicles.",
    shipping: "Via dealers",
    highlights: ["OEM for supercars", "GT kits for street/track", "Sport pads & rotors"],
    rating: 4.9,
    tags: ["Universal", "Brakes", "Performance"],
  },
  {
    name: "Stoptech",
    domain: "stoptech.com",
    url: "https://www.stoptech.com",
    specialty: ["Brakes"],
    description: "Performance brake specialists offering slotted rotors, sport pads, big brake kits, and stainless brake lines for all platforms.",
    shipping: "Via dealers",
    highlights: ["Street & track brake kits", "Slotted & drilled rotors", "Wide vehicle coverage"],
    rating: 4.7,
    tags: ["Universal", "Brakes", "Performance"],
  },
  {
    name: "Borla",
    domain: "borla.com",
    url: "https://www.borla.com",
    specialty: ["Exhaust"],
    description: "American-made stainless steel performance exhaust systems. Known for their distinctive sound and million-mile warranty.",
    shipping: "Via dealers",
    highlights: ["Million-mile warranty", "Made in USA", "Catback & axleback options"],
    rating: 4.8,
    tags: ["Universal", "Exhaust", "Performance"],
  },
  {
    name: "Magnaflow",
    domain: "magnaflow.com",
    url: "https://www.magnaflow.com",
    specialty: ["Exhaust"],
    description: "Performance exhaust manufacturer offering catback systems, mufflers, and catalytic converters for street and track.",
    shipping: "Free over $75",
    highlights: ["50-state legal options", "Wide vehicle coverage", "Street & performance line"],
    rating: 4.6,
    tags: ["Universal", "Exhaust"],
  },
  // ── Japanese / JDM ─────────────────────────────────────────────────────────
  {
    name: "HKS",
    domain: "hksusa.com",
    url: "https://www.hksusa.com",
    specialty: ["Performance", "JDM", "Turbo"],
    description: "Legendary Japanese performance brand. Industry-leading turbos, intakes, exhausts, coilovers, and ECU management systems.",
    shipping: "Via dealers",
    highlights: ["60+ years of motorsport heritage", "Turbo & supercharger kits", "GTII & Super Power Flow intakes"],
    rating: 4.9,
    tags: ["JDM", "Honda", "Nissan", "Toyota", "Subaru", "Turbo", "Performance"],
  },
  {
    name: "Tein",
    domain: "tein.com",
    url: "https://www.tein.com",
    specialty: ["Suspension", "JDM"],
    description: "Japanese coilover and spring specialist with exceptional quality and the widest JDM platform fitment.",
    shipping: "Via dealers",
    highlights: ["EDFC electronic damping", "Wide JDM fitment", "Flex Z & Street Advance lineup"],
    rating: 4.7,
    tags: ["JDM", "Suspension", "Coilovers", "Honda", "Toyota", "Nissan"],
  },
  {
    name: "Cusco",
    domain: "cusco.co.jp",
    url: "https://www.cusco.co.jp/en",
    specialty: ["Performance", "JDM", "Suspension"],
    description: "Japanese motorsport manufacturer famous for roll cages, strut bars, LSD differentials, and suspension for all JDM platforms.",
    shipping: "Via dealers",
    highlights: ["Rally & track proven", "LSD differentials", "Chassis bracing & roll cages"],
    rating: 4.8,
    tags: ["JDM", "Subaru", "Honda", "Mitsubishi", "Suspension", "Performance"],
  },
  {
    name: "Tomei Powered",
    domain: "tomeiusa.com",
    url: "https://www.tomeiusa.com",
    specialty: ["Engine", "JDM", "Performance"],
    description: "Japanese engine component specialist known for camshafts, pistons, exhaust manifolds, and the Expreme titanium exhaust line.",
    shipping: "Via dealers",
    highlights: ["Expreme Ti exhaust systems", "Built camshafts & pistons", "Nissan & Toyota specialists"],
    rating: 4.8,
    tags: ["JDM", "Nissan", "Toyota", "Engine", "Exhaust"],
  },
  {
    name: "GReddy / Trust",
    domain: "greddy.com",
    url: "https://www.greddy.com",
    specialty: ["Turbo", "JDM", "Performance"],
    description: "Iconic Japanese tuning brand for turbos, intercoolers, exhausts, and oil coolers. A JDM staple since the 1970s.",
    shipping: "Via dealers",
    highlights: ["Turbo upgrade kits", "Intercooler kits", "Classic JDM brand"],
    rating: 4.6,
    tags: ["JDM", "Turbo", "Honda", "Nissan", "Toyota", "Performance"],
  },
  {
    name: "Blitz",
    domain: "blitz.co.jp",
    url: "https://www.blitz.co.jp/en",
    specialty: ["Turbo", "JDM", "Electronics"],
    description: "Japanese performance brand offering turbos, blow-off valves, intercoolers, and the popular Nur-Spec exhaust line.",
    shipping: "Via dealers",
    highlights: ["Nur-Spec exhaust systems", "Turbo & BOV specialists", "Boost controller systems"],
    rating: 4.6,
    tags: ["JDM", "Turbo", "Exhaust", "Honda", "Nissan", "Subaru"],
  },
  {
    name: "Skunk2 Racing",
    domain: "skunk2.com",
    url: "https://www.skunk2.com",
    specialty: ["Performance", "Honda", "Engine"],
    description: "California-based Honda/Acura specialists making intakes, cams, header, suspension, and engine internals.",
    shipping: "Free over $99",
    highlights: ["Honda/Acura specialists", "Alpha series headers", "Mega Power intake manifolds"],
    rating: 4.7,
    tags: ["Honda", "Acura", "JDM", "Engine", "Performance"],
  },
  {
    name: "K-Tuned",
    domain: "k-tuned.com",
    url: "https://www.k-tuned.com",
    specialty: ["Honda", "Engine", "Performance"],
    description: "Premium Honda K-series and B-series parts for swaps and builds. Race-quality throttle bodies, shifters, and components.",
    shipping: "Free over $100",
    highlights: ["K-swap specialists", "Race-quality throttle bodies", "Shift linkage & cables"],
    rating: 4.8,
    tags: ["Honda", "Acura", "K-Series", "Engine"],
  },
  {
    name: "Hondata",
    domain: "hondata.com",
    url: "https://www.hondata.com",
    specialty: ["Tuning", "Honda", "Electronics"],
    description: "The standard in Honda ECU tuning. FlashPro, KPro, and S300 systems for comprehensive engine management on all Honda/Acura platforms.",
    shipping: "Direct",
    highlights: ["FlashPro for modern Hondas", "KPro for K-series", "Broad Honda ECU support"],
    rating: 4.9,
    tags: ["Honda", "Acura", "Tuning", "ECU"],
  },
  {
    name: "PRL Motorsports",
    domain: "prlmotorsports.com",
    url: "https://www.prlmotorsports.com",
    specialty: ["Honda", "Turbo", "Performance"],
    description: "Florida-based Honda/Acura specialists producing high-quality intakes, intercoolers, downpipes, and turbo kits.",
    shipping: "Free over $150",
    highlights: ["Civic Si/Type R specialists", "Front-mount intercooler kits", "Turbo inlet & downpipes"],
    rating: 4.8,
    tags: ["Honda", "Acura", "Turbo", "Performance"],
  },
  {
    name: "Injen Technology",
    domain: "injen.com",
    url: "https://www.injen.com",
    specialty: ["Intake", "Performance"],
    description: "American intake and exhaust manufacturer with broad coverage across Japanese and domestic vehicles. Known for the SP and RD intake series.",
    shipping: "Free over $75",
    highlights: ["SP & RD intake lines", "Covers 500+ vehicles", "Made in USA"],
    rating: 4.6,
    tags: ["Honda", "Toyota", "Subaru", "Intake", "Universal"],
  },
  {
    name: "AEM Performance",
    domain: "aemintakes.com",
    url: "https://www.aemintakes.com",
    specialty: ["Intake", "Electronics", "Performance"],
    description: "Performance electronics and intake specialists. Known for V2 cold air intakes, water/meth injection kits, and the AEM Infinity ECU.",
    shipping: "Via dealers",
    highlights: ["V2 cold air intakes", "Water/meth injection", "AEM Infinity ECU system"],
    rating: 4.6,
    tags: ["Universal", "Intake", "Electronics", "Performance"],
  },
  // ── Subaru Specialists ──────────────────────────────────────────────────────
  {
    name: "COBB Tuning",
    domain: "cobbtuning.com",
    url: "https://www.cobbtuning.com",
    specialty: ["Tuning", "Subaru", "Performance"],
    description: "The definitive Subaru and Porsche tuning brand. Accessport ECU tuning device, intakes, exhausts, and full stage packages.",
    shipping: "Free over $99",
    highlights: ["Accessport OBD-II tuning", "Stage 1/2/3 power packages", "Subaru & Porsche specialists"],
    rating: 4.9,
    tags: ["Subaru", "Porsche", "Tuning", "ECU", "Performance"],
  },
  {
    name: "Perrin Performance",
    domain: "perrin.com",
    url: "https://www.perrin.com",
    specialty: ["Subaru", "Performance"],
    description: "Pacific Northwest Subaru specialists producing intakes, blow-off valves, suspension, and engine accessories in-house.",
    shipping: "Free over $75",
    highlights: ["Subaru-first development", "Blow-off valve specialists", "Chassis & engine bracing"],
    rating: 4.7,
    tags: ["Subaru", "Performance", "Turbo"],
  },
  {
    name: "GrimmSpeed",
    domain: "grimmspeed.com",
    url: "https://www.grimmspeed.com",
    specialty: ["Subaru", "Performance"],
    description: "Subaru parts manufacturer known for turbo inlets, uppipes, downpipes, and boost control solenoid upgrades.",
    shipping: "Free over $99",
    highlights: ["Turbo inlet specialists", "Uppipe & downpipe kits", "Race-proven parts"],
    rating: 4.7,
    tags: ["Subaru", "Turbo", "Engine"],
  },
  {
    name: "IAG Performance",
    domain: "iagperformance.com",
    url: "https://www.iagperformance.com",
    specialty: ["Subaru", "Engine"],
    description: "Subaru engine builders and specialists. Complete short blocks, long blocks, and supporting hardware for EJ and FA platforms.",
    shipping: "Direct",
    highlights: ["EJ & FA engine builds", "Short block assemblies", "Vetted for high power builds"],
    rating: 4.9,
    tags: ["Subaru", "Engine", "Performance"],
  },
  // ── Ford / American ─────────────────────────────────────────────────────────
  {
    name: "Steeda",
    domain: "steeda.com",
    url: "https://www.steeda.com",
    specialty: ["Ford", "Performance"],
    description: "The number-one Mustang and Ford Focus/Fusion performance brand. Suspension, intakes, exhausts, and tuning for all Mustang generations.",
    shipping: "Free over $99",
    highlights: ["#1 Mustang specialist", "Handling & suspension kits", "Ford Focus RS/ST parts"],
    rating: 4.8,
    tags: ["Ford", "Mustang", "Focus", "Performance"],
  },
  {
    name: "Edelbrock",
    domain: "edelbrock.com",
    url: "https://www.edelbrock.com",
    specialty: ["Engine", "American Muscle"],
    description: "American performance institution. Intake manifolds, carburetors, superchargers, and cylinder heads for domestic V8 platforms.",
    shipping: "Via dealers",
    highlights: ["Legendary intake manifolds", "E-Force supercharger kits", "Small & big block V8 specialists"],
    rating: 4.7,
    tags: ["Chevy", "Ford", "Dodge", "V8", "Engine", "American Muscle"],
  },
  {
    name: "Flowmaster",
    domain: "flowmastermufflers.com",
    url: "https://www.flowmastermufflers.com",
    specialty: ["Exhaust", "American Muscle"],
    description: "Iconic American exhaust brand famous for their chambered muffler technology and aggressive muscle car sound.",
    shipping: "Via dealers",
    highlights: ["Series 40 & 44 mufflers", "American muscle iconic sound", "50-state legal options"],
    rating: 4.6,
    tags: ["Ford", "Chevy", "Dodge", "Exhaust", "American Muscle"],
  },
  {
    name: "Corsa Performance",
    domain: "corsaperformance.com",
    url: "https://www.corsaperformance.com",
    specialty: ["Exhaust"],
    description: "Premium no-drone exhaust systems for Corvette, Camaro, Mustang, and trucks. RSC patented technology eliminates cabin drone.",
    shipping: "Free",
    highlights: ["No-drone RSC technology", "Corvette & Camaro specialists", "Premium sound quality"],
    rating: 4.8,
    tags: ["Chevy", "Ford", "Cadillac", "Exhaust", "American Muscle"],
  },
  {
    name: "Roush Performance",
    domain: "roushperformance.com",
    url: "https://www.roushperformance.com",
    specialty: ["Ford", "Performance", "Supercharger"],
    description: "Ford-specialist performance shop offering supercharger kits, exhausts, cold air intakes, and full vehicle packages for Mustang and F-150.",
    shipping: "Direct / dealer",
    highlights: ["R2300 supercharger kits", "Mustang & F-150 packages", "CARB-certified options"],
    rating: 4.7,
    tags: ["Ford", "Mustang", "F-150", "Supercharger", "Performance"],
  },
  {
    name: "Mountune",
    domain: "mountune.com",
    url: "https://www.mountune.com",
    specialty: ["Ford", "Performance"],
    description: "Official Ford Performance partner producing factory-approved power upgrade kits for Focus ST/RS, Fiesta ST, and Mustang EcoBoost.",
    shipping: "Free over $75",
    highlights: ["Ford-approved warranty retention", "Focus ST/RS specialists", "Intercooler & intake kits"],
    rating: 4.8,
    tags: ["Ford", "Focus", "Fiesta", "EcoBoost", "Performance"],
  },
  // ── GM / Chevy ──────────────────────────────────────────────────────────────
  {
    name: "Lingenfelter Performance",
    domain: "lingenfelter.com",
    url: "https://www.lingenfelter.com",
    specialty: ["GM", "Performance", "Supercharger"],
    description: "Premium GM performance shop building supercharger kits, cam packages, and full engine builds for Corvette, Camaro, and CTS-V.",
    shipping: "Direct",
    highlights: ["Corvette & Camaro specialists", "Supercharger upgrade kits", "Full engine builds"],
    rating: 4.8,
    tags: ["Chevy", "GM", "Corvette", "Camaro", "Performance"],
  },
  {
    name: "American Racing Headers",
    domain: "americanracingheaders.com",
    url: "https://www.americanracingheaders.com",
    specialty: ["Exhaust", "Engine"],
    description: "American-made headers and exhaust systems for GM, Ford, and Chrysler platforms. LS-swap and muscle car specialists.",
    shipping: "Free",
    highlights: ["Made in USA headers", "LS-swap solutions", "Long-tube & shorty headers"],
    rating: 4.6,
    tags: ["Chevy", "Ford", "Dodge", "LS", "Exhaust", "Engine"],
  },
  // ── European ────────────────────────────────────────────────────────────────
  {
    name: "ECS Tuning",
    domain: "ecstuning.com",
    url: "https://www.ecstuning.com",
    specialty: ["European"],
    description: "One of the largest European car parts retailers. Excellent for Audi, BMW, VW, Porsche, and Mercedes OEM and aftermarket parts.",
    shipping: "Free over $49",
    highlights: ["Huge OEM+ selection", "Excellent fitment guarantee", "Lifetime warranty on select parts"],
    rating: 4.7,
    tags: ["Audi", "BMW", "VW", "Porsche", "Mercedes", "European"],
  },
  {
    name: "FCP Euro",
    domain: "fcpeuro.com",
    url: "https://www.fcpeuro.com",
    specialty: ["European"],
    description: "Lifetime replacement guarantee on everything. Premier source for European OEM and OEM+ parts with outstanding customer service.",
    shipping: "Free over $49",
    highlights: ["Lifetime replacement guarantee", "OEM & OEM+ focus", "Excellent return policy"],
    rating: 4.9,
    tags: ["Audi", "BMW", "Volvo", "Mercedes", "European"],
  },
  {
    name: "APR",
    domain: "goapr.com",
    url: "https://www.goapr.com",
    specialty: ["Performance", "Tuning"],
    description: "Industry-leading ECU tune developer for VW/Audi Group vehicles. Also manufactures intakes, intercoolers, exhausts, and suspension.",
    shipping: "Free (dealer network)",
    highlights: ["Industry-leading ECU tunes", "Full stage kit packages", "Nationwide dealer network"],
    rating: 4.9,
    tags: ["Audi", "VW", "Porsche", "Tuning", "ECU", "European"],
  },
  {
    name: "034Motorsport",
    domain: "034motorsport.com",
    url: "https://www.034motorsport.com",
    specialty: ["Performance", "European"],
    description: "Premium Audi/VW performance parts manufacturer. Renowned for solid motor mounts, dynamic+ suspension, and intake systems.",
    shipping: "Calculated",
    highlights: ["In-house engineering", "Audi/VW specialists", "Density line motor mounts"],
    rating: 4.8,
    tags: ["Audi", "VW", "European", "Performance"],
  },
  {
    name: "COBB Tuning (Porsche)",
    domain: "cobbtuning.com",
    url: "https://www.cobbtuning.com/porsche",
    specialty: ["Tuning", "Porsche"],
    description: "Accessport tuning for 911, Cayman, Boxster, Macan, and Cayenne. Stage 1 through Stage 3 power packages with full hardware support.",
    shipping: "Free over $99",
    highlights: ["Accessport OBD-II device", "Porsche stage packages", "Porsche ECU specialists"],
    rating: 4.9,
    tags: ["Porsche", "Tuning", "ECU"],
  },
  {
    name: "Unitronic",
    domain: "unitronic.ca",
    url: "https://www.unitronic.ca",
    specialty: ["Tuning"],
    description: "Canadian ECU and DSG tune specialists for VW/Audi Group. Tune stacking and hardware support packages.",
    shipping: "Calculated",
    highlights: ["ECU + DSG tune packages", "Tune stacking support", "Strong community"],
    rating: 4.8,
    tags: ["Audi", "VW", "Tuning", "DSG", "European"],
  },
  {
    name: "CTS Turbo",
    domain: "ctsturbo.com",
    url: "https://www.ctsturbo.com",
    specialty: ["Turbo", "Performance"],
    description: "Turbo upgrade kits, intakes, intercoolers, and supporting mods for VW/Audi MQB and MLB platforms.",
    shipping: "Free over $150",
    highlights: ["IS38 hybrid turbos", "MQB intake specialists", "Intercooler kits"],
    rating: 4.6,
    tags: ["Audi", "VW", "GTI", "Golf R", "Turbo", "European"],
  },
  // ── Nissan / Infiniti ───────────────────────────────────────────────────────
  {
    name: "Z1 Motorsports",
    domain: "z1motorsports.com",
    url: "https://www.z1motorsports.com",
    specialty: ["Nissan", "Performance"],
    description: "Dedicated Nissan Z, 370Z, 350Z, G35, G37, and GTR specialists offering exhausts, intakes, turbos, and built engines.",
    shipping: "Free over $99",
    highlights: ["370Z & 350Z specialists", "GTR performance parts", "VQ & VR38 engine experts"],
    rating: 4.8,
    tags: ["Nissan", "Infiniti", "350Z", "370Z", "GTR", "Performance"],
  },
  {
    name: "JWT (Jim Wolf Technology)",
    domain: "jimwolftech.com",
    url: "https://www.jimwolftech.com",
    specialty: ["Nissan", "Engine", "Tuning"],
    description: "Nissan engine and ECU specialists with decades of motorsport history. Cams, ECU tuning, and engine components for SR20, RB, VQ.",
    shipping: "Via dealers",
    highlights: ["Nissan ECU specialists", "Camshaft experts", "Motorsport proven"],
    rating: 4.7,
    tags: ["Nissan", "Tuning", "Engine", "JDM"],
  },
  // ── Toyota / Lexus ──────────────────────────────────────────────────────────
  {
    name: "TRD (Toyota Racing Development)",
    domain: "toyota.com/trdparts",
    url: "https://www.toyota.com/configurator/api/lexicon/models/trdparts",
    specialty: ["Toyota", "Performance"],
    description: "Toyota's official performance division. Supra, GR86, and Camry TRD parts backed by Toyota's engineering and warranty.",
    shipping: "Via dealers",
    highlights: ["Factory warranty retention", "GR86 & Supra specialists", "OEM fit & finish"],
    rating: 4.7,
    tags: ["Toyota", "Supra", "GR86", "Performance"],
  },
  {
    name: "Verus Engineering",
    domain: "verus-engineering.com",
    url: "https://www.verus-engineering.com",
    specialty: ["Toyota", "Aerodynamics", "Performance"],
    description: "Motorsport-derived aerodynamics and handling parts for GR86, BRZ, and Subaru. Front splitters, wings, canards engineered for downforce.",
    shipping: "Free over $99",
    highlights: ["Track-tested aero kits", "GR86 & BRZ specialists", "Splitters, wings & diffusers"],
    rating: 4.8,
    tags: ["Toyota", "Subaru", "GR86", "BRZ", "Aerodynamics"],
  },
  // ── Mitsubishi / DSM ────────────────────────────────────────────────────────
  {
    name: "EVO X Parts",
    domain: "evoxparts.com",
    url: "https://www.evoxparts.com",
    specialty: ["Mitsubishi", "Performance"],
    description: "Mitsubishi Lancer Evolution specialists stocking suspension, engine, turbo, and exterior parts for all EVO generations.",
    shipping: "Free over $99",
    highlights: ["EVO generation specialists", "Engine & turbo upgrades", "Rally-inspired parts"],
    rating: 4.6,
    tags: ["Mitsubishi", "EVO", "Lancer", "Performance", "JDM"],
  },
  // ── Diesel & Truck ──────────────────────────────────────────────────────────
  {
    name: "Banks Power",
    domain: "bankspower.com",
    url: "https://www.bankspower.com",
    specialty: ["Diesel", "Truck"],
    description: "America's most powerful diesel and gas engine power systems. Monster exhaust, intakes, and intercoolers for Ford, Chevy, and Dodge diesel trucks.",
    shipping: "Free over $149",
    highlights: ["Diesel power specialists", "iDash data monitor", "Sidewinder turbo systems"],
    rating: 4.7,
    tags: ["Ford", "Chevy", "Dodge", "Diesel", "Truck"],
  },
  {
    name: "Rough Country",
    domain: "roughcountry.com",
    url: "https://www.roughcountry.com",
    specialty: ["Truck", "Off-Road", "Suspension"],
    description: "Budget-friendly lift kits, leveling kits, and off-road accessories for trucks and SUVs. Covering Ford, GM, Jeep, and RAM.",
    shipping: "Free",
    highlights: ["Affordable lift kits", "Wide truck coverage", "Lights & accessories"],
    rating: 4.4,
    tags: ["Ford", "Chevy", "Jeep", "Dodge", "Truck", "Off-Road"],
  },
  {
    name: "Icon Vehicle Dynamics",
    domain: "iconvehicledynamics.com",
    url: "https://www.iconvehicledynamics.com",
    specialty: ["Truck", "Off-Road", "Suspension"],
    description: "Premium off-road suspension specialist for trucks, SUVs, and off-road vehicles. Coilovers, UCA kits, and billet components.",
    shipping: "Via dealers",
    highlights: ["Billet aluminum construction", "Coilover & UCA kits", "Tacoma & 4Runner specialists"],
    rating: 4.8,
    tags: ["Toyota", "Ford", "GM", "Truck", "Off-Road", "Suspension"],
  },
  // ── Wheels & Tires ─────────────────────────────────────────────────────────
  {
    name: "Discount Tire",
    domain: "discounttire.com",
    url: "https://www.discounttire.com",
    specialty: ["Tires", "Wheels"],
    description: "America's largest independent tire and wheel retailer. Price match, free flat repair for life, and installation at 1000+ locations.",
    shipping: "Free to store",
    highlights: ["Free flat repair for life", "Price match guarantee", "1000+ US locations"],
    rating: 4.7,
    tags: ["Tires", "Wheels", "Universal"],
  },
  {
    name: "Enkei Wheels",
    domain: "enkei.com",
    url: "https://www.enkei.com",
    specialty: ["Wheels"],
    description: "Japanese wheel manufacturer trusted by OEMs and motorsport teams. RPF1, RS05RR, and PF07 are track-proven lightweights.",
    shipping: "Via dealers",
    highlights: ["RPF1 lightweight forged", "JWL & VIA certified", "OEM motorsport supplier"],
    rating: 4.8,
    tags: ["Wheels", "Universal", "JDM", "Track"],
  },
  {
    name: "Volk Racing (Rays)",
    domain: "rayswheels.com",
    url: "https://www.rayswheels.com",
    specialty: ["Wheels", "Premium"],
    description: "The pinnacle of Japanese wheel engineering. TE37, CE28, and G25 are benchmark lightweight forged wheels for track and street.",
    shipping: "Via dealers",
    highlights: ["TE37 iconic design", "RAYS proprietary forging", "Motorsport championship pedigree"],
    rating: 4.9,
    tags: ["Wheels", "Universal", "JDM", "Premium", "Track"],
  },
  {
    name: "BBS Wheels",
    domain: "bbs.com",
    url: "https://www.bbs.com",
    specialty: ["Wheels", "Premium"],
    description: "German-engineered premium wheels trusted by F1 and OEM manufacturers. The RS, RI-A, and CH-R lines are iconic.",
    shipping: "Via dealers",
    highlights: ["F1 & OEM supplier", "RS classic design", "Forged & flow-formed options"],
    rating: 4.9,
    tags: ["Wheels", "Universal", "European", "Premium"],
  },
  // ── Electronics & Audio ─────────────────────────────────────────────────────
  {
    name: "Crutchfield",
    domain: "crutchfield.com",
    url: "https://www.crutchfield.com",
    specialty: ["Audio", "Electronics"],
    description: "America's top car audio and electronics retailer. Detailed fitment guides and lifetime tech support with every purchase.",
    shipping: "Free",
    highlights: ["Free lifetime tech support", "Detailed install guides", "Wide vehicle coverage"],
    rating: 4.8,
    tags: ["Audio", "Electronics", "Universal"],
  },
  {
    name: "Pioneer Electronics",
    domain: "pioneerelectronics.com",
    url: "https://www.pioneerelectronics.com",
    specialty: ["Audio", "Electronics"],
    description: "Industry-leading car audio and head unit manufacturer. AVH and DMH series double-DINs are the go-to aftermarket upgrade.",
    shipping: "Via dealers",
    highlights: ["Industry-leading head units", "Apple CarPlay & Android Auto", "Wide vehicle fitment"],
    rating: 4.7,
    tags: ["Audio", "Electronics", "Universal"],
  },
];

export default function VendorsPage() {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("All");

  const allTags = ["All", "Universal", "JDM", "European", "American Muscle", "Honda", "Subaru", "Toyota", "Nissan", "Ford", "Chevy", "Porsche", "Truck", "Off-Road", "Turbo", "Suspension", "Brakes", "Exhaust", "Wheels", "Tires", "Tuning", "Audio"];

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
          {VENDORS.length} trusted sources for performance parts, OEM replacements, and upgrades
        </p>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors…"
            className="pl-8"
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
