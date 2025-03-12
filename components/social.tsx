import Image from 'next/image';
import { useState, useEffect } from 'react';


export default function Social() {


  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-white text-2xl font-bold mb-4 font-[Poppins] tracking-wider uppercase relative after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-16 after:h-1 after:bg-green-500 after:rounded-full">Creators</h2>
      <div className="flex gap-6">
        <a href="https://x.com/aybarsgngrms" target="_blank" rel="noopener noreferrer" className="rounded-full overflow-hidden w-16 h-16 hover:scale-110 transition-transform group relative">
          <Image
            src="/social/kandor.jpg" 
            alt="kandor"
            width={64}
            height={64}
            className="object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            kandor
          </span>
        </a>
        <a href="https://x.com/0xSabotsuke" target="_blank" rel="noopener noreferrer" className="rounded-full overflow-hidden w-16 h-16 hover:scale-110 transition-transform group relative">
          <Image
            src="/social/sabo.jpg"
            alt="sabo" 
            width={64}
            height={64}
            className="object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            sabo
          </span>
        </a>
        <a href="https://x.com/immaUF" target="_blank" rel="noopener noreferrer" className="rounded-full overflow-hidden w-16 h-16 hover:scale-110 transition-transform group relative">
          <Image
            src="/social/imma.jpg"
            alt="imma"
            width={64}
            height={64}
            className="object-cover" 
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            imma
          </span>
        </a>
        <a href="https://x.com/blocashmain" target="_blank" rel="noopener noreferrer" className="rounded-full overflow-hidden w-16 h-16 hover:scale-110 transition-transform group relative">
          <Image
            src="/social/blocash.jpg"
            alt="blocash"
            width={64}
            height={64}
            className="object-cover" 
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            blocash
          </span>
        </a>
      </div>
      
    </div>
  );
}