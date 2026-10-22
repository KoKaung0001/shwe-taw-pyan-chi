type BrandWordmarkProps = {
  className?: string;
  inline?: boolean;
};

export function BrandWordmark({ className = '', inline = false }: BrandWordmarkProps) {
  return (
    <span className={`brand-wordmark${inline ? ' brand-wordmark-inline' : ''} ${className}`.trim()}>
      <span className="brand-wordmark-blue">Shwe Taw</span>{' '}
      <span className="brand-wordmark-purple">Pyan Chi</span>
    </span>
  );
}
