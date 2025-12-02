"use client";

import Image from 'next/image';
import { useEffect, useState } from 'react';

// Images located in /public/dishes
const dishes = [
  "Aglio_Olio.png",
  "American_Fried_Chicken.png",
  "Baby_Back_Ribs.png",
  "Bulalo.png",
  "Carbonara.png",
  "Ceasar_Salad.png",
  "Chicken_Sandwich.png",
  "Clubhouse_Sandwich.png",
  "Crispy_Mascara.png",
  "Fresh_lumpia.png",
  "Gambas.png",
  "Garden_Salad.png",
  "Grilled_Garlic_Pork.png",
  "Hot_Chili_Wings.png",
  "Isaw.png",
  "Italian_Fish_Fillet.png",
  "Joanna's_Full_House_Salad.png",
  "Lasagna.png",
  "Nachos.png",
  "Pork_Sisig.png",
  "Seafood_Marinara.png",
  "Sizzling_Bulalo.png",
  "Sizzling_Tuna_Belly.png",
  "Tuna_Spread_Sandwich.png",
];

function formatDishName(filename) {
  const name = filename.replace(/\.[^.]+$/,'');
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function CafeCarousel({ heightClass = 'h-80 md:h-96' }) {
  const [idx, setIdx] = useState(0);
  const [prevIdx, setPrevIdx] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [animPhase, setAnimPhase] = useState(false);

  const TRANSITION_MS = 700;

  // helper to change slide with cross-fade
  const showIndex = (newIdx) => {
    if (newIdx === idx) return;
    setPrevIdx(idx);
    setIdx(newIdx);
    setAnimating(true);
  };

  useEffect(() => {
    if (!animating) return;
    // start the fade on next frame so CSS transition will run
    const raf = requestAnimationFrame(() => setAnimPhase(true));
    const t = setTimeout(() => {
      setPrevIdx(null);
      setAnimating(false);
      setAnimPhase(false);
    }, TRANSITION_MS);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [animating]);

  useEffect(() => {
    const interval = setInterval(() => showIndex((idx + 1) % dishes.length), 4000);
    return () => clearInterval(interval);
  }, [idx]);

  const prev = () => showIndex((idx - 1 + dishes.length) % dishes.length);
  const next = () => showIndex((idx + 1) % dishes.length);

  return (
    <div className="w-full">
      <div className="relative rounded-lg overflow-hidden shadow-lg bg-white">
        <div className={`relative w-full ${heightClass} flex items-center justify-center bg-gray-50 p-2`}>
          {/* Previous slide (fades out) */}
          {prevIdx !== null && (
            <Image
              src={`/dishes/${dishes[prevIdx]}`}
              alt={formatDishName(dishes[prevIdx])}
              fill
              className={`object-contain absolute inset-0 transition-opacity duration-700 ${animating ? (animPhase ? 'opacity-0' : 'opacity-100') : 'opacity-0'}`}
              sizes="(max-width: 768px) 100vw, 800px"
              priority={false}
            />
          )}

          {/* Current slide (fades in) */}
          <Image
            src={`/dishes/${dishes[idx]}`}
            alt={formatDishName(dishes[idx])}
            fill
            className={`object-contain absolute inset-0 transition-opacity duration-700 ${animating ? (animPhase ? 'opacity-100' : 'opacity-0') : 'opacity-100'}`}
            sizes="(max-width: 768px) 100vw, 800px"
            priority={idx === 0}
          />

          {/* Caption */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 z-20">
            <div className="text-white text-lg md:text-2xl font-semibold">{formatDishName(dishes[idx])}</div>
          </div>
        </div>

        <button onClick={prev} aria-label="Previous" className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white p-2 rounded-full">
          ‹
        </button>
        <button onClick={next} aria-label="Next" className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/60 hover:bg-white p-2 rounded-full">
          ›
        </button>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-30">
          {dishes.map((d, i) => (
            <button key={d} onClick={() => showIndex(i)} className={`w-2 h-2 rounded-full ${i === idx ? 'bg-white' : 'bg-white/50'}`} aria-label={`Show ${formatDishName(d)}`}></button>
          ))}
        </div>
      </div>
    </div>
  );
}
