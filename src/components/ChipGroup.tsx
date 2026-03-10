interface ChipOption {
  value: string;
  label: string;
  icon?: string;
}

interface ChipGroupProps {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (val: string) => void;
}

export function ChipGroup({ label, options, value, onChange }: ChipGroupProps) {
  return (
    <div className="mb-2.5">
      <label className="block font-mono text-[9px] tracking-[1.5px] uppercase text-muted-foreground mb-1.5">{label}</label>
      <div className="flex gap-1 flex-wrap">
        {options.map(opt => {
          const isOn = opt.value === value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`flex-1 min-w-[52px] bg-card border rounded-sm font-mono text-[9px] tracking-[0.5px] py-1.5 px-0.5 cursor-pointer transition-all duration-200 text-center flex flex-col items-center gap-0.5 select-none relative overflow-hidden
                ${isOn
                  ? 'bg-primary/[0.06] border-primary text-primary shadow-[0_0_12px_hsl(var(--neon-dim)/0.07),inset_0_0_12px_hsl(var(--neon-dim)/0.07)]'
                  : 'border-border2 text-muted-foreground hover:border-primary hover:text-primary hover:shadow-[0_0_10px_hsl(var(--neon-dim)/0.07),inset_0_0_10px_hsl(var(--neon-dim)/0.07)]'
                }`}
            >
              {opt.icon && <span className="text-[13px]" style={{ filter: 'drop-shadow(0 0 4px hsl(var(--primary)))' }}>{opt.icon}</span>}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
