interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <img
      className={`brand-logo ${compact ? 'brand-logo--compact' : ''}`}
      src={`${import.meta.env.BASE_URL}brand/relationship-training-logo.svg`}
      alt=""
      aria-hidden="true"
    />
  );
}
