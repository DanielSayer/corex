type MedalProps = {
  color: string;
  glow: string;
  label: string;
  ring: string;
};

function Medal({ color, glow, label, ring }: MedalProps) {
  const uid = `medal-${label.replace(/\W/g, "")}`;
  const fontSize = label.length > 2 ? 17 : 21;

  return (
    <svg
      className="h-14 w-14 transition-all duration-300"
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={`bg-${uid}`} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={`${color}cc`} stopOpacity="1" />
        </radialGradient>
        <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur result="blur" stdDeviation="2.5" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle
        cx="40"
        cy="40"
        r="37"
        fill="none"
        stroke={glow}
        strokeWidth="6"
      />
      <circle
        cx="40"
        cy="40"
        r="34"
        fill="none"
        stroke={ring}
        strokeWidth="2.5"
      />
      <circle cx="40" cy="40" r="31" fill={`url(#bg-${uid})`} />
      <circle
        cx="40"
        cy="40"
        r="26"
        fill="none"
        stroke={ring}
        strokeOpacity="0.5"
        strokeWidth="0.75"
      />
      <text
        dominantBaseline="middle"
        fill="white"
        fontFamily="system-ui, sans-serif"
        fontSize={fontSize}
        fontWeight="800"
        letterSpacing="-0.5"
        textAnchor="middle"
        x="40"
        y="41"
      >
        {label}
      </text>
    </svg>
  );
}

export { Medal };
