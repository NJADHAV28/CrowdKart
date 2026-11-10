import { useState } from 'react';

/**
 * Left-hand welcome panel of the desktop Login screen.
 * Figma: file hSPCnVwtsuMN4rrYEWRcSm, node 5:912 ("Welcome panel", 640 x 1000).
 * Shown from the `lg` breakpoint up; phones keep the existing dark hero header in Login.jsx.
 *
 * Photo: export Figma node 5:916 ("Community") as client/public/community.jpg
 * (until then a soft gradient is shown).
 */
export default function WelcomePanel({ className = '', image = './community.jpg' }) {
  const [broken, setBroken] = useState(false);

  return (
    <aside className={`flex-col bg-navy px-16 pb-16 pt-14 font-display text-white ${className}`}>
      <p className="text-[28px] font-bold leading-[1.45]">CrowdKart</p>

      <h1 className="mt-[135px] max-w-[520px] text-[54px] font-bold leading-[1.45]">
        Your community.<br />Your advantage.
      </h1>

      <p className="mt-11 text-xl font-medium leading-[1.45] text-lilac">Buy Together. Save More.</p>

      <div className="mt-[75px] h-[280px] w-full max-w-[512px] overflow-hidden rounded-2xl">
        {broken ? (
          <div className="h-full w-full bg-gradient-to-br from-white/15 to-white/5" aria-hidden="true" />
        ) : (
          <img
            src={image}
            alt="Students sharing a table and planning a group order"
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        )}
      </div>

      <p className="mt-10 text-base leading-[1.45] text-mist">Better deals begin with better company.</p>
    </aside>
  );
}
